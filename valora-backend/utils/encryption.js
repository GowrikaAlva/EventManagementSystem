// ─── Valora — AES-256-GCM Encryption Utility ─────────────────────────────────
const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV — optimal for GCM

function getKey() {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be a 64-char hex string (32 bytes). Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
  }
  return Buffer.from(hex, "hex");
}

/**
 * Encrypt plaintext → "iv:authTag:ciphertext" (all hex, colon-separated)
 */
function encrypt(plaintext) {
  const iv      = crypto.randomBytes(IV_LENGTH);
  const cipher  = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const enc     = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, enc].map((b) => b.toString("hex")).join(":");
}

/**
 * Decrypt "iv:authTag:ciphertext" → plaintext
 * Throws if the ciphertext has been tampered with (GCM auth tag mismatch).
 */
function decrypt(encoded) {
  const [ivHex, authTagHex, encHex] = encoded.split(":");
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(encHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

module.exports = { encrypt, decrypt };