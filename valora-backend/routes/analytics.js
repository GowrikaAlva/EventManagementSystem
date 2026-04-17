const express = require("express");
const router = express.Router();
const Violation = require("../models/Violation");
const { asyncHandler } = require("../middleware/errorHandler");
const { authMiddleware, adminMiddleware } = require("../middleware/authMiddleware");

// @route   GET /api/analytics/total-leaks
// @desc    Get total violations
// @access  Private/Admin
router.get(
  "/total-leaks",
  [authMiddleware, adminMiddleware],
  asyncHandler(async (req, res) => {
    const count = await Violation.countDocuments();
    res.json({ success: true, count });
  })
);

// @route   GET /api/analytics/top-users
// @desc    Get top users with most leaks
// @access  Private/Admin
router.get(
  "/top-users",
  [authMiddleware, adminMiddleware],
  asyncHandler(async (req, res) => {
    const pipeline = [
      // Exclude violations that might have missing userIds (if any fallback occurred)
      { $match: { userId: { $exists: true, $ne: null } } },
      
      // Group by user id
      {
        $group: {
          _id: "$userId",
          violationCount: { $sum: 1 },
        },
      },
      
      // Sort backwards
      { $sort: { violationCount: -1 } },
      
      // Keep only top 5
      { $limit: 5 },
      
      // Join over to User collection to bring back user details
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "userDetails",
        },
      },
      
      // Flatten the resulting array
      { $unwind: "$userDetails" },
      
      // Select fields
      {
        $project: {
          _id: 1,
          violationCount: 1,
          email: "$userDetails.email",
        },
      },
    ];

    const topUsers = await Violation.aggregate(pipeline);

    res.json({ success: true, topUsers });
  })
);

module.exports = router;
