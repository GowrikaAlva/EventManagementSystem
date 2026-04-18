const mongoose = require("mongoose");

const IndividualUserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  trialExpiresAt: { 
    type: Date, 
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) 
  },
  scanCount: { type: Number, default: 0 },
  plan: { 
    type: String, 
    enum: ["free","basic","pro","premium"], 
    default: "free" 
  }
}, { timestamps: true });

module.exports = mongoose.model("IndividualUser", IndividualUserSchema);
