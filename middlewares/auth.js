// middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../model/user-model');

const checkAuth = async (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    res.locals.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).lean();
    res.locals.user = user;
  } catch (err) {
    res.locals.user = null;
  }

  next();
};

module.exports = checkAuth;
