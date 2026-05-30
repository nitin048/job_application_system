# 📘 Complete User Manual: Autonomous Multi-Platform AI Job Application System

Welcome to the user manual for the **Autonomous Multi-Platform AI Job Application System**. This system is an end-to-end automation suite designed to crawl job boards, analyze candidate compatibility, optimize resumes using generative AI, upload and sync files to cloud storage, and automate the application submission process using anti-detect web drivers.

---

## 📖 Table of Contents
1. [System Overview & Target Audience](#1-system-overview--target-audience)
2. [Functional Subsystems: How They Work](#2-functional-subsystems-how-they-work)
   * [A. Job Ingestion & Web Crawler](#a-job-ingestion--web-crawler-srcjob_crawlerpy)
   * [B. Compatibility Scoring Engine](#b-compatibility-scoring-engine-srcscoringpy)
   * [C. AI Resume Customizer](#c-ai-resume-customizer-srcresume_tweakerpy)
   * [D. Cryptographic Hash Buster](#d-cryptographic-hash-buster-srcdocument_generatorpy)
   * [E. Stateful Form Filling](#e-stateful-form-filling-srcform_graphpy)
   * [F. Playwright Evasion Driver](#f-playwright-evasion-driver-srcbrowser_driverpy)
   * [G. Google Drive Sync](#g-google-drive-sync-srcgdrive_managerpy)
3. [User Interface & Dashboard Tabs](#3-user-interface--dashboard-tabs)
4. [System Outputs: Database Collections & Files](#4-system-outputs-database-collections--files)
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
1. **Search Vectors**: The system reads your configured target job titles (e.g., "Full Stack Developer") and locations from MongoDB.
2. **Parallel Scrape Workers**: It launches multiple concurrent background crawler threads to scrape Naukri search result lists.
3. **URL Normalization & DB Indexing**: All found job URLs are normalized (removing trackers, queries, and session IDs). The system compares them against the `jobs` collection in MongoDB to prevent scanning or displaying the same job twice.
4. **Detail Scraping**: For new jobs, the crawler navigates to the detailed page to parse the complete text description using BeautifulSoup4.
5. **Apply Type Detection**: It inspects interactive elements (buttons, links, forms) to detect whether the job is an **Easy Apply** (can be applied to directly on Naukri) or requires **Manual Intervention** (redirects to an external company careers page).
6. **Fallback Registry**: If the crawler is blocked by rate-limiting or is run without an active internet connection, it automatically loads a preconfigured registry of mock developer roles at companies like Google, Stripe, and Meta to allow offline testing.

#### 📊 Crawler Dataflow Visualized:
```mermaid
graph TD
    A[Start Scan Request] --> B[Read Search Settings from DB]
    B --> C[Launch Parallel Scraper Workers]
    C -->|Thread 1: Software Engineer| D[Scrape Naukri Search Page]
    C -->|Thread 2: Full Stack Developer| E[Scrape Naukri Search Page]
    D & E --> F{URL in MongoDB jobs collection?}
    F -->|Yes: Duplicate| G[Skip Page Load]
    F -->|No: New Job| H[Scrape Full Job Description]
    H --> I[Detect Application Route]
    I -->|Direct Easy Apply Option| J[Set apply_type = 'Easy Apply']
    I -->|Redirect / Company Site| K[Set apply_type = 'Manual Intervention']
    J & K --> L[Pass to Scoring Engine]
    L --> M[Save to MongoDB jobs collection]
```

---

### B. Compatibility Scoring Engine (`src/scoring.py`)
Every discovered job is scored out of **5.0** (scaled to a percentage) to assess how well your background matches the posting.
1. **Disqualification Checks**: The engine immediately reviews the company name and job title against `blacklist_companies` and `blacklist_titles` configured in your settings. If there is a match, the score is forced to `0.0` and the job is excluded.
2. **Weight Allocation Formula**:
   $$\text{Compatibility Score} = 5.0 \times \sum (w_j \cdot s_j)$$
   * **Title Match (25% weight)**: Matches target roles against the job title.
   * **Tech Stack Match (25% weight)**: Compares required technologies in the job posting with candidate skills.
   * **Location Match (20% weight)**: Checks target location compatibility.
   * **Workplace Type Match (15% weight)**: Evaluates Remote, Hybrid, or On-site parameters.
   * **Seniority Match (15% weight)**: Compares required years of experience vs. candidate experience.

#### 📊 Score Weight Distribution:
```mermaid
pie title Compatibility Evaluation Metric Weights
    "Title Match" : 25
    "Tech Stack Match" : 25
    "Location Match" : 20
    "Workplace Type Match" : 15
    "Seniority Match" : 15
```

---

### C. AI Resume Customizer (`src/resume_tweaker.py`)
To maximize interview rates, this subsystem tailors a candidate's resume to match a specific job description.
1. **Gemini Integration**: Sends the candidate's base resume (retrieved from MongoDB) and the target job description to the Google Gemini API. It instructs the model to organically integrate key technologies, methodologies, and bullet points to hit an **85%+ ATS match score** while retaining actual names, dates, and locations.
2. **0.1s Local Heuristic Fallback**: If the Gemini API key is missing or quota limits are exceeded (HTTP 429), a local keyword injection engine executes in less than 0.1 seconds. It maps the skills in the job description to the resume sections (summary, skills list, experience bullets) automatically.
3. **ReportLab PDF Rendering**: Generates a single-column, clean, highly readable, ATS-compliant PDF using ReportLab flowables to a temporary path, which is instantly base64-encoded and persisted to the MongoDB `resumes` collection.

#### 📊 AI Optimization Loop:
```mermaid
flowchart TD
    A[Start Resume Customization] --> B{Gemini API Key Available?}
    B -->|Yes| C[Call Gemini API optimization]
    B -->|No/Rate Limited| D[Trigger 0.1s Local Heuristic Fallback]
    D --> E[Inject Skills & Keywords via Regex]
    C --> F{Successfully parsed JSON?}
    F -->|Yes| G[Set Tailored JSON data]
    F -->|No| D
    G & E --> H[Render PDF via ReportLab Flowables to Temp]
    H --> I[Send to Cryptographic Hash Buster]
    I --> J[Base64 Encode & Save to MongoDB resumes collection]
```

---

## D. Cryptographic Hash Buster (`src/document_generator.py`)
Job boards use file hashing algorithms to flag duplicate resume uploads.
* **How it works**: The system appends randomized white characters and metadata nodes (`/ModifierID`, `/Keywords`) to the PDF binary layout.
* **Result**: The visual document remains identical to the recruiter, but the cryptographic file signature (MD5/SHA-256 hash) changes completely on every generation. This forces Naukri to process the resume as a new document, updating the candidate's visibility timestamp on recruiters' search feeds.

#### 📊 Hash Alteration Concept:
```mermaid
gantt
    title File Hash Modification Lifecycle
    dateFormat  X
    axisFormat %s
    section Original PDF Binary
    Pristine Content Schema       :active, 0, 10
    Cryptographic MD5 Signature (abc123xyz) :crit, 10, 12
    section Modified PDF Binary
    Pristine Content Schema       :active, 0, 10
    Appended Hidden Metadata tags (/ModifierID) :done, 10, 11
    New Cryptographic MD5 Signature (987qwe456) :crit, 11, 13
```

---

### E. Stateful Form Filling (`src/form_graph.py`)
For external application forms, this sub-system automates input entries.
1. **State Node Workflow**:
   * **Initialize**: Validates the webpage address.
   * **Extract**: Iterates through elements (`input`, `select`, `textarea`, `file`) and associates them with labels, placeholders, or aria descriptions.
   * **Generate**: Maps candidate data (names, demographics, notices, salary expectations) to corresponding inputs.
   * **Assemble**: Populates values, uploads the tailored resume PDF, generates page screenshots, and prepares for submission.
2. **Interactive Form Actions**: Fills inputs, selects drop-down items, and checks boxes automatically.

#### 📊 Form Graph State Transitions:
```mermaid
stateDiagram-v2
    [*] --> Initialize : Load Page URL
    Initialize --> Extract : URL validation success
    Initialize --> [*] : Error: Invalid protocol
    Extract --> Generate : Scrape HTML input elements & labels
    Generate --> Assemble : Map candidate profile variables to fields
    Assemble --> Submit : Populate on-screen forms & upload files
    Submit --> [*] : Screenshot & Click Submit
```

---

### F. Playwright Evasion Driver (`src/browser_driver.py`)
Handles web automation actions safely.
1. **Fingerprint Masking**: Injects a stealth evasion script before page load. This overrides `navigator.webdriver` to `undefined`, configures browser plugins, and sets languages to prevent bot-detection libraries (like Cloudflare or Akamai) from blocking the crawler.
2. **Slow-Motion Execution**: Configures a `slow_mo=150` millisecond delay between interactions to mimic human typing and browsing behavior.
3. **Session Preservation**: Saves cookies, tokens, and storage state to MongoDB's `browser_states` collection on exit. This bypasses login challenges and OTP/SMS inputs on subsequent runs.
4. **Easy Apply Chatbot Navigation**: Evaluates multi-step chatbot apply drawers on Naukri, answers questions (defaults to "Yes/Agree" for checkboxes and inputs credentials like notice periods), and clicks submit.

#### 📊 Automation Security Evasions:
```mermaid
graph TD
    A[Launch Playwright Browser] --> B[Inject Stealth Init Script]
    B -->|Evade Bot Detectors| C[Set navigator.webdriver = undefined]
    B -->|Mimic Chrome user| D[Mock navigator.plugins & languages]
    A --> E{Cookie Session in MongoDB browser_states?}
    E -->|Yes| F[Restore authenticated cookies & storage state]
    E -->|No| G[Perform standard username/password login]
    F & G --> H[Open Target Job Board Link]
```

---

### G. Google Drive Sync (`src/gdrive_manager.py`)
If enabled, uploads tailored resumes directly to Google Drive. To maintain a stateless local environment, PDFs are read as bytes from MongoDB on-the-fly and uploaded.

#### 📊 Google Drive File Sync Flow:
```mermaid
sequenceDiagram
    participant Tweaker as ResumeTweaker
    participant DB as MongoDB Database
    participant GDrive as GoogleDriveManager
    participant Form as Playwright Form Submitter

    Tweaker->>DB: Save base64-encoded PDF to resumes collection
    Note over DB: Resume Vaulted in Database
    GDrive->>DB: Query tailored resume PDF bytes
    GDrive->>GDrive: Upload to Google Drive Folder
    
    Note over Form: Application triggered
    Form->>DB: Retrieve PDF bytes from MongoDB resumes collection
    Form->>Form: Write to tempfile path
    Form->>Form: Upload file to form input
    Form->>Form: Delete tempfile path
```

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
  * Enter API keys (Gemini) and SMTP host details. Saving automatically encrypts passwords and credentials, saving them directly into MongoDB.

---

## 4. System Outputs: Database Collections & Files

Rather than utilizing persistent local filesystems, the application behaves in a stateless manner, persisting all structured documents and settings to MongoDB under the following collections:

1. **`jobs` Collection**: Holds scraped job descriptions, compatibility metrics, apply routes, and tailoring histories.
2. **`browser_states` Collection**: Holds active browser cookies, security parameters, and localStorage tokens to maintain persistent logged-in sessions.
3. **`resumes` Collection**: Holds original and tailored resumes as base64-encoded PDF documents, raw text structures, and optimized JSON representations.
4. **`configs` Collection**: Holds user profiles, search criteria, locations, blacklists, and encrypted third-party credentials.
5. **Temporary Files (`tempfile` directory)**: 
   * Screen captures generated during submissions (`apply_before_*.png`, `apply_final_*.png`) are temporarily stored and deleted, or streamed inline.
   * Temporary resume PDFs compiled by ReportLab are deleted immediately after base64 encryption or form submission completes.

---

## 5. Step-by-Step Operations Walkthrough

### Walkthrough 1: Initial Setup
1. Complete the installation steps in the [README.md](file:///Users/nitinpradhan/Learning/job_application_system/README.md).
2. Start the server and navigate to [http://localhost:8000](http://localhost:8000).
3. Open the **Secrets & Keys** tab, paste your **Gemini API Key**, and click **Save Settings** to encrypt the key in MongoDB.
4. Upload your master resume in the **Resume Hub** tab to structure your base candidate profile.

### Walkthrough 2: Refreshing Naukri Search Visibility
To update the visibility timestamp of your Naukri profile:
1. Open the dashboard and navigate to the **Job Scanner** tab.
2. Under **Quick Actions**, click **Refresh Profile Visibility** (or run `python main.py --action bump-naukri` in the terminal).
3. The browser will launch, log in to Naukri (using cookies loaded from MongoDB), compile your resume into a temporary path, modify its binary signature, and upload it to refresh your search rankings.

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
* **A**: The compatibility score depends on the preferences set in your dashboard configuration. Check that the locations, technologies, and years of experience configured in your settings align with the target job descriptions.

#### Q: What happens if the Gemini API quota is exhausted?
* **A**: The system will automatically fallback to local keyword heuristics. You will still receive an optimized resume, though it will rely on direct term injection rather than full-context rewriting.

#### Q: Is my password safe in the database?
* **A**: Yes. The system encrypts all passwords using symmetric Fernet keys prior to writing them to the MongoDB `configs` collection. Plaintext credentials are decrypted in memory only when logging in.
