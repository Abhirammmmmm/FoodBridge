const nodemailer = require("nodemailer");
const dotenv = require("dotenv");

dotenv.config();

const transporter = nodemailer.createTransport({
  service: 'gmail',            
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, 
  },
});

transporter.verify((error, success) => {
  if (error) {
    console.error("❌ Mailer connection failed:", error.message);
  } else {
    console.log("✅ Mailer is ready to send messages");
  }
});

module.exports = transporter;
