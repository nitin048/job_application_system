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
from src.providers.naukri_provider import NaukriProvider
from src.providers.linkedin_provider import LinkedInProvider
from src.providers.indeed_provider import IndeedProvider

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
        Polls listings and scores compatibility across enabled providers in parallel threads.
        Falls back to a default registry if all sources return empty.
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

        # Initialize providers dynamically based on settings config
        target_portals = getattr(self.config.search_parameters, "target_portals", {})
        providers = []
        if target_portals.get("naukri", True):
            providers.append(NaukriProvider(self.config))
        if target_portals.get("linkedin", True):
            providers.append(LinkedInProvider(self.config))
        if target_portals.get("indeed", True):
            providers.append(IndeedProvider(self.config))

        scored_jobs = []
        import threading
        scored_jobs_lock = threading.Lock()

        # Shared processing callback that providers can invoke progressively
        def process_listing_cb(raw_job: dict) -> dict | None:
            scored = self._process_and_score_listing(raw_job)
            if scored:
                with scored_jobs_lock:
                    if not any(j["id"] == scored["id"] for j in scored_jobs):
                        scored_jobs.append(scored)
                        if on_job_found_cb:
                            on_job_found_cb(scored)
                return scored
            return None

        # Build search pairs
        search_tasks = []
        for provider in providers:
            for pos in positions[:3]:
                for loc in locations[:2]:
                    search_tasks.append((provider, pos, loc))

        if search_tasks:
            from concurrent.futures import ThreadPoolExecutor, as_completed
            max_workers = 5
            logger.info(f"Starting parallel scans for {len(search_tasks)} tasks across {len(providers)} providers (max_workers={max_workers})...")
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                future_to_task = {
                    executor.submit(provider.search_jobs, pos, loc, cache, process_listing_cb): (provider, pos, loc)
                    for provider, pos, loc in search_tasks
                }
                for future in as_completed(future_to_task):
                    provider, pos, loc = future_to_task[future]
                    try:
                        provider_results = future.result()
                        logger.info(f"Parallel crawl completed successfully for provider '{provider.__class__.__name__}' -> '{pos}' in '{loc}'.")
                    except Exception as e:
                        logger.warning(f"Parallel crawl task failed for provider '{provider.__class__.__name__}' -> '{pos}' in '{loc}': {e}")

        # Fallback Registry: High-fidelity mock targets if live search is offline/empty
        if not scored_jobs:
            logger.info("No live results returned. Falling back to default registry.")
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
