import crypto from "crypto";

// Derive a 32-byte master key from environment secret or a secure fallback
const getMasterKey = () => {
  const secret = process.env.SETTINGS_ENCRYPTION_KEY || process.env.JWT_SECRET || "delivix-production-secret-encryption-key-2026";
  return crypto.createHash("sha256").update(secret).digest();
};

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // Standard for GCM

/**
 * Encrypt a plaintext string using AES-256-GCM
 * Output format: iv:authTag:encryptedHex
 */
export const encryptSecret = (plainText) => {
  if (!plainText || typeof plainText !== "string") return "";
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = getMasterKey();
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(plainText, "utf8", "hex");
    encrypted += cipher.final("hex");
    
    const authTag = cipher.getAuthTag().toString("hex");
    return `${iv.toString("hex")}:${authTag}:${encrypted}`;
  } catch (error) {
    console.error("Encryption error:", error.message);
    return plainText;
  }
};

/**
 * Decrypt an AES-256-GCM cipher string
 */
export const decryptSecret = (cipherString) => {
  if (!cipherString || typeof cipherString !== "string") return "";
  const parts = cipherString.split(":");
  if (parts.length !== 3) {
    // String is not in our encrypted format (may be legacy plaintext or empty)
    return cipherString;
  }

  try {
    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const key = getMasterKey();

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    console.error("Decryption error:", error.message);
    return "";
  }
};

/**
 * Check if a string is a masked representation (e.g. starts with bullet characters)
 */
export const isMasked = (str) => {
  if (!str || typeof str !== "string") return false;
  return str.startsWith("••••") || str.includes("••••••••");
};

/**
 * Return a safe masked representation of a secret for frontend display
 */
export const maskSecret = (secret, visibleChars = 4) => {
  if (!secret || typeof secret !== "string") return "";
  
  // If it's stored encrypted, decrypt first to get last characters
  let plain = secret;
  if (secret.includes(":") && secret.split(":").length === 3) {
    plain = decryptSecret(secret) || "";
  }
  
  if (!plain) return "";
  if (plain.length <= visibleChars) {
    return "••••••••";
  }
  
  const end = plain.slice(-visibleChars);
  return `••••••••••••${end}`;
};

export default {
  encryptSecret,
  decryptSecret,
  isMasked,
  maskSecret,
};

