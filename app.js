const express = require("express");
const app = express();
const dotenv = require("dotenv")
const db = require("./config/db");
const indexRoutes = require("./routes/indexRoutes");
dotenv.config();
db();
const cookieParser = require('cookie-parser');
const checkAuth = require('./middlewares/auth');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set("view engine", "ejs");
app.use(cookieParser());
app.use(checkAuth);
app.use("/", indexRoutes);
app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
});
