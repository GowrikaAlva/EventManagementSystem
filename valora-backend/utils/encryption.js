const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getKey() {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) throw new Error("ENCRYPTION_KEY must be a 64-char hex string");
  return Buffer.from(hex, "hex");
}

function encrypt(plaintext) {
  const iv      = crypto.randomBytes(IV_LENGTH);
  const cipher  = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const enc     = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, enc].map((b) => b.toString("hex")).join(":");
}

function decrypt(encoded) {
  const [ivHex, authTagHex, encHex] = encoded.split(":");
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(encHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

/** SHA-256 of the plaintext — safe to store and send to the extension */
function hashValue(plaintext) {
  return crypto.createHash("sha256").update(plaintext.trim()).digest("hex");
}

module.exports = { encrypt, decrypt, hashValue };