import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * Get the encryption key from env. Returns undefined if not configured,
 * meaning emails will be stored in plain text.
 */
export function getEmailEncryptionKey(): Buffer | undefined {
  const raw = process.env.EMAIL_ENCRYPTION_KEY;
  if (!raw) return undefined;
  if (raw.length !== 64) {
    throw new Error(
      "EMAIL_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)"
    );
  }
  return Buffer.from(raw, "hex");
}

/**
 * Deterministic SHA-256 hash of an email (lowercased, trimmed).
 * Used for unique constraint / dedup regardless of encryption.
 */
export function hashEmail(email: string): string {
  return createHash("sha256")
    .update(email.toLowerCase().trim())
    .digest("hex");
}

/**
 * Encrypt a string with AES-256-GCM. Returns a hex-encoded string:
 * iv (12 bytes) + authTag (16 bytes) + ciphertext
 *
 * Returns the original string unchanged if no encryption key is configured.
 */
export function encryptEmail(email: string): string {
  const key = getEmailEncryptionKey();
  if (!key) return email;

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(email, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]).toString("hex");
}

/**
 * Decrypt an AES-256-GCM encrypted hex string back to the original email.
 *
 * Returns the input unchanged if no encryption key is configured
 * (assumes the value is plain text).
 */
export function decryptEmail(encrypted: string): string {
  const key = getEmailEncryptionKey();
  if (!key) return encrypted;

  const data = Buffer.from(encrypted, "hex");
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
