import os
from src.crypto_manager import decrypt_value

# Naukri Manipulation Constants
RESUME_PATH = os.getenv("RESUME_PATH", r"/Users/nitinpradhan/.gemini/antigravity/scratch/job_application_system/assets/Resume (1).pdf")
MODIFIED_RESUME_PATH = os.getenv("MODIFIED_RESUME_PATH", r"/Users/nitinpradhan/.gemini/antigravity/scratch/job_application_system/data/Modified_Resume.pdf")
USERNAME = os.getenv("NAUKRI_USERNAME", "nitinpradhan48@gmail.com")
PASSWORD = decrypt_value(os.getenv("NAUKRI_PASSWORD", "ENC::gAAAAABqGY7wlM_FoOdEIbzv-myAK-EHyCAPnSeAGJaG55JDaZr9NL73cyIrgMP_3pNogGmtutaPrYQnB7okm_E83fyto_xuBg=="))
MOBILE = os.getenv("NAUKRI_MOBILE", "+917795275103")
UPDATE_PDF_HASH = True

# LLM API Config
GEMINI_API_KEY = decrypt_value(os.getenv("GEMINI_API_KEY", "ENC::gAAAAABqGY7wouiy7KEAYuL2Eb0Xb-o6abQgdLuB_FD6ZUZVLyFOgFl9k_fqIPvZBNtQnkR1o9fC9a10sOsBa0d9_sWQpdZPPqw-fkoeUsG1m4YirjJ7gIh2jQCdIeqH6uv8l7cHgZHK"))
SOLVER_API_KEY = decrypt_value(os.getenv("SOLVER_API_KEY", ""))

# Browser settings
AGENT_BROWSER_HEADED = os.getenv("AGENT_BROWSER_HEADED", "True") == "True"
AGENT_BROWSER_CDP = os.getenv("AGENT_BROWSER_CDP", "")

# Google Drive Sync Config
GDRIVE_SYNC_ENABLED = True
GDRIVE_CLIENT_SECRETS_PATH = os.getenv("GDRIVE_CLIENT_SECRETS_PATH", r"config/credentials.json")
GDRIVE_TOKEN_PATH = os.getenv("GDRIVE_TOKEN_PATH", r"data/token.json")

# SMTP Email Config
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = decrypt_value(os.getenv("SMTP_PASSWORD", ""))
