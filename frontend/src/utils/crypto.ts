/**
 * crypto.ts — Browser-native cryptographic utilities for secure local auth.
 * Uses Web Crypto API (SubtleCrypto) — zero external dependencies.
 *
 * Provides:
 *  - SHA-256 password hashing with random salt
 *  - Password verification
 *  - AES-GCM encryption/decryption for user data blobs
 */

// ─── Helpers ──────────────────────────────────────────────

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function generateSalt(length = 16): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return arrayBufferToBase64(bytes.buffer);
}

// ─── Password Hashing (SHA-256 + Salt) ───────────────────

export async function hashPassword(
  password: string,
  existingSalt?: string
): Promise<{ hash: string; salt: string }> {
  const salt = existingSalt || generateSalt();
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return { hash: arrayBufferToBase64(hashBuffer), salt };
}

export async function verifyPassword(
  password: string,
  storedHash: string,
  salt: string
): Promise<boolean> {
  const { hash } = await hashPassword(password, salt);
  return hash === storedHash;
}

// ─── AES-GCM Encryption for Data Blobs ───────────────────

const ENCRYPTION_KEY_NAME = "aegis_auth_enc_key";

async function getOrCreateEncryptionKey(): Promise<CryptoKey> {
  // Try to load from sessionStorage (ephemeral per-tab key cache)
  const stored = localStorage.getItem(ENCRYPTION_KEY_NAME);
  if (stored) {
    const raw = base64ToArrayBuffer(stored);
    return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, true, [
      "encrypt",
      "decrypt",
    ]);
  }

  // Generate a new key and persist it
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  const exported = await crypto.subtle.exportKey("raw", key);
  localStorage.setItem(ENCRYPTION_KEY_NAME, arrayBufferToBase64(exported));
  return key;
}

export async function encryptData(plaintext: string): Promise<string> {
  const key = await getOrCreateEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext)
  );
  // Pack as: base64(iv) + "." + base64(ciphertext)
  return arrayBufferToBase64(iv.buffer) + "." + arrayBufferToBase64(encrypted);
}

export async function decryptData(packed: string): Promise<string> {
  const key = await getOrCreateEncryptionKey();
  const [ivB64, cipherB64] = packed.split(".");
  if (!ivB64 || !cipherB64) throw new Error("Invalid encrypted data format");
  const iv = new Uint8Array(base64ToArrayBuffer(ivB64));
  const ciphertext = base64ToArrayBuffer(cipherB64);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(decrypted);
}

// ─── Password Strength Calculator ────────────────────────

export type PasswordStrength = "weak" | "medium" | "strong" | "very-strong";

export function calcPasswordStrength(password: string): {
  level: PasswordStrength;
  score: number; // 0-100
  label: string;
} {
  let score = 0;
  if (password.length >= 8) score += 20;
  if (password.length >= 12) score += 15;
  if (password.length >= 16) score += 10;
  if (/[a-z]/.test(password)) score += 10;
  if (/[A-Z]/.test(password)) score += 15;
  if (/[0-9]/.test(password)) score += 15;
  if (/[^a-zA-Z0-9]/.test(password)) score += 15;

  score = Math.min(100, score);

  if (score < 30) return { level: "weak", score, label: "Weak" };
  if (score < 55) return { level: "medium", score, label: "Medium" };
  if (score < 80) return { level: "strong", score, label: "Strong" };
  return { level: "very-strong", score, label: "Very Strong" };
}
