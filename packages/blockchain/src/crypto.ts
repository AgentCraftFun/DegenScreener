import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const hex = process.env.WALLET_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "WALLET_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)",
    );
  }
  return Buffer.from(hex, "hex");
}

/**
 * Encrypts a private key using AES-256-GCM.
 * Returns base64-encoded string containing: iv (16) + authTag (16) + ciphertext
 */
export function encryptPrivateKey(
  privateKey: string,
  encryptionKeyHex?: string,
): string {
  const key = encryptionKeyHex
    ? Buffer.from(encryptionKeyHex, "hex")
    : getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(privateKey, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Format: iv + authTag + ciphertext
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString("base64");
}

/**
 * Decrypts a private key from the base64-encoded format.
 * Returns the raw private key hex string.
 */
export function decryptPrivateKey(
  encryptedBase64: string,
  encryptionKeyHex?: string,
): string {
  const key = encryptionKeyHex
    ? Buffer.from(encryptionKeyHex, "hex")
    : getEncryptionKey();
  const combined = Buffer.from(encryptedBase64, "base64");

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

/**
 * Generates a random 32-byte encryption key as a hex string.
 * Use this to generate a WALLET_ENCRYPTION_KEY for .env
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString("hex");
}
