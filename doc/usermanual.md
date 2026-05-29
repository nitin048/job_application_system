# 📘 Complete User Manual: Autonomous Multi-Platform AI Job Application System

Welcome to the user manual for the **Autonomous Multi-Platform AI Job Application System**. This system is an end-to-end automation suite designed to crawl job boards, analyze candidate compatibility, optimize resumes using generative AI, upload and sync files to cloud storage, and automate the application submission process using anti-detect web drivers.

---

## 📖 Table of Contents
1. [System Overview & Target Audience](#1-system-overview--target-audience)
2. [Functional Subsystems: How They Work](#2-functional-subsystems-how-they-work)
3. [User Interface & Dashboard Tabs](#3-user-interface--dashboard-tabs)
4. [System Outputs: What the System Generates](#4-system-outputs-what-the-system-generates)
5. [Step-by-Step Operations Walkthrough](#5-step-by-step-operations-walkthrough)
6. [Troubleshooting, Evasions & FAQs](#6-troubleshooting-evasions--faqs)

---

## 1. System Overview & Target Audience

This application is built for job seekers (primarily software engineers, full-stack developers, and technical professionals) who want to automate the tedious steps of crawling job postings, customizing resumes for individual descriptions, and filing job applications.

The system interfaces directly with **Naukri.com** and standard company ATS forms (e.g., Workday, Greenhouse, Lever) via a hybrid interface of:
1. A **Premium Glassmorphic SPA Dashboard** (web browser portal running on `localhost:8000`).
2. A **Stateful Command-Line Interface (CLI)** tool (`main.py`) for background automations and cron jobs.

---

## 2. Functional Subsystems: How They Work

### A. Job Ingestion & Web Crawler (`src/job_crawler.py`)
The job crawler discovers active job openings based on your preferences.
1. **Search Vectors**: The system reads your configured target job titles (e.g., "Full Stack Developer") and locations from `config/searches.yaml`.
2. **Parallel Scrape Workers**: It launches multiple concurrent background crawler threads (up to 3 in parallel) to scrape Naukri search result lists.
3. **URL Normalization & Caching**: All found job URLs are normalized (removing trackers, queries, and session IDs). The system compares them against a local flat cache (`data/discovered_jobs.json`) to prevent scanning the same job twice.
4. **Detail Scraping**: For new jobs, the crawler navigates to the detailed page to parse the complete text description using BeautifulSoup4.
5. **Apply Type Detection**: It inspects interactive elements (buttons, links, forms) to detect whether the job is an **Easy Apply** (can be applied to directly on Naukri) or requires **Manual Intervention** (redirects to an external company careers page).
6. **Fallback Registry**: If the crawler is blocked by rate-limiting or is run without an active internet connection, it automatically loads a preconfigured registry of mock developer roles at companies like Google, Stripe, and Meta to allow offline testing.

### B. Compatibility Scoring Engine (`src/scoring.py`)
Every discovered job is scored out of **5.0** (scaled to a percentage) to assess how well your background matches the posting.
1. **Disqualification Checks**: The engine immediately reviews the company name and job title against `blacklist_companies` and `blacklist_titles` configured in `searches.yaml`. If there is a match, the score is forced to `0.0` and the job is excluded.
2. **Weight Allocation Formula**:
   $$\text{Compatibility Score} = 5.0 \times \sum (w_j \cdot s_j)$$
   * **Title Match (25% weight)**: Matches target roles against the job title.
   * **Tech Stack Match (25% weight)**: Compares required technologies in the job posting with candidate skills.
   * **Location Match (20% weight)**: Checks target location compatibility.
   * **Workplace Type Match (15% weight)**: Evaluates Remote, Hybrid, or On-site parameters.
   * **Seniority Match (15% weight)**: Compares required years of experience vs. candidate experience.

### C. AI Resume Customizer (`src/resume_tweaker.py`)
To maximize interview rates, this subsystem tailors a candidate's resume to match a specific job description.
1. **Gemini Integration**: Sends the candidate's base resume and the target job description to the Google Gemini API. It instructs the model to organically integrate key technologies, methodologies, and bullet points to hit an **85%+ ATS match score** while retaining actual names, dates, and locations.
2. **0.1s Local Heuristic Fallback**: If the Gemini API key is missing or quota limits are exceeded (HTTP 429), a local keyword injection engine executes in less than 0.1 seconds. It maps the skills in the job description to the resume sections (summary, skills list, experience bullets) automatically.
3. **ReportLab PDF Rendering**: Generates a single-column, clean, highly readable, ATS-compliant PDF using ReportLab flowables.

### D. Cryptographic Hash Buster (`src/document_generator.py`)
Job boards use file hashing algorithms to flag duplicate resume uploads.
* **How it works**: The system appends randomized white characters and metadata nodes (`/ModifierID`, `/Keywords`) to the PDF binary layout.
* **Result**: The visual document remains identical to the recruiter, but the cryptographic file signature (MD5/SHA-256 hash) changes completely on every generation. This forces Naukri to process the resume as a new document, updating the candidate's visibility timestamp on recruiters' search feeds.

### E. Stateful Form Filling (`src/form_graph.py`)
For external application forms, this sub-system automates input entries.
1. **State Node Workflow**:
   ```
   [Initialize] ➔ [Extract] ➔ [Generate] ➔ [Assemble]
   ```
   * **Initialize**: Validates the webpage address.
   * **Extract**: Iterates through elements (`input`, `select`, `textarea`, `file`) and associates them with labels, placeholders, or aria descriptions.
   * **Generate**: Maps candidate data (names, demographics, notices, salary expectations) to corresponding inputs.
   * **Assemble**: Populates values, uploads the tailored resume PDF, generates page screenshots, and prepares for submission.
2. **Interactive Form Actions**: Fills inputs, selects drop-down items, and checks boxes automatically.

### F. Playwright Evasion Driver (`src/browser_driver.py` & `src/naukri_runner.py`)
Handles web automation actions safely.
1. **Fingerprint Masking**: Injects a stealth evasion script before page load. This overrides `navigator.webdriver` to `undefined`, configures browser plugins, and sets languages to prevent bot-detection libraries (like Cloudflare or Akamai) from blocking the crawler.
2. **Slow-Motion Execution**: Configures a `slow_mo=150` millisecond delay between interactions to mimic human typing and browsing behavior.
3. **Session Preservation**: Saves cookies, tokens, and storage state to `data/session_state.json` on exit. This bypasses login challenges and OTP/SMS inputs on subsequent runs.
4. **Easy Apply Chatbot Navigation**: Evaluates multi-step chatbot apply drawers on Naukri, answers questions (defaults to "Yes/Agree" for checkboxes and inputs credentials like notice periods), and clicks submit.

### G. Google Drive Sync (`src/gdrive_manager.py`)
If enabled, uploads tailored resumes directly to Google Drive. Once uploaded, the local copy is deleted to maintain a clean local workspace. When applying, the system retrieves the file from Google Drive on-the-fly.

---

## 3. User Interface & Dashboard Tabs

### 1. 🔍 Job Scanner Tab
* **What it is**: Your central control center for discovering roles.
* **Key Actions**:
  * Click **Scan Jobs** to launch parallel crawling threads.
  * Monitor the **Live Execution Output Console** to see crawler logs, status reports, and scrape progress.
  * Inspect the **Discovered Listings Grid**. Displays the Role, Company, Location, Compatibility Percentage, and Apply Route (Easy Apply vs. Manual Intervention).
  * Sort listings by compatibility score to prioritize high-matching applications.

### 2. 📄 Resume Hub Tab
* **What it is**: The document vault and audit workspace.
* **Key Actions**:
  * Use the **Drag-and-Drop Ingestion Zone** to upload a `.pdf` or `.docx` resume.
  * View the **ATS Scorecard Circle Gauges** displaying Original vs. Tailored scores (Red/Danger for low matches, Teal/Accent for optimized matches).
  * Check the **Side-by-Side Visual Diff Panel** highlighting additions in green highlight and deletions in red strike-through text.
  * Enter a target Job URL and click **Analyze** to audit compatibility, or click **Tailor & Match** to generate a customized PDF.

### 3. ⚙️ Settings & Credentials Tab
* **What it is**: The configuration dashboard.
* **Key Actions**:
  * Edit Candidate Identity parameters (Personal info, Notice period, Expected salary).
  * Define Search Parameters (Target positions, locations, workplace types, and blacklist rules).
  * Enter API keys (Gemini) and SMTP host details. Saving automatically encrypts passwords on disk.

---

## 4. System Outputs: What the System Generates

When you run the system, it generates the following file assets locally:

1. **`data/discovered_jobs.json`**: A structured database of scraped job descriptions, compatibility metrics, apply routes, and tailoring histories.
2. **`data/session_state.json`**: Encrypted cookies and browser storage state to persist logins.
3. **`data/screenshots/`**:
   * `apply_before_*.png`: Capture of the job board page prior to application.
   * `apply_modal_*.png`: Capture of the chatbot/question modal.
   * `apply_final_*.png` / `apply_error_*.png`: Success or failure confirmation screenshot.
4. **`assets/{company_name}_resume/`**: Houses generated resume JSON data and customized PDF outputs.
5. **`config/constants.py`**: Encrypted credentials database containing key/value entries with Fernet symmetric signatures.

---

## 5. Step-by-Step Operations Walkthrough

### Walkthrough 1: Initial Setup
1. Complete the installation steps in the [README.md](file:///Users/nitinpradhan/Learning/job_application_system/README.md).
2. Start the server and navigate to [http://localhost:8000](http://localhost:8000).
3. Open the **Secrets & Keys** tab, paste your **Gemini API Key**, and click **Save Settings** to encrypt the key.
4. Upload your master resume in the **Resume Hub** tab to structure your base candidate profile.

### Walkthrough 2: Refreshing Naukri Search Visibility
To update the visibility timestamp of your Naukri profile:
1. Open the dashboard and navigate to the **Job Scanner** tab.
2. Under **Quick Actions**, click **Refresh Profile Visibility** (or run `python main.py --action bump-naukri` in the terminal).
3. The browser will launch, log in to Naukri, modify your resume's binary signature, and upload the updated document to refresh your search rankings.

### Walkthrough 3: Auto-Applying to Jobs
1. Go to the **Job Scanner** tab on the dashboard.
2. Click **Scan Jobs** to discover and score matching job openings.
3. Locate a job labeled **Easy Apply** with a high compatibility score.
4. Click the **🚀 Auto Apply** button next to the listing.
5. Monitor the progress console as the system tailors your resume, syncs it to Google Drive, logs into Naukri, updates your profile resume, and completes the application.

### Walkthrough 4: Manual Application Helper
For postings that require application on external company websites:
1. In the **Discovered Listings** grid, find a job labeled **Manual Intervention**.
2. Click the **🛠️ Manual Apply** button.
3. The system will launch a headed browser on your desktop, navigate to the application URL, extract the form fields, and fill in your details (name, email, skills, tailored resume).
4. The script will pause and keep the browser window open, allowing you to review the information and click submit manually.

---

## 6. Troubleshooting, Evasions & FAQs

#### Q: How does the system handle captchas during login?
* **A**: If a captcha is detected during Naukri login, the browser driver will pause execution. If headed mode is enabled, you can complete the challenge manually in the browser window, and the automation script will resume once login succeeds.

#### Q: Why is my compatibility score low for some jobs?
* **A**: The compatibility score depends on the preferences set in `searches.yaml`. Check that the locations, technologies, and years of experience configured in your settings align with the target job descriptions.

#### Q: What happens if the Gemini API quota is exhausted?
* **A**: The system will automatically fallback to local keyword heuristics. You will still receive an optimized resume, though it will rely on direct term injection rather than full-context rewriting.

#### Q: Is my password safe on disk?
* **A**: Yes. The system encrypts all passwords using symmetric Fernet keys. Plaintext credentials are decrypted in memory only when logging in.
