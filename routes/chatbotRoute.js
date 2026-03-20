// routes/chatbotRoute.js
const express = require("express");
const router = express.Router();

// --- Simple Chatbot Logic ---
router.post("/api/chatbot", async (req, res) => {
  try {
    const { message } = req.body;

    let reply = "Hi! I'm your FoodBridge assistant. How can I help you today?";

    if (!message) {
      return res.json({ reply: "Please type a message first." });
    }

    const msg = message.toLowerCase();

    if (msg.includes("donate")) {
      reply = "You can donate food via the Donate page — just fill in the food details and submit!";
    } else if (msg.includes("ngo")) {
      reply = "We partner with nearby NGOs to collect your food donations efficiently.";
    } else if (msg.includes("reward")) {
      reply = "Each donation earns you reward points redeemable at our partner restaurants!";
    } else if (msg.includes("thank")) {
      reply = "You're very welcome! 😊";
    }

    res.json({ reply });
  } catch (err) {
    console.error("Chatbot error:", err);
    res.status(500).json({ reply: "Sorry, something went wrong on our side." });
  }
});

module.exports = router;
