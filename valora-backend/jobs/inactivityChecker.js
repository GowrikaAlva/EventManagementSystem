const nodemailer = require("nodemailer");
const User = require("../models/User");
const ActivityLog = require("../models/ActivityLog");
const AlertLog = require("../models/AlertLog");

const checkInactivity = async () => {
  try {
    const INACTIVITY_DAYS = parseInt(process.env.INACTIVITY_DAYS || "3", 10);
    const INACTIVITY_MS = INACTIVITY_DAYS * 24 * 60 * 60 * 1000;
    const now = Date.now();

    // Setup nodemailer
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587", 10),
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const admins = await User.find({ role: "admin" });

    for (const admin of admins) {
      const employees = await User.find({ orgId: admin._id, role: "employee" });
      
      for (const employee of employees) {
        const lastLog = await ActivityLog.findOne({ userId: employee._id }).sort({ timestamp: -1 });
        const lastActive = lastLog ? new Date(lastLog.timestamp).getTime() : null;

        if (lastActive && (now - lastActive) > INACTIVITY_MS) {
          // Check if an alert was sent in the last INACTIVITY_DAYS
          const recentAlert = await AlertLog.findOne({
            userId: employee._id,
            alertType: "inactivity",
            sentAt: { $gte: new Date(now - INACTIVITY_MS) },
          });

          if (!recentAlert) {
            // Send email to employee
            await transporter.sendMail({
              from: process.env.SMTP_FROM || "noreply@valora.app",
              to: employee.email,
              subject: "Valora Extension Inactive — Action Required",
              text: `Your Valora data protection extension has not been active for ${INACTIVITY_DAYS} days. Please ensure it is enabled.`,
            });

            // Send email to admin
            await transporter.sendMail({
              from: process.env.SMTP_FROM || "noreply@valora.app",
              to: admin.email,
              subject: `Team Member Inactive on Valora — ${employee.email}`,
              text: `${employee.email} has not used the Valora extension for ${INACTIVITY_DAYS} days. Last seen: ${new Date(lastActive).toLocaleDateString()}.`,
            });

            // Log the alert
            await AlertLog.create({
              userId: employee._id,
              orgId: admin._id,
              alertType: "inactivity",
            });
            console.log(`Inactivity alert sent for user ${employee.email}`);
          }
        }
      }
    }
  } catch (error) {
    console.error("Error in inactivityChecker job:", error);
  }
};

const startJob = () => {
  // Run every 24 hours
  setInterval(checkInactivity, 24 * 60 * 60 * 1000);
  // Run once on startup
  checkInactivity();
};

module.exports = startJob;
