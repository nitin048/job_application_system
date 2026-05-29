import json
import re
from bs4 import BeautifulSoup
from pydantic import BaseModel, Field

class ExtractedRoleSchema(BaseModel):
    title: str = ""
    company: str = ""
    location: str = ""
    workplace_type: str = "Unknown"  # Remote, Hybrid, On-site, Unknown
    salary_range: str = ""
    requirements: list[str] = Field(default_factory=list)
    experience_years: float = 0.0

class CascadingExtractor:
    def __init__(self, gemini_client=None):
        self.gemini_client = gemini_client

    def extract(self, html_content: str, raw_text: str = "") -> ExtractedRoleSchema:
        # Tier 1: Try structured JSON-LD parsing
        json_ld_data = self._extract_json_ld(html_content)
        if json_ld_data:
            return json_ld_data

        # Tier 2: CSS / Regex selectors (heuristic selectors)
        css_data = self._extract_by_heuristics(html_content)
        if css_data:
            return css_data

        # Tier 3: LLM parsing from clean text representation
        if self.gemini_client and raw_text:
            return self._extract_via_llm(raw_text)

        # Fallback empty profile
        return ExtractedRoleSchema()

    def _extract_json_ld(self, html: str) -> ExtractedRoleSchema | None:
        try:
            soup = BeautifulSoup(html, "html.parser")
            scripts = soup.find_all("script", type="application/ld+json")
            for script in scripts:
                try:
                    data = json.loads(script.string)
                    # Normalize if it's a list or dictionary
                    items = data if isinstance(data, list) else [data]
                    for item in items:
                        if item.get("@type") == "JobPosting":
                            return ExtractedRoleSchema(
                                title=item.get("title", ""),
                                company=item.get("hiringOrganization", {}).get("name", "") if isinstance(item.get("hiringOrganization"), dict) else "",
                                location=item.get("jobLocation", {}).get("address", {}).get("addressLocality", "") if isinstance(item.get("jobLocation"), dict) else "",
                                workplace_type=self._guess_workplace_type(item.get("title", "") + " " + item.get("description", "")),
                                salary_range=str(item.get("baseSalary", {}).get("value", "")) if isinstance(item.get("baseSalary"), dict) else "",
                                requirements=self._guess_skills_from_description(item.get("description", ""))
                            )
                except Exception:
                    continue
        except Exception:
            pass
        return None

    def _extract_by_heuristics(self, html: str) -> ExtractedRoleSchema | None:
        try:
            soup = BeautifulSoup(html, "html.parser")
            title_tag = soup.find("h1") or soup.find("title")
            title = title_tag.text.strip() if title_tag else ""
            if not title:
                return None
            
            # Simple text parsing heuristics
            text = soup.get_text(" ")
            return ExtractedRoleSchema(
                title=title,
                workplace_type=self._guess_workplace_type(text),
                requirements=self._guess_skills_from_description(text),
                location=self._extract_location_heuristic(soup)
            )
        except Exception:
            return None

    def _extract_via_llm(self, text: str) -> ExtractedRoleSchema:
        # Structured Gemini translation will be implemented using google-generativeai
        # Fallback to local parsing for robustness if Gemini fails or is unconfigured
        return ExtractedRoleSchema(
            title="Extracted Position",
            workplace_type=self._guess_workplace_type(text),
            requirements=self._guess_skills_from_description(text)
        )

    def _guess_workplace_type(self, text: str) -> str:
        text = text.lower()
        if "hybrid" in text:
            return "Hybrid"
        elif "remote" in text or "telecommute" in text or "work from home" in text:
            return "Remote"
        elif "on-site" in text or "onsite" in text or "in-office" in text:
            return "On-site"
        return "Unknown"

    def _guess_skills_from_description(self, text: str) -> list[str]:
        # Simple regex keyword spotter
        keywords = ["python", "javascript", "react", "node", "typescript", "golang", "java", "c++", "aws", "docker", "kubernetes", "sql", "nosql", "postgres"]
        found = []
        text_lower = text.lower()
        for kw in keywords:
            if re.search(rf"\b{kw}\b", text_lower):
                found.append(kw.title() if kw != "aws" else "AWS")
        return found

    def _extract_location_heuristic(self, soup: BeautifulSoup) -> str:
        loc_tags = soup.find_all(class_=re.compile("location|job-location|address", re.I))
        if loc_tags:
            return loc_tags[0].text.strip()
        return ""
