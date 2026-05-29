# 🚀 Render Deployment Guide

This guide explains how to deploy the **Autonomous Multi-Platform AI Job Application System** to **Render** as a hobby project.

Since this application relies on **Playwright** (which requires Chromium and complex system-level OS libraries), it is deployed using **Docker**. This ensures all browser engines run out-of-the-box without missing shared library errors (`.so`).

---

## 🛠️ Step-by-Step Deployment Instructions

### 1. Push Your Code to GitHub
Ensure all your files, including the newly added `Dockerfile` and `render.yaml`, are pushed to your GitHub repository on a branch (e.g., `Feature/Readme` or `master`).

### 2. Connect Your GitHub to Render
1. Go to [Render Dashboard](https://dashboard.render.com/) and log in.
2. Click **New +** in the top right and select **Blueprint**.
3. Connect your GitHub account and select your job application system repository.

### 3. Deploy the Service
1. Render will automatically parse your `render.yaml` Blueprint file.
2. Give your blueprint group a name (e.g., `job-app-group`).
3. Click **Apply**.
4. Render will start building the Docker image (which takes 2-4 minutes as it downloads and installs the Debian packages and Playwright Chromium binary) and start the service.

---

## ⚠️ Important Production Considerations (Render Free Tier)

If you are using Render's **Free Tier** web service, please keep the following rules in mind:

### 1. Ephemeral Disk (File Reset)
* **What happens**: The free tier uses an ephemeral disk. Every time the server restarts (e.g., after being idle for 15 minutes, or on redeploys), any files written to the local disk will be **wiped out**.
* **Impact**: 
  * Your discovered jobs history (`data/discovered_jobs.json`) will reset to empty.
  * Your saved cookies/login session (`data/session_state.json`) will be deleted, requiring you to re-log in to Naukri on subsequent runs.
* **Solution**: 
  * Turn on **Google Drive Sync** in your dashboard settings. This uploads tailored PDFs directly to Google Drive, ensuring your tailored documents are safely stored in the cloud.
  * To persist your jobs list database and login cookies indefinitely, you can add a **Persistent Volume** to your Render Web Service. This requires upgrading to a paid tier (starting at \$7/month).

### 2. Startup Delay (Cold Starts)
* **What happens**: Render's free tier spins down web services after 15 minutes of inactivity.
* **Impact**: When you visit your dashboard URL after some time, it might take 30-50 seconds to load while the container spins back up.

### 3. Login Captchas in Headless Mode
* **What happens**: When running in the cloud (Render), Playwright runs in **headless mode** (without displaying a browser window).
* **Impact**: If Naukri prompts a captcha challenge during login, the auto-apply script will pause.
* **Solution**: You can connect to your local browser profile using **CDP (Chrome DevTools Protocol)**, or execute the login flow once in headed mode locally to populate the `data/session_state.json` file, and commit/push that state file to bypass captchas in the cloud (be careful not to expose credentials publicly if pushing to a public repository).
