import json
import logging
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright

STATE_LOCK = threading.Lock()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Stealth CDP JS Injection script to override navigator.webdriver detection
STEALTH_SCRIPT = """
Object.defineProperty(navigator, 'webdriver', {
  get: () => undefined
});
Object.defineProperty(navigator, 'plugins', {
  get: () => [1, 2, 3, 4, 5]
});
Object.defineProperty(navigator, 'languages', {
  get: () => ['en-US', 'en']
});
"""

class SecureBrowserDriver:
    def __init__(self, headless: bool = False, cdp_address: str = "", state_path: str = "data/session_state.json"):
        self.headless = headless
        self.cdp_address = cdp_address
        self.state_path = Path(state_path)
        self.playwright = None
        self.browser = None
        self.context = None

    def start(self):
        self.playwright = sync_playwright().start()
        
        use_cdp = False
        if self.cdp_address:
            try:
                cdp_target = self.cdp_address.strip()
                # If only digits, treat as local port
                if cdp_target.isdigit():
                    port = int(cdp_target)
                    if not (1 <= port <= 65535):
                        raise ValueError(f"CDP port '{cdp_target}' is out of range (1-65535).")
                    cdp_target = f"127.0.0.1:{port}"
                else:
                    if ":" in cdp_target:
                        host, port_str = cdp_target.rsplit(":", 1)
                        if port_str.isdigit():
                            port = int(port_str)
                            if not (1 <= port <= 65535):
                                raise ValueError(f"CDP port '{port_str}' in '{cdp_target}' is out of range (1-65535).")
                    else:
                        cdp_target = f"{cdp_target}:9222"

                logger.info(f"Connecting to browser via CDP: {cdp_target}")
                self.browser = self.playwright.chromium.connect_over_cdp(f"http://{cdp_target}")
                self.context = self.browser.contexts[0] if self.browser.contexts else self.browser.new_context()
                use_cdp = True
            except Exception as e:
                logger.warning(f"CDP browser connection failed ({e}). Falling back to standalone Chromium context.")
                self.cdp_address = ""  # Clear so close() shuts down standalone browser properly
                if self.browser:
                    try:
                        self.browser.close()
                    except Exception:
                        pass
                self.browser = None
                self.context = None

        if not use_cdp:
            # Standalone local Chromium with user-like slow_mo delay
            logger.info("Initializing standalone Chromium context with slow_mo delay")
            self.browser = self.playwright.chromium.launch(
                headless=self.headless,
                slow_mo=150
            )
            
            user_agent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            
            from src.db import get_db, current_user_id_var
            import tempfile
            import json
            import os
            
            db_state = None
            user_id = current_user_id_var.get()
            if user_id:
                try:
                    db = get_db()
                    state_doc = db["browser_states"].find_one({"user_id": user_id})
                    if state_doc and "state" in state_doc:
                        db_state = state_doc["state"]
                        logger.info(f"Retrieved browser session state from MongoDB for user: {user_id}")
                except Exception as e:
                    logger.warning(f"Failed to load browser state from MongoDB: {e}")
            
            temp_state_file = None
            if db_state:
                try:
                    fd, path = tempfile.mkstemp(suffix=".json", prefix="playwright_state_")
                    os.close(fd)
                    temp_state_file = Path(path)
                    with open(temp_state_file, "w", encoding="utf-8") as f:
                        json.dump(db_state, f)
                    storage_state_param = str(temp_state_file)
                except Exception as e:
                    logger.error(f"Failed to create temp state file: {e}")
                    storage_state_param = None
            else:
                # Load stored session cookies if state exists locally
                with STATE_LOCK:
                    state_exists = self.state_path.exists()
                if state_exists:
                    logger.info(f"Loading session context state from local file: {self.state_path}")
                    storage_state_param = str(self.state_path)
                else:
                    storage_state_param = None
            
            if storage_state_param:
                self.context = self.browser.new_context(
                    storage_state=storage_state_param,
                    user_agent=user_agent
                )
                if temp_state_file and temp_state_file.exists():
                    try:
                        temp_state_file.unlink()
                    except Exception:
                        pass
            else:
                self.context = self.browser.new_context(
                    user_agent=user_agent
                )
                
        # Inject Evasion & Hardening Scripts
        self.context.add_init_script(STEALTH_SCRIPT)
        return self

    def navigate(self, url: str):
        page = self.context.new_page()
        page.goto(url)
        return page

    def save_state(self):
        """
        Saves authenticated state local cookie storage representation securely.
        """
        if not self.cdp_address and self.context:
            from src.db import get_db, current_user_id_var
            import time
            
            user_id = current_user_id_var.get()
            if user_id:
                try:
                    state_dict = self.context.storage_state()
                    db = get_db()
                    db["browser_states"].update_one(
                        {"user_id": user_id},
                        {"$set": {
                            "state": state_dict,
                            "updated_at": time.time()
                        }},
                        upsert=True
                    )
                    logger.info(f"Persisted browser session cookies to MongoDB for user: {user_id}")
                    return
                except Exception as e:
                    logger.error(f"Failed to save browser state to MongoDB: {e}")
            
            with STATE_LOCK:
                self.state_path.parent.mkdir(parents=True, exist_ok=True)
                self.context.storage_state(path=str(self.state_path))
            logger.info(f"Persisted browser session cookies locally to {self.state_path}")


    def close(self):
        if self.context and not self.cdp_address:
            self.save_state()
        if self.browser:
            if self.cdp_address:
                self.browser.disconnect()
            else:
                self.browser.close()
        if self.playwright:
            self.playwright.stop()
