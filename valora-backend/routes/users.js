const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { asyncHandler } = require("../middleware/errorHandler");
const { authMiddleware, adminMiddleware } = require("../middleware/authMiddleware");

// @route   GET /api/users
// @desc    Get all employees
// @access  Private/Admin
router.get(
  "/",
  [authMiddleware, adminMiddleware],
  asyncHandler(async (req, res) => {
    // Return everyone, exclude password field
    const users = await User.find({}).select("-password").sort({ createdAt: -1 });
    res.json({ success: true, users });
  })
);

// @route   POST /api/users
// @desc    Add a new employee
// @access  Private/Admin
router.post(
  "/",
  [authMiddleware, adminMiddleware],
  asyncHandler(async (req, res) => {
    const { email, role } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: "Email is required" });
    }

    const emailLower = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: emailLower });
    
    if (existingUser) {
      return res.status(400).json({ success: false, error: "User already exists" });
    }

    // Since they are created by Admin, they haven't set their password yet
    // Put a placeholder random password
    const temporaryPassword = Math.random().toString(36).slice(-10);

    const user = await User.create({
      email: emailLower,
      password: temporaryPassword, 
      role: role === "admin" ? "admin" : "employee",
      isFirstLogin: true,
    });

    res.status(201).json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        isFirstLogin: user.isFirstLogin,
        createdAt: user.createdAt,
      },
    });
  })
);

module.exports = router;
