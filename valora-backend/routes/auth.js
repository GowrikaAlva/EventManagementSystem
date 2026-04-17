const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Helper to generate JWT
const generateToken = (id, role, email) => {
  return jwt.sign({ id, role, email }, process.env.JWT_SECRET || "valora_fallback_secret_key", {
    expiresIn: "30d",
  });
};

// @route   POST /api/auth/check-email
// @desc    Check if an email exists and if it's the user's first login
// @access  Public (Extension pre-login)
router.post("/check-email", async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: "Email required" });

    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return res.status(404).json({ success: false, exists: false });
    }

    res.json({
      success: true,
      exists: true,
      isFirstLogin: user.isFirstLogin,
    });
  } catch (err) {
    next(err);
  }
});

// @route   POST /api/auth/set-password
// @desc    Set password for first-time login and activate account
// @access  Public (Extension first login step)
router.post("/set-password", async (req, res, next) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) {
      return res.status(400).json({ success: false, error: "Email and new password required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    if (!user.isFirstLogin) {
      return res.status(400).json({ success: false, error: "Password was already set. Please login instead." });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.isFirstLogin = false;
    
    await user.save();

    const token = generateToken(user._id, user.role, user.email);

    res.json({
      success: true,
      token,
      user: { id: user._id, email: user.email, role: user.role }
    });
  } catch (err) {
    next(err);
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate existing user & get token
// @access  Public
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Email and password required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }

    if (user.isFirstLogin) {
      return res.status(401).json({ success: false, error: "Please set your password first" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }

    const token = generateToken(user._id, user.role, user.email);

    res.json({
      success: true,
      token,
      user: { id: user._id, email: user.email, role: user.role }
    });
  } catch (err) {
    next(err);
  }
});

// @route   POST /api/auth/admin-login
// @desc    Authenticate admin & get token
// @access  Public (React Dashboard)
router.post("/admin-login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    // Explicit security check to prevent normal employees from accessing via the admin endpoint
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user || user.role !== "admin") {
      return res.status(401).json({ success: false, error: "Not authorized as an admin" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }

    const token = generateToken(user._id, user.role, user.email);

    res.json({
      success: true,
      token,
      user: { id: user._id, email: user.email, role: user.role }
    });
  } catch (err) {
    next(err);
  }
});

// @route   POST /api/auth/admin
// @desc    Authenticate or create new admin user & get token
// @access  Public
router.post("/admin", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Email and password required" });
    }

    const emailLower = email.toLowerCase();
    const user = await User.findOne({ email: emailLower });

    if (user) {
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ success: false, error: "Invalid credentials" });
      }

      const token = generateToken(user._id, user.role, user.email);

      return res.json({
        success: true,
        token,
        user: { id: user._id, email: user.email, role: user.role }
      });
    } else {
      // Create new admin
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      const newUser = await User.create({
        email: emailLower,
        password: hashedPassword,
        role: "admin",
        isFirstLogin: false,
      });

      const token = generateToken(newUser._id, newUser.role, newUser.email);

      return res.json({
        success: true,
        token,
        user: { id: newUser._id, email: newUser.email, role: newUser.role }
      });
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
