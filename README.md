# FoodBridge
🍽️ FoodBridge – Connecting Food, Reducing Waste

FoodBridge is a smart food donation platform that connects food donors (individuals, restaurants, events) with NGOs to reduce food waste and fight hunger. The platform uses modern web technologies along with AI assistance to make food donation simple, fast, and rewarding.

🚀 Features
🧾 Easy Food Donation
Users can submit food details like type, quantity, and availability.
📍 Live Location Sharing (GPS)
Helps NGOs quickly locate and collect donated food.
🤖 AI Chatbot Assistance
Guides users through the donation process in real-time.
🔔 Real-Time Notifications
Get updates when food is accepted and delivered.
🎁 Reward System
Donors receive discounts and offers via restaurant partnerships.
🌐 NGO Integration
NGOs can view, accept, and manage donation requests.
🛠️ Tech Stack
Frontend
HTML, CSS, JavaScript
EJS (Embedded JavaScript Templates)
Tailwind CSS (for styling)
Backend
Node.js
Express.js
Database
MongoDB Atlas
Other Tools
JWT Authentication
Nodemailer (for email notifications)
Google Maps API (for location services)

📂 Project Structure

FoodBridge/
│
├── models/          # MongoDB schemas

├── routes/          # Express routes

├── views/           # EJS templates

│   ├── partials/    # Header & Footer

│   ├── index.ejs

│   ├── donate.ejs

│   ├── ngos.ejs

│   └── rewards.ejs

│
├── public/          # Static files (CSS, JS, images)

├── .env             # Environment variables

├── app.js           # Main server file

└── package.json

