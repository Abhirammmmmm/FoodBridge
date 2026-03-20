const express=require('express');
const router=express.Router();
const User = require('../model/user-model');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const Donation = require('../model/donation-model');
const Coupon = require('../model/coupon-model');
const transporter = require("../config/mailer");



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
router.post("/registrationUser", async (req, res) => {
  const email = (req.body.email || "").trim().toLowerCase();
  const password = req.body.password || "";
  const role = req.body.role || "donor";
  const name = (req.body.fullname || "").trim();

  console.log("Register:", { email, name, role });

  try {
    // 1️⃣ Check if user already exists
    const existing = await User.findOne({ email });
    if (existing) {
      return res
        .status(400)
        .json({ success: false, message: "User already exists" });
    }

    // 2️⃣ Create new user
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword, role });
    await user.save();

    // 3️⃣ Generate JWT token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    // 4️⃣ Set token as HTTP-only cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });

    // 5️⃣ Send Welcome Email
    const mailOptions = {
      from: `"Food Bridge" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Welcome "+name,
      html: `
     <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Welcome to FoodBridge</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f9fafb; padding: 20px; color: #333;">
  <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); padding: 30px;">
    
    <div style="text-align: center;">
      <h2 style="color: #2E8B57;">🌟 Welcome to FoodBridge — Thank You for Joining Us!</h2>
    </div>
    
    <p>Dear ${name},</p>

    <p>Thank you for joining <strong>FoodBridge</strong> — we’re thrilled to have you as part of our mission to reduce food waste and fight hunger. 🌍✨</p>

    <p>By being part of FoodBridge, you’re helping connect surplus food to people in need through our network of donors and NGOs. Every meal you share brings hope and happiness to someone’s day. 🍱❤️</p>

    <p><strong>Here’s what you can look forward to:</strong></p>
    <ul>
      <li>Easy food donations and pickups through our platform.</li>
      <li>Real-time GPS tracking and updates.</li>
      <li>A transparent system ensuring food reaches those who need it most.</li>
      <li>Exciting rewards and recognition for your contributions.</li>
    </ul>

    <p>Together, we can make sure no food goes to waste and no one sleeps hungry.</p>

    <p>Thank you once again for being a part of <strong>FoodBridge</strong> — where compassion meets technology.</p>

    <p style="margin-top: 30px;">Warm regards,<br>
    <strong>The FoodBridge Team</strong></p>

    <hr style="margin-top: 40px; border: none; border-top: 1px solid #ddd;">
    <p style="font-size: 12px; color: #777; text-align: center;">
      ©️ 2025 FoodBridge. All rights reserved. | This is an automated message — please do not reply.
    </p>
  </div>
</body>
</html>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`✅ Welcome email sent to ${email}`);
    } catch (mailErr) {
      console.error("❌ Failed to send welcome email:", mailErr.message);
    }

    // 6️⃣ Respond to client
    res.json({ success: true, redirect: "/" });
  } catch (err) {
    console.error("❌ Registration Error:", err);
    res.status(500).send("Registration failed.");
  }
});

router.post('/login', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';
  console.log('Login attempt for:', email);

  try {
    const user = await User.findOne({ email });
    if (!user) {
      if (req.xhr || (req.headers.accept || '').includes('application/json')) return res.status(400).json({ success: false, message: 'Invalid email or password' });
      return res.status(400).send('Invalid email or password');
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      if (req.xhr || (req.headers.accept || '').includes('application/json')) return res.status(400).json({ success: false, message: 'Invalid email or password' });
      return res.status(400).send('Invalid email or password');
    }

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
    if (req.xhr || (req.headers.accept || '').includes('application/json')) return res.json({ success: true, redirect: '/' });
    res.redirect('/');
  } catch (err) {
    console.error('Login error:', err);
    if (req.xhr || (req.headers.accept || '').includes('application/json')) return res.status(500).json({ success: false, message: 'Login failed' });
    res.status(500).send('Login failed.');
  }
});
router.get("/logout", (req, res) => {
  res.clearCookie("token");
  res.redirect("/");
});



// NGO donations page - show both available and accepted food donations
router.get("/donationsNGO", async(req, res) => {
    try {
        const token = req.cookies.token;
        if (!token) return res.redirect('/');
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        
        if (!user || user.role !== 'ngo') return res.status(403).send('Forbidden');

        // Get all available food donations
        const availableDonations = await Donation.find({
            type: 'food',
            status: 'available'
        }).sort({ createdAt: -1 }).lean();

        // Get accepted donations by this NGO
        const acceptedDonations = await Donation.find({
            type: 'food',
            status: 'accepted',
            acceptedBy: user._id,
            // Only show accepted donations that aren't past their completion date
            acceptedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Within last 24 hours
        }).sort({ acceptedAt: -1 }).lean();

        // Add expected completion date (24 hours after acceptance)
        acceptedDonations.forEach(donation => {
            donation.expectedCompletionDate = new Date(donation.acceptedAt);
            donation.expectedCompletionDate.setDate(donation.expectedCompletionDate.getDate() + 1);
        });

        res.render("ngoDonations", { availableDonations, acceptedDonations });
    } catch (err) {
        console.error(err);
        res.redirect('/');
    }
});

// Handle donation acceptance
router.post('/accept-donation', async (req, res) => {
    try {
        const token = req.cookies.token;
        if (!token) return res.status(401).json({ message: 'Not authenticated' });
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        
        if (!user || user.role !== 'ngo') {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const { donationId } = req.body;
        const donation = await Donation.findById(donationId);
        
        if (!donation) {
            return res.status(404).json({ message: 'Donation not found' });
        }

        if (donation.status !== 'available') {
            return res.status(400).json({ message: 'Donation is no longer available' });
        }

        // Update donation status
        donation.status = 'accepted';
        donation.acceptedBy = user._id;
        donation.acceptedAt = new Date();
        donation.expectedCompletionDate = new Date(donation.acceptedAt);
        donation.expectedCompletionDate.setDate(donation.expectedCompletionDate.getDate() + 1);
        await donation.save();

        // Send email notifications to donor and NGO
        const donor = await User.findById(donation.donor);
        
        // Email to donor
        const donorMail = {
            from: `"FoodBridge" <${process.env.EMAIL_USER}>`,
            to: donor.email,
            subject: "Your Food Donation Has Been Accepted",
            html: `
                <h2>Your Food Donation Has Been Accepted!</h2>
                <p>Dear ${donor.name},</p>
                <p>Your food donation of ${donation.quantity} ${donation.foodItem} has been accepted by ${user.name} (NGO).</p>
                <p>They will contact you at: ${donation.phone}</p>
                <p>Donation Address: ${donation.address}</p>
                <p>Thank you for making a difference!</p>
            `
        };

        // Email to NGO
        const ngoMail = {
            from: `"FoodBridge" <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: "Food Donation Acceptance Confirmation",
            html: `
                <h2>Food Donation Acceptance Confirmation</h2>
                <p>Dear ${user.name},</p>
                <p>You have successfully accepted a food donation:</p>
                <ul>
                    <li>Item: ${donation.foodItem}</li>
                    <li>Quantity: ${donation.quantity}</li>
                    <li>Donor Contact: ${donation.phone}</li>
                    <li>Pickup Address: ${donation.address}</li>
                </ul>
                <p>Please contact the donor to arrange pickup.</p>
            `
        };

        await Promise.all([
            transporter.sendMail(donorMail),
            transporter.sendMail(ngoMail)
        ]);

        res.json({ success: true });
    } catch (err) {
        console.error('Error accepting donation:', err);
        res.status(500).json({ message: 'Failed to accept donation' });
    }
});

// Handle donation completion
router.post('/complete-donation', async (req, res) => {
    try {
        const token = req.cookies.token;
        if (!token) return res.status(401).json({ message: 'Not authenticated' });
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        
        if (!user || user.role !== 'ngo') {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const { donationId } = req.body;
        const donation = await Donation.findById(donationId);
        
        if (!donation) {
            return res.status(404).json({ message: 'Donation not found' });
        }

        if (donation.status !== 'accepted') {
            return res.status(400).json({ message: 'Donation is not in accepted state' });
        }

        if (donation.acceptedBy.toString() !== user._id.toString()) {
            return res.status(403).json({ message: 'This donation was accepted by a different NGO' });
        }

        // Update donation status
        donation.status = 'completed';
        donation.completedAt = new Date();
        await donation.save();

        // Send completion confirmation emails
        const donor = await User.findById(donation.donor);
        
        // Email to donor
        const donorMail = {
            from: `"FoodBridge" <${process.env.EMAIL_USER}>`,
            to: donor.email,
            subject: "Your Food Donation Has Been Completed",
            html: `
                <h2>Your Food Donation Has Been Successfully Completed!</h2>
                <p>Dear ${donor.name},</p>
                <p>Your food donation of ${donation.quantity} ${donation.foodItem} has been successfully completed by ${user.name} (NGO).</p>
                <p>Thank you for your generous contribution to our community!</p>
                <p>Want to donate again? Visit FoodBridge to make another donation.</p>
            `
        };

        // Email to NGO
        const ngoMail = {
            from: `"FoodBridge" <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: "Food Donation Completion Confirmation",
            html: `
                <h2>Food Donation Successfully Completed</h2>
                <p>Dear ${user.name},</p>
                <p>You have successfully completed the food donation:</p>
                <ul>
                    <li>Item: ${donation.foodItem}</li>
                    <li>Quantity: ${donation.quantity}</li>
                    <li>Completion Date: ${new Date().toLocaleDateString()}</li>
                </ul>
                <p>Thank you for your service to the community!</p>
            `
        };

        await Promise.all([
            transporter.sendMail(donorMail),
            transporter.sendMail(ngoMail)
        ]);

        res.json({ success: true });
    } catch (err) {
        console.error('Error completing donation:', err);
        res.status(500).json({ message: 'Failed to complete donation' });
    }
});
module.exports=router;