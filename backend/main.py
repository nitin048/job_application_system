import argparse
import sys
import json
import logging
from pathlib import Path

# Add src to the path
sys.path.append(str(Path(__file__).parent))

from src.config_loader import load_config
from src.universal_runner import UniversalRunner
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

    import os
    import json
    
    # Resolve and write resume PDF from database dynamically
    session_config_path = os.getenv("AEGIS_SESSION_CONFIG_PATH")
    temp_resume_file = None
    if session_config_path and os.path.exists(session_config_path):
        try:
            with open(session_config_path, "r", encoding="utf-8") as f:
                file_config = json.load(f)
            user_id = file_config.get("user_id")
            if user_id:
                # Import db helpers
                from src.db import get_db, current_user_id_var
                # Bind current user id context variable
                current_user_id_var.set(user_id)
                db = get_db()
                doc = db["resumes"].find_one({"user_id": user_id, "type": "original"}, sort=[("created_at", -1)])
                if doc and "pdf_data" in doc:
                    import base64
                    import tempfile
                    pdf_bytes = base64.b64decode(doc["pdf_data"])
                    fd, path = tempfile.mkstemp(suffix=".pdf", prefix="naukri_bump_resume_")
                    os.close(fd)
                    temp_resume_file = path
                    with open(temp_resume_file, "wb") as f_res:
                        f_res.write(pdf_bytes)
                    
                    # Write the temp resume path back to the config file
                    if "constants" not in file_config:
                        file_config["constants"] = {}
                    file_config["constants"]["RESUME_PATH"] = temp_resume_file
                    with open(session_config_path, "w", encoding="utf-8") as f:
                        json.dump(file_config, f)
                    print(f"[System] Injected MongoDB original resume at: {temp_resume_file}")
        except Exception as e:
            print(f"Warning: Failed to load user resume from database: {e}")

    try:
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
                
            runner = UniversalRunner(USERNAME, PASSWORD, RESUME_PATH)
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
            from config.constants import GDRIVE_SYNC_ENABLED, GDRIVE_CLIENT_SECRETS_PATH, GDRIVE_TOKEN_PATH, GDRIVE_CLIENT_SECRETS_CONTENT, GDRIVE_TOKEN_CONTENT
            if GDRIVE_SYNC_ENABLED:
                logger.info("Google Drive Sync enabled. Uploading tailored resume...")
                try:
                    from src.gdrive_manager import GoogleDriveManager
                    
                    on_token_change = None
                    try:
                        from src.db import current_user_id_var, get_db
                        u_id = current_user_id_var.get()
                        if u_id:
                            def on_token_change(new_token_str):
                                try:
                                    import json
                                    token_dict = json.loads(new_token_str)
                                    db_instance = get_db()
                                    db_instance["configs"].update_one(
                                        {"user_id": u_id},
                                        {"$set": {"constants.GDRIVE_TOKEN_CONTENT": token_dict}}
                                    )
                                    logger.info("[GDrive CLI] Saved refreshed Google token back to MongoDB.")
                                except Exception as cb_err:
                                    logger.error(f"[GDrive CLI Warning] Failed to save token callback: {cb_err}")
                    except Exception:
                        pass
                        
                    gdrive_manager = GoogleDriveManager(
                        client_secrets_path=str(Path(GDRIVE_CLIENT_SECRETS_PATH)) if GDRIVE_CLIENT_SECRETS_PATH else None,
                        token_path=str(Path(GDRIVE_TOKEN_PATH)) if GDRIVE_TOKEN_PATH else None,
                        config=config,
                        client_secrets_content=GDRIVE_CLIENT_SECRETS_CONTENT,
                        token_content=GDRIVE_TOKEN_CONTENT,
                        on_token_change=on_token_change
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
            
            logger.info(f"Launching UniversalRunner to apply to: {job['url']}")
            runner = UniversalRunner(
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
    finally:
        if temp_resume_file and os.path.exists(temp_resume_file):
            try:
                os.unlink(temp_resume_file)
            except Exception:
                pass


if __name__ == "__main__":
    main()
