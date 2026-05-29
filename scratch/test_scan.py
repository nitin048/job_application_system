import logging
from src.config_loader import load_config
from src.job_crawler import JobCrawler
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def main():
    yaml_path = Path("config/searches.yaml")
    if not yaml_path.exists():
        print("searches.yaml not found!")
        return
        
    config = load_config(yaml_path)
    crawler = JobCrawler(config)
    
    print("Starting Job Scanner...")
    
    def on_job(job):
        print(f"--- [PROGRESSIVE] Job Found: {job['title']} at {job['company']} (Score: {job['compatibility']}%)")
        
    jobs = crawler.scan_jobs(on_job_found_cb=on_job)
    print(f"Scan complete. Total jobs: {len(jobs)}")

if __name__ == "__main__":
    main()
