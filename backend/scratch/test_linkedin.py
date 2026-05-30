import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    url = "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=Software%20Engineer&location=Pune&start=0"
    print(f"Navigating to: {url}")
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=15000)
        content = page.content()
        print(f"Content length: {len(content)}")
        print(f"First 1000 chars of page HTML:\n{content[:1000]}")
        li_elements = page.query_selector_all("li")
        print(f"Found {len(li_elements)} li elements.")
        for li in li_elements[:3]:
            print(f"li text: {li.inner_text().strip()[:100]}")
    except Exception as e:
        print(f"Error navigating: {e}")
    browser.close()
