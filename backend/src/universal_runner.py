import time
import logging
import re
from pathlib import Path
from src.browser_driver import SecureBrowserDriver
from src.naukri_runner import NaukriRunner

class CallbackLogger:
    def __init__(self, name):
        self._logger = logging.getLogger(name)
        self.callback = None
    
    def info(self, msg, *args, **kwargs):
        self._logger.info(msg, *args, **kwargs)
        if self.callback:
            try:
                self.callback(str(msg))
            except Exception:
                pass
                
    def warning(self, msg, *args, **kwargs):
        self._logger.warning(msg, *args, **kwargs)
        if self.callback:
            try:
                self.callback(f"[WARNING] {msg}")
            except Exception:
                pass
                
    def error(self, msg, *args, **kwargs):
        self._logger.error(msg, *args, **kwargs)
        if self.callback:
            try:
                self.callback(f"[ERROR] {msg}")
            except Exception:
                pass

logging.basicConfig(level=logging.INFO)
logger = CallbackLogger(__name__)

# Monkey-patch NaukriRunner's logger to use CallbackLogger
import src.naukri_runner
src.naukri_runner.logger = logger

class UniversalRunner(NaukriRunner):
    def __init__(self, username: str, password: str, resume_path: str, headed: bool = True, cdp_address: str = "", log_callback=None):
        super().__init__(username, password, resume_path, headed, cdp_address)
        logger.callback = log_callback

    def _get_credentials(self, portal: str):
        """
        Retrieves the credentials for the specific portal from config.constants.
        Falls back to general USERNAME/PASSWORD if portal-specific ones are not set.
        """
        import config.constants as consts
        from src.crypto_manager import decrypt_value, is_encrypted
        username = ""
        password = ""
        
        if portal == "linkedin":
            username = getattr(consts, "LINKEDIN_USERNAME", "")
            password = getattr(consts, "LINKEDIN_PASSWORD", "")
        elif portal == "indeed":
            username = getattr(consts, "INDEED_USERNAME", "")
            password = getattr(consts, "INDEED_PASSWORD", "")
        elif portal == "naukri":
            username = getattr(consts, "NAUKRI_USERNAME", "")
            password = getattr(consts, "NAUKRI_PASSWORD", "")

        # Fallback to general credentials if empty
        if not username:
            username = self.username or getattr(consts, "USERNAME", "")
        if not password:
            password = self.password or getattr(consts, "PASSWORD", "")

        # Explicitly decrypt/deobfuscate if still encrypted/obfuscated
        if is_encrypted(username):
            username = decrypt_value(username)
        if is_encrypted(password):
            password = decrypt_value(password)

        return username, password

    def _is_2fa_active(self, page, portal: str) -> bool:
        url = page.url.lower()
        
        # Check URL patterns
        if "/checkpoint/challenge/" in url or "/checkpoint/lg/" in url or "challenge" in url or "captcha" in url or "verification" in url:
            return True
            
        # Check page text content for verification/captcha signs
        body_text = ""
        try:
            body_text = page.locator("body").inner_text().lower()
        except Exception:
            pass
            
        security_keywords = [
            "verification code", "two-factor", "2-factor", "security check", 
            "verify your identity", "enter the code", "verify you are human", 
            "solve the captcha", "prove you are human", "quick verification", 
            "security verification"
        ]
        if any(w in body_text for w in security_keywords):
            return True
            
        # Check for inputs that ask for verification codes
        try:
            input_selectors = [
                "input#input-code", "input[name='pin']", "input[name='code']", 
                "input[placeholder*='code']", "input[placeholder*='pin']",
                "input[id*='code']", "input[id*='pin']"
            ]
            for selector in input_selectors:
                if page.locator(selector).count() > 0:
                    return True
        except Exception:
            pass

        # Check for typical captcha/challenge iframe
        try:
            iframes = page.locator("iframe").all()
            for iframe in iframes:
                try:
                    src = iframe.get_attribute("src") or ""
                    src_lower = src.lower()
                    if any(c in src_lower for c in ["captcha", "challenge", "recaptcha", "hcaptcha", "arkoselabs", "funcaptcha"]):
                        return True
                except Exception:
                    continue
        except Exception:
            pass

        return False

    def _wait_for_2fa_manual(self, page, portal: str) -> bool:
        """
        Detects security checkpoints and prompts the user to resolve it.
        Performs 4 attempts of 30 seconds each (total 2 minutes).
        Raises ValueError if not resolved.
        """
        portal_name = portal.capitalize()
        for attempt in range(1, 5):
            logger.warning(
                f"[ACTION REQUIRED] {portal_name} security checkpoint or 2FA detected! "
                f"Attempt {attempt}/4: Please switch to the headed browser and complete verification manually. "
                f"Waiting 30 seconds..."
            )
            
            # Poll every 1 second for 30 seconds
            for second in range(30):
                page.wait_for_timeout(1000)
                if not self._is_2fa_active(page, portal):
                    logger.info(f"[2FA Success] {portal_name} security verification resolved!")
                    return True
            
            logger.info(f"Attempt {attempt}/4 complete. Security check still active.")
            
        raise ValueError(f"2-Factor Authentication not resolved on {portal_name} after 4 attempts. Aborting.")

    # ------------------------------------------------------------------
    # PORTAL LOGIN FLOWS
    # ------------------------------------------------------------------
    def _login_naukri(self, page) -> bool:
        username, password = self._get_credentials("naukri")
        logger.info("[Naukri] Navigating to Naukri login page...")
        page.goto("https://www.naukri.com/nlogin/login", wait_until="domcontentloaded")
        page.wait_for_timeout(2000)
        try:
            page.fill("#usernameField", username)
            page.fill("#passwordField", password)
            page.click("button[type='submit']")
            logger.info("[Naukri] Login form submitted. Checking for 2FA/Checkpoint...")
        except Exception as e:
            logger.error(f"[Naukri] Login fill failed: {e}")
            return False
        
        page.wait_for_timeout(3000)
        if self._is_2fa_active(page, "naukri"):
            self._wait_for_2fa_manual(page, "naukri")

        # Wait for redirect
        try:
            page.wait_for_url("**/mnjuser/**", timeout=15000)
            logger.info("[Naukri] Logged in successfully!")
            return True
        except Exception:
            if "login" in page.url:
                logger.error("[Naukri] Login failed. Check credentials.")
                return False
            return True

    def _ensure_logged_in_naukri(self, page) -> bool:
        try:
            page.goto("https://www.naukri.com/mnjuser/homepage", wait_until="domcontentloaded", timeout=15000)
            page.wait_for_timeout(2000)
            if "login" in page.url or "nlogin" in page.url:
                logger.info("[Naukri] Session expired. Re-authenticating...")
                return self._login_naukri(page)
            logger.info("[Naukri] Active session confirmed.")
            return True
        except Exception as e:
            logger.warning(f"[Naukri] Session check failed: {e}. Attempting login...")
            return self._login_naukri(page)

    def _login_linkedin(self, page) -> bool:
        username, password = self._get_credentials("linkedin")
        logger.info("[LinkedIn] Navigating to LinkedIn login page...")
        page.goto("https://www.linkedin.com/login", wait_until="domcontentloaded", timeout=20000)
        page.wait_for_timeout(2000)

        if "/feed" in page.url or any(c['name'] == 'li_at' for c in page.context.cookies()):
            logger.info("[LinkedIn] Already logged in.")
            return True

        try:
            page.fill("input#username", username)
            page.fill("input#password", password)
            page.click("button[type='submit']")
            logger.info("[LinkedIn] Login form submitted. Checking for 2FA...")
        except Exception as e:
            logger.error(f"[LinkedIn] Could not fill login form: {e}")
            return False

        page.wait_for_timeout(3000)
        
        # 2FA check
        if self._is_2fa_active(page, "linkedin"):
            self._wait_for_2fa_manual(page, "linkedin")

        # Wait a few seconds for redirect and cookie placement
        page.wait_for_timeout(5000)
        
        # Verify success via session cookies
        cookies = page.context.cookies()
        if any(c['name'] == 'li_at' for c in cookies):
            logger.info("[LinkedIn] Logged in successfully (verified via session cookie)!")
            return True
            
        # Verify success via UI elements or URL feed
        if "/feed" in page.url or page.locator("#global-nav").count() > 0 or page.locator("button:has-text('Sign Out')").count() > 0:
            logger.info("[LinkedIn] Logged in successfully (verified via UI elements)!")
            return True

        try:
            page.wait_for_url("**/feed/**", timeout=10000)
            logger.info("[LinkedIn] Logged in successfully!")
            return True
        except Exception:
            if "login" in page.url or "checkpoint" in page.url:
                logger.error("[LinkedIn] Login failed or still stuck on checkpoint.")
                return False
            # Assume success if we are not on login/checkpoint page anymore
            return True

    def _ensure_logged_in_linkedin(self, page) -> bool:
        # Check active session cookies first
        cookies = page.context.cookies()
        if any(c['name'] == 'li_at' for c in cookies):
            logger.info("[LinkedIn] Active session confirmed via cookie.")
            return True
            
        try:
            page.goto("https://www.linkedin.com/feed/", wait_until="domcontentloaded", timeout=15000)
            page.wait_for_timeout(2000)
            if any(c['name'] == 'li_at' for c in page.context.cookies()):
                logger.info("[LinkedIn] Active session confirmed.")
                return True
            if "login" in page.url or "/login" in page.url or "signup" in page.url:
                logger.info("[LinkedIn] Session expired. Re-authenticating...")
                return self._login_linkedin(page)
            logger.info("[LinkedIn] Active session confirmed.")
            return True
        except Exception as e:
            logger.warning(f"[LinkedIn] Session check failed: {e}. Attempting login...")
            return self._login_linkedin(page)

    def _login_indeed(self, page) -> bool:
        username, password = self._get_credentials("indeed")
        logger.info("[Indeed] Navigating to Indeed login page...")
        page.goto("https://secure.indeed.com/auth", wait_until="domcontentloaded", timeout=20000)
        page.wait_for_timeout(2000)

        if "indeed.com" in page.url and "/auth" not in page.url:
            logger.info("[Indeed] Already logged in.")
            return True

        try:
            page.fill("input#ifl-InputFormField-email", username)
            page.click("button[type='submit']")
            page.wait_for_timeout(1500)
            page.fill("input#ifl-InputFormField-password", password)
            page.click("button[type='submit']")
            logger.info("[Indeed] Login form submitted. Checking for 2FA...")
        except Exception as e:
            logger.error(f"[Indeed] Login form fill failed: {e}")
            return False

        page.wait_for_timeout(3000)
        if self._is_2fa_active(page, "indeed"):
            self._wait_for_2fa_manual(page, "indeed")

        return True

    def _ensure_logged_in_indeed(self, page) -> bool:
        try:
            page.goto("https://www.indeed.com/", wait_until="domcontentloaded", timeout=15000)
            page.wait_for_timeout(2000)
            if "auth" in page.url or "login" in page.url:
                return self._login_indeed(page)
            return True
        except Exception:
            return self._login_indeed(page)

    # ------------------------------------------------------------------
    # ENTRY POINT - APPLY TO JOB
    # ------------------------------------------------------------------
    def apply_to_job(self, job_url: str, job_title: str, job_company: str, tailored_resume_path: str, is_easy_apply: bool = True) -> dict:
        job_url_lower = job_url.lower()
        if "linkedin.com" in job_url_lower:
            portal = "linkedin"
        elif "indeed.com" in job_url_lower:
            portal = "indeed"
        elif "naukri.com" in job_url_lower:
            portal = "naukri"
        else:
            portal = "generic"

        logger.info(f"Running Universal apply pipeline for {portal.upper()} job: {job_url}")

        if portal == "naukri":
            return self._apply_naukri(job_url, job_title, job_company, tailored_resume_path, is_easy_apply)
        elif portal == "linkedin":
            return self._apply_linkedin(job_url, job_title, job_company, tailored_resume_path, is_easy_apply)
        elif portal == "indeed":
            return self._apply_indeed(job_url, job_title, job_company, tailored_resume_path, is_easy_apply)
        else:
            return self._apply_generic(job_url, job_title, job_company, tailored_resume_path)

    # ------------------------------------------------------------------
    # NAUKRI APPLY
    # ------------------------------------------------------------------
    def _apply_naukri(self, job_url: str, job_title: str, job_company: str, tailored_resume_path: str, is_easy_apply: bool = True) -> dict:
        screenshot_dir = Path("data/screenshots")
        screenshot_dir.mkdir(parents=True, exist_ok=True)
        ts = int(time.time())

        self.driver = self._make_driver()
        self.driver.start()
        page = self.driver.context.new_page()

        result = {"success": False, "message": "Naukri apply flow did not complete.", "screenshot": ""}

        try:
            if not self._ensure_logged_in_naukri(page):
                result["message"] = "Naukri login failed. Check credentials in Settings."
                return result

            self.driver.save_state()

            # Sync tailored resume to profile
            self._update_profile_resume(page, tailored_resume_path)

            logger.info(f"[Naukri] Navigating to job: {job_url}")
            page.goto(job_url, wait_until="domcontentloaded", timeout=20000)
            page.wait_for_timeout(3000)
            if self._is_2fa_active(page, "naukri"):
                self._wait_for_2fa_manual(page, "naukri")

            before_ss = str(screenshot_dir / f"apply_before_naukri_{ts}.png")
            page.screenshot(path=before_ss)
            result["screenshot"] = before_ss

            applied = self._click_apply_button(page)
            if not applied:
                result["message"] = "Could not locate Apply button. Manual intervention required."
                return result

            page.wait_for_timeout(3000)
            self._close_side_panel(page)

            # Chatbot steps
            self._handle_apply_flow(page, tailored_resume_path)
            page.wait_for_timeout(2000)

            success = self._check_apply_success(page)
            final_ss = str(screenshot_dir / f"apply_final_naukri_{ts}.png")
            page.screenshot(path=final_ss)
            result["screenshot"] = final_ss

            if success or not is_easy_apply:
                result["success"] = True
                result["message"] = f"Successfully applied to '{job_title}' at '{job_company}' on Naukri!"
            else:
                result["message"] = "Applied button clicked but success check failed."
        except Exception as e:
            logger.error(f"Naukri apply failed: {e}")
            result["message"] = f"Naukri apply failed: {str(e)}"
        finally:
            if is_easy_apply:
                self.driver.close()

        return result

    # ------------------------------------------------------------------
    # LINKEDIN APPLY
    # ------------------------------------------------------------------
    def _apply_linkedin(self, job_url: str, job_title: str, job_company: str, tailored_resume_path: str, is_easy_apply: bool = True) -> dict:
        screenshot_dir = Path("data/screenshots")
        screenshot_dir.mkdir(parents=True, exist_ok=True)
        ts = int(time.time())

        self.driver = self._make_driver()
        self.driver.start()
        page = self.driver.context.new_page()

        result = {"success": False, "message": "LinkedIn apply flow did not complete.", "screenshot": ""}

        try:
            if not self._ensure_logged_in_linkedin(page):
                result["message"] = "LinkedIn login failed. Check credentials in Settings."
                return result

            self.driver.save_state()

            logger.info(f"[LinkedIn] Navigating to job: {job_url}")
            page.goto(job_url, wait_until="domcontentloaded", timeout=20000)
            page.wait_for_timeout(3500)
            if self._is_2fa_active(page, "linkedin"):
                self._wait_for_2fa_manual(page, "linkedin")

            before_ss = str(screenshot_dir / f"apply_before_linkedin_{ts}.png")
            page.screenshot(path=before_ss)
            result["screenshot"] = before_ss

            apply_btn = None
            selectors = [
                "button.jobs-apply-button",
                "button:has-text('Easy Apply')",
                "button:has-text('Apply now')",
                "button:has-text('Apply')"
            ]
            for sel in selectors:
                try:
                    el = page.locator(sel).first
                    if el.is_visible():
                        apply_btn = el
                        break
                except Exception:
                    continue

            if not apply_btn:
                result["message"] = "Could not locate Apply / Easy Apply button on LinkedIn job page."
                return result

            btn_text = apply_btn.inner_text().strip()
            logger.info(f"[LinkedIn] Clicking apply button: '{btn_text}'")
            apply_btn.click()
            page.wait_for_timeout(3000)

            # Check if Easy Apply modal is visible
            modal = page.locator("div.jobs-easy-apply-modal, [class*='easy-apply-modal']").first
            is_modal_visible = False
            try:
                is_modal_visible = modal.is_visible()
            except Exception:
                pass

            if is_modal_visible:
                logger.info("[LinkedIn] Easy Apply modal detected. Proceeding...")
                
                for step in range(10):
                    page.wait_for_timeout(1500)
                    
                    # 1. Upload tailored resume if file upload input is visible
                    try:
                        file_inputs = page.locator("input[type='file']").all()
                        for fi in file_inputs:
                            if fi.is_visible():
                                logger.info(f"[LinkedIn] Uploading resume: {tailored_resume_path}")
                                fi.set_input_files(tailored_resume_path)
                                page.wait_for_timeout(2000)
                    except Exception as e:
                        logger.warning(f"[LinkedIn] Resume upload step issue: {e}")

                    # 2. Answer radio buttons (default to Yes/Agree)
                    try:
                        radios = page.locator("input[type='radio']").all()
                        for r in radios:
                            if not r.is_checked() and r.is_visible():
                                label_id = r.get_attribute("id")
                                label_txt = ""
                                if label_id:
                                    lbl = page.locator(f"label[for='{label_id}']")
                                    if lbl.count() > 0:
                                        label_txt = lbl.first.inner_text().lower()
                                if any(w in label_txt for w in ["yes", "agree", "correct"]):
                                    r.click()
                                    break
                    except Exception:
                        pass

                    # 3. Next / Submit buttons
                    submit_btn = None
                    button_selectors = [
                        "button:has-text('Submit application')",
                        "button:has-text('Next')",
                        "button:has-text('Review')",
                        "button:has-text('Continue')"
                    ]
                    for bs in button_selectors:
                        try:
                            btn = page.locator(bs).first
                            if btn.is_visible():
                                submit_btn = btn
                                break
                        except Exception:
                            continue

                    if not submit_btn:
                        logger.info("[LinkedIn] No navigation buttons found. Apply complete or stopped.")
                        break

                    click_txt = submit_btn.inner_text().strip()
                    logger.info(f"[LinkedIn] Clicking '{click_txt}' button...")
                    submit_btn.click()
                    
                    if "Submit application" in click_txt:
                        logger.info("[LinkedIn] Submit application clicked successfully!")
                        page.wait_for_timeout(3000)
                        result["success"] = True
                        result["message"] = f"Successfully auto-applied on LinkedIn to '{job_title}' at '{job_company}'!"
                        break

                final_ss = str(screenshot_dir / f"apply_final_linkedin_{ts}.png")
                page.screenshot(path=final_ss)
                result["screenshot"] = final_ss
            else:
                # Redirect apply
                logger.info("[LinkedIn] Standard redirect apply. Browser kept open.")
                result["success"] = True
                result["message"] = f"Opened LinkedIn Apply page for '{job_title}' at '{job_company}'. Complete manually."
                is_easy_apply = False # keeps browser open
        except Exception as e:
            logger.error(f"LinkedIn apply failed: {e}")
            result["message"] = f"LinkedIn apply failed: {str(e)}"
        finally:
            if is_easy_apply:
                self.driver.close()

        return result

    # ------------------------------------------------------------------
    # INDEED APPLY
    # ------------------------------------------------------------------
    def _apply_indeed(self, job_url: str, job_title: str, job_company: str, tailored_resume_path: str, is_easy_apply: bool = True) -> dict:
        screenshot_dir = Path("data/screenshots")
        screenshot_dir.mkdir(parents=True, exist_ok=True)
        ts = int(time.time())

        self.driver = self._make_driver()
        self.driver.start()
        page = self.driver.context.new_page()

        result = {"success": False, "message": "Indeed apply flow did not complete.", "screenshot": ""}

        try:
            if not self._ensure_logged_in_indeed(page):
                result["message"] = "Indeed login failed. Check credentials in Settings."
                return result

            self.driver.save_state()

            logger.info(f"[Indeed] Navigating to job: {job_url}")
            page.goto(job_url, wait_until="domcontentloaded", timeout=20000)
            page.wait_for_timeout(3500)
            if self._is_2fa_active(page, "indeed"):
                self._wait_for_2fa_manual(page, "indeed")

            before_ss = str(screenshot_dir / f"apply_before_indeed_{ts}.png")
            page.screenshot(path=before_ss)
            result["screenshot"] = before_ss

            apply_btn = None
            selectors = [
                "button:has-text('Apply now')",
                "a:has-text('Apply now')",
                "button:has-text('Apply')",
                "a:has-text('Apply')"
            ]
            for sel in selectors:
                try:
                    el = page.locator(sel).first
                    if el.is_visible():
                        apply_btn = el
                        break
                except Exception:
                    continue

            if not apply_btn:
                result["message"] = "Could not locate Apply button on Indeed job page."
                return result

            logger.info("[Indeed] Clicking apply button...")
            apply_btn.click()
            page.wait_for_timeout(3000)

            # Keeping indeed open for manual completion or fallback
            result["success"] = True
            result["message"] = f"Opened Indeed job application for '{job_title}' at '{job_company}'. Browser kept open."
            is_easy_apply = False
        except Exception as e:
            logger.error(f"Indeed apply failed: {e}")
            result["message"] = f"Indeed apply failed: {str(e)}"
        finally:
            if is_easy_apply:
                self.driver.close()

        return result

    # ------------------------------------------------------------------
    # GENERIC FALLBACK APPLY
    # ------------------------------------------------------------------
    def _apply_generic(self, job_url: str, job_title: str, job_company: str, tailored_resume_path: str) -> dict:
        self.driver = self._make_driver()
        self.driver.start()
        page = self.driver.context.new_page()

        logger.info(f"[Generic] Navigating to job: {job_url}")
        page.goto(job_url, wait_until="domcontentloaded", timeout=20000)
        
        return {
            "success": True,
            "message": f"Opened generic application page for '{job_title}' at '{job_company}'. Browser kept open for manual completion.",
            "screenshot": ""
        }
