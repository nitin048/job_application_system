import os
import contextvars
from src.crypto_manager import decrypt_value, is_encrypted

# Naukri Manipulation Constants
RESUME_PATH = ""
MODIFIED_RESUME_PATH = ""
USERNAME = ""
PASSWORD = ""
UPDATE_PDF_HASH = True

# LLM API Config
GEMINI_API_KEY = ""
SOLVER_API_KEY = ""

# Browser settings
AGENT_BROWSER_HEADED = True
AGENT_BROWSER_CDP = ""

# Google Drive Sync Config
GDRIVE_SYNC_ENABLED = False
GDRIVE_CLIENT_SECRETS_PATH = r"config/credentials.json"
GDRIVE_TOKEN_PATH = r"data/token.json"

# SMTP Email Config
SMTP_HOST = ""
SMTP_PORT = 587
SMTP_USER = ""
SMTP_PASSWORD = ""

session_config_var = contextvars.ContextVar("session_config_var", default=None)

_DEFAULTS = {
    "RESUME_PATH": "",
    "MODIFIED_RESUME_PATH": "",
    "USERNAME": "",
    "PASSWORD": "",
    "UPDATE_PDF_HASH": True,
    "GEMINI_API_KEY": "",
    "SOLVER_API_KEY": "",
    "AGENT_BROWSER_HEADED": True,
    "AGENT_BROWSER_CDP": "",
    "GDRIVE_SYNC_ENABLED": False,
    "GDRIVE_CLIENT_SECRETS_PATH": r"config/credentials.json",
    "GDRIVE_TOKEN_PATH": r"data/token.json",
    "SMTP_HOST": "",
    "SMTP_PORT": 587,
    "SMTP_USER": "",
    "SMTP_PASSWORD": "",
    
    # Target portals authentication credentials (optional)
    "LINKEDIN_USERNAME": "",
    "LINKEDIN_PASSWORD": "",
    "INSTAHYRE_USERNAME": "",
    "INSTAHYRE_PASSWORD": "",
    "CUTSHORT_USERNAME": "",
    "CUTSHORT_PASSWORD": "",
    "WELLFOUND_USERNAME": "",
    "WELLFOUND_PASSWORD": "",
    "HIRIST_USERNAME": "",
    "HIRIST_PASSWORD": "",
    "NAUKRI_USERNAME": "",
    "NAUKRI_PASSWORD": "",
    "INDEED_USERNAME": "",
    "INDEED_PASSWORD": "",
    "FOUNDIT_USERNAME": "",
    "FOUNDIT_PASSWORD": "",
    "SHINE_USERNAME": "",
    "SHINE_PASSWORD": "",
    "TIMESJOBS_USERNAME": "",
    "TIMESJOBS_PASSWORD": "",
    "GLASSDOOR_USERNAME": "",
    "GLASSDOOR_PASSWORD": ""
}

# Sensitive keys to decrypt
SENSITIVE_KEYS = {
    "PASSWORD", "GEMINI_API_KEY", "SOLVER_API_KEY", "SMTP_PASSWORD",
    "LINKEDIN_PASSWORD", "INSTAHYRE_PASSWORD", "CUTSHORT_PASSWORD", "WELLFOUND_PASSWORD", "HIRIST_PASSWORD",
    "NAUKRI_PASSWORD", "INDEED_PASSWORD", "FOUNDIT_PASSWORD", "SHINE_PASSWORD", "TIMESJOBS_PASSWORD", "GLASSDOOR_PASSWORD"
}

def __getattr__(name):
    # 1. First, check if name is in ContextVar session config (which would have a nested 'constants' dict)
    current_config = session_config_var.get()
    if current_config and "constants" in current_config:
        val = current_config["constants"].get(name)
        if val is not None:
            if name in SENSITIVE_KEYS and isinstance(val, str) and is_encrypted(val):
                return decrypt_value(val)
            return val

    # 2. Second, check if we have a temporary session config file loaded via environment variable
    session_config_path = os.getenv("AEGIS_SESSION_CONFIG_PATH")
    if session_config_path and os.path.exists(session_config_path):
        try:
            with open(session_config_path, "r", encoding="utf-8") as f:
                import json
                file_config = json.load(f)
                if "constants" in file_config:
                    val = file_config["constants"].get(name)
                    if val is not None:
                        if name in SENSITIVE_KEYS and isinstance(val, str) and is_encrypted(val):
                            return decrypt_value(val)
                        return val
        except Exception:
            pass

    # 3. Third, check environment variables directly
    env_name = f"NAUKRI_{name}" if name in ("USERNAME", "PASSWORD") else name
    if env_name in os.environ:
        val = os.getenv(env_name)
        if name in SENSITIVE_KEYS and isinstance(val, str) and is_encrypted(val):
            return decrypt_value(val)
        if name in ("UPDATE_PDF_HASH", "AGENT_BROWSER_HEADED", "GDRIVE_SYNC_ENABLED"):
            return val == "True" or val is True
        if name == "SMTP_PORT":
            try:
                return int(val)
            except Exception:
                pass
        return val

    # 4. Fallback to default
    if name in _DEFAULTS:
        val = _DEFAULTS[name]
        if name in SENSITIVE_KEYS and isinstance(val, str) and is_encrypted(val):
            return decrypt_value(val)
        return val

    raise AttributeError(f"module {__name__} has no attribute {name}")

# Clear the static values from the module dict so __getattr__ is always invoked
for key in list(globals().keys()):
    if key in _DEFAULTS:
        del globals()[key]
