const express=require('express');
const router=express.Router();
const User = require('../model/user-model');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const Donation = require('../model/donation-model');
const Coupon = require('../model/coupon-model');
router.get('/', async(req, res) => {
const token = req.cookies.token;
  let user = null;
  let userData=null;
  if (token) {
    try {
        user = jwt.verify(token, process.env.JWT_SECRET);
        console.log(user)
        userData= await User.findById(user.id)
        console.log(userData)
    } catch (err) {
      console.log("Invalid token");
    }
  }

  res.render("index", { userData });
});

// Donor donations & rewards page
router.get('/donations', async (req, res) => {
  try {
    const token = req.cookies.token;
    if (!token) return res.redirect('/');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || user.role !== 'donor') return res.status(403).send('Forbidden');

    const donations = await Donation.find({ donor: user._id }).sort({ createdAt: -1 }).lean();
    // compute points: 1 point per ₹100 for monetary donations, 1 point per food donation
    const moneyPoints = donations.filter(d=>d.type==='monetary').reduce((s,d)=>s + (d.amount?Math.floor(d.amount/100):0),0);
    const foodPoints = donations.filter(d=>d.type==='food').length;
    const totalPoints = moneyPoints + foodPoints;
    // load redeemed coupons for this donor
    const coupons = await Coupon.find({ donor: user._id }).sort({ issuedAt: -1 }).lean();
    res.render('donations', { donations, totalPoints, coupons });
  } catch (err) {
    console.error(err);
    res.redirect('/');
  }
});

// Redeem endpoint: create a coupon if donor has points
router.post('/redeem', async (req, res) => {
  try {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: 'Not authenticated' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || user.role !== 'donor') return res.status(403).json({ error: 'Forbidden' });

    const { restaurantId, restaurantName } = req.body;
    // recompute points and used coupons
    const donations = await Donation.find({ donor: user._id }).lean();
    const moneyPoints = donations.filter(d=>d.type==='monetary').reduce((s,d)=>s + (d.amount?Math.floor(d.amount/100):0),0);
    const foodPoints = donations.filter(d=>d.type==='food').length;
    const totalPoints = moneyPoints + foodPoints;
    const redeemedCount = await Coupon.countDocuments({ donor: user._id });
    const available = totalPoints - redeemedCount;
    if (available < 1) return res.status(400).json({ error: 'Not enough points' });

    // generate code and save
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i=0;i<8;i++) code += chars.charAt(Math.floor(Math.random()*chars.length));
    code = 'FB-' + code;

  const coupon = new Coupon({ code, donor: user._id, restaurantId, restaurantName });
  await coupon.save();
  // recompute redeemed after save
  const redeemedCountAfter = await Coupon.countDocuments({ donor: user._id });
  const availableAfter = totalPoints - redeemedCountAfter;
  res.json({ success: true, code, restaurantName, remaining: availableAfter });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to redeem' });
  }
});

// Handle monetary donation form
router.post('/donate/money', async (req, res) => {
  try {
    const token = req.cookies.token;
    if (!token) return res.redirect('/');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || user.role !== 'donor') return res.status(403).send('Forbidden');

    const { name, address, amount } = req.body;
    const donation = new Donation({
      donor: user._id,
      type: 'monetary',
      amount: Number(amount) || 0,
      address,
    });
    await donation.save();
    res.redirect('/donations');
  } catch (err) {
    console.error(err);
    res.redirect('/');
  }
});

// Handle food donation form
router.post('/donate/food', async (req, res) => {
  try {
    const token = req.cookies.token;
    if (!token) return res.redirect('/');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || user.role !== 'donor') return res.status(403).send('Forbidden');

    const { name, address, foodType, foodItem, quantity, phone } = req.body;
    const donation = new Donation({
      donor: user._id,
      type: 'food',
      foodItem,
      quantity: Number(quantity) || 1,
      address,
      phone,
    });
    await donation.save();
    res.redirect('/donations');
  } catch (err) {
    console.error(err);
    res.redirect('/');
  }
});

// /routes/auth.js

router.post('/registrationUser', async (req, res) => {
  const {  email, password, role } = req.body;
  const name = req.body.fullname
  console.log(req.body);

  try {
    // Check if user already exists
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).send('User already exists');
    }

    // Create new user
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword, role });
    await user.save();

    // // Send welcome email
    // const transporter = nodemailer.createTransport({
    //   service: 'gmail',
    //   auth: {
    //     user: process.env.EMAIL_USER,
    //     pass: process.env.EMAIL_PASS,
    //   },
    // });

    // await transporter.sendMail({
    //   from: `"Food Donor" <${process.env.EMAIL_USER}>`,
    //   to: email,
    //   subject: 'Welcome to Food Donor',
    //   text: `Hello ${name}, thank you for joining as a ${role}.`,
    // });

    // Generate JWT token
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: '1d',
    });

    // Set token as HTTP-only cookie
    res.cookie('token', token, { httpOnly: true, secure: false }); 
    res.redirect('/'); 

  } catch (err) {
    console.error(err);
    res.status(500).send('Registration failed.');
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).send('Invalid email or password');
    }

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.cookie('token', token, { httpOnly: true });
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.status(500).send('Login failed.');
  }
});
router.get("/logout", (req, res) => {
  res.clearCookie("token");
  res.redirect("/");
});

module.exports=router;