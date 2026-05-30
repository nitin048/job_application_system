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
        
        if self.cdp_address:
            cdp_target = self.cdp_address.strip()
            # If only digits, treat as local port
            if cdp_target.isdigit():
                port = int(cdp_target)
                if not (1 <= port <= 65535):
                    raise ValueError(f"Invalid CDP port: '{cdp_target}' is out of range (must be 1-65535). Please correct this in Secrets & Keys.")
                cdp_target = f"127.0.0.1:{port}"
            else:
                if ":" in cdp_target:
                    host, port_str = cdp_target.rsplit(":", 1)
                    if port_str.isdigit():
                        port = int(port_str)
                        if not (1 <= port <= 65535):
                            raise ValueError(f"Invalid CDP port: '{port_str}' in '{cdp_target}' is out of range (must be 1-65535). Please correct this in Secrets & Keys.")
                else:
                    cdp_target = f"{cdp_target}:9222"

            logger.info(f"Connecting to browser via CDP: {cdp_target}")
            self.browser = self.playwright.chromium.connect_over_cdp(f"http://{cdp_target}")
            # Get existing context if active or default to new
            self.context = self.browser.contexts[0] if self.browser.contexts else self.browser.new_context()
        else:
            # Standalone local Chromium with user-like slow_mo delay
            logger.info("Initializing standalone Chromium context with slow_mo delay")
            self.browser = self.playwright.chromium.launch(
                headless=self.headless,
                slow_mo=150
            )
            
            user_agent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            
            # Load stored session cookies if state exists locally
            with STATE_LOCK:
                state_exists = self.state_path.exists()
                
            if state_exists:
                logger.info(f"Loading session context state from {self.state_path}")
                with STATE_LOCK:
                    self.context = self.browser.new_context(
                        storage_state=str(self.state_path),
                        user_agent=user_agent
                    )
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
            with STATE_LOCK:
                self.state_path.parent.mkdir(parents=True, exist_ok=True)
                self.context.storage_state(path=str(self.state_path))
            logger.info(f"Persisted browser session cookies to {self.state_path}")

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
