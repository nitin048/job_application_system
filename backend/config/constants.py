import os
from src.crypto_manager import decrypt_value

# Naukri Manipulation Constants
RESUME_PATH = os.getenv("RESUME_PATH", r"/Users/nitinpradhan/.gemini/antigravity/scratch/job_application_system/assets/Resume (1).pdf")
MODIFIED_RESUME_PATH = os.getenv("MODIFIED_RESUME_PATH", r"/Users/nitinpradhan/.gemini/antigravity/scratch/job_application_system/data/Modified_Resume.pdf")
USERNAME = os.getenv("NAUKRI_USERNAME", "nitinpradhan48@gmail.com")
PASSWORD = decrypt_value(os.getenv("NAUKRI_PASSWORD", "ENC::gAAAAABqGdJWsudKLldQnXBs6PZP_QLLOr8mRAgXhQYpWn-Biw3Ku7j_co_4FM5iwdUDQjyZcemACowXFqf_rqHrlL4kgYbAEjZIMNOw38fG7SFijhdm76ue2ujTepwfHemJOjhObwwc"))
MOBILE = os.getenv("NAUKRI_MOBILE", "+917795275103")
UPDATE_PDF_HASH = True

# LLM API Config
GEMINI_API_KEY = decrypt_value(os.getenv("GEMINI_API_KEY", "ENC::gAAAAABqGdJWkh7bMVc8N6-Ww_yI0N0E3lHUhRH63jmG9rjNzq8qHaMuK_GEBM340EW_SBi-RAKyQMzrZs2ZLW5eF9N0OXhFZSTr9XZf5wY-eBZfLm-OHI8hjcCqEsoemyV5qGO8vRmZ"))
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
