import logging
import urllib.parse
import re
from typing import List, Dict, Any
from src.providers.base_provider import BasePortalProvider
from src.discovery import normalize_url

logger = logging.getLogger(__name__)

class NaukriProvider(BasePortalProvider):
    def __init__(self, config):
        super().__init__(config)
        import threading
        self._scraped_urls = set()
        self._scraped_urls_lock = threading.Lock()

    def search_jobs(self, position: str, location: str, cache: dict = None, process_listing_cb = None) -> List[Dict[str, Any]]:
        from src.browser_driver import SecureBrowserDriver
        from config.constants import AGENT_BROWSER_HEADED, AGENT_BROWSER_CDP
        
        logger.info(f"Scraping Naukri listings for '{position}' in '{location}'...")
        driver = SecureBrowserDriver(
            headless=not AGENT_BROWSER_HEADED,
            cdp_address=AGENT_BROWSER_CDP
        )
        results = []
        
        # Build experience query param from candidate config
        cand_exp = getattr(self.config.search_parameters, "candidate_experience_years", None)
        exp_param_raw = ""
        if cand_exp is not None and cand_exp > 0:
            exp_min = max(0, int(cand_exp) - 2)
            exp_max = int(cand_exp) + 2
            exp_param_raw = f"experience={exp_min}%2C{exp_max}&experienceRangeType=STATIC"
            logger.info(f"Applying experience filter: {exp_min}-{exp_max} years")
            
        cand_skills = getattr(self.config.search_parameters, "candidate_skills", [])
        k_query = ""
        if cand_skills:
            k_query = ", ".join(cand_skills[:4])
            logger.info(f"Applying skills query parameter: {k_query}")
            
        params = []
        if exp_param_raw:
            params.append(exp_param_raw)
        if k_query:
            params.append(f"k={urllib.parse.quote(k_query)}")
            
        query_str = ""
        if params:
            query_str = "?" + "&".join(params)
        
        try:
            driver.start()
            page = driver.context.new_page()
            detail_page = driver.context.new_page()
            
            pos_slug = urllib.parse.quote(position.lower().replace(" ", "-"))
            loc_slug = urllib.parse.quote(location.lower().replace(" ", "-"))
            
            max_pages = 2
            for page_idx in range(1, max_pages + 1):
                if page_idx == 1:
                    url = f"https://www.naukri.com/{pos_slug}-jobs-in-{loc_slug}{query_str}"
                else:
                    url = f"https://www.naukri.com/{pos_slug}-jobs-in-{loc_slug}-{page_idx}{query_str}"
                    
                logger.info(f"Navigating to Naukri url (Page {page_idx}): {url}")
                try:
                    page.goto(url, wait_until="domcontentloaded", timeout=15000)
                    page.wait_for_timeout(3000)
                    
                    page.evaluate("window.scrollTo(0, document.body.scrollHeight/2)")
                    page.wait_for_timeout(1000)
                    
                    job_elements = []
                    for sel in ["div.srp-job-tuple", "article.jobTuple", "div.cust-job-tuple", "div.jobTuple"]:
                        elems = page.query_selector_all(sel)
                        if elems:
                            job_elements = elems
                            logger.info(f"Found {len(elems)} elements with selector '{sel}' on page {page_idx}")
                            break
                    
                    if not job_elements:
                        logger.info(f"No job elements discovered on page {page_idx}. Stopping page loop.")
                        break
                        
                    for elem in job_elements[:8]:
                        try:
                            title_el = elem.query_selector("a.title") or elem.query_selector("a.job-title")
                            title = title_el.inner_text().strip() if title_el else "Software Engineer"
                            
                            job_url = title_el.get_attribute("href") if title_el else ""
                            if not job_url:
                                continue
                                
                            clean_url = normalize_url(job_url)
                            with self._scraped_urls_lock:
                                if clean_url in self._scraped_urls:
                                    logger.info(f"Skipping duplicate concurrent crawl/load for URL: {clean_url}")
                                    continue
                                self._scraped_urls.add(clean_url)
                                
                            company_el = elem.query_selector("a.comp-name") or elem.query_selector("div.companyInfo a") or elem.query_selector(".companyName")
                            company = company_el.inner_text().strip() if company_el else "Unknown Company"
                            
                            loc_el = elem.query_selector("span.loc-wrap") or elem.query_selector("li.location")
                            loc_text = loc_el.inner_text().strip() if loc_el else location
                            
                            desc_el = elem.query_selector("span.job-desc") or elem.query_selector(".jobDescription") or elem.query_selector(".desc")
                            desc = desc_el.inner_text().strip() if desc_el else f"Opportunity for {title} at {company} in {loc_text}."
                            
                            if cache and job_url in cache:
                                cached_job = cache[job_url]
                                full_desc = cached_job.get("description", "")
                                is_easy_apply = cached_job.get("apply_type", "Easy Apply") == "Easy Apply"
                                logger.info(f"Using cached description/apply type for already crawled job: {job_url}")
                            else:
                                full_desc, page_easy_apply = self.fetch_job_details(detail_page, job_url)
                                card_text = elem.inner_text().lower()
                                list_easy_apply = True
                                if "company site" in card_text or "external" in card_text or "website" in card_text:
                                    list_easy_apply = False
                                    
                                is_easy_apply = page_easy_apply if list_easy_apply else False
                                
                            job_desc = full_desc if full_desc else desc
                            
                            raw_dict = {
                                "id": f"naukri_{hash(job_url) & 0xffffffff}",
                                "title": title,
                                "company": company,
                                "location": loc_text,
                                "description": job_desc,
                                "url": clean_url,
                                "is_easy_apply": is_easy_apply,
                                "portal": "naukri"
                            }
                            
                            if process_listing_cb:
                                processed = process_listing_cb(raw_dict)
                                if processed:
                                    results.append(processed)
                            else:
                                results.append(raw_dict)
                        except Exception as el_err:
                            logger.debug(f"Error parsing Naukri job element: {el_err}")
                except Exception as page_err:
                    logger.warning(f"Failed to scrape Naukri search page {page_idx}: {page_err}")
                    break
                    
            return results
        except Exception as e:
            logger.warning(f"Failed to scrape Naukri search pages: {e}")
            return []
        finally:
            try:
                driver.close()
            except Exception:
                pass

    def fetch_job_details(self, detail_page, job_url: str) -> tuple[str, bool]:
        try:
            logger.info(f"Fetching Naukri full description from: {job_url}")
            detail_page.goto(job_url, wait_until="domcontentloaded", timeout=15000)
            
            selectors = [
                "section.job-desc",
                "div.job-desc",
                "div[class*='job-desc-container']",
                "div[class*='JdContainer']",
                "section[class*='job-desc']",
                "main.job-details",
                ".jd-description",
                "div.clearBoth"
            ]
            
            try:
                combined_selector = ", ".join(selectors)
                detail_page.wait_for_selector(combined_selector, timeout=2000)
            except Exception:
                try:
                    detail_page.wait_for_load_state("networkidle", timeout=1000)
                except Exception:
                    pass
                
            is_easy_apply = True
            try:
                apply_elements = []
                interactive_els = detail_page.query_selector_all("button, a, input[type='button'], input[type='submit'], [role='button']")
                for el in interactive_els:
                    try:
                        text = (el.inner_text() or el.get_attribute("value") or "").strip().lower()
                        if "apply" in text:
                            apply_elements.append(text)
                    except Exception:
                        continue
                
                class_apply_els = detail_page.query_selector_all("[class*='apply']")
                for el in class_apply_els:
                    try:
                        text = (el.inner_text() or "").strip().lower()
                        if "apply" in text:
                            apply_elements.append(text)
                    except Exception:
                        continue
                
                for text_val in set(apply_elements):
                    if any(phrase in text_val for phrase in ["company site", "on site", "company website", "external", "website", "redirect"]):
                        is_easy_apply = False
                        logger.info(f"Dynamically detected manual apply button text: '{text_val}'")
                        break
            except Exception as btn_err:
                logger.debug(f"Error checking apply elements: {btn_err}")
                
            full_text = ""
            for sel in selectors:
                try:
                    el = detail_page.query_selector(sel)
                    if el:
                        full_text = el.inner_text().strip()
                        if full_text:
                            break
                except Exception:
                    continue
            if not full_text:
                el = detail_page.query_selector("body")
                if el:
                    full_text = el.inner_text().strip()
                    
            import re
            full_text = re.sub(r'\n{3,}', '\n\n', full_text)
            return (full_text, is_easy_apply)
        except Exception as e:
            logger.warning(f"Failed to fetch full description from {job_url}: {e}")
            return "", True
