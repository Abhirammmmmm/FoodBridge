const express=require('express');
const router=express.Router();
const User = require('../model/user-model');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
router.get('/', (req, res) => {
  res.render('index');
});

// /routes/auth.js

router.post('/register', async (req, res) => {
  const { name, email, password, role } = req.body;
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

    // Send welcome email
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Food Donor" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Welcome to Food Donor',
      text: `Hello ${name}, thank you for joining as a ${role}.`,
    });

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

    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
    res.cookie('token', token, { httpOnly: true });
    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.status(500).send('Login failed.');
  }
});

module.exports=router;