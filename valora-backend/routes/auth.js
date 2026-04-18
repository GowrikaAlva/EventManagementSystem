const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Rule = require("../models/Rule");
const IndividualUser = require("../models/IndividualUser");

// Helper to generate JWT
const generateToken = (id, role, email, orgId) => {
  return jwt.sign({ id, role, email, orgId }, process.env.JWT_SECRET || "valora_fallback_secret_key", {
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

    const orgId = user.role === 'admin' ? user._id : user.orgId;
    const token = generateToken(user._id, user.role, user.email, orgId);

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

    const orgId = user.role === 'admin' ? user._id : user.orgId;
    const token = generateToken(user._id, user.role, user.email, orgId);

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
    
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return res.status(401).json({ success: false, error: "No account found" });
    }

    if (user.role !== "admin") {
      return res.status(401).json({ success: false, error: "Not authorized as an admin" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }

    const token = generateToken(user._id, user.role, user.email, user._id);

    res.json({
      success: true,
      token,
      user: { id: user._id, email: user.email, role: user.role }
    });
  } catch (err) {
    next(err);
  }
});

// @route   POST /api/auth/admin-register
// @desc    Create new admin user & get token
// @access  Public
router.post("/admin-register", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Email and password required" });
    }

    const emailLower = email.toLowerCase();
    const existingUser = await User.findOne({ email: emailLower });

    if (existingUser) {
      return res.status(400).json({ success: false, error: "An account with this email already exists" });
    }

    // Create new admin
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    const newUser = await User.create({
      email: emailLower,
      password: hashedPassword,
      role: "admin",
      isFirstLogin: true,
    });

    await Rule.create({ orgId: newUser._id, domains: [], keywords: [], customPatterns: [] });

    const token = generateToken(newUser._id, newUser.role, newUser.email, newUser._id);

    res.json({
      success: true,
      token,
      user: { id: newUser._id, email: newUser.email, role: newUser.role }
    });
  } catch (err) {
    next(err);
  }
});

// @route   POST /api/auth/individual/register
// @desc    Register a new individual user
// @access  Public
router.post("/individual/register", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Email and password required" });
    }

    const emailLower = email.toLowerCase();
    const existingUser = await IndividualUser.findOne({ email: emailLower });
    if (existingUser) {
      return res.status(400).json({ success: false, error: "An account with this email already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await IndividualUser.create({
      email: emailLower,
      password: hashedPassword
    });

    const token = generateToken(newUser._id, "individual", newUser.email, newUser._id);

    res.json({
      success: true,
      token,
      trialExpiresAt: newUser.trialExpiresAt,
      userType: "individual"
    });
  } catch (err) {
    next(err);
  }
});

// @route   POST /api/auth/individual/login
// @desc    Login individual user
// @access  Public
router.post("/individual/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Email and password required" });
    }

    const user = await IndividualUser.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }

    const token = generateToken(user._id, "individual", user.email, user._id);

    res.json({
      success: true,
      token,
      trialExpiresAt: user.trialExpiresAt,
      userType: "individual"
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
