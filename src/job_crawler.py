import urllib.parse
import json
import logging
import urllib.request
import re
from bs4 import BeautifulSoup
from typing import List, Dict, Any
from src.config_loader import JobAppConfig
from src.extractor import ExtractedRoleSchema
from src.scoring import ScoringMatrix
from src.discovery import JobListing, normalize_url

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class JobCrawler:
    def __init__(self, config: JobAppConfig):
        self.config = config
        self.scoring_matrix = ScoringMatrix(config)
        import threading
        self._scraped_urls = set()
        self._scraped_urls_lock = threading.Lock()

    def scan_jobs(self, on_job_found_cb=None, cache: dict = None) -> List[Dict[str, Any]]:
        """
        Polls listings and scores compatibility.
        Crawls Naukri live listings using the headless browser, falling back to a pre-defined active
        software engineering job registry if rate-limited or offline.
        """
        if cache is None:
            cache = {}
            try:
                import os
                cache_path = "data/discovered_jobs.json"
                if os.path.exists(cache_path):
                    with open(cache_path, "r", encoding="utf-8") as f:
                        cached_data = json.load(f)
                        for job in cached_data:
                            if "url" in job:
                                cache[job["url"]] = job
                logger.info(f"Loaded existing jobs cache with {len(cache)} jobs.")
            except Exception as e:
                logger.warning(f"Failed to load existing jobs cache: {e}")

        positions = self.config.search_parameters.positions
        locations = self.config.search_parameters.locations
        
        # 1. Scrape live Naukri results using browser context in parallel threads
        from concurrent.futures import ThreadPoolExecutor, as_completed
        
        max_workers = 3
        search_pairs = []
        for pos in positions[:3]:
            for loc in locations[:2]:
                search_pairs.append((pos, loc))
                
        scored_jobs = []
        
        import threading
        scored_jobs_lock = threading.Lock()
        
        def handle_job_found_progressive(scored_job):
            with scored_jobs_lock:
                if not any(j["id"] == scored_job["id"] for j in scored_jobs):
                    scored_jobs.append(scored_job)
                    if on_job_found_cb:
                        on_job_found_cb(scored_job)

        if search_pairs:
            logger.info(f"Starting parallel scans for {len(search_pairs)} queries (max_workers={max_workers})...")
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                future_to_query = {
                    executor.submit(self._fetch_naukri_listings, pos, loc, cache, handle_job_found_progressive): (pos, loc)
                    for pos, loc in search_pairs
                }
                for future in as_completed(future_to_query):
                    pos, loc = future_to_query[future]
                    try:
                        naukri_results = future.result()
                        logger.info(f"Parallel crawl completed successfully for '{pos}' in '{loc}'.")
                    except Exception as e:
                        logger.warning(f"Parallel crawl task failed for '{pos}' in '{loc}': {e}")
        
        # 2. Fallback Registry: High-fidelity mock targets if live search is offline/empty
        if not scored_jobs:
            logger.info("No live Naukri results returned. Falling back to default registry.")
            fallback_registry = self._get_fallback_registry()
            for raw in fallback_registry:
                scored = self._process_and_score_listing(raw)
                if scored:
                    with scored_jobs_lock:
                        if not any(j["id"] == scored["id"] for j in scored_jobs):
                            scored_jobs.append(scored)
                            if on_job_found_cb:
                                on_job_found_cb(scored)
                
        # Sort by compatibility score descending
        scored_jobs.sort(key=lambda x: x["compatibility"], reverse=True)
        return scored_jobs

    def _process_and_score_listing(self, raw: dict) -> dict | None:
        url = raw.get("url", "")
        if not url:
            return None
        
        clean_url = normalize_url(url)
        exp_req = self._extract_experience_years(raw["description"])
        role = ExtractedRoleSchema(
            title=raw["title"],
            company=raw["company"],
            location=raw["location"],
            workplace_type="Remote" if "remote" in raw["location"].lower() or "remote" in raw["description"].lower() else "Hybrid",
            requirements=self._infer_requirements(raw["description"]),
            experience_years=exp_req
        )
        
        score_out_of_5 = self.scoring_matrix.evaluate(role)
        compatibility_percentage = int((score_out_of_5 / 5.0) * 100)
        
        is_blacklisted = False
        for blacklisted in getattr(self.config.search_parameters, "companyBlacklist", []):
            if blacklisted and blacklisted.lower() in raw["company"].lower():
                is_blacklisted = True
                break
        if is_blacklisted:
            logger.info(f"Skipping {raw['title']} at {raw['company']} (company blacklisted)")
            return None

        if compatibility_percentage >= 60:
            desc = raw["description"]
            if not ("**About the Role**" in desc or "**Key Responsibilities**" in desc or "**Required Technical Skills**" in desc):
                summarized = self._clean_and_summarize_job_desc(desc)
                if summarized:
                    desc = summarized
            return {
                "id": raw.get("id") or f"naukri_{hash(clean_url) & 0xffffffff}",
                "title": raw["title"],
                "company": raw["company"],
                "location": raw["location"],
                "description": desc,
                "url": clean_url,
                "compatibility": compatibility_percentage,
                "workplace_type": role.workplace_type,
                "skills": role.requirements,
                "apply_type": "Easy Apply" if raw.get("is_easy_apply", True) else "Manual Intervention"
            }
        return None

    def _extract_experience_years(self, text: str) -> float:
        if not text:
            return 2.0
        text_clean = text.replace('\n', ' ')
        match_range = re.search(r'(\d+)\s*(?:to|-)\s*(\d+)\s*years?', text_clean, re.IGNORECASE)
        if match_range:
            return float(match_range.group(1))
        match_plus = re.search(r'(\d+)\+\s*years?', text_clean, re.IGNORECASE)
        if match_plus:
            return float(match_plus.group(1))
        match_single = re.search(r'(\d+)\s*years?\s*experience', text_clean, re.IGNORECASE)
        if match_single:
            return float(match_single.group(1))
        return 2.0

    def _fetch_naukri_listings(self, position: str, location: str, cache: dict = None, on_job_found_cb = None) -> list[dict]:
        """
        Uses the browser driver to scrape Naukri search result pages across multiple pages.
        """
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
            # Map years of experience to Naukri experience range filter (approximate)
            exp_min = max(0, int(cand_exp) - 2)
            exp_max = int(cand_exp) + 2
            exp_param_raw = f"experience={exp_min}%2C{exp_max}&experienceRangeType=STATIC"
            logger.info(f"Applying experience filter: {exp_min}-{exp_max} years")
            
        cand_skills = getattr(self.config.search_parameters, "candidate_skills", [])
        k_query = ""
        if cand_skills:
            # Take top 4 skills for precise and relevant target queries
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
            page = driver.context.new_page() # Use context to get fresh page
            detail_page = driver.context.new_page()
            
            # Encode position and location for Naukri URL
            pos_slug = urllib.parse.quote(position.lower().replace(" ", "-"))
            loc_slug = urllib.parse.quote(location.lower().replace(" ", "-"))
            
            # Scrape Page 1 and 2 for comprehensive and fast loading
            max_pages = 2
            for page_idx in range(1, max_pages + 1):
                if page_idx == 1:
                    url = f"https://www.naukri.com/{pos_slug}-jobs-in-{loc_slug}{query_str}"
                else:
                    # Page 2+ append page number  
                    url = f"https://www.naukri.com/{pos_slug}-jobs-in-{loc_slug}-{page_idx}{query_str}"
                    
                logger.info(f"Navigating to Naukri url (Page {page_idx}): {url}")
                try:
                    page.goto(url, wait_until="domcontentloaded", timeout=15000)
                    page.wait_for_timeout(3000)
                    
                    # Scroll to trigger lazy loading of tuples
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
                        
                    # Crawl up to 8 results per page
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
                            
                            # Check if already cached to avoid page loads and optimize crawling speed
                            if cache and job_url in cache:
                                cached_job = cache[job_url]
                                full_desc = cached_job.get("description", "")
                                is_easy_apply = cached_job.get("apply_type", "Easy Apply") == "Easy Apply"
                                logger.info(f"Using cached description/apply type for already crawled job: {job_url}")
                            else:
                                # Crawl full description and classify apply type dynamically
                                full_desc, page_easy_apply = self._fetch_naukri_full_desc(detail_page, job_url)
                                
                                # Fallback list check if page classification is inconclusive
                                card_text = elem.inner_text().lower()
                                list_easy_apply = True
                                if "company site" in card_text or "external" in card_text or "website" in card_text:
                                    list_easy_apply = False
                                    
                                is_easy_apply = page_easy_apply if list_easy_apply else False
                                
                            # Score and emit job progressively in the thread loop
                            job_desc = full_desc if full_desc else desc
                            
                            raw_dict = {
                                "id": f"naukri_{hash(job_url) & 0xffffffff}",
                                "title": title,
                                "company": company,
                                "location": loc_text,
                                "description": job_desc,
                                "url": clean_url,
                                "is_easy_apply": is_easy_apply
                            }
                            
                            scored = self._process_and_score_listing(raw_dict)
                            if scored:
                                results.append(scored)
                                if on_job_found_cb:
                                    on_job_found_cb(scored)
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

    def _fetch_naukri_full_desc(self, detail_page, job_url: str) -> tuple[str, bool]:
        try:
            logger.info(f"Fetching full description from: {job_url}")
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
            
            # Fast wait for any description selector to load
            try:
                combined_selector = ", ".join(selectors)
                detail_page.wait_for_selector(combined_selector, timeout=2000)
            except Exception:
                try:
                    detail_page.wait_for_load_state("networkidle", timeout=1000)
                except Exception:
                    pass
                
            # Dynamic Apply Button Detection (Easy Apply vs Manual Intervention)
            is_easy_apply = True
            try:
                apply_elements = []
                # 1. Select standard interactive elements
                interactive_els = detail_page.query_selector_all("button, a, input[type='button'], input[type='submit'], [role='button']")
                for el in interactive_els:
                    try:
                        text = (el.inner_text() or el.get_attribute("value") or "").strip().lower()
                        if "apply" in text:
                            apply_elements.append(text)
                    except Exception:
                        continue
                
                # 2. Select any elements with 'apply' substring inside class name
                class_apply_els = detail_page.query_selector_all("[class*='apply']")
                for el in class_apply_els:
                    try:
                        text = (el.inner_text() or "").strip().lower()
                        if "apply" in text:
                            apply_elements.append(text)
                    except Exception:
                        continue
                
                # Check for redirection patterns
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
                # Fallback to page text body
                el = detail_page.query_selector("body")
                if el:
                    full_text = el.inner_text().strip()
                    
            import re
            full_text = re.sub(r'\n{3,}', '\n\n', full_text)
            return (full_text, is_easy_apply)
        except Exception as e:
            logger.warning(f"Failed to fetch full description from {job_url}: {e}")
            return "", True

    def _clean_and_summarize_job_desc(self, raw_desc: str) -> str:
        if not raw_desc:
            return ""
            
        from config.constants import GEMINI_API_KEY
        import google.generativeai as genai
        
        if GEMINI_API_KEY:
            try:
                genai.configure(api_key=GEMINI_API_KEY)
                models_to_try = ["gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]
                
                prompt = f"""
You are an expert technical recruiter. Your task is to read the entire job description and generate a detailed, comprehensive, and thoroughly explained summary of it. Do not truncate, omit, or gloss over any technical requirements, duties, or tools. The summary must be highly readable and complete.

Format the output as clean, structured plain text with standard spacing. Highlight and detail the following sections:
- **About the Role**: A detailed, explained overview of the position, team context, and key focus areas.
- **Key Responsibilities**: Detailed, clear, and comprehensive bullet points detailing all duties, tasks, and deliverables expected.
- **Required Technical Skills & Qualifications**: A complete, exhaustive list of required languages, tools, frameworks, databases, methodologies, years of experience, and educational requirements.
- **Preferred Qualifications & Benefits**: Formatted details of any nice-to-have skills, certifications, perks, benefits, or working arrangements.

Avoid generic headers, footers, duplicate lines, cookie notices, and raw HTML tags or script residue. Make it sound professional, crisp, and direct.

Raw job description:
{raw_desc}
"""
                for model_name in models_to_try:
                    try:
                        logger.info(f"Attempting to summarize job desc with Gemini model: {model_name}")
                        model = genai.GenerativeModel(model_name)
                        response = model.generate_content(prompt)
                        summary = response.text.strip()
                        if summary:
                            return summary
                    except Exception as ex:
                        logger.warning(f"Failed to summarize with model {model_name}: {ex}")
                        ex_str = str(ex).lower()
                        if "429" in ex_str or "quota" in ex_str or "exhausted" in ex_str:
                            logger.warning("Gemini API quota exceeded or rate limit hit. Aborting further model attempts.")
                            break
                        continue
            except Exception as e:
                logger.warning(f"Failed to run Gemini summarizer: {e}")
                
        # Heuristic fallback if Gemini fails or is not configured
        logger.info("Executing rule-based fallback cleanup on raw job description...")
        lines = [line.strip() for line in raw_desc.split("\n") if line.strip()]
        cleaned_lines = []
        for line in lines:
            if any(term in line.lower() for term in ["cookie", "privacy policy", "accept terms", "login to", "copyright ©", "all rights reserved"]):
                continue
            cleaned_lines.append(line)
        return "\n".join(cleaned_lines)

    def _infer_requirements(self, text: str) -> List[str]:
        # Merge candidate skills from config with default keywords
        keywords = ["python", "javascript", "react", "node", "typescript", "golang", "aws", "docker", "postgres", "sql server", "c#", ".net"]
        cand_skills = getattr(self.config.search_parameters, "candidate_skills", [])
        if cand_skills:
            for cs in cand_skills:
                if cs.lower() not in keywords:
                    keywords.append(cs.lower())
                    
        found = []
        text_lower = text.lower()
        for kw in keywords:
            if kw in text_lower:
                if kw == "aws":
                    found.append("AWS")
                elif kw == "c#":
                    found.append("C#")
                elif kw == ".net":
                    found.append(".NET Core")
                elif kw == "sql server":
                    found.append("SQL Server")
                else:
                    found.append(kw.title())
        return list(set(found))

    def _get_fallback_registry(self) -> List[Dict[str, Any]]:
        return [
            {
                "id": "job_google_1",
                "title": "Software Engineer, Full Stack",
                "company": "Google",
                "location": "London (Hybrid)",
                "description": "Build high-performance web applications using Python, JavaScript, and React. Work with cloud infrastructure (AWS) and PostgreSQL databases.",
                "url": "https://careers.google.com/jobs/results/job_google_1",
                "is_easy_apply": False
            },
            {
                "id": "job_stripe_1",
                "title": "Backend Developer",
                "company": "Stripe",
                "location": "Remote (UK)",
                "description": "Design secure payment APIs. Build microservices in Go, Python, and TypeScript. Experience with Docker, Kubernetes, and PostgreSQL is required.",
                "url": "https://stripe.com/jobs/results/job_stripe_1",
                "is_easy_apply": False
            },
            {
                "id": "job_revolut_1",
                "title": "Software Engineer (Python/Go)",
                "company": "Revolut",
                "location": "London (Remote)",
                "description": "Scale financial ledger engines. Deploy python data pipelines and server layers. Experience with AWS, PostgreSQL, and typescript frontend views.",
                "url": "https://revolut.com/jobs/results/job_revolut_1",
                "is_easy_apply": True
            },
            {
                "id": "job_meta_1",
                "title": "React Frontend Engineer",
                "company": "Meta",
                "location": "London (On-site)",
                "description": "Optimize UI components for web platforms. Deep experience with React, JavaScript, HTML5, and CSS performance metrics.",
                "url": "https://careers.fb.com/jobs/results/job_meta_1",
                "is_easy_apply": False
            }
        ]
