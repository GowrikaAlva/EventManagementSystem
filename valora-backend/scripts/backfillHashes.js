// scripts/backfillHashes.js
const mongoose = require("mongoose");
const crypto   = require("crypto");
const Rule     = require("../models/Rule");

function hashValue(value) {
  return crypto.createHash("sha256").update(value.trim()).digest("hex");
}

async function run() {
  await mongoose.connect("mongodb+srv://gowrikaalva_db_user:0kZKfens0x1xDNy6@cluster0.xqcfwjb.mongodb.net/?appName=Cluster0");
  console.log("Connected ✓");

  const rules = await Rule.find({});
  let updated = 0;

  for (const rule of rules) {
    let dirty = false;

    for (const key of rule.apiKeys) {
      if (!key.hash) {
        key.hash = "NEEDS_REENTRY";
        dirty = true;
      }
    }

    for (const num of rule.sensitiveNumbers) {
      if (!num.hash) {
        num.hash = "NEEDS_REENTRY";
        dirty = true;
      }
    }

    if (dirty) {
      await rule.save();
      updated++;
    }
  }

  console.log(`Done — updated ${updated} rule documents`);
  mongoose.disconnect();
}

run().catch(console.error);