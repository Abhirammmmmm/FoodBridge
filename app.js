const express = require("express");
const app = express();
const dotenv = require("dotenv");
const db = require("./config/db");
const indexRoutes = require("./routes/indexRoutes");
const cookieParser = require('cookie-parser');
const checkAuth = require('./middlewares/auth');

dotenv.config();
db();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ✅ Serve static files from "public" folder
app.use(express.static("public"));

app.set("view engine", "ejs");
app.use(cookieParser());
app.use(checkAuth);

// Routes
app.use("/", indexRoutes);

// Start server
app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
});
