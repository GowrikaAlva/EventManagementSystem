const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const User = require("../models/User");
const ActivityLog = require("../models/ActivityLog");
const { asyncHandler } = require("../middleware/errorHandler");
const { authMiddleware, adminMiddleware } = require("../middleware/authMiddleware");

// @route   GET /api/reports/generate
// @desc    Generate weekly/monthly/yearly reports
// @access  Private/Admin
router.get(
  "/generate",
  [authMiddleware, adminMiddleware],
  asyncHandler(async (req, res) => {
    const { period = "monthly" } = req.query;
    
    let days = 30;
    if (period === "weekly") days = 7;
    if (period === "yearly") days = 365;

    const to = new Date();
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const orgId = new mongoose.Types.ObjectId(req.orgId); // Ensure ObjectId type for aggregation

    // Coverage
    const employees = await User.find({ orgId: req.orgId, role: 'employee' }).select("_id");
    
    let active = 0;
    let inactive = 0;
    let notInstalled = 0;

    for (const emp of employees) {
      const lastActivity = await ActivityLog.findOne({ userId: emp._id }).sort({ timestamp: -1 });
      if (!lastActivity) {
        notInstalled++;
      } else if (lastActivity.timestamp >= from) {
        active++;
      } else {
        inactive++;
      }
    }

    // Platform Usage
    const platformUsageRaw = await ActivityLog.aggregate([
      { $match: { orgId: orgId, timestamp: { $gte: from } } },
      { $group: { _id: "$platform", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    const platformUsage = platformUsageRaw.map(p => ({ platform: p._id || "Unknown", count: p.count }));

    // Activity Timeline
    const timelineRaw = await ActivityLog.aggregate([
      { $match: { orgId: orgId, timestamp: { $gte: from } } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
            userId: "$userId"
          }
        }
      },
      {
        $group: {
          _id: "$_id.date",
          activeUsers: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    const activityTimelineMap = {};
    timelineRaw.forEach(t => {
      activityTimelineMap[t._id] = t.activeUsers;
    });
    
    // Fill in missing days
    const activityTimeline = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split("T")[0];
      activityTimeline.push({
        date: dateStr,
        activeUsers: activityTimelineMap[dateStr] || 0
      });
    }

    // Top Active Employees
    const topEmployeesRaw = await ActivityLog.aggregate([
      { $match: { orgId: orgId, timestamp: { $gte: from } } },
      {
        $group: {
          _id: {
            userId: "$userId",
            date: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } }
          },
          platforms: { $addToSet: "$platform" }
        }
      },
      {
        $group: {
          _id: "$_id.userId",
          daysActive: { $sum: 1 },
          allPlatforms: { $push: "$platforms" }
        }
      },
      { $sort: { daysActive: -1 } },
      { $limit: 5 }
    ]);

    const topActiveEmployees = [];
    for (const t of topEmployeesRaw) {
      const user = await User.findById(t._id).select("email");
      if (user) {
        // Flatten and distinct platforms
        const distinctPlatforms = [...new Set(t.allPlatforms.flat())].filter(p => p && p !== "Unknown");
        topActiveEmployees.push({
          email: user.email,
          daysActive: t.daysActive,
          platforms: distinctPlatforms.length > 0 ? distinctPlatforms : ["Unknown"]
        });
      }
    }

    res.json({
      success: true,
      period,
      generatedAt: new Date().toISOString(),
      dateRange: { from: from.toISOString(), to: to.toISOString() },
      org: {
        adminEmail: req.user.email,
        totalEmployees: employees.length
      },
      coverage: { active, inactive, notInstalled },
      platformUsage,
      activityTimeline,
      topActiveEmployees
    });
  })
);

module.exports = router;
