import re
from abc import ABC, abstractmethod
from typing import List, Dict, Any
from src.config_loader import JobAppConfig

class BasePortalProvider(ABC):
    def __init__(self, config: JobAppConfig):
        self.config = config

    @abstractmethod
    def search_jobs(self, position: str, location: str, cache: dict = None, on_job_found_cb = None) -> List[Dict[str, Any]]:
        """
        Search for job listings on the specific portal and return list of raw dicts.
        """
        pass

    @abstractmethod
    def fetch_job_details(self, detail_page, job_url: str) -> tuple[str, bool]:
        """
        Fetch full description and classify apply type dynamically.
        """
        pass

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

    def _infer_requirements(self, text: str) -> List[str]:
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
