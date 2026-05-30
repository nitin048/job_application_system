# 🚀 Render Deployment Guide

This guide explains how to deploy the **Autonomous Multi-Platform AI Job Application System** to **Render** as a cloud service.

Since this application relies on **Playwright** (which requires Chromium and complex system-level OS libraries), it is deployed using **Docker**. This ensures all browser engines run out-of-the-box without missing shared library errors (`.so`).

---

## 🛠️ Step-by-Step Deployment Instructions

### 1. Provision a MongoDB Database
To support the stateless cloud architecture, the application requires a MongoDB database instance. 
1. Create a free-tier database cluster on [MongoDB Atlas](https://www.mongodb.com/products/platform/atlas-database).
2. Create a database named `aegis_flow` and configure a database user with read/write access.
3. Copy the connection string (e.g., `mongodb+srv://<username>:<password>@cluster0.xxxx.mongodb.net/aegis_flow?retryWrites=true&w=majority`).

### 2. Connect Your GitHub to Render
1. Go to the [Render Dashboard](https://dashboard.render.com/) and log in.
2. Click **New +** in the top right and select **Blueprint**.
3. Connect your GitHub account and select your job application system repository.

### 3. Deploy the Service
1. Render will automatically parse your `render.yaml` Blueprint file.
2. Give your blueprint group a name (e.g., `job-app-group`).
3. Under Environment Variables, specify the **`MONGODB_URI`** variable and paste your MongoDB Atlas connection string.
4. Click **Apply**.
5. Render will start building the Docker image (which takes 2-4 minutes as it downloads and installs the Debian packages and Playwright Chromium binary) and start the service.

---

## ⚙️ Cloud Architecture & Ephemeral Disk Compatibility

Thanks to the system's database migration, the application is **fully stateless** and runs natively on Render's Free Tier container environments.

### 1. Ephemeral Disk Resilience
* **No Volume Required**: Render Free Tier containers reset their filesystem on redeploys or after 15 minutes of inactivity. Since all state is database-driven, this has **zero impact** on the system.
* **Persistent Collections**:
  * Your job discovery list and logs are stored in the `jobs` collection.
  * Your configurations, search queries, target skills, and blacklist settings are stored in `configs`.
  * Encrypted secret keys (SMTP password, Naukri credentials, Gemini keys) are stored in `configs`.
  * Original and tailored resumes (base64 PDFs and structured JSON files) are stored in `resumes`.
  * Playwright cookie sessions and local storage details are preserved in the `browser_states` collection.
* **Dynamic Temp File Lifecycle**: Files required physically by the system (like PDF buffers for Playwright uploads or resume text parsing) are compiled or downloaded to system temporary directories (`tempfile`) on-the-fly, utilized immediately, and automatically purged when the process finishes.

### 2. Startup Delay (Cold Starts)
* Render's Free Tier spins down web services after 15 minutes of inactivity. When you visit your dashboard URL after some time, it might take 30-50 seconds to load while the container spins back up.

### 3. Login Captchas in Headless Mode
* When running in the cloud (Render), Playwright runs in **headless mode** (without displaying a browser window).
* If Naukri prompts a captcha challenge during login, the auto-apply script will pause.
* **Solution**: You can perform the login flow once locally on your machine in headed mode. The authenticated session cookie state will be automatically saved to your cloud MongoDB instance in the `browser_states` collection. Once saved, the Render cloud instance will retrieve this state and bypass the login forms/OTP checks entirely!
