import { describe, it, expect } from "vitest";
import { 
  calcPasswordStrength, 
  hashPassword, 
  verifyPassword, 
  encryptData, 
  decryptData 
} from "./crypto";

describe("Password Strength Calculator (calcPasswordStrength)", () => {
  it("should classify short passwords as weak", () => {
    const result = calcPasswordStrength("123");
    expect(result.level).toBe("weak");
    expect(result.score).toBeLessThan(30);
  });

  it("should classify simple lowercase-only passwords as weak", () => {
    const result = calcPasswordStrength("abcdefgh");
    expect(result.level).toBe("weak");
  });

  it("should classify mixed letter and number passwords as medium", () => {
    const result = calcPasswordStrength("abcdefg1");
    expect(result.level).toBe("medium");
  });

  it("should classify mixed case, numbers, and symbols as strong", () => {
    const result = calcPasswordStrength("Abcdefg1!");
    expect(result.level).toBe("strong");
  });

  it("should classify long complex passwords as very-strong", () => {
    const result = calcPasswordStrength("SuperSecureP@ss1234!");
    expect(result.level).toBe("very-strong");
    expect(result.score).toBe(100);
  });
});

describe("Cryptographic Hashing (hashPassword & verifyPassword)", () => {
  it("should successfully hash and verify a password", async () => {
    const password = "mySecretPassword123";
    const { hash, salt } = await hashPassword(password);
    
    expect(hash).toBeDefined();
    expect(salt).toBeDefined();
    expect(hash.length).toBe(64); // SHA-256 hex is 64 chars
    
    const isValid = await verifyPassword(password, hash, salt);
    expect(isValid).toBe(true);
  });

  it("should fail validation for incorrect passwords", async () => {
    const password = "mySecretPassword123";
    const { hash, salt } = await hashPassword(password);
    
    const isValid = await verifyPassword("wrongPassword", hash, salt);
    expect(isValid).toBe(false);
  });

  it("should produce unique hashes for the same password due to salts", async () => {
    const password = "testPassword";
    const run1 = await hashPassword(password);
    const run2 = await hashPassword(password);
    
    expect(run1.salt).not.toBe(run2.salt);
    expect(run1.hash).not.toBe(run2.hash);
  });
});

describe("AES-GCM Encryption (encryptData & decryptData)", () => {
  it("should encrypt and successfully decrypt data", async () => {
    const originalText = JSON.stringify({
      username: "testuser",
      email: "test@example.com",
      secrets: ["key1", "key2"]
    });
    
    const encrypted = await encryptData(originalText);
    expect(encrypted).toBeDefined();
    expect(encrypted).not.toBe(originalText);
    
    const decrypted = await decryptData(encrypted);
    expect(decrypted).toBe(originalText);
  });

  it("should fail to decrypt tampered ciphertext", async () => {
    const originalText = "Sensitive Data";
    const encrypted = await encryptData(originalText);
    
    // Corrupt the ciphertext by changing the last few characters
    const tampered = encrypted.substring(0, encrypted.length - 5) + "abcde";
    
    await expect(decryptData(tampered)).rejects.toThrow();
  });
});
