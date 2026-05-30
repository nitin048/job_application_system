import argparse
import sys
import json
import logging
from pathlib import Path

# Add src to the path
sys.path.append(str(Path(__file__).parent))

from src.config_loader import load_config
from src.naukri_runner import NaukriRunner
from src.form_graph import FormGraphOrchestrator
from src.resume_tweaker import ResumeTweaker
from src.browser_driver import SecureBrowserDriver

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def main():
    parser = argparse.ArgumentParser(description="Autonomous AI Job Application System Runner")
    parser.add_argument(
        "--action", 
        choices=["test-graph", "bump-naukri", "apply"], 
        required=True,
        help="Action to perform: 'test-graph' runs a mock form-filling cycle; 'bump-naukri' updates your Naukri resume profile; 'apply' applies to a discovered job."
    )
    parser.add_argument(
        "--job-id",
        help="The unique ID of the discovered job to apply to (required for action='apply')."
    )
    args = parser.parse_args()

    # Load configuration
    config_path = Path("config/searches.yaml")
    if not config_path.exists():
        print(f"Error: Configuration file not found at {config_path}")
        sys.exit(1)
        
    config = load_config(config_path)

    if args.action == "test-graph":
        print("Starting mock form-filling graph validation...")
        orchestrator = FormGraphOrchestrator(config)
        
        # Mock HTML DOM structure
        mock_dom = [
            {"id": "first_name", "label": "First Name", "type": "text"},
            {"id": "last_name", "label": "Last Name", "type": "text"},
            {"id": "email", "label": "Email Address", "type": "text"},
            {"id": "relocate", "label": "Willing to relocate?", "type": "select", "options": ["Yes", "No"]},
        ]
        
        state = orchestrator.run("https://example.com/apply", mock_dom)
        print("\n--- Processed Form Payload Output ---")
        for k, v in state.assembled_payload.items():
            print(f"Field [{k}]: '{v}'")
        print("--------------------------------------")
        print(f"Errors encountered: {state.errors or 'None'}")
        print("Mock execution complete.")

    elif args.action == "bump-naukri":
        from config.constants import USERNAME, PASSWORD, RESUME_PATH
        print(f"Starting profile visibility routine for {USERNAME}...")
        
        # Touch mock resume file if it doesn't exist
        resume_file = Path(RESUME_PATH)
        if not resume_file.exists():
            resume_file.parent.mkdir(parents=True, exist_ok=True)
            from src.document_generator import DocumentGenerator
            doc = DocumentGenerator("", str(resume_file))
            doc.compile_pdf(
                config.candidate_identity.personal_details.first_name,
                config.candidate_identity.personal_details.last_name,
                config.candidate_identity.personal_details.email,
                config.candidate_identity.personal_details.phone
            )
            print(f"Created a mock resume PDF at {RESUME_PATH}")
            
        runner = NaukriRunner(USERNAME, PASSWORD, RESUME_PATH)
        runner.run_profile_update()

    elif args.action == "apply":
        if not args.job_id:
            print("Error: --job-id is required for action 'apply'.")
            sys.exit(1)
            
        logger.info(f"Starting automated application process for Job ID: {args.job_id}...")
        
        # Load the job details from data/discovered_jobs.json
        jobs_json_path = Path("data/discovered_jobs.json")
        if not jobs_json_path.exists():
            logger.error("Error: data/discovered_jobs.json does not exist. Run job scan first.")
            sys.exit(1)
            
        with open(jobs_json_path, "r", encoding="utf-8") as f:
            jobs = json.load(f)
            
        job = next((j for j in jobs if j["id"] == args.job_id), None)
        if not job:
            logger.error(f"Error: Job ID '{args.job_id}' not found in discovered jobs.")
            sys.exit(1)
            
        logger.info(f"Matched Job: '{job['title']}' at '{job['company']}'")
        
        # Step 1: Tailor the Resume
        logger.info("Executing resume customizer...")
        tweaker = ResumeTweaker(config)
        tailored_resume_path = tweaker.tailor_resume(
            job_title=job["title"],
            job_company=job["company"],
            job_desc=job["description"]
        )
        logger.info(f"Optimized resume generated successfully at {tailored_resume_path}")
        
        # Step 1b: Google Drive Sync
        from config.constants import GDRIVE_SYNC_ENABLED, GDRIVE_CLIENT_SECRETS_PATH, GDRIVE_TOKEN_PATH
        if GDRIVE_SYNC_ENABLED:
            logger.info("Google Drive Sync enabled. Uploading tailored resume...")
            try:
                from src.gdrive_manager import GoogleDriveManager
                gdrive_manager = GoogleDriveManager(
                    client_secrets_path=str(Path(GDRIVE_CLIENT_SECRETS_PATH)),
                    token_path=str(Path(GDRIVE_TOKEN_PATH)),
                    config=config
                )
                gdrive_link, gdrive_file_id = gdrive_manager.upload_tailored_resume(job["company"], tailored_resume_path)
                logger.info(f"Google Drive Sync complete. Link: {gdrive_link}")
                job["gdrive_link"] = gdrive_link
                job["gdrive_file_id"] = gdrive_file_id
                with open(jobs_json_path, "w", encoding="utf-8") as f:
                    json.dump(jobs, f, indent=2)
            except Exception as e:
                logger.warning(f"Google Drive upload skipped/failed: {e}")
        
        # Step 2: Auto Apply via NaukriRunner
        from config.constants import USERNAME, PASSWORD, AGENT_BROWSER_HEADED, AGENT_BROWSER_CDP
        
        logger.info(f"Launching NaukriRunner to apply to: {job['url']}")
        runner = NaukriRunner(
            username=USERNAME,
            password=PASSWORD,
            resume_path=tailored_resume_path,
            headed=AGENT_BROWSER_HEADED,
            cdp_address=AGENT_BROWSER_CDP or ""
        )
        
        result = runner.apply_to_job(
            job_url=job["url"],
            job_title=job["title"],
            job_company=job["company"],
            tailored_resume_path=tailored_resume_path
        )
        
        # Step 3: Update job status in discovered_jobs.json
        if result["success"]:
            job["applied"] = True
            job["apply_result"] = result["message"]
            with open(jobs_json_path, "w", encoding="utf-8") as f:
                json.dump(jobs, f, indent=2)
            print(f"[SUCCESS] {result['message']}")
        else:
            print(f"[WARNING] {result['message']}")
            if result.get("screenshot"):
                print(f"[INFO] Screenshot saved: {result['screenshot']}")


if __name__ == "__main__":
    main()
