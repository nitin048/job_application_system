import sys
from pathlib import Path

# Add src to the path
ROOT_DIR = Path(__file__).parent.parent
sys.path.append(str(ROOT_DIR))

from src.resume_hub import crawl_job_portal_details, is_valid_job_portal

url = "https://autodesk.wd1.myworkdayjobs.com/Ext/job/Pune-IND/Senior-Software-Engineer_25WD93636-1?src=JB-10065&source=LinkedIn"
print("Is valid job portal:", is_valid_job_portal(url))

details = crawl_job_portal_details(url)
print("Title:", details.get("title"))
print("Company:", details.get("company"))
print("Description length:", len(details.get("description", "")))
print("Description sample:", details.get("description")[:200] if details.get("description") else "None")
