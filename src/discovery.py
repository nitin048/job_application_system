import urllib.parse
from pydantic import BaseModel, Field

class JobListing(BaseModel):
    id: str
    title: str
    company: str
    url: str
    location: str
    description: str = ""
    raw_metadata: dict = Field(default_factory=dict)

def normalize_url(url: str) -> str:
    """
    Standardizes a target job listing URL to ensure exact duplicates are removed
    across ingestion pipelines (e.g. stripping tracking codes, query params).
    """
    parsed = urllib.parse.urlparse(url)
    # Rebuild URL dropping tracking queries common in job boards
    query_params = urllib.parse.parse_qsl(parsed.query)
    clean_params = []
    
    # Standard list of parameters we keep (e.g. job identifier parameters)
    keep_params = {"jk", "id", "jobId", "currentJobId"}
    for k, v in query_params:
        if k in keep_params:
            clean_params.append((k, v))
            
    query_string = urllib.parse.urlencode(clean_params)
    clean_url = urllib.parse.urlunparse((
        parsed.scheme,
        parsed.netloc,
        parsed.path,
        parsed.params,
        query_string,
        ""  # drop fragment
    ))
    return clean_url

class DiscoveryEngine:
    def __init__(self, search_params):
        self.search_params = search_params
        self.seen_urls = set()

    def deduplicate_and_load(self, raw_listings: list[dict]) -> list[JobListing]:
        deduplicated = []
        for raw in raw_listings:
            url = raw.get("url", "")
            if not url:
                continue
            normalized = normalize_url(url)
            if normalized not in self.seen_urls:
                self.seen_urls.add(normalized)
                raw["url"] = normalized
                # Map to schema
                deduplicated.append(JobListing(
                    id=raw.get("id", str(hash(normalized))),
                    title=raw.get("title", ""),
                    company=raw.get("company", ""),
                    url=normalized,
                    location=raw.get("location", ""),
                    description=raw.get("description", ""),
                    raw_metadata=raw.get("raw_metadata", {})
                ))
        return deduplicated
