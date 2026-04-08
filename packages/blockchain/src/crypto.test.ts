import { encryptPrivateKey, decryptPrivateKey, generateEncryptionKey } from "./crypto.js";

const testKey = generateEncryptionKey();
const testPrivateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

// Test: encrypt then decrypt should match
const encrypted = encryptPrivateKey(testPrivateKey, testKey);
const decrypted = decryptPrivateKey(encrypted, testKey);

if (decrypted !== testPrivateKey) {
  console.error("FAIL: decrypted key does not match original");
  process.exit(1);
}
console.log("PASS: encrypt/decrypt roundtrip");

// Test: wrong key should fail
const wrongKey = generateEncryptionKey();
try {
  decryptPrivateKey(encrypted, wrongKey);
  console.error("FAIL: decryption with wrong key should throw");
  process.exit(1);
} catch {
  console.log("PASS: wrong key throws error");
}

// Test: encrypted output is base64 and different from input
if (encrypted === testPrivateKey) {
  console.error("FAIL: encrypted should differ from input");
  process.exit(1);
}
console.log("PASS: encrypted differs from plaintext");

// Test: two encryptions produce different ciphertext (random IV)
const encrypted2 = encryptPrivateKey(testPrivateKey, testKey);
if (encrypted === encrypted2) {
  console.error("FAIL: two encryptions should produce different ciphertext");
  process.exit(1);
}
console.log("PASS: random IV produces different ciphertext");

console.log("\nAll crypto tests passed.");
