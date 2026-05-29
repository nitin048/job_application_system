import time
import logging
import re
from pathlib import Path
from src.browser_driver import SecureBrowserDriver

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class NaukriRunner:
    def __init__(self, username: str, password: str, resume_path: str, headed: bool = True, cdp_address: str = ""):
        self.username = username
        self.password = password
        self.resume_path = resume_path
        self.headed = headed
        self.cdp_address = cdp_address
        self.driver = None

    def _make_driver(self) -> SecureBrowserDriver:
        return SecureBrowserDriver(
            headless=not self.headed,
            cdp_address=self.cdp_address
        )

    # ------------------------------------------------------------------
    # LOGIN HELPER
    # ------------------------------------------------------------------
    def _do_login(self, page) -> bool:
        """Performs Naukri login on the given page. Returns True on success."""
        logger.info("Navigating to Naukri login page...")
        page.goto("https://www.naukri.com/nlogin/login", wait_until="domcontentloaded")
        page.wait_for_timeout(2000)

        # Fill email
        try:
            page.fill("#usernameField", self.username)
            logger.info("Email filled.")
        except Exception as e:
            logger.error(f"Could not fill email field: {e}")
            return False

        # Fill password
        try:
            page.fill("#passwordField", self.password)
            logger.info("Password filled.")
        except Exception as e:
            logger.error(f"Could not fill password field: {e}")
            return False

        # Click submit
        try:
            page.click("button[type='submit']")
            logger.info("Login form submitted. Waiting for redirect...")
        except Exception as e:
            logger.error(f"Could not click submit: {e}")
            return False

        # Wait for successful redirect
        try:
            page.wait_for_url("**/mnjuser/**", timeout=15000)
            logger.info(f"Logged in successfully. Current URL: {page.url}")
            return True
        except Exception:
            # Check if we hit a captcha or wrong password page
            time.sleep(3)
            if "login" in page.url:
                logger.error("Login failed — still on login page. Check credentials.")
                return False
            logger.info(f"Login redirect detected. URL: {page.url}")
            return True

    def _ensure_logged_in(self, page) -> bool:
        """Check if session is valid; re-login if needed."""
        try:
            page.goto("https://www.naukri.com/mnjuser/homepage", wait_until="domcontentloaded", timeout=15000)
            page.wait_for_timeout(2000)
            if "login" in page.url or "nlogin" in page.url:
                logger.info("Session expired. Re-authenticating...")
                return self._do_login(page)
            logger.info("Active Naukri session confirmed.")
            return True
        except Exception as e:
            logger.warning(f"Session check failed: {e}. Attempting login...")
            return self._do_login(page)

    # ------------------------------------------------------------------
    # PROFILE BUMP (existing functionality)
    # ------------------------------------------------------------------
    def _update_profile_resume(self, page, resume_path: str) -> bool:
        """Helper to upload the resume at resume_path to the candidate's Naukri profile."""
        try:
            logger.info("Navigating to Naukri profile dashboard to sync resume...")
            page.goto("https://www.naukri.com/mnjuser/profile", wait_until="domcontentloaded")
            page.wait_for_timeout(3000)

            logger.info("Locating resume upload input element (input#attachCV)...")
            file_input = page.locator("input#attachCV")
            file_input.wait_for(state="attached", timeout=15000)

            logger.info(f"Uploading resume: {resume_path}")
            file_input.set_input_files(resume_path)
            time.sleep(6)
            logger.info("Naukri profile resume synced successfully!")
            return True
        except Exception as e:
            logger.error(f"Failed to update profile resume: {e}")
            return False

    def run_profile_update(self):
        """
        Automates updates to the Naukri profile to boost search rankings.
        1. Modifies PDF metadata to generate a new cryptographic hash.
        2. Uploads the newly hash-modified PDF to force timestamp refresh.
        """
        logger.info("Starting Naukri profile ranking bump routine")

        # Modify PDF resume hash first to make it a unique file
        from src.document_generator import DocumentGenerator
        doc_gen = DocumentGenerator(self.resume_path, self.resume_path)
        if doc_gen.regenerate_with_hash_modifier():
            logger.info("PDF Resume cryptographic hash buster applied successfully.")
        else:
            logger.warning("Could not regenerate PDF resume.")

        self.driver = self._make_driver()
        self.driver.start()

        try:
            page = self.driver.context.new_page()

            if not self._ensure_logged_in(page):
                logger.error("Cannot update profile: login failed.")
                return

            self._update_profile_resume(page, self.resume_path)
            logger.info("Naukri profile update complete. Visibility refreshed successfully!")

        except Exception as e:
            logger.error(f"Error executing Naukri profile update: {e}")
        finally:
            self.driver.close()
            logger.info("Naukri profile bump process finished.")

    # ------------------------------------------------------------------
    # AUTO APPLY
    # ------------------------------------------------------------------
    def apply_to_job(self, job_url: str, job_title: str, job_company: str, tailored_resume_path: str, is_easy_apply: bool = True) -> dict:
        """
        Logs into Naukri and applies to the given job URL.
        Returns a result dict: {success: bool, message: str, screenshot: str}
        """
        screenshot_dir = Path("data/screenshots")
        screenshot_dir.mkdir(parents=True, exist_ok=True)

        self.driver = self._make_driver()
        self.driver.start()
        page = self.driver.context.new_page()

        result = {"success": False, "message": "Apply flow did not complete.", "screenshot": ""}

        try:
            # Step 1: Ensure we are logged in
            if not self._ensure_logged_in(page):
                result["message"] = "Naukri login failed. Check USERNAME / PASSWORD in Settings."
                return result

            # Save session after successful login
            self.driver.save_state()

            # Step 1.5: Update profile resume with the tailored version
            # so Easy Apply (which uses the profile resume) uses the tailored one!
            self._update_profile_resume(page, tailored_resume_path)

            # Step 2: Navigate to the job detail URL
            logger.info(f"Navigating to job: {job_url}")
            page.goto(job_url, wait_until="domcontentloaded", timeout=20000)
            page.wait_for_timeout(3000)

            # Screenshot before apply
            ts = int(time.time())
            before_ss = str(screenshot_dir / f"apply_before_{ts}.png")
            page.screenshot(path=before_ss)
            logger.info(f"Pre-apply screenshot: {before_ss}")

            # Step 3: Find and click the Apply button
            applied = self._click_apply_button(page)
            if not applied:
                result["message"] = "Could not locate the Apply button on the job page. The page may require manual intervention."
                result["screenshot"] = before_ss
                return result

            # Wait for modal / next page
            page.wait_for_timeout(3000)

            # Check and close side panel popup if it appears
            self._close_side_panel(page)

            # Screenshot after clicking apply
            after_click_ss = str(screenshot_dir / f"apply_modal_{ts}.png")
            page.screenshot(path=after_click_ss)

            # Step 4: Handle the apply modal / chatbot / form
            self._handle_apply_flow(page, tailored_resume_path)

            # Wait after handling
            page.wait_for_timeout(2000)

            # Step 5: Check for success signals
            success = self._check_apply_success(page)

            final_ss = str(screenshot_dir / f"apply_final_{ts}.png")
            page.screenshot(path=final_ss)

            if success or not is_easy_apply:
                result["success"] = True
                if is_easy_apply:
                    result["message"] = f"Successfully applied to '{job_title}' at '{job_company}'!"
                else:
                    result["message"] = f"Opened company application page for '{job_title}' at '{job_company}'. Browser kept open for manual completion."
                result["screenshot"] = final_ss
                logger.info(result["message"])
            else:
                result["message"] = f"Applied button was clicked but success confirmation not detected. Check screenshot: {final_ss}"
                result["screenshot"] = final_ss
                logger.warning(result["message"])

        except Exception as e:
            logger.error(f"Apply runtime error: {e}")
            result["message"] = f"Apply runtime error: {str(e)}"
            try:
                err_ss = str(screenshot_dir / f"apply_error_{int(time.time())}.png")
                page.screenshot(path=err_ss)
                result["screenshot"] = err_ss
            except Exception:
                pass
        finally:
            if is_easy_apply:
                self.driver.close()
            else:
                logger.info("Manual apply flow: keeping the browser open for the user to complete the application.")

        return result

    def _click_apply_button(self, page) -> bool:
        """Attempts to find and click the Apply button using multiple selector strategies."""

        # Naukri uses multiple possible selectors for the apply button
        apply_selectors = [
            # Primary Naukri apply buttons
            "button.apply-button",
            "button[id*='apply']",
            "a.apply-button",
            "div.apply-button",
            ".styles_apply-button__N8fq5",
            ".styles_jhc__apply-btn__",
            "button.btn-dark-ot",
            # Generic text-match approach
            "button:has-text('Apply')",
            "a:has-text('Apply')",
            "button:has-text('Apply Now')",
            "a:has-text('Apply Now')",
        ]

        for selector in apply_selectors:
            try:
                btn = page.locator(selector).first
                if btn.is_visible():
                    logger.info(f"Found apply button with selector: '{selector}'")
                    btn.scroll_into_view_if_needed()
                    page.wait_for_timeout(500)
                    btn.click()
                    logger.info("Apply button clicked.")
                    return True
            except Exception:
                continue

        # Last resort: look for any visible button/link containing "Apply" text
        try:
            btns = page.locator("button, a").all()
            for btn in btns:
                try:
                    txt = btn.inner_text().strip().lower()
                    if txt in ("apply", "apply now", "easy apply", "apply on company site"):
                        if btn.is_visible():
                            logger.info(f"Found apply button by text: '{txt}'")
                            btn.scroll_into_view_if_needed()
                            page.wait_for_timeout(300)
                            btn.click()
                            return True
                except Exception:
                    continue
        except Exception as e:
            logger.warning(f"Text-based button search failed: {e}")

        logger.warning("No apply button found on page.")
        return False

    def _handle_apply_flow(self, page, tailored_resume_path: str):
        """
        Handles Naukri's multi-step apply flow:
        - Chatbot-style question steps (click Next/Continue)
        - Resume upload if file input appears
        - Final Submit / Apply button
        """
        logger.info("Handling apply flow (modal / chatbot / form steps)...")

        # Check and close side panel popup if it appears
        self._close_side_panel(page)

        # Naukri sometimes uses a chatbot-style apply modal with multiple steps
        # We loop through up to 10 steps, clicking Next/Continue until Submit appears
        for step in range(10):
            page.wait_for_timeout(1500)
            self._close_side_panel(page)

            # Check if a file upload input appears
            try:
                file_inputs = page.locator("input[type='file']").all()
                for fi in file_inputs:
                    if fi.is_visible():
                        logger.info(f"File input found at step {step}. Uploading tailored resume...")
                        try:
                            fi.set_input_files(tailored_resume_path)
                            page.wait_for_timeout(2000)
                            logger.info("Resume uploaded to apply form.")
                        except Exception as e:
                            logger.warning(f"Resume upload failed: {e}")
            except Exception:
                pass

            # Check for radio/checkbox questions and answer Yes to everything
            try:
                radios = page.locator("input[type='radio']").all()
                for radio in radios:
                    try:
                        if not radio.is_checked() and radio.is_visible():
                            val = radio.get_attribute("value") or ""
                            label = ""
                            rid = radio.get_attribute("id")
                            if rid:
                                lbl_el = page.locator(f"label[for='{rid}']")
                                if lbl_el.count() > 0:
                                    label = lbl_el.first.inner_text().lower()
                            # Default: click Yes / True / Agree options
                            if any(w in (val + label) for w in ["yes", "true", "agree", "1", "no"]):
                                radio.click()
                                logger.info(f"Radio answered: {val or label}")
                                break
                    except Exception:
                        continue
            except Exception:
                pass

            # Check for text inputs asking years of experience or similar
            try:
                text_inputs = page.locator("input[type='text'], input[type='number']").all()
                for ti in text_inputs:
                    try:
                        if ti.is_visible() and ti.is_editable():
                            current_val = ti.input_value()
                            if not current_val:
                                placeholder = ti.get_attribute("placeholder") or ""
                                label_text = ""
                                tid = ti.get_attribute("id")
                                if tid:
                                    lbl = page.locator(f"label[for='{tid}']")
                                    if lbl.count() > 0:
                                        label_text = lbl.first.inner_text().lower()
                                if "year" in (placeholder + label_text).lower() or "experience" in (placeholder + label_text).lower():
                                    ti.fill("7")
                                    logger.info(f"Filled experience field: 7")
                                elif "notice" in (placeholder + label_text).lower():
                                    ti.fill("30")
                                    logger.info("Filled notice period: 30")
                                elif "salary" in (placeholder + label_text).lower() or "ctc" in (placeholder + label_text).lower():
                                    ti.fill("1200000")
                                    logger.info("Filled expected salary: 1200000")
                    except Exception:
                        continue
            except Exception:
                pass

            # Look for Submit / Apply / Proceed button
            submit_found = False
            submit_selectors = [
                "button:has-text('Submit')",
                "button:has-text('Apply')",
                "button:has-text('Apply Now')",
                "button:has-text('Proceed')",
                "button:has-text('Next')",
                "button:has-text('Continue')",
                "button[type='submit']",
                ".chatbot__submit",
                ".apply__submit",
            ]

            for sel in submit_selectors:
                try:
                    btn = page.locator(sel).first
                    if btn.is_visible():
                        btn_text = btn.inner_text().strip()
                        logger.info(f"Step {step}: clicking '{btn_text}'")
                        btn.click()
                        submit_found = True

                        # If this is a final submit (not just Next/Continue), we're done
                        if any(w in btn_text.lower() for w in ["submit", "apply"]):
                            logger.info("Final Apply/Submit button clicked. Apply flow complete.")
                            return

                        break  # Continue to next step
                except Exception:
                    continue

            if not submit_found:
                logger.info(f"No submit/next button found at step {step}. Flow likely complete.")
                return

        logger.info("Apply modal flow finished (max steps reached).")

    def _check_apply_success(self, page) -> bool:
        """Check if apply was successful by looking for confirmation signals."""
        success_texts = [
            "application submitted",
            "applied successfully",
            "your application",
            "thank you for applying",
            "successfully applied",
            "application sent",
            "you have applied",
        ]
        try:
            body_text = page.locator("body").inner_text().lower()
            for text in success_texts:
                if text in body_text:
                    logger.info(f"Success signal detected: '{text}'")
                    return True
        except Exception:
            pass

        # Also check page URL for any applied redirect
        try:
            if "applied" in page.url.lower() or "success" in page.url.lower():
                return True
        except Exception:
            pass

        return False

    def _close_side_panel(self, page):
        """
        Scrapes and clicks the close button of any active questionnaire drawer or chatbot side panel
        if it appears at apply time.
        """
        close_selectors = [
            "span[class*='crossIcon']",
            "span[class*='closeIcon']",
            "[class*='drawer'] [class*='close']",
            "[class*='drawer'] [class*='Close']",
            "[class*='chatbot'] [class*='close']",
            "[class*='side-panel'] [class*='close']",
            "[class*='drawer-close']",
            "[class*='close-icon']",
            ".crossIcon",
            ".closeIcon",
            "span.icon-close",
            "i.icon-close",
            "button:has-text('✕')",
            "span:has-text('✕')",
            "i:has-text('✕')",
            "i[class*='close']",
            "[class*='Close']",
            ".drawer-close-btn",
            ".drawer-close-icon"
        ]
        
        for sel in close_selectors:
            try:
                el = page.locator(sel).first
                if el and el.is_visible():
                    logger.info(f"Detected side panel close element matching selector: {sel}. Closing panel...")
                    el.click()
                    page.wait_for_timeout(1000)
                    return True
            except Exception:
                continue
        return False
