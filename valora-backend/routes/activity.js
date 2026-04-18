const express = require("express");
const router = express.Router();
const User = require("../models/User");
const ActivityLog = require("../models/ActivityLog");
const { asyncHandler } = require("../middleware/errorHandler");
const { authMiddleware, adminMiddleware } = require("../middleware/authMiddleware");
const mongoose = require("mongoose");

// @route   POST /api/activity
// @desc    Heartbeat from extension
// @access  Private
router.post(
  "/",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { platform = "Unknown" } = req.body || {};
    // Insert a new log instead of updating so we have a timeline of activity
    await ActivityLog.create({
      userId: req.user.id,
      orgId: req.orgId,
      platform,
      timestamp: Date.now()
    });
    res.json({ success: true });
  })
);

// @route   GET /api/activity/team
// @desc    Get team activity status
// @access  Private/Admin
router.get(
  "/team",
  [authMiddleware, adminMiddleware],
  asyncHandler(async (req, res) => {
    const employees = await User.find({ orgId: req.orgId, role: "employee" }).select("email _id");
    const activityLogs = await ActivityLog.aggregate([
      { $match: { orgId: new mongoose.Types.ObjectId(req.orgId) } },
      { $sort: { timestamp: -1 } },
      { $group: { _id: "$userId", timestamp: { $first: "$timestamp" } } }
    ]);

    const activityMap = {};
    activityLogs.forEach((log) => {
      activityMap[log._id.toString()] = log.timestamp;
    });

    const INACTIVITY_LIMIT = 3 * 24 * 60 * 60 * 1000; // 3 days
    const now = Date.now();

    const team = employees.map((emp) => {
      const lastActive = activityMap[emp._id.toString()];
      let status = "not_installed";
      if (lastActive) {
        if (now - new Date(lastActive).getTime() > INACTIVITY_LIMIT) {
          status = "inactive";
        } else {
          status = "active";
        }
      }
      return {
        userId: emp._id,
        email: emp.email,
        status,
        lastActive: lastActive || null,
      };
    });

    res.json({ success: true, team });
  })
);

module.exports = router;
