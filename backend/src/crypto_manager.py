"""
crypto_manager.py — Secure symmetric encryption/decryption for sensitive config values.
Uses Fernet (AES-128-CBC + HMAC-SHA256) from the cryptography package.
The encryption key is stored in data/.secret.key — NEVER commit this to source control.
"""

import os
import base64
from pathlib import Path
from cryptography.fernet import Fernet, InvalidToken

ROOT_DIR = Path(__file__).parent.parent
KEY_FILE = ROOT_DIR / "data" / ".secret.key"

# Prefix added to encrypted values stored in constants.py so they can be detected
ENCRYPTED_PREFIX = "ENC::"


def _get_or_create_key() -> bytes:
    """Load the Fernet key from disk, creating it if it doesn't exist."""
    KEY_FILE.parent.mkdir(parents=True, exist_ok=True)
    if KEY_FILE.exists():
        return KEY_FILE.read_bytes()
    key = Fernet.generate_key()
    KEY_FILE.write_bytes(key)
    # Restrict permissions to owner-only on Unix systems
    try:
        os.chmod(KEY_FILE, 0o600)
    except Exception:
        pass
    return key


def _get_fernet() -> Fernet:
    return Fernet(_get_or_create_key())


def encrypt_value(plaintext: str) -> str:
    """
    Encrypts a plaintext string and returns a prefixed base64 token string.
    Returns empty string for empty input (no encryption needed).
    """
    if not plaintext:
        return ""
    # Don't double-encrypt already encrypted values
    if plaintext.startswith(ENCRYPTED_PREFIX):
        return plaintext
    fernet = _get_fernet()
    token = fernet.encrypt(plaintext.encode("utf-8"))
    return ENCRYPTED_PREFIX + token.decode("utf-8")


def decrypt_value(encrypted: str) -> str:
    """
    Decrypts a prefixed encrypted string (or deobfuscates an OBF:: string) back to plaintext.
    Returns the original string unchanged if it is not encrypted.
    Returns empty string if decryption fails.
    """
    if not encrypted:
        return ""
    if isinstance(encrypted, str) and encrypted.startswith("OBF::"):
        try:
            import base64
            import urllib.parse
            base64_str = encrypted[5:]
            decoded_bytes = base64.b64decode(base64_str)
            try:
                return urllib.parse.unquote(decoded_bytes.decode("utf-8"))
            except Exception:
                return decoded_bytes.decode("utf-8")
        except Exception:
            return encrypted
    if not encrypted.startswith(ENCRYPTED_PREFIX):
        # Plain text (legacy value) — return as-is
        return encrypted
    raw_token = encrypted[len(ENCRYPTED_PREFIX):]
    try:
        fernet = _get_fernet()
        return fernet.decrypt(raw_token.encode("utf-8")).decode("utf-8")
    except (InvalidToken, Exception):
        return ""


def is_encrypted(value: str) -> bool:
    """Returns True if the value is an encrypted or obfuscated token."""
    return isinstance(value, str) and (value.startswith(ENCRYPTED_PREFIX) or value.startswith("OBF::"))
