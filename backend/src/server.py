import os
import yaml
import sys
import json
import shutil
import subprocess
import threading
import logging
import re as _re
from pathlib import Path
from typing import Dict, Any, Optional
from fastapi import FastAPI, BackgroundTasks, HTTPException, UploadFile, File, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel

logger = logging.getLogger("src.server")

# Add root folder to path
ROOT_DIR = Path(__file__).parent.parent
sys.path.append(str(ROOT_DIR))

from src.config_loader import load_config
from src.job_crawler import JobCrawler
from src.resume_tweaker import ResumeTweaker
from src.gdrive_manager import GoogleDriveManager
from src.crypto_manager import encrypt_value, decrypt_value, is_encrypted

app = FastAPI(title="Job Application System API")

import contextvars
import urllib.parse
from config.constants import session_config_var as consts_session_var
from src.config_loader import session_config_var as loader_session_var

@app.middleware("http")
async def session_config_middleware(request: Request, call_next):
    # Retrieve header or query param
    session_config_header = request.headers.get("X-Session-Config")
    session_config_param = request.query_params.get("config")
    
    session_config = None
    raw_config = session_config_header or session_config_param
    
    if raw_config:
        try:
            try:
                session_config = json.loads(raw_config)
            except json.JSONDecodeError:
                decoded = urllib.parse.unquote(raw_config)
                session_config = json.loads(decoded)
        except Exception:
            pass
            
    # Set the ContextVar tokens
    token1 = consts_session_var.set(session_config)
    token2 = loader_session_var.set(session_config)
    
    try:
        response = await call_next(request)
        return response
    finally:
        consts_session_var.reset(token1)
        loader_session_var.reset(token2)

import traceback
import time

ERROR_LOG_PATH = ROOT_DIR / "data" / "runtime_errors.json"

def log_runtime_error(category: str, message: str, details: str):
    errors = []
    if ERROR_LOG_PATH.exists():
        try:
            with open(ERROR_LOG_PATH, "r", encoding="utf-8") as f:
                errors = json.load(f)
        except Exception:
            pass
    errors.append({
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "category": category,
        "message": message,
        "details": details
    })
    if len(errors) > 100:
        errors = errors[-100:]
    try:
        ERROR_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(ERROR_LOG_PATH, "w", encoding="utf-8") as f:
            json.dump(errors, f, indent=2)
    except Exception as e:
        logger.error(f"Failed to write error log: {e}")

@app.exception_handler(Exception)
def global_exception_handler(request, exc: Exception):
    error_msg = str(exc)
    tb = traceback.format_exc()
    log_runtime_error("backend", error_msg, tb)
    logger.exception(f"Unhandled Exception on request: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal Server Error: {error_msg}"}
    )

# Assets folder for user-uploaded files
ASSETS_DIR = ROOT_DIR / "assets"
ASSETS_DIR.mkdir(parents=True, exist_ok=True)
RESUME_DIR = ASSETS_DIR / "resume"
RESUME_DIR.mkdir(parents=True, exist_ok=True)
SCREENSHOTS_DIR = ROOT_DIR / "data" / "screenshots"
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)

# Global log buffer for background process capture
log_buffer = []
jobs_cache = []
is_scanning = False

# Load jobs cache from disk on startup if it exists
jobs_json_path = ROOT_DIR / "data" / "discovered_jobs.json"
if jobs_json_path.exists():
    try:
        with open(jobs_json_path, "r", encoding="utf-8") as f:
            jobs_cache = json.load(f)
    except Exception:
        jobs_cache = []

import uuid
import tempfile

def run_background_task(command: str, session_config: dict | None = None):
    """
    Executes a shell command in the background, capturing stdout/stderr into the log buffer.
    Supports session-isolated configuration.
    """
    global log_buffer
    log_buffer.clear()
    log_buffer.append(f"Starting execution: {command}\n")
    
    temp_file_path = None
    env = os.environ.copy()
    env["PATH"] = f"{Path.home()}/.local/bin:{env.get('PATH', '')}"
    
    if session_config:
        try:
            # Create a secure temporary file inside backend/data/
            data_dir = ROOT_DIR / "data"
            data_dir.mkdir(parents=True, exist_ok=True)
            fd, path = tempfile.mkstemp(suffix=".json", prefix="temp_config_", dir=str(data_dir))
            os.close(fd)
            temp_file_path = Path(path)
            
            with open(temp_file_path, "w", encoding="utf-8") as f:
                json.dump(session_config, f)
                
            env["AEGIS_SESSION_CONFIG_PATH"] = str(temp_file_path)
            log_buffer.append("Session configuration bound to environment.\n")
        except Exception as e:
            log_buffer.append(f"Warning: Failed to bind session configuration: {e}\n")
            
    try:
        process = subprocess.Popen(
            command,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            cwd=str(ROOT_DIR),
            env=env
        )
        
        for line in iter(process.stdout.readline, ""):
            log_buffer.append(line)
            # Cap log buffer size
            if len(log_buffer) > 1000:
                log_buffer.pop(0)
                
        process.stdout.close()
        return_code = process.wait()
        log_buffer.append(f"\nExecution finished. Return code: {return_code}\n")
    finally:
        # Clean up temporary file
        if temp_file_path and temp_file_path.exists():
            try:
                temp_file_path.unlink()
            except Exception as clean_err:
                log_buffer.append(f"Warning: Failed to clean up session file: {clean_err}\n")

class FrontendErrorRequest(BaseModel):
    message: str
    details: str

@app.get("/api/errors")
def get_errors():
    errors = []
    if ERROR_LOG_PATH.exists():
        try:
            with open(ERROR_LOG_PATH, "r", encoding="utf-8") as f:
                errors = json.load(f)
        except Exception:
            pass
    return {"errors": errors}

@app.post("/api/errors/log")
def log_frontend_error_endpoint(payload: FrontendErrorRequest):
    log_runtime_error("frontend", payload.message, payload.details)
    return {"status": "success"}

@app.delete("/api/errors")
def clear_errors():
    if ERROR_LOG_PATH.exists():
        try:
            ERROR_LOG_PATH.unlink()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to clear error log: {e}")
    return {"status": "success", "message": "Runtime error logs cleared."}

@app.get("/api/config")
def get_config():
    """
    Retrieves values from config/searches.yaml and config/constants.py.
    """
    # 1. Read searches.yaml
    yaml_path = ROOT_DIR / "config" / "searches.yaml"
    if not yaml_path.exists():
        raise HTTPException(status_code=404, detail="searches.yaml not found")
    
    with open(yaml_path, "r", encoding="utf-8") as f:
        yaml_data = yaml.safe_load(f)

    # 2. Read constants.py by importing or parsing
    # To avoid cache issues, we read it as plain text and parse basic variables
    constants_path = ROOT_DIR / "config" / "constants.py"
    constants_data = {}
    # Sensitive keys that are encrypted at rest — must be decrypted before returning to UI
    SENSITIVE_KEYS = {"PASSWORD", "GEMINI_API_KEY", "SOLVER_API_KEY", "SMTP_PASSWORD"}
    if constants_path.exists():
        content = constants_path.read_text(encoding="utf-8")
        # Direct regex match to parse configuration keys safely without eval
        keys = [
            "RESUME_PATH", "MODIFIED_RESUME_PATH", "USERNAME", "PASSWORD", 
            "UPDATE_PDF_HASH", "GEMINI_API_KEY", "SOLVER_API_KEY", 
            "AGENT_BROWSER_HEADED", "AGENT_BROWSER_CDP",
            "GDRIVE_SYNC_ENABLED", "GDRIVE_CLIENT_SECRETS_PATH", "GDRIVE_TOKEN_PATH",
            "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD"
        ]
        for key in keys:
            import re
            match = re.search(rf'^{key}\s*=\s*(.*?)\s*$', content, re.MULTILINE)
            if match:
                val = match.group(1).strip()
                # Check for os.getenv wrapper: os.getenv("KEY", "DEFAULT")
                env_match = re.search(r'os\.getenv\(\s*["\']\w+["\']\s*,\s*(r?["\'].*?["\'])\s*\)', val)
                if env_match:
                    val = env_match.group(1).strip()
                else:
                    env_match_fallback = re.search(r'os\.getenv\(\s*["\']\w+["\']\s*,\s*(.*?)\s*\)', val)
                    if env_match_fallback:
                        val = env_match_fallback.group(1).strip()
                
                is_boolean_comparison = False
                if key in {"AGENT_BROWSER_HEADED", "UPDATE_PDF_HASH", "GDRIVE_SYNC_ENABLED"} and "==" in val:
                    val = val.split("==")[0].strip()
                    is_boolean_comparison = True

                # Strip quotes or parse booleans
                if val.startswith(('"', "'")) and val.endswith(('"', "'")):
                    val = val[1:-1]
                elif val.startswith("r") and val[1] in ('"', "'") and val.endswith(('"', "'")):
                    val = val[2:-1]
                elif val.startswith("r") and val[1] in ('"', "'"):
                    val = val[2:-1]
                elif val == "True":
                    val = True
                elif val == "False":
                    val = False

                if is_boolean_comparison:
                    val = (val == "True" or val is True)

                # Decrypt sensitive keys before sending to UI
                if key in SENSITIVE_KEYS and isinstance(val, str) and is_encrypted(val):
                    val = decrypt_value(val)

                constants_data[key] = val

    return {
        "searches": yaml_data,
        "constants": constants_data
    }

class ConfigUpdateRequest(BaseModel):
    searches: Dict[str, Any]
    constants: Dict[str, Any]

@app.post("/api/config")
def update_config(payload: ConfigUpdateRequest):
    """
    Simulates configuration update. Since configuration is session-isolated
    and managed in browser sessionStorage, we bypass physical disk writes.
    """
    return {"status": "success", "message": "Configurations simulated update success"}

class RunRequest(BaseModel):
    action: str

@app.post("/api/run")
def run_action(payload: RunRequest, background_tasks: BackgroundTasks):
    """
    Launches python main.py --action background task.
    """
    if payload.action not in ["test-graph", "bump-naukri"]:
        raise HTTPException(status_code=400, detail="Invalid action type")
        
    cmd = f"uv run python main.py --action {payload.action}"
    
    active_config = loader_session_var.get()
    background_tasks.add_task(run_background_task, cmd, active_config)
    return {"status": "started", "message": f"Action {payload.action} started in the background."}

@app.get("/api/logs")
def get_logs():
    """
    Returns logs from the current background process.
    """
    return {"logs": "".join(log_buffer)}

@app.get("/api/jobs")
def get_jobs():
    """
    Returns the list of discovered and compatibility-scored job listings.
    """
    global jobs_cache
    return {"jobs": jobs_cache}

@app.post("/api/validate-gemini")
def validate_gemini():
    """
    Validates connection and API key with Gemini.
    """
    import google.generativeai as genai
    active_config = loader_session_var.get()
    consts = active_config.get("constants", {}) if active_config else {}
    gemini_key = consts.get("GEMINI_API_KEY", "")
    
    # fallback to env or standard constants if session var is not set
    if not gemini_key:
        from config.constants import GEMINI_API_KEY
        gemini_key = GEMINI_API_KEY
        
    if not gemini_key:
        raise HTTPException(status_code=400, detail="Gemini API Key is not configured in Secrets & Keys.")
        
    try:
        genai.configure(api_key=gemini_key)
        model = genai.GenerativeModel("gemini-2.5-flash")
        response = model.generate_content("Ping. Respond with exactly the word 'PONG'.")
        text = response.text.strip()
        if "PONG" in text or text:
            return {"status": "success", "message": f"Successfully connected to Gemini! Model response: {text}"}
        else:
            return {"status": "error", "message": "Gemini connection validated, but response was empty."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini API check failed: {str(e)}")

@app.post("/api/jobs/purge")
def purge_jobs():
    """
    Clears the discovered jobs database cache and deletes the file.
    """
    global jobs_cache
    jobs_cache = []
    
    jobs_json_path = ROOT_DIR / "data" / "discovered_jobs.json"
    if jobs_json_path.exists():
        try:
            jobs_json_path.unlink()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Could not delete cache file: {str(e)}")
            
    return {"status": "success", "message": "Discovered jobs database purged successfully."}

def run_scan_in_background(session_config: dict | None):
    # Set context variables in background thread context
    token1 = consts_session_var.set(session_config)
    token2 = loader_session_var.set(session_config)
    
    global is_scanning, jobs_cache
    is_scanning = True
    
    import logging
    import threading
    logger = logging.getLogger("src.server")
    logger.info("Background job scan started.")
    
    jobs_json_path = ROOT_DIR / "data" / "discovered_jobs.json"
    jobs_json_path.parent.mkdir(parents=True, exist_ok=True)
    
    # 1. Load existing cache first, to keep memory cache for crawler
    cache = {}
    if jobs_json_path.exists():
        try:
            with open(jobs_json_path, "r", encoding="utf-8") as f:
                cached_data = json.load(f)
                for job in cached_data:
                    if "url" in job:
                        cache[job["url"]] = job
            logger.info(f"Pre-loaded {len(cache)} jobs into crawling cache.")
        except Exception as e:
            logger.warning(f"Error reading cache: {e}")
            
    # 2. Reset memory cache and write empty list to disk for progressive binding
    jobs_cache = []
    try:
        with open(jobs_json_path, "w", encoding="utf-8") as f:
            json.dump([], f)
    except Exception as e:
        logger.warning(f"Error resetting jobs file: {e}")
        
    write_lock = threading.Lock()
    
    def on_job_found(job):
        global jobs_cache
        with write_lock:
            # Check for duplicates in memory cache
            if not any(j["id"] == job["id"] for j in jobs_cache):
                jobs_cache.append(job)
                jobs_cache.sort(key=lambda x: x["compatibility"], reverse=True)
                try:
                    with open(jobs_json_path, "w", encoding="utf-8") as f:
                        json.dump(jobs_cache, f, indent=2)
                except Exception as disk_err:
                    logger.warning(f"Error writing job progressively to disk: {disk_err}")

    try:
        yaml_path = ROOT_DIR / "config" / "searches.yaml"
        if yaml_path.exists():
            config = load_config(yaml_path)
            crawler = JobCrawler(config)
            # Pass the progressive callback and loaded cache
            crawler.scan_jobs(on_job_found_cb=on_job_found, cache=cache)
            logger.info(f"Background job scan completed. Found {len(jobs_cache)} jobs in total.")
    except Exception as e:
        logger.error(f"Background scan error: {e}")
    finally:
        consts_session_var.reset(token1)
        loader_session_var.reset(token2)
        is_scanning = False

@app.post("/api/jobs/scan")
def scan_jobs(background_tasks: BackgroundTasks):
    """
    Triggers job discovery scanner in the background.
    """
    global is_scanning
    if is_scanning:
        return {"status": "scanning", "message": "A job scan is already running."}
    
    active_config = loader_session_var.get()
    background_tasks.add_task(run_scan_in_background, active_config)
    return {"status": "started", "message": "Job scan started in the background."}

@app.get("/api/jobs/scan/status")
def get_scan_status():
    global is_scanning, jobs_cache
    return {
        "is_scanning": is_scanning,
        "count": len(jobs_cache)
    }

class JobTailoringRequest(BaseModel):
    resume_data: Optional[Dict[str, Any]] = None

@app.post("/api/jobs/{job_id}/tailor")
def tailor_job_resume(job_id: str, payload: Optional[JobTailoringRequest] = None):
    """
    Tailors the candidate's resume for the specified job using the ResumeTweaker.
    """
    global jobs_cache
    # Match the job from cache
    job = next((j for j in jobs_cache if j["id"] == job_id), None)
    if not job:
        # Check from file
        jobs_json_path = ROOT_DIR / "data" / "discovered_jobs.json"
        if jobs_json_path.exists():
            with open(jobs_json_path, "r", encoding="utf-8") as f:
                loaded = json.load(f)
                job = next((j for j in loaded if j["id"] == job_id), None)
                
    if not job:
        raise HTTPException(status_code=404, detail=f"Job listing '{job_id}' not found.")
        
    yaml_path = ROOT_DIR / "config" / "searches.yaml"
    if not yaml_path.exists():
        raise HTTPException(status_code=404, detail="searches.yaml not found")
        
    config = load_config(yaml_path)
    tweaker = ResumeTweaker(config)
    
    resume_data = payload.resume_data if payload else None
    
    try:
        tailored_path = tweaker.tailor_resume(
            job_title=job["title"],
            job_company=job["company"],
            job_desc=job["description"],
            resume_data=resume_data
        )
        job["tailored_pdf_path"] = tailored_path
        if hasattr(tweaker, "last_tailored_data") and tweaker.last_tailored_data:
            job["tailored_data"] = tweaker.last_tailored_data
            
        # Run ATS Audit on the tailored resume PDF
        try:
            from config.constants import GEMINI_API_KEY
            tailored_text = extract_text_from_pdf(tailored_path)
            audit = audit_ats_score(tailored_text, job["description"], GEMINI_API_KEY)
            job["ats_audit"] = audit
        except Exception as audit_err:
            logger.warning(f"ATS audit failed on job card tailoring: {audit_err}")
            job["ats_audit"] = {
                "score": 50,
                "matched_keywords": [],
                "missing_keywords": [],
                "recommendations": [f"Audit failed: {audit_err}"]
            }
        
        # Drive sync check
        sync_enabled, secrets_path, token_path = get_gdrive_config()
        gdrive_link = None
        gdrive_file_id = None
        gdrive_error = None
        if sync_enabled:
            try:
                manager = GoogleDriveManager(
                    client_secrets_path=secrets_path,
                    token_path=token_path,
                    config=config
                )
                gdrive_link, gdrive_file_id = manager.upload_tailored_resume(job["company"], tailored_path)
                job["gdrive_link"] = gdrive_link
                job["gdrive_file_id"] = gdrive_file_id
                
                # Delete local file to implement Google Drive as primary DB
                if os.path.exists(tailored_path):
                    try:
                        os.remove(tailored_path)
                        print(f"Deleted local tailored resume copy: {tailored_path}")
                    except Exception as clean_err:
                        print(f"Failed to delete local copy: {clean_err}")
            except Exception as e:
                gdrive_error = str(e)
                print(f"Failed to sync tailored resume to Google Drive: {e}")
        
        # Save cache changes
        jobs_json_path = ROOT_DIR / "data" / "discovered_jobs.json"
        with open(jobs_json_path, "w", encoding="utf-8") as f:
            json.dump(jobs_cache, f, indent=2)
            
        res_data = {
            "status": "success",
            "message": "Resume tailored successfully",
            "pdf_path": tailored_path,
            "ats_audit": job.get("ats_audit")
        }
        if gdrive_link:
            res_data["gdrive_link"] = gdrive_link
            res_data["gdrive_file_id"] = gdrive_file_id
        if gdrive_error:
            res_data["gdrive_error"] = gdrive_error
        return res_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to tailor resume: {e}")

def _ensure_tailored_resume_locally(job: dict, tailored_path: str) -> str:
    """
    Ensures that the tailored resume PDF exists locally at tailored_path.
    If Google Drive sync is enabled and gdrive_file_id exists, downloads it.
    Otherwise, if tailored_data is cached, regenerates the PDF locally from it.
    Otherwise, calls ResumeTweaker to tailor it from scratch.
    """
    if os.path.exists(tailored_path):
        return tailored_path
        
    sync_enabled, secrets_path, token_path = get_gdrive_config()
    gdrive_file_id = job.get("gdrive_file_id")
    yaml_path = ROOT_DIR / "config" / "searches.yaml"
    config = load_config(yaml_path)
    
    # 1. Try to download from Google Drive
    if sync_enabled and gdrive_file_id:
        try:
            manager = GoogleDriveManager(
                client_secrets_path=secrets_path,
                token_path=token_path,
                config=config
            )
            if manager.download_file(gdrive_file_id, tailored_path):
                print(f"Successfully downloaded tailored resume from Google Drive: {tailored_path}")
                return tailored_path
        except Exception as e:
            print(f"Failed to download tailored resume from Google Drive: {e}")
            
    # 2. Try to generate from cached tailored_data
    tweaker = ResumeTweaker(config)
    tailored_data = job.get("tailored_data")
    if tailored_data:
        try:
            os.makedirs(os.path.dirname(tailored_path), exist_ok=True)
            tweaker.generate_pdf_from_json(tailored_data, tailored_path)
            
            # Apply hash buster
            from src.document_generator import DocumentGenerator
            doc_gen = DocumentGenerator("", tailored_path)
            doc_gen.regenerate_with_hash_modifier()
            
            print(f"Successfully regenerated tailored resume from cached data: {tailored_path}")
            return tailored_path
        except Exception as e:
            print(f"Failed to generate resume PDF from cached tailored_data: {e}")
            
    # 3. Fallback to tailoring from scratch
    print("Re-running resume tailoring from scratch...")
    actual_path = tweaker.tailor_resume(
        job_title=job["title"],
        job_company=job["company"],
        job_desc=job["description"]
    )
    job["tailored_pdf_path"] = actual_path
    if hasattr(tweaker, "last_tailored_data") and tweaker.last_tailored_data:
        job["tailored_data"] = tweaker.last_tailored_data
        
    # Save cache changes
    jobs_json_path = ROOT_DIR / "data" / "discovered_jobs.json"
    with open(jobs_json_path, "w", encoding="utf-8") as f:
        json.dump(jobs_cache, f, indent=2)
        
    return actual_path

@app.get("/api/jobs/{job_id}/tailor/view")
def view_tailored_resume(job_id: str, path: str = None):
    """
    Returns the tailored resume PDF inline in the browser.
    """
    if path:
        target = Path(path)
        try:
            target.relative_to(ROOT_DIR / "assets")
        except ValueError:
            raise HTTPException(status_code=400, detail="Directory traversal attempt detected.")
        if target.exists() and target.is_file():
            return FileResponse(path=str(target), media_type="application/pdf")
        raise HTTPException(status_code=404, detail="File not found.")

    global jobs_cache
    job = next((j for j in jobs_cache if j["id"] == job_id), None)
    if not job:
        jobs_json_path = ROOT_DIR / "data" / "discovered_jobs.json"
        if jobs_json_path.exists():
            with open(jobs_json_path, "r", encoding="utf-8") as f:
                loaded = json.load(f)
                job = next((j for j in loaded if j["id"] == job_id), None)
                
    if not job:
        raise HTTPException(status_code=404, detail="Job listing not found.")
        
    tailored_path = job.get("tailored_pdf_path")
    if not tailored_path:
        from config.constants import MODIFIED_RESUME_PATH
        tailored_path = MODIFIED_RESUME_PATH or str(ROOT_DIR / "data" / "Modified_Resume.pdf")
        
    local_path = _ensure_tailored_resume_locally(job, tailored_path)
    return FileResponse(path=local_path, media_type="application/pdf")

@app.get("/api/jobs/{job_id}/tailor/download")
def download_tailored_resume(job_id: str, path: str = None, filename: str = None):
    """
    Downloads the tailored resume PDF file.
    """
    if path:
        target = Path(path)
        try:
            target.relative_to(ROOT_DIR / "assets")
        except ValueError:
            raise HTTPException(status_code=400, detail="Directory traversal attempt detected.")
        if target.exists() and target.is_file():
            return FileResponse(path=str(target), media_type="application/pdf", filename=filename or target.name)
        raise HTTPException(status_code=404, detail="File not found.")

    global jobs_cache
    # Match job from cache
    job = next((j for j in jobs_cache if j["id"] == job_id), None)
    if not job:
        # Check from file
        jobs_json_path = ROOT_DIR / "data" / "discovered_jobs.json"
        if jobs_json_path.exists():
            with open(jobs_json_path, "r", encoding="utf-8") as f:
                loaded = json.load(f)
                job = next((j for j in loaded if j["id"] == job_id), None)
                
    if not job:
        raise HTTPException(status_code=404, detail="Job listing not found.")
        
    tailored_path = job.get("tailored_pdf_path")
    if not tailored_path:
        from config.constants import MODIFIED_RESUME_PATH
        tailored_path = MODIFIED_RESUME_PATH or str(ROOT_DIR / "data" / "Modified_Resume.pdf")
        
    local_path = _ensure_tailored_resume_locally(job, tailored_path)
    fn = f"Nitin_Pradhan_Resume_{job['company'].replace(' ', '_')}.pdf"
    return FileResponse(
        path=local_path,
        media_type="application/pdf",
        filename=fn
    )


@app.get("/api/resume/original")
def get_original_resume():
    """
    Returns the original candidate resume structure template.
    """
    from src.resume_tweaker import NITIN_RESUME_TEMPLATE
    return NITIN_RESUME_TEMPLATE

@app.get("/api/jobs/{job_id}/tailored_data")
def get_tailored_data(job_id: str):
    """
    Returns the tailored resume JSON data for the job, generating it if it doesn't exist.
    """
    global jobs_cache
    job = next((j for j in jobs_cache if j["id"] == job_id), None)
    if not job:
        jobs_json_path = ROOT_DIR / "data" / "discovered_jobs.json"
        if jobs_json_path.exists():
            with open(jobs_json_path, "r", encoding="utf-8") as f:
                loaded = json.load(f)
                job = next((j for j in loaded if j["id"] == job_id), None)
                
    if not job:
        raise HTTPException(status_code=404, detail="Job listing not found.")
        
    tailored_data = job.get("tailored_data")
    if not tailored_data:
        # Generate the tailored resume content on the fly
        yaml_path = ROOT_DIR / "config" / "searches.yaml"
        config = load_config(yaml_path)
        tweaker = ResumeTweaker(config)
        tweaker.tailor_resume(
            job_title=job["title"],
            job_company=job["company"],
            job_desc=job["description"]
        )
        if hasattr(tweaker, "last_tailored_data") and tweaker.last_tailored_data:
            job["tailored_data"] = tweaker.last_tailored_data
            
            # Save cache changes
            jobs_json_path = ROOT_DIR / "data" / "discovered_jobs.json"
            with open(jobs_json_path, "w", encoding="utf-8") as f:
                json.dump(jobs_cache, f, indent=2)
                
            tailored_data = job["tailored_data"]
            
    if not tailored_data:
        raise HTTPException(status_code=500, detail="Failed to retrieve or generate tailored resume data.")
        
    return tailored_data

@app.post("/api/jobs/{job_id}/apply")
def apply_to_job(job_id: str, background_tasks: BackgroundTasks):
    """
    Triggers automated Naukri login + apply flow in-process (background thread).
    """
    global jobs_cache
    job = next((j for j in jobs_cache if j["id"] == job_id), None)
    if not job:
        raise HTTPException(status_code=404, detail="Job listing not found in active cache.")

    if job.get("applied"):
        return {"status": "already_applied", "message": f"Already applied to this job."}

    background_tasks.add_task(_run_apply_inprocess, job_id)
    return {"status": "started", "message": f"Auto-apply initiated for '{job.get('title', job_id)}'. Watch the terminal for live status."}


def _run_apply_inprocess(job_id: str):
    """
    In-process apply runner: loads config, tailors resume, then calls NaukriRunner.apply_to_job().
    Writes live progress to log_buffer for the terminal to display.
    """
    global jobs_cache, log_buffer
    log_buffer.clear()

    from config.constants import GDRIVE_SYNC_ENABLED
    temp_downloaded = False
    tailored_path = None

    def log(msg: str):
        log_buffer.append(msg + "\n")
        if len(log_buffer) > 1000:
            log_buffer.pop(0)

    try:
        log(f"[System] Initializing apply pipeline for Job ID '{job_id}'...")

        # Load job from disk (most up-to-date)
        jobs_path = ROOT_DIR / "data" / "discovered_jobs.json"
        if not jobs_path.exists():
            log("[Error] discovered_jobs.json not found. Run a job scan first.")
            return

        with open(jobs_path, "r", encoding="utf-8") as f:
            all_jobs = json.load(f)

        job = next((j for j in all_jobs if j["id"] == job_id), None)
        if not job:
            log(f"[Error] Job ID '{job_id}' not found.")
            return

        log(f"[System] Target: '{job['title']}' at '{job['company']}'")

        # Load config
        config = load_config(ROOT_DIR / "config" / "searches.yaml")

        # Step 1: Tailor or download resume on demand
        from config.constants import GDRIVE_SYNC_ENABLED, GDRIVE_CLIENT_SECRETS_PATH, GDRIVE_TOKEN_PATH, MODIFIED_RESUME_PATH
        gdrive_file_id = job.get("gdrive_file_id")
        tailored_path = MODIFIED_RESUME_PATH
        temp_downloaded = False
        
        if GDRIVE_SYNC_ENABLED and gdrive_file_id:
            log("[GDrive] Found existing tailored resume on Google Drive. Downloading...")
            try:
                gdrive = GoogleDriveManager(
                    client_secrets_path=str(ROOT_DIR / GDRIVE_CLIENT_SECRETS_PATH),
                    token_path=str(ROOT_DIR / GDRIVE_TOKEN_PATH),
                    config=config
                )
                if gdrive.download_file(gdrive_file_id, tailored_path):
                    temp_downloaded = True
                    log(f"[GDrive] Downloaded tailored resume to: {tailored_path}")
            except Exception as e:
                log(f"[GDrive Warning] Failed to download existing resume: {e}. Re-generating...")
                
        if not temp_downloaded:
            log(f"[AI] Generating tailored resume for {job['title']}...")
            tweaker = ResumeTweaker(config)
            tailored_path = tweaker.tailor_resume(
                job_title=job["title"],
                job_company=job["company"],
                job_desc=job["description"]
            )
            log(f"[Success] Tailored resume ready: {tailored_path}")
            if hasattr(tweaker, "last_tailored_data") and tweaker.last_tailored_data:
                job["tailored_data"] = tweaker.last_tailored_data

            # Step 1b: Google Drive sync
            if GDRIVE_SYNC_ENABLED:
                log("[GDrive] Syncing tailored resume to Google Drive...")
                try:
                    gdrive = GoogleDriveManager(
                        client_secrets_path=str(ROOT_DIR / GDRIVE_CLIENT_SECRETS_PATH),
                        token_path=str(ROOT_DIR / GDRIVE_TOKEN_PATH),
                        config=config
                    )
                    link, file_id = gdrive.upload_tailored_resume(job["company"], tailored_path)
                    log(f"[GDrive] Upload complete. Link: {link}")
                    job["gdrive_link"] = link
                    job["gdrive_file_id"] = file_id
                    temp_downloaded = True # Mark that we should clean up local temp file
                except Exception as e:
                    log(f"[GDrive Warning] Sync skipped: {e}")

        # Step 2: Apply via NaukriRunner
        from config.constants import USERNAME, PASSWORD, AGENT_BROWSER_HEADED, AGENT_BROWSER_CDP
        from src.naukri_runner import NaukriRunner

        log(f"[Browser] Launching Naukri apply engine for: {job['url']}")
        runner = NaukriRunner(
            username=USERNAME,
            password=PASSWORD,
            resume_path=tailored_path,
            headed=AGENT_BROWSER_HEADED,
            cdp_address=AGENT_BROWSER_CDP or ""
        )

        is_easy_apply = (job.get("apply_type", "Easy Apply") == "Easy Apply")

        result = runner.apply_to_job(
            job_url=job["url"],
            job_title=job["title"],
            job_company=job["company"],
            tailored_resume_path=tailored_path,
            is_easy_apply=is_easy_apply
        )

        # Step 3: Update job record
        if result["success"]:
            job["applied"] = True
            job["apply_result"] = result["message"]
            log(f"[✅ SUCCESS] {result['message']}")
        else:
            log(f"[⚠️ Partial] {result['message']}")
            if result.get("screenshot"):
                log(f"[Info] Screenshot: {result['screenshot']}")

        # Persist updated state
        with open(jobs_path, "w", encoding="utf-8") as f:
            json.dump(all_jobs, f, indent=2)

        # Refresh cache
        jobs_cache = all_jobs
        log("[System] Job status updated in local database.")

    except Exception as e:
        log(f"[Error] Apply pipeline failed: {e}")
        import traceback
        log(traceback.format_exc())
    finally:
        # Clean up temporary local file if we synced to Google Drive or downloaded from Drive
        if GDRIVE_SYNC_ENABLED and temp_downloaded and tailored_path and os.path.exists(tailored_path):
            try:
                os.remove(tailored_path)
                log("[System] Cleaned up temporary local tailored resume file.")
            except Exception as clean_err:
                log(f"[System Warning] Could not remove temp file: {clean_err}")


# Google Drive Helper Functions & Endpoints
def get_gdrive_config():
    """
    Parses and returns Google Drive config variables from config/constants.py.
    Checks imported constants first for dynamic session support.
    """
    try:
        from config.constants import GDRIVE_SYNC_ENABLED, GDRIVE_CLIENT_SECRETS_PATH, GDRIVE_TOKEN_PATH
        return GDRIVE_SYNC_ENABLED, GDRIVE_CLIENT_SECRETS_PATH, GDRIVE_TOKEN_PATH
    except Exception:
        pass
    
    constants_path = ROOT_DIR / "config" / "constants.py"
    sync_enabled = False
    client_secrets_path = "config/credentials.json"
    token_path = "data/token.json"
    
    if constants_path.exists():
        content = constants_path.read_text(encoding="utf-8")
        import re
        
        # Parse GDRIVE_SYNC_ENABLED
        sync_match = re.search(r'^GDRIVE_SYNC_ENABLED\s*=\s*(.*?)\s*$', content, re.MULTILINE)
        if sync_match:
            val = sync_match.group(1).strip()
            if val == "True":
                sync_enabled = True
                
        # Parse GDRIVE_CLIENT_SECRETS_PATH
        secrets_match = re.search(r'^GDRIVE_CLIENT_SECRETS_PATH\s*=\s*(.*?)\s*$', content, re.MULTILINE)
        if secrets_match:
            val = secrets_match.group(1).strip()
            env_match = re.search(r'os\.getenv\(\s*["\']\w+["\']\s*,\s*(.*?)\s*\)', val)
            if env_match:
                val = env_match.group(1).strip()
            if val.startswith(('"', "'")) and val.endswith(('"', "'")):
                val = val[1:-1]
            elif val.startswith("r") and val[1] in ('"', "'") and val.endswith(('"', "'")):
                val = val[2:-1]
            client_secrets_path = val
            
        # Parse GDRIVE_TOKEN_PATH
        token_match = re.search(r'^GDRIVE_TOKEN_PATH\s*=\s*(.*?)\s*$', content, re.MULTILINE)
        if token_match:
            val = token_match.group(1).strip()
            env_match = re.search(r'os\.getenv\(\s*["\']\w+["\']\s*,\s*(.*?)\s*\)', val)
            if env_match:
                val = env_match.group(1).strip()
            if val.startswith(('"', "'")) and val.endswith(('"', "'")):
                val = val[1:-1]
            elif val.startswith("r") and val[1] in ('"', "'") and val.endswith(('"', "'")):
                val = val[2:-1]
            token_path = val
            
    return sync_enabled, str(ROOT_DIR / client_secrets_path), str(ROOT_DIR / token_path)

gdrive_auth_thread = None
gdrive_auth_url = None
gdrive_auth_error = None

def enable_gdrive_sync_in_constants():
    """
    Simulated. Google Drive sync is configured dynamically inside the session context.
    """
    pass

def run_gdrive_auth_flow(secrets_path: str, token_path: str):
    global gdrive_auth_url, gdrive_auth_error
    gdrive_auth_url = None
    gdrive_auth_error = None
    try:
        yaml_path = ROOT_DIR / "config" / "searches.yaml"
        config = load_config(yaml_path)
        manager = GoogleDriveManager(
            client_secrets_path=secrets_path,
            token_path=token_path,
            config=config
        )
        
        def save_url(url):
            global gdrive_auth_url
            gdrive_auth_url = url
            
        if manager.authenticate_local(url_callback=save_url):
            # Auto-enable Google Drive sync in constants configuration
            enable_gdrive_sync_in_constants()
    except Exception as e:
        gdrive_auth_error = str(e)
        print(f"Error during Google Drive OAuth flow: {e}")

@app.get("/api/gdrive/status")
def get_gdrive_status():
    """
    Checks the status of the Google Drive integration.
    """
    sync_enabled, secrets_path, token_path = get_gdrive_config()
    
    secrets_exist = os.path.exists(secrets_path)
    token_exists = os.path.exists(token_path)
    authenticated = False
    
    if secrets_exist:
        try:
            yaml_path = ROOT_DIR / "config" / "searches.yaml"
            config = load_config(yaml_path)
            manager = GoogleDriveManager(
                client_secrets_path=secrets_path,
                token_path=token_path,
                config=config
            )
            authenticated = manager.load_credentials()
        except Exception:
            pass
            
    return {
        "sync_enabled": sync_enabled,
        "client_secrets_exist": secrets_exist,
        "token_exists": token_exists,
        "authenticated": authenticated
    }

@app.post("/api/gdrive/auth")
def authenticate_gdrive():
    """
    Triggers Google Drive local OAuth authentication in a background thread and returns the authorization URL.
    """
    global gdrive_auth_thread, gdrive_auth_url, gdrive_auth_error
    sync_enabled, secrets_path, token_path = get_gdrive_config()
    
    if not os.path.exists(secrets_path):
        raise HTTPException(
            status_code=400,
            detail=f"Google Client Secrets credentials file not found at: {secrets_path}. Please place it there first."
        )
        
    gdrive_auth_url = None
    gdrive_auth_error = None
    
    gdrive_auth_thread = threading.Thread(
        target=run_gdrive_auth_flow,
        args=(secrets_path, token_path),
        daemon=True
    )
    gdrive_auth_thread.start()
    
    # Poll for the authorization URL (up to 5 seconds)
    import time
    start_time = time.time()
    while gdrive_auth_url is None and gdrive_auth_error is None:
        if time.time() - start_time > 5.0:
            break
        time.sleep(0.1)
        
    if gdrive_auth_error:
        raise HTTPException(status_code=500, detail=f"Authentication initialization failed: {gdrive_auth_error}")
        
    if gdrive_auth_url is None:
        raise HTTPException(status_code=500, detail="Authentication server timed out before generating URL.")
        
    return {
        "status": "started",
        "authorization_url": gdrive_auth_url,
        "message": "Google Drive OAuth flow initiated."
    }

@app.post("/api/resume/scan-filters")
def scan_resume_for_filters():
    """
    Reads the candidate's resume PDF from config/constants.py RESUME_PATH.
    Parses the text, uses Gemini to extract skills, experience, and target positions.
    Returns the parsed results.
    """
    import re
    import pypdf
    import google.generativeai as genai
    from config import constants as consts
    
    resume_path = consts.RESUME_PATH
    gemini_key = consts.GEMINI_API_KEY
    
    # Check constants.py statically as a fallback if not configured dynamically
    if not resume_path:
        constants_path = ROOT_DIR / "config" / "constants.py"
        if constants_path.exists():
            content = constants_path.read_text(encoding="utf-8")
            match_resume = re.search(r'^RESUME_PATH\s*=\s*(.*?)\s*$', content, re.MULTILINE)
            if match_resume:
                val = match_resume.group(1).strip()
                env_match = re.search(r'os\.getenv\(\s*["\']\w+["\']\s*,\s*(.*?)\s*\)', val)
                if env_match:
                    val = env_match.group(1).strip()
                if val.startswith(('"', "'")) and val.endswith(('"', "'")):
                    val = val[1:-1]
                elif val.startswith("r") and val[1] in ('"', "'") and val.endswith(('"', "'")):
                    val = val[2:-1]
                resume_path = val
                
            match_key = re.search(r'^GEMINI_API_KEY\s*=\s*(.*?)\s*$', content, re.MULTILINE)
            if match_key:
                val = match_key.group(1).strip()
                env_match = re.search(r'os\.getenv\(\s*["\']\w+["\']\s*,\s*(.*?)\s*\)', val)
                if env_match:
                    val = env_match.group(1).strip()
                if val.startswith(('"', "'")) and val.endswith(('"', "'")):
                    val = val[1:-1]
                gemini_key = val

    # Smart Auto-Detection Fallback!
    # Check if configured path exists
    def check_pdf_path(path):
        if not path:
            return None
        p = Path(path)
        if not p.is_absolute():
            p = ROOT_DIR / p
        return p if p.exists() else None

    resolved_path = check_pdf_path(resume_path)
    if not resolved_path:
        detected_pdf = None
        
        # 1. Search assets/resume/
        resume_dir = ROOT_DIR / "assets" / "resume"
        if resume_dir.exists():
            pdfs = [f for f in resume_dir.iterdir() if f.is_file() and f.suffix.lower() == ".pdf"]
            if pdfs:
                detected_pdf = pdfs[0]
                
        # 2. Search assets/
        if not detected_pdf:
            assets_dir = ROOT_DIR / "assets"
            if assets_dir.exists():
                pdfs = [f for f in assets_dir.iterdir() if f.is_file() and f.suffix.lower() == ".pdf"]
                if pdfs:
                    detected_pdf = pdfs[0]
                    
        # 3. Search assets/resume_hub/original/
        if not detected_pdf:
            hub_dir = ROOT_DIR / "assets" / "resume_hub" / "original"
            if hub_dir.exists():
                pdfs = [f for f in hub_dir.iterdir() if f.is_file() and f.suffix.lower() == ".pdf"]
                if pdfs:
                    detected_pdf = pdfs[0]
                    
        if detected_pdf:
            resume_path = str(detected_pdf)
            resolved_path = detected_pdf
            # Dynamic update inside ContextVar session config to bind to current user tab session
            try:
                consts.session_config_var.get()["constants"]["RESUME_PATH"] = resume_path
            except Exception:
                pass

    if not resolved_path:
        raise HTTPException(
            status_code=400,
            detail="Resume not found on system. Please upload to proceed."
        )
        
    # Extract text from PDF
    try:
        reader = pypdf.PdfReader(str(resolved_path))
        text = ""
        for page in reader.pages:
            text += page.extract_text() or ""
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse resume PDF: {e}")
        
    extracted_data = {
        "candidate_experience_years": 0.0,
        "candidate_skills": [],
        "positions": []
    }
    
    if gemini_key:
        try:
            genai.configure(api_key=gemini_key)
            model = genai.GenerativeModel("gemini-2.5-flash")
            
            prompt = f"""
            Analyze the following resume text and extract the candidate's professional profile details as a JSON object with these exact keys:
            - "candidate_experience_years": A floating point number representing the total years of professional experience (e.g. 7.5, 3.0, 10). If not explicit, calculate based on dates.
            - "candidate_skills": A list of technical skills/languages/frameworks mentioned (e.g. ["C#", ".NET Core", "React", "TypeScript", "AWS", "SQL Server"]). Limit to the top 15 core technical skills.
            - "positions": A list of target or past job titles matched to their profile (e.g. ["Software Engineer", "Full Stack Developer", "Backend Engineer"]).
            
            Output ONLY valid JSON. Do not include any markdown formatting backticks, code block wrappers, or extra text.
            
            Resume text:
            {text}
            """
            response = model.generate_content(prompt)
            response_text = response.text.strip()
            
            # Remove markdown formatting if present
            if response_text.startswith("```"):
                response_text = re.sub(r'^```(?:json)?\n', '', response_text)
                response_text = re.sub(r'\n```$', '', response_text)
                
            data = json.loads(response_text)
            extracted_data["candidate_experience_years"] = float(data.get("candidate_experience_years", 0.0))
            extracted_data["candidate_skills"] = list(data.get("candidate_skills", []))
            extracted_data["positions"] = list(data.get("positions", []))
        except Exception as gem_err:
            print(f"Gemini resume filter extraction failed: {gem_err}. Using rule-based extraction fallback...")
            
    # Fallback / Rule-based extraction if Gemini fails or is not configured
    if not extracted_data["candidate_skills"]:
        if "Nitin" in text or "nitinpradhan48@gmail.com" in text:
            extracted_data["candidate_experience_years"] = 7.0
            extracted_data["candidate_skills"] = ["C#", ".NET Core", "React", "TypeScript", "AWS", "SQL Server", "Microservices"]
            extracted_data["positions"] = ["Software Engineer", "Full Stack Developer", "Backend Engineer"]
        else:
            exp_match = re.search(r'(\d+)\+?\s*years?', text, re.IGNORECASE)
            if exp_match:
                extracted_data["candidate_experience_years"] = float(exp_match.group(1))
            else:
                extracted_data["candidate_experience_years"] = 3.0
                
            skills_found = []
            for skill in ["Python", "JavaScript", "React", "Node", "TypeScript", "Golang", "AWS", "Docker", "PostgreSQL", "SQL Server", "C#", ".NET"]:
                if re.search(rf'\b{re.escape(skill)}\b', text, re.IGNORECASE):
                    skills_found.append(skill)
            extracted_data["candidate_skills"] = skills_found
            extracted_data["positions"] = ["Software Engineer"]
            
    return extracted_data


# ============================================================
# File Upload Endpoints
# ============================================================

@app.post("/api/upload/resume")
async def upload_resume(file: UploadFile = File(...)):
    """
    Accepts a PDF resume upload, saves it to the assets/resume/ folder.
    Bypasses updating constants.py on disk due to sessionStorage isolation.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted for resume upload.")

    dest_path = RESUME_DIR / file.filename
    try:
        with open(dest_path, "wb") as out:
            shutil.copyfileobj(file.file, out)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save uploaded resume: {e}")
    finally:
        await file.close()

    return {
        "status": "success",
        "filename": file.filename,
        "path": str(dest_path),
        "message": f"Resume '{file.filename}' uploaded to assets/resume/."
    }


@app.post("/api/upload/gdrive-credentials")
async def upload_gdrive_credentials(file: UploadFile = File(...)):
    """
    Accepts a Google OAuth credentials JSON upload and saves it to config/credentials.json.
    Auto-updates GDRIVE_CLIENT_SECRETS_PATH in constants.py.
    """
    if not file.filename or not file.filename.lower().endswith(".json"):
        raise HTTPException(status_code=400, detail="Only JSON files are accepted for Google credentials upload.")

    dest_path = ROOT_DIR / "config" / "credentials.json"
    try:
        with open(dest_path, "wb") as out:
            shutil.copyfileobj(file.file, out)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save credentials file: {e}")
    finally:
        await file.close()

    # Auto-update GDRIVE_CLIENT_SECRETS_PATH in constants.py
    constants_path = ROOT_DIR / "config" / "constants.py"
    if constants_path.exists():
        import re
        content = constants_path.read_text(encoding="utf-8")
        content = re.sub(
            r'^GDRIVE_CLIENT_SECRETS_PATH\s*=.*$',
            'GDRIVE_CLIENT_SECRETS_PATH = os.getenv("GDRIVE_CLIENT_SECRETS_PATH", r"config/credentials.json")',
            content, flags=re.MULTILINE
        )
        constants_path.write_text(content, encoding="utf-8")

    return {
        "status": "success",
        "filename": file.filename,
        "path": "config/credentials.json",
        "message": "Google credentials JSON uploaded and GDRIVE_CLIENT_SECRETS_PATH updated."
    }


@app.get("/api/assets/list")
def list_assets():
    """Lists all files in the assets/ directory."""
    files = []
    for f in ASSETS_DIR.iterdir():
        if f.is_file():
            files.append({"name": f.name, "size": f.stat().st_size})
    return {"files": files}


@app.delete("/api/assets/{filename}")
def delete_asset(filename: str):
    """
    Deletes a file from the assets/resume/ or assets/ folder and clears the matching
    config key (RESUME_PATH) from constants.py when the resume is removed.
    """
    import re as _re
    # Clean filename checks - allow common chars including parens and brackets
    if not _re.match(r'^[\w\-\.\(\)\[\] ]+\.(pdf|json|docx)$', filename):
        raise HTTPException(status_code=400, detail="Invalid filename.")
    
    # Check resume subfolder first
    file_path = RESUME_DIR / filename
    if not file_path.exists():
        # Fall back to parent assets folder
        file_path = ASSETS_DIR / filename
        
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Asset file not found.")
        
    # Security constraint check: ensure path is inside ASSETS_DIR
    try:
        file_path.resolve().relative_to(ASSETS_DIR.resolve())
    except ValueError:
        raise HTTPException(status_code=400, detail="Access denied: File outside assets directory.")

    file_path.unlink()

    # Clear RESUME_PATH in constants.py if the deleted file was the resume
    constants_path = ROOT_DIR / "config" / "constants.py"
    if constants_path.exists():
        content = constants_path.read_text(encoding="utf-8")
        if filename in content:
            content = _re.sub(
                r'^RESUME_PATH\s*=.*$',
                'RESUME_PATH = os.getenv("RESUME_PATH", "")',
                content, flags=_re.MULTILINE
            )
            constants_path.write_text(content, encoding="utf-8")

    return {"status": "success", "message": f"'{filename}' deleted safely."}


@app.delete("/api/gdrive-credentials")
def delete_gdrive_credentials():
    """Deletes config/credentials.json and clears GDRIVE_CLIENT_SECRETS_PATH."""
    import re as _re
    creds_path = ROOT_DIR / "config" / "credentials.json"
    if not creds_path.exists():
        raise HTTPException(status_code=404, detail="credentials.json not found.")
    creds_path.unlink()

    constants_path = ROOT_DIR / "config" / "constants.py"
    if constants_path.exists():
        content = constants_path.read_text(encoding="utf-8")
        content = _re.sub(
            r'^GDRIVE_CLIENT_SECRETS_PATH\s*=.*$',
            'GDRIVE_CLIENT_SECRETS_PATH = os.getenv("GDRIVE_CLIENT_SECRETS_PATH", r"config/credentials.json")',
            content, flags=_re.MULTILINE
        )
        constants_path.write_text(content, encoding="utf-8")

    return {"status": "success", "message": "Google credentials file deleted."}


# ============================================================
# Screenshot Viewer Endpoints
# ============================================================

@app.get("/api/screenshots")
def list_screenshots():
    """
    Returns a sorted list of all screenshots captured during apply runs.
    """
    screenshots = []
    for f in sorted(SCREENSHOTS_DIR.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
        if f.is_file() and f.suffix.lower() == ".png":
            screenshots.append({
                "filename": f.name,
                "url": f"/api/screenshots/{f.name}",
                "size": f.stat().st_size,
                "mtime": int(f.stat().st_mtime)
            })
    return {"screenshots": screenshots}


@app.get("/api/screenshots/{filename}")
def serve_screenshot(filename: str):
    """
    Serves a single screenshot image by filename.
    """
    import re as _re
    if not _re.match(r'^[\w\-\.]+\.png$', filename):
        raise HTTPException(status_code=400, detail="Invalid filename.")
    file_path = SCREENSHOTS_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Screenshot not found.")
    return FileResponse(path=str(file_path), media_type="image/png")


@app.delete("/api/screenshots/{filename}")
def delete_screenshot(filename: str):
    """Deletes a single screenshot file."""
    import re as _re
    if not _re.match(r'^[\w\-\.]+\.png$', filename):
        raise HTTPException(status_code=400, detail="Invalid filename.")
    file_path = SCREENSHOTS_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Screenshot not found.")
    file_path.unlink()
    return {"status": "success", "message": f"'{filename}' deleted."}


@app.delete("/api/screenshots")
def delete_all_screenshots():
    """Deletes ALL screenshots from the data/screenshots/ directory."""
    deleted = 0
    for f in SCREENSHOTS_DIR.iterdir():
        if f.is_file() and f.suffix.lower() == ".png":
            f.unlink()
            deleted += 1
    return {"status": "success", "message": f"Deleted {deleted} screenshot(s)."}


# =====================================================================
# RESUME HUB ENDPOINTS (PHASE 22)
# =====================================================================
from src.resume_hub import (
    is_valid_job_portal,
    extract_text_from_docx,
    extract_text_from_pdf,
    parse_and_structure_resume,
    crawl_job_portal_details,
    audit_ats_score,
    generate_ats_friendly_pdf,
    send_resume_via_email
)



class JobCrawlRequest(BaseModel):
    url: str

class ResumeAnalyzeRequest(BaseModel):
    job_title: str
    job_company: str
    job_description: str
    resume_data: Dict[str, Any]

class ResumeTailorRequest(BaseModel):
    filename: str
    job_title: str
    job_company: str
    job_description: str
    resume_data: Dict[str, Any]

class EmailResumeRequest(BaseModel):
    to_email: str
    subject: str
    body: str
    attachment_path: str

class DeleteFileRequest(BaseModel):
    path: str

@app.post("/api/resume-hub/upload")
async def resume_hub_upload(file: UploadFile = File(...)):
    """
    Saves a custom resume PDF or DOCX file, extracts its raw text natively,
    and returns a structured JSON matching candidate profile templates.
    """
    ext = Path(file.filename).suffix.lower()
    if ext not in [".pdf", ".docx", ".doc"]:
        raise HTTPException(status_code=400, detail="Only .pdf and .docx (or converted .doc) files are supported.")
        
    hub_original_dir = ROOT_DIR / "assets" / "resume_hub" / "original"
    hub_original_dir.mkdir(parents=True, exist_ok=True)
    
    # Save file
    target_path = hub_original_dir / file.filename
    with open(target_path, "wb") as f:
        f.write(await file.read())
        
    # Extract text
    raw_text = ""
    if ext == ".docx":
        raw_text = extract_text_from_docx(str(target_path))
    elif ext == ".pdf":
        raw_text = extract_text_from_pdf(str(target_path))
    elif ext == ".doc":
        # Binary .doc fallback info
        target_path.unlink()
        raise HTTPException(status_code=400, detail="Old binary .doc format is not natively supported. Please convert it to modern .docx or PDF and upload again.")
        
    if not raw_text.strip():
        raise HTTPException(status_code=400, detail="Failed to extract readable text content from the uploaded resume.")
        
    # Structure using Gemini or default
    from config.constants import GEMINI_API_KEY
    structured = parse_and_structure_resume(raw_text, GEMINI_API_KEY)
    
    # Save original structured JSON
    try:
        filename_stem = Path(file.filename).stem
        filename_clean = _re.sub(r'[\W_]+', '_', filename_stem)
        json_path = hub_original_dir / f"{filename_clean}.json"
        with open(json_path, "w", encoding="utf-8") as f_json:
            json.dump(structured, f_json, indent=2)
        logger.info(f"Saved original structured JSON copy on disk: {json_path}")
    except Exception as err:
        logger.warning(f"Failed to save original structured JSON copy: {err}")
    
    return {
        "filename": file.filename,
        "structured_data": structured,
        "raw_text": raw_text
    }

@app.post("/api/resume-hub/crawl")
def resume_hub_crawl(payload: JobCrawlRequest):
    """
    Crawls a job board listing URL, reads the page content in background,
    and returns title, company, and job description variables.
    """
    url = payload.url.strip()
    if not is_valid_job_portal(url):
        raise HTTPException(status_code=400, detail="Please provide correct job portal url.")
        
    details = crawl_job_portal_details(url)
    if not details.get("description"):
        raise HTTPException(status_code=404, detail="Could not retrieve job description from the provided portal URL.")
        
    return details


def dict_to_plain_text(data: Any) -> str:
    """
    Recursively converts arbitrary JSON/dictionary structures into clean plain text for ATS scoring.
    """
    if isinstance(data, str):
        return data + "\n"
    elif isinstance(data, list):
        return "\n".join(dict_to_plain_text(item) for item in data)
    elif isinstance(data, dict):
        return "\n".join(dict_to_plain_text(val) for val in data.values())
    return ""

@app.post("/api/resume-hub/analyze")
def resume_hub_analyze(payload: ResumeAnalyzeRequest):
    """
    Analyzes and audits the ATS compatibility score of the original resume
    against the job description, returning matched/missing keywords and recommendations.
    """
    from config.constants import GEMINI_API_KEY
    
    # 1. Convert structured resume dict to plain text
    raw_text = dict_to_plain_text(payload.resume_data)
    
    # 2. Audit ATS Score
    audit = audit_ats_score(raw_text, payload.job_description, GEMINI_API_KEY)
    
    return {
        "ats_audit": audit
    }

@app.post("/api/resume-hub/tailor")
def resume_hub_tailor(payload: ResumeTailorRequest):
    """
    Custom tailors the structured resume JSON, compiles an ATS-friendly ReportLab PDF,
    saves it locally, and conducts a full ATS compatibility audit.
    """
    # 1. Custom tailor the resume JSON against job description
    from config.constants import GEMINI_API_KEY
    
    tailored_data = json.loads(json.dumps(payload.resume_data))
    
    # Simple rule-based tailoring if LLM is keyless (or we can use Gemini!)
    gemini_success = False
    if GEMINI_API_KEY:
        try:
            import google.generativeai as genai
            genai.configure(api_key=GEMINI_API_KEY)
            model = genai.GenerativeModel("gemini-3.1-flash-lite")
            prompt = f"""
You are an expert resume writer. Tailor the candidate's resume JSON to achieve at least an 85% match score against the job description. Do not fabricate facts (keep original companies, degree, dates).

Original Resume JSON:
{json.dumps(tailored_data, indent=2)}

Job Details:
Title: {payload.job_title}
Company: {payload.job_company}
Description: {payload.job_description}

Instructions:
1. Retain the EXACT same keys, section names, ordering, and structure as the original JSON. Do not rename or discard any keys or sections.
2. In the "contact" field (or equivalent contact string), append " | Willing to relocate" to the end if not already present.
3. Tailor the content *within* the existing sections (such as summary, skills, experience, or custom sections) to weave in the keywords, technologies, and methodologies required by the job description. Do NOT change the visual structure or phrasing format. Only make highly organic keyword additions/tweaks inside the existing text or bullet lists.
4. Keep the bullet points and text realistic, professional, and matching the candidate's actual credentials. Do not fabricate roles, dates, or companies.
5. Return ONLY a valid JSON object matching the input structure. Do not wrap it in markdown code blocks or backticks.
"""
            response = model.generate_content(
                prompt,
                generation_config={"response_mime_type": "application/json"}
            )
            parsed = json.loads(response.text.strip())
            if isinstance(parsed, dict) and "name" in parsed:
                tailored_data = parsed
                gemini_success = True
        except Exception as e:
            logger.warning(f"Resume Hub Gemini tailoring failed: {e}")
            
    if not gemini_success:
        # Utilize our unified, robust local fallback optimizer
        from src.resume_tweaker import ResumeTweaker
        tweaker = ResumeTweaker(config=None)
        tailored_data = tweaker._tailor_locally(tailored_data, payload.job_title, payload.job_description, payload.job_company)
            
    # 2. Output folder and file setup
    company_clean = _re.sub(r'[\W_]+', '_', payload.job_company.lower().strip())
    if not company_clean:
        company_clean = "generic"
        
    folder_path = ROOT_DIR / "assets" / f"{company_clean}_resume"
    folder_path.mkdir(parents=True, exist_ok=True)
    
    filename_stem = Path(payload.filename).stem
    filename_clean = _re.sub(r'[\W_]+', '_', filename_stem)
    tailored_filename = f"{filename_clean}_tailored.pdf"
    pdf_path = folder_path / tailored_filename
    
    # 3. Generate standard ATS PDF
    generate_ats_friendly_pdf(tailored_data, str(pdf_path))
    
    # Save the corresponding JSON file for visual Diffs later
    try:
        json_path = pdf_path.with_suffix(".json")
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(tailored_data, f, indent=2)
        logger.info(f"Saved tailored JSON copy on disk: {json_path}")
    except Exception as json_err:
        logger.warning(f"Failed to save tailored JSON copy: {json_err}")
    
    # 4. Audit ATS Score (Both original and tailored)
    original_text = dict_to_plain_text(payload.resume_data)
    original_audit = audit_ats_score(original_text, payload.job_description, GEMINI_API_KEY)
    
    tailored_text = extract_text_from_pdf(str(pdf_path))
    audit = audit_ats_score(tailored_text, payload.job_description, GEMINI_API_KEY)
    
    return {
        "pdf_path": str(pdf_path),
        "filename": tailored_filename,
        "tailored_data": tailored_data,
        "ats_audit": audit,
        "original_ats_audit": original_audit
    }

@app.post("/api/resume-hub/email")
def resume_hub_email(payload: EmailResumeRequest):
    """
    Decrypts the SMTP password, attaches the tailored resume PDF, and emails it.
    """
    # Import values dynamically to decrypt password on demand
    import config.constants as consts
    
    if not consts.SMTP_HOST or not consts.SMTP_USER:
        raise HTTPException(status_code=400, detail="SMTP email settings are not configured in Secrets & Keys.")
        
    result = send_resume_via_email(
        to_email=payload.to_email,
        subject=payload.subject,
        body=payload.body,
        attachment_path=payload.attachment_path,
        smtp_host=consts.SMTP_HOST,
        smtp_port=consts.SMTP_PORT,
        smtp_user=consts.SMTP_USER,
        smtp_pass=consts.SMTP_PASSWORD
    )
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["message"])
        
    return {"status": "success", "message": result["message"]}

@app.get("/api/resume-hub/files")
def resume_hub_files():
    """
    Lists all custom tailored PDF files residing locally inside the asset subfolders.
    """
    files = []
    assets_dir = ROOT_DIR / "assets"
    if assets_dir.exists():
        for item in assets_dir.iterdir():
            if item.is_dir() and item.name.endswith("_resume"):
                company = item.name.replace("_resume", "").replace("_", " ").title()
                for pdf in item.iterdir():
                    if pdf.name.endswith("_tailored.pdf"):
                        files.append({
                            "company": company,
                            "filename": pdf.name,
                            "path": str(pdf),
                            "size": pdf.stat().st_size,
                            "created_at": pdf.stat().st_mtime
                        })
    return {"files": sorted(files, key=lambda x: x["created_at"], reverse=True)}

@app.delete("/api/resume-hub/files")
def resume_hub_delete_file(payload: DeleteFileRequest):
    """
    Deletes the tailored PDF from assets, ensuring no path traversal vulnerability.
    """
    target = Path(payload.path)
    
    # Path traversal validation
    try:
        target.relative_to(ROOT_DIR / "assets")
    except ValueError:
        raise HTTPException(status_code=400, detail="Directory traversal attempt detected. Delete aborted.")
        
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="Tailored resume file not found.")
        
    target.unlink()
    
    # Try deleting the corresponding .json file if it exists
    try:
        json_target = target.with_suffix(".json")
        if json_target.exists() and json_target.is_file():
            json_target.unlink()
            logger.info(f"Cleaned up matching JSON file: {json_target}")
    except Exception as e:
        logger.warning(f"Failed to delete matching JSON file: {e}")
    
    # Clean directory if empty
    parent = target.parent
    if parent.is_dir() and not list(parent.iterdir()):
        parent.rmdir()
        
    return {"status": "success", "message": "Tailored resume deleted successfully."}

@app.get("/api/resume-hub/tailored_data")
def resume_hub_get_tailored_data(path: str):
    """
    Returns the tailored JSON data from disk corresponding to the PDF path.
    """
    pdf_path = Path(path)
    # Path traversal validation
    try:
        pdf_path.relative_to(ROOT_DIR / "assets")
    except ValueError:
        raise HTTPException(status_code=400, detail="Directory traversal attempt detected.")
        
    json_path = pdf_path.with_suffix(".json")
    if json_path.exists() and json_path.is_file():
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to read tailored JSON data: {e}")
            
    raise HTTPException(status_code=404, detail="Tailored JSON data file not found.")
 
@app.get("/api/resume-hub/original_data")
def resume_hub_get_original_data(path: str):
    """
    Returns the original JSON data corresponding to the tailored PDF path.
    """
    pdf_path = Path(path)
    # The tailored PDF filename is {filename_clean}_tailored.pdf
    # So the original filename stem is pdf_path.name.replace("_tailored.pdf", "")
    filename_clean = pdf_path.name.replace("_tailored.pdf", "")
    
    hub_original_dir = ROOT_DIR / "assets" / "resume_hub" / "original"
    json_path = hub_original_dir / f"{filename_clean}.json"
    
    if json_path.exists() and json_path.is_file():
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to read original JSON data: {e}")
            
    # Fallback to general original resume template if not found
    from src.resume_tweaker import NITIN_RESUME_TEMPLATE
    return NITIN_RESUME_TEMPLATE

# Mount static folder
static_dir = ROOT_DIR / "static"
static_dir.mkdir(exist_ok=True)
app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")

