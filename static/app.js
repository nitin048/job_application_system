// Active configurations state
let currentConfig = null;
let logInterval = null;

// Pagination & filter state variables
let jobsList = [];         // All fetched jobs
let filteredJobsList = []; // After filter applied
let currentPage = 1;
const jobsPerPage = 10;
let lastRenderedJobIds = new Set();

// Resume Hub state variables
let hubUploadedFilename = "";
let hubUploadedResumeData = null;
let hubTailoredPdfPath = "";
let hubTailoredResumeData = null;
let hubAtsAuditData = null;
let hubOriginalAtsAuditData = null;
let hubCompany = "";
let hubJobTitle = "";
let hubJobDescription = ""; // Stored job description for consistent ATS re-analysis

document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initRoadmap();
  loadConfigurations();
  initAutocompletes();

  // Mobile Menu / Sidebar Handlers
  const mobileToggle = document.getElementById("mobile-menu-toggle");
  const mobileClose = document.getElementById("mobile-menu-close");
  const sidebarNav = document.getElementById("sidebar-nav");
  const sidebarBackdrop = document.getElementById("sidebar-backdrop");

  if (mobileToggle && sidebarNav && sidebarBackdrop) {
    mobileToggle.addEventListener("click", () => {
      sidebarNav.classList.add("open");
      sidebarBackdrop.classList.add("active");
    });
  }

  if (mobileClose && sidebarNav && sidebarBackdrop) {
    mobileClose.addEventListener("click", () => {
      sidebarNav.classList.remove("open");
      sidebarBackdrop.classList.remove("active");
    });
  }

  if (sidebarBackdrop && sidebarNav) {
    sidebarBackdrop.addEventListener("click", () => {
      sidebarNav.classList.remove("open");
      sidebarBackdrop.classList.remove("active");
    });
  }

  // Save Config Button
  document.getElementById("save-config-btn").addEventListener("click", saveConfigurations);

  // Connect Google Drive Button
  document.getElementById("connect-gdrive-btn").addEventListener("click", connectGDrive);

  // Run Buttons
  document.getElementById("run-dryrun-btn").addEventListener("click", () => triggerAction("test-graph"));
  document.getElementById("run-naukri-btn").addEventListener("click", () => triggerAction("bump-naukri"));

  // Job scan trigger button
  document.getElementById("scan-jobs-btn").addEventListener("click", triggerJobScan);

  // Auto-Scan Resume Button
  document.getElementById("scan-resume-filters-btn").addEventListener("click", scanResumeForFilters);

  // Pagination Buttons
  document.getElementById("prev-page-btn").addEventListener("click", () => handlePaginationClick(-1));
  document.getElementById("next-page-btn").addEventListener("click", () => handlePaginationClick(1));

  // Clear Terminal Button
  document.getElementById("clear-terminal-btn").addEventListener("click", () => {
    document.getElementById("terminal-body").innerHTML = '<div class="terminal-line system">Terminal cleared.</div>';
    showToast("Terminal logs cleared.", "success");
  });

  // Load app state from localStorage
  loadAppState();
});

/**
 * Tab Navigation Setup
 */
function initTabs() {
  const tabs = document.querySelectorAll(".nav-item");
  const panes = document.querySelectorAll(".tab-pane");
  const title = document.getElementById("page-title");
  const desc = document.getElementById("page-desc");

  const tabMeta = {
    dashboard: {
      title: "Control Center",
      desc: "Monitor pipeline actions, analyze job parsing metrics, and manage search automation execution."
    },
    jobs: {
      title: "Discovered Listings",
      desc: "Review compatibility-scored jobs, tailor your resume to match at least 85%, and submit applications."
    },
    "resume-hub": {
      title: "Resume Hub",
      desc: "Upload any PDF/DOCX resume, match it to any job URL, audit your ATS score, and email the tailored result."
    },
    search: {
      title: "Search Filters",
      desc: "Define roles, location scopes, distance bounds, and employer blacklist configurations."
    },
    identity: {
      title: "Candidate Profile Info",
      desc: "Edit personal credentials, contact endpoints, and demographic variables."
    },
    compliance: {
      title: "Compliance & EEO Preferences",
      desc: "Set standardized choices for application legal questionnaires and equal opportunity details."
    },
    credentials: {
      title: "Credentials & API Tokens",
      desc: "Manage logins, security secrets, resume file paths, and browser debugging addresses."
    }
  };

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const target = tab.getAttribute("data-tab");
      switchTab(target);
    });
  });
}

function switchTab(target) {
  const tabs = document.querySelectorAll(".nav-item");
  const panes = document.querySelectorAll(".tab-pane");
  const title = document.getElementById("page-title");
  const desc = document.getElementById("page-desc");

  const tabMeta = {
    dashboard: {
      title: "Control Center",
      desc: "Monitor pipeline actions, analyze job parsing metrics, and manage search automation execution."
    },
    jobs: {
      title: "Discovered Listings",
      desc: "Review compatibility-scored jobs, tailor your resume to match at least 85%, and submit applications."
    },
    "resume-hub": {
      title: "Resume Hub",
      desc: "Upload any PDF/DOCX resume, match it to any job URL, audit your ATS score, and email the tailored result."
    },
    search: {
      title: "Search Filters",
      desc: "Define roles, location scopes, distance bounds, and employer blacklist configurations."
    },
    identity: {
      title: "Candidate Profile Info",
      desc: "Edit personal credentials, contact endpoints, and demographic variables."
    },
    compliance: {
      title: "Compliance & EEO Preferences",
      desc: "Set standardized choices for application legal questionnaires and equal opportunity details."
    },
    credentials: {
      title: "Credentials & API Tokens",
      desc: "Manage logins, security secrets, resume file paths, and browser debugging addresses."
    }
  };

  tabs.forEach(t => t.classList.remove("active"));
  panes.forEach(p => p.classList.remove("active"));

  const activeTab = document.querySelector(`.nav-item[data-tab="${target}"]`);
  if (activeTab) activeTab.classList.add("active");
  
  const activePane = document.getElementById(`tab-${target}`);
  if (activePane) activePane.classList.add("active");

  // Update text descriptions
  title.textContent = tabMeta[target].title;
  desc.textContent = tabMeta[target].desc;

  // Show navigation feedback
  showToast(`Switched to: ${tabMeta[target].title}`, "success");

  if (target === "jobs") {
    loadJobs();
  } else if (target === "resume-hub") {
    loadHubFiles();
  }

  // Close mobile sidebar on navigation
  const sidebarNav = document.getElementById("sidebar-nav");
  const sidebarBackdrop = document.getElementById("sidebar-backdrop");
  if (sidebarNav) {
    sidebarNav.classList.remove("open");
  }
  if (sidebarBackdrop) {
    sidebarBackdrop.classList.remove("active");
  }

  // Save active tab state
  saveAppState();
}

/**
 * Onboarding Roadmap Link Click
 */
function initRoadmap() {
  const steps = document.querySelectorAll(".roadmap-step");
  steps.forEach(step => {
    step.addEventListener("click", () => {
      const target = step.getAttribute("data-target");
      switchTab(target);
    });
  });
}

/**
 * Load Configurations from API
 */
async function loadConfigurations() {
  try {
    const res = await fetch("/api/config");
    if (!res.ok) throw new Error("Could not retrieve setup variables.");
    
    currentConfig = await res.json();
    populateUI(currentConfig);
    updateDashboardStats(currentConfig);
    updateChecklist(currentConfig);
    checkGDriveStatus();
  } catch (err) {
    console.error(err);
    showToast("Error loading configurations from local database.", "error");
  }
}

/**
 * Populate UI inputs from loaded configurations
 */
function populateUI(data) {
  const s = data.searches.search_parameters;
  const i = data.searches.candidate_identity;
  const p = i.personal_details;
  const d = i.demographics;
  const c = data.searches.compliance_preferences;
  const consts = data.constants;

  // Search parameters Tab
  document.getElementById("search-positions").value = (s.positions || []).join(", ");
  document.getElementById("search-locations").value = (s.locations || []).join(", ");
  document.getElementById("search-distance").value = (s.distance !== null && s.distance !== undefined) ? s.distance : "";
  document.getElementById("search-experience-years").value = (s.candidate_experience_years !== null && s.candidate_experience_years !== undefined) ? s.candidate_experience_years : "";
  document.getElementById("search-skills").value = (s.candidate_skills || []).join(", ");
  document.getElementById("search-remote").checked = !!s.remote;
  document.getElementById("search-apply-once").checked = !!s.apply_once_at_company;
  document.getElementById("search-blacklist-companies").value = (s.companyBlacklist || []).join(", ");
  document.getElementById("search-blacklist-titles").value = (s.titleBlacklist || []).join(", ");

  // Identity profile Tab
  document.getElementById("candidate-first-name").value = p.first_name || "";
  document.getElementById("candidate-last-name").value = p.last_name || "";
  document.getElementById("candidate-email").value = p.email || "";
  document.getElementById("candidate-phone").value = p.phone || "";
  document.getElementById("candidate-gender").value = d.gender || "";
  document.getElementById("candidate-pronouns").value = d.pronouns || "";
  document.getElementById("candidate-ethnicity").value = d.ethnicity || "";
  document.getElementById("candidate-veteran").value = d.veteran_status || "No";

  // Compliance preferences Tab
  document.getElementById("compliance-remote-work").value = c.remote_work || "Yes";
  document.getElementById("compliance-in-person").value = c.in_person_work || "No";
  document.getElementById("compliance-relocation").value = c.open_to_relocation || "No";
  document.getElementById("compliance-relocation-dest").value = c.relocation_destinations || "";
  document.getElementById("compliance-assessments").value = c.willing_to_complete_assessments || "Yes";
  document.getElementById("compliance-drug-tests").value = c.willing_to_undergo_drug_tests || "No";
  document.getElementById("compliance-background-checks").value = c.willing_to_undergo_background_checks || "Yes";

  // Constants & API credentials Tab
  document.getElementById("const-naukri-user").value = consts.USERNAME || "";
  document.getElementById("const-naukri-pass").value = consts.PASSWORD || "";
  document.getElementById("const-naukri-mobile").value = consts.MOBILE || "";
  // Show current resume path in the upload zone hint label
  const resumePathDisplay = document.getElementById("resume-path-display");
  const resumeDeleteRow = document.getElementById("resume-delete-row");
  const resumePathEmpty = document.getElementById("resume-path-display-empty");
  if (consts.RESUME_PATH) {
    const parts = (consts.RESUME_PATH || "").split(/[\\/]/);
    const fname = parts[parts.length - 1];
    if (resumePathDisplay) resumePathDisplay.innerHTML = `📄 Current file: <strong>${fname || consts.RESUME_PATH}</strong> &mdash; stored in <code>assets/</code>`;
    if (resumeDeleteRow) { resumeDeleteRow.style.display = "flex"; }
    if (resumePathEmpty) resumePathEmpty.style.display = "none";
    const statusEl = document.getElementById("resume-upload-status");
    if (statusEl) statusEl.textContent = "Click to replace with a new PDF";
    const zone = document.getElementById("resume-upload-zone");
    if (zone) zone.classList.add("upload-success");
    // Store filename for deletion
    const delBtn = document.getElementById("resume-delete-btn");
    if (delBtn) delBtn.dataset.filename = fname;
  } else {
    if (resumeDeleteRow) resumeDeleteRow.style.display = "none";
    if (resumePathEmpty) resumePathEmpty.style.display = "";
  }
  document.getElementById("const-gemini-key").value = consts.GEMINI_API_KEY || "";
  document.getElementById("const-solver-key").value = consts.SOLVER_API_KEY || "";
  document.getElementById("const-cdp-address").value = consts.AGENT_BROWSER_CDP || "";
  document.getElementById("const-browser-headed").checked = !!consts.AGENT_BROWSER_HEADED;

  // Load SMTP fields
  document.getElementById("const-smtp-host").value = consts.SMTP_HOST || "";
  document.getElementById("const-smtp-port").value = consts.SMTP_PORT || "";
  document.getElementById("const-smtp-user").value = consts.SMTP_USER || "";
  document.getElementById("const-smtp-pass").value = consts.SMTP_PASSWORD || "";
  // Show gdrive credentials status in upload zone
  const gdreveStatusEl = document.getElementById("gdrive-creds-upload-status");
  const gdriveDeleteRow = document.getElementById("gdrive-creds-delete-row");
  if (consts.GDRIVE_CLIENT_SECRETS_PATH) {
    if (gdreveStatusEl) gdreveStatusEl.textContent = `✓ credentials.json already uploaded`;
    const zone = document.getElementById("gdrive-creds-zone");
    if (zone) zone.classList.add("upload-success");
    if (gdriveDeleteRow) gdriveDeleteRow.style.display = "flex";
  } else {
    if (gdriveDeleteRow) gdriveDeleteRow.style.display = "none";
  }
  document.getElementById("const-gdrive-token-path").value = consts.GDRIVE_TOKEN_PATH || "";
  document.getElementById("const-gdrive-sync-enabled").checked = !!consts.GDRIVE_SYNC_ENABLED;
}

/**
 * Update Dashboard panel stats cards
 */
function updateDashboardStats(data) {
  const s = data.searches.search_parameters;
  const consts = data.constants;

  const positionsCount = (s.positions || []).length;
  document.getElementById("stat-positions").textContent = `${positionsCount} Target${positionsCount === 1 ? '' : 's'}`;

  const locationsCount = (s.locations || []).length;
  document.getElementById("stat-locations").textContent = `${locationsCount} Location${locationsCount === 1 ? '' : 's'}`;

  const keyStatus = consts.GEMINI_API_KEY ? "Connected" : "Not Set";
  const badge = document.getElementById("stat-api-key");
  badge.textContent = keyStatus;
  badge.className = `badge ${consts.GEMINI_API_KEY ? 'success' : 'warning'}`;
}

/**
 * Update onboarding checklist state
 */
function updateChecklist(data) {
  const consts = data.constants;
  
  // 1. Resume PDF Path
  const chkResume = document.getElementById("chk-resume");
  if (consts.RESUME_PATH && consts.RESUME_PATH.endsWith(".pdf")) {
    chkResume.className = "completed";
  } else {
    chkResume.className = "";
  }

  // 2. Naukri Login credentials
  const chkNaukri = document.getElementById("chk-naukri");
  if (consts.USERNAME && consts.PASSWORD && consts.USERNAME !== "candidate_auth@domain.local") {
    chkNaukri.className = "completed";
  } else {
    chkNaukri.className = "";
  }

  // 3. Gemini API Key
  const chkKey = document.getElementById("chk-key");
  if (consts.GEMINI_API_KEY) {
    chkKey.className = "completed";
  } else {
    chkKey.className = "";
  }
}

/**
 * Gather form values and send to API endpoint
 */
async function saveConfigurations() {
  const saveBtn = document.getElementById("save-config-btn");
  saveBtn.disabled = true;
  saveBtn.textContent = "Saving...";
  showToast("Saving configurations and writing to disk...", "success");

  const parseCSV = (str) => str.split(",").map(val => val.trim()).filter(val => val !== "");

  const payload = {
    searches: {
      search_parameters: {
        positions: parseCSV(document.getElementById("search-positions").value),
        locations: parseCSV(document.getElementById("search-locations").value),
        distance: document.getElementById("search-distance").value === "" ? null : (parseInt(document.getElementById("search-distance").value, 10) || 0),
        remote: document.getElementById("search-remote").checked,
        candidate_experience_years: document.getElementById("search-experience-years").value === "" ? null : (parseFloat(document.getElementById("search-experience-years").value) || 0.0),
        candidate_skills: parseCSV(document.getElementById("search-skills").value),
        jobTypes: currentConfig.searches.search_parameters.jobTypes || { full_time: true, contract: false },
        experienceLevel: currentConfig.searches.search_parameters.experienceLevel || { mid_level: true, senior: false },
        date_range: currentConfig.searches.search_parameters.date_range || { past_24_hours: true },
        apply_once_at_company: document.getElementById("search-apply-once").checked,
        companyBlacklist: parseCSV(document.getElementById("search-blacklist-companies").value),
        titleBlacklist: parseCSV(document.getElementById("search-blacklist-titles").value)
      },
      candidate_identity: {
        personal_details: {
          first_name: document.getElementById("candidate-first-name").value,
          last_name: document.getElementById("candidate-last-name").value,
          email: document.getElementById("candidate-email").value,
          phone: document.getElementById("candidate-phone").value
        },
        demographics: {
          gender: document.getElementById("candidate-gender").value,
          pronouns: document.getElementById("candidate-pronouns").value,
          veteran_status: document.getElementById("candidate-veteran").value,
          disability_status: currentConfig.searches.candidate_identity.demographics.disability_status || "No",
          ethnicity: document.getElementById("candidate-ethnicity").value
        }
      },
      compliance_preferences: {
        remote_work: document.getElementById("compliance-remote-work").value,
        in_person_work: document.getElementById("compliance-in-person").value,
        open_to_relocation: document.getElementById("compliance-relocation").value,
        relocation_destinations: document.getElementById("compliance-relocation-dest").value,
        willing_to_complete_assessments: document.getElementById("compliance-assessments").value,
        willing_to_undergo_drug_tests: document.getElementById("compliance-drug-tests").value,
        willing_to_undergo_background_checks: document.getElementById("compliance-background-checks").value
      }
    },
    constants: {
      // RESUME_PATH and GDRIVE_CLIENT_SECRETS_PATH are managed via file upload endpoints — read from current config
      RESUME_PATH: currentConfig?.constants?.RESUME_PATH || "",
      MODIFIED_RESUME_PATH: currentConfig?.constants?.MODIFIED_RESUME_PATH || "",
      USERNAME: document.getElementById("const-naukri-user").value,
      PASSWORD: document.getElementById("const-naukri-pass").value,
      MOBILE: document.getElementById("const-naukri-mobile").value,
      UPDATE_PDF_HASH: true,
      GEMINI_API_KEY: document.getElementById("const-gemini-key").value,
      SOLVER_API_KEY: document.getElementById("const-solver-key").value,
      AGENT_BROWSER_HEADED: document.getElementById("const-browser-headed").checked,
      AGENT_BROWSER_CDP: document.getElementById("const-cdp-address").value,
      GDRIVE_CLIENT_SECRETS_PATH: currentConfig?.constants?.GDRIVE_CLIENT_SECRETS_PATH || "config/credentials.json",
      GDRIVE_TOKEN_PATH: document.getElementById("const-gdrive-token-path").value,
      GDRIVE_SYNC_ENABLED: document.getElementById("const-gdrive-sync-enabled").checked,
      SMTP_HOST: document.getElementById("const-smtp-host").value,
      SMTP_PORT: document.getElementById("const-smtp-port").value === "" ? 587 : (parseInt(document.getElementById("const-smtp-port").value, 10) || 587),
      SMTP_USER: document.getElementById("const-smtp-user").value,
      SMTP_PASSWORD: document.getElementById("const-smtp-pass").value
    }
  };

  try {
    const res = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) throw new Error("Could not update configs.");
    
    showToast("Configurations saved and written to disk successfully!", "success");
    loadConfigurations(); // Refresh
  } catch (err) {
    console.error(err);
    showToast("Failed to save configuration files.", "error");
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<span class="btn-icon">💾</span> Save Settings';
  }
}

/**
 * Triggers process execution commands on the server
 */
async function triggerAction(actionName) {
  const terminal = document.getElementById("terminal-body");
  const dot = document.querySelector(".status-dot");
  const statusText = document.getElementById("engine-status-text");

  showToast(`Starting pipeline action: ${actionName}`, "success");
  terminal.innerHTML = `<div class="terminal-line system">[System] Initializing process execution for '${actionName}'...</div>`;
  
  // Set UI status to Busy
  dot.className = "status-dot busy";
  statusText.textContent = "Processing Task";

  // Reset visual form fields
  resetSimulatorFields();

  try {
    const res = await fetch("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: actionName })
    });
    
    if (!res.ok) throw new Error("Trigger request blocked.");
    
    showToast(`Background process ${actionName} started!`, "success");
    
    // Start polling terminal logs
    if (logInterval) clearInterval(logInterval);
    logInterval = setInterval(() => pollLogs(actionName), 1000);
  } catch (err) {
    terminal.innerHTML += `<div class="terminal-line error">[Error] Trigger request failed: ${err.message}</div>`;
    resetStatusIndicators();
  }
}

/**
 * Poll stdout logs from the background task and write to terminal box
 */
async function pollLogs(actionName) {
  const terminal = document.getElementById("terminal-body");
  try {
    const res = await fetch("/api/logs");
    if (!res.ok) return;
    
    const data = await res.json();
    const cleanLogs = data.logs || "";
    
    if (cleanLogs) {
      const lines = cleanLogs.split("\n");
      let htmlContent = "";
      
      lines.forEach(line => {
        if (!line) return;
        if (line.includes("Error") || line.includes("FAILED")) {
          htmlContent += `<div class="terminal-line error">${escapeHtml(line)}</div>`;
        } else if (line.includes("OK") || line.includes("successfully") || line.includes("finished")) {
          htmlContent += `<div class="terminal-line success">${escapeHtml(line)}</div>`;
        } else {
          htmlContent += `<div class="terminal-line">${escapeHtml(line)}</div>`;
        }
      });
      
      terminal.innerHTML = htmlContent;
      terminal.scrollTop = terminal.scrollHeight; // Auto-scroll to bottom
      
      // Animate Sandbox fields
      animateFormSandbox(cleanLogs);

      // Stop polling when command indicates complete
      if (cleanLogs.includes("Execution finished")) {
        clearInterval(logInterval);
        resetStatusIndicators();
        showToast("Task execution successfully finished!", "success");
        loadJobs(); // Reload jobs state (applied status etc)
      }
    }
  } catch (err) {
    console.error("Log fetch failure: ", err);
  }
}

/**
 * Sequenced Mock/Real Form Filling Animation
 */
function animateFormSandbox(logs) {
  const fn = document.getElementById("sim-first-name");
  const ln = document.getElementById("sim-last-name");
  const em = document.getElementById("sim-email");
  const rel = document.getElementById("sim-relocate");

  // 1. First Name
  let fnMatch = logs.match(/Field \[first_name_input\]: '([^']+)'/) || logs.match(/Field \[first_name\]: '([^']+)'/) || logs.match(/Filling text '([^']+)' for field: 'First Name'/i);
  if (fnMatch) {
    fn.value = fnMatch[1];
    fn.classList.add("active-fill");
  }
  
  // 2. Last Name
  let lnMatch = logs.match(/Field \[last_name\]: '([^']+)'/) || logs.match(/Filling text '([^']+)' for field: 'Last Name'/i);
  if (lnMatch) {
    ln.value = lnMatch[1];
    ln.classList.add("active-fill");
  }
  
  // 3. Email
  let emMatch = logs.match(/Field \[email_input\]: '([^']+)'/) || logs.match(/Field \[email\]: '([^']+)'/) || logs.match(/Filling text '([^']+)' for field: 'Email'/i) || logs.match(/Filling text '([^']+)' for field: 'Email Address'/i);
  if (emMatch) {
    em.value = emMatch[1];
    em.classList.add("active-fill");
  }
  
  // 4. Relocate
  let relMatch = logs.match(/Field \[relocate\]: '([^']+)'/) || logs.match(/Selecting option '([^']+)' for field: 'Willing to relocate\?'/i) || logs.match(/Selecting option '([^']+)' for field: 'relocat'/i);
  if (relMatch) {
    rel.value = relMatch[1];
    rel.classList.add("active-fill");
  }
}

function resetSimulatorFields() {
  const fields = document.querySelectorAll(".sim-field");
  fields.forEach(f => {
    f.value = "";
    f.placeholder = "Waiting...";
    f.classList.remove("active-fill");
  });
}

function resetStatusIndicators() {
  const dot = document.querySelector(".status-dot");
  const statusText = document.getElementById("engine-status-text");
  dot.className = "status-dot online";
  statusText.textContent = "Server Connected";
}

/**
 * Toast Notification Popup Builder
 */
function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  
  const icon = type === "success" ? "✓" : "⚠";
  toast.innerHTML = `<span class="toast-icon">${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);

  // Animate slide-out and remove
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-10px)";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

/**
 * Job Board Scanning & Rendering
 */
async function triggerJobScan() {
  const scanBtn = document.getElementById("scan-jobs-btn");
  const loading = document.getElementById("jobs-loading");
  const grid = document.getElementById("jobs-grid");

  showToast("Starting background job scan...", "success");
  scanBtn.disabled = true;
  loading.style.display = "block";
  grid.innerHTML = "";
  
  // Reset rendered state tracking
  lastRenderedJobIds.clear();
  const controls = document.getElementById("pagination-controls");
  if (controls) controls.style.display = "none";

  try {
    const res = await fetch("/api/jobs/scan", { method: "POST" });
    if (!res.ok) throw new Error("Job scan request failed.");
    
    const startData = await res.json();
    if (startData.status === "scanning") {
      showToast("Job scan is already running in the background.", "warning");
    }

    // Start polling scan status
    pollScanStatus();
  } catch (err) {
    console.error(err);
    showToast("Failed to start job search backend.", "error");
    loading.style.display = "none";
    scanBtn.disabled = false;
  }
}

function pollScanStatus() {
  const scanBtn = document.getElementById("scan-jobs-btn");
  const loading = document.getElementById("jobs-loading");
  const loadingText = loading.querySelector("p");

  const interval = setInterval(async () => {
    try {
      const res = await fetch("/api/jobs/scan/status");
      if (!res.ok) throw new Error("Status query failed");
      const statusData = await res.json();

      if (statusData.is_scanning) {
        if (loadingText) {
          loadingText.textContent = `Running web crawls and matching job descriptions against your resume... (Discovered ${statusData.count} jobs so far)`;
        }
        // Load and bind new jobs dynamically as they are processed
        await loadJobsIncremental();
      } else {
        clearInterval(interval);
        showToast("Job scan completed!", "success");
        await loadJobs();
        
        // Update subtitle with scan context
        const subtitle = document.getElementById("jobs-scan-subtitle");
        if (subtitle && currentConfig) {
          const sp = currentConfig.searches.search_parameters;
          const exp = sp.candidate_experience_years || 0;
          const skills = (sp.candidate_skills || []).slice(0, 3).join(", ");
          subtitle.textContent = `Found ${statusData.count} jobs matching ${exp}yr experience${skills ? ` · ${skills}` : ""} · Sorted by compatibility`;
        }

        loading.style.display = "none";
        scanBtn.disabled = false;
      }
    } catch (e) {
      console.error("Error polling scan status:", e);
      clearInterval(interval);
      loading.style.display = "none";
      scanBtn.disabled = false;
    }
  }, 2000);
}

async function loadJobsIncremental() {
  try {
    const res = await fetch("/api/jobs");
    if (!res.ok) throw new Error("Could not retrieve jobs.");
    const data = await res.json();
    const jobs = data.jobs || [];
    
    jobsList = jobs;
    updateAppliedCount();
    
    // Check if there are any new jobs
    const currentJobIds = new Set(jobs.map(j => j.id));
    let hasNewJobs = false;
    for (const id of currentJobIds) {
      if (!lastRenderedJobIds.has(id)) {
        hasNewJobs = true;
        break;
      }
    }
    
    if (hasNewJobs || lastRenderedJobIds.size === 0) {
      // Capture open accordion element states to preserve user reading focus
      const expandedCardIds = [];
      document.querySelectorAll(".job-card.expanded").forEach(card => {
        const cardId = card.id.replace("job-card-", "");
        expandedCardIds.push(cardId);
      });
      
      // Filter list based on current active control filters
      const keyword = (document.getElementById("filter-keyword")?.value || "").toLowerCase().trim();
      const minScore = parseInt(document.getElementById("filter-min-score")?.value || "0", 10);
      const workplaceType = (document.getElementById("filter-workplace")?.value || "");
      const applyType = (document.getElementById("filter-apply-type")?.value || "");
      
      filteredJobsList = jobsList.filter(job => {
        if (keyword) {
          const haystack = [
            job.title || "",
            job.company || "",
            (job.skills || []).join(" "),
            job.description || ""
          ].join(" ").toLowerCase();
          if (!haystack.includes(keyword)) return false;
        }
        if (minScore > 0 && (job.compatibility || 0) < minScore) return false;
        if (workplaceType && job.workplace_type !== workplaceType) return false;
        if (applyType && (job.apply_type || "") !== applyType) return false;
        return true;
      });
      
      lastRenderedJobIds = currentJobIds;
      
      // Render active page
      displayPage(currentPage);
      
      // Re-apply expanded height configurations to accordion bodies
      expandedCardIds.forEach(id => {
        const card = document.getElementById(`job-card-${id}`);
        if (card) {
          const body = card.querySelector(".accordion-body");
          const btn = card.querySelector(".accordion-toggle-btn");
          if (body && btn) {
            body.style.maxHeight = body.scrollHeight + "px";
            card.classList.add("expanded");
            btn.textContent = "▲";
          }
        }
      });
    }
  } catch (err) {
    console.error("Progressive job render error:", err);
  }
}

async function loadJobs() {
  const grid = document.getElementById("jobs-grid");
  try {
    const res = await fetch("/api/jobs");
    if (!res.ok) throw new Error("Could not retrieve jobs.");
    const data = await res.json();
    renderJobs(data.jobs || []);
  } catch (err) {
    console.error("Failed to load jobs: ", err);
  }
}

function updateAppliedCount() {
  const appliedCount = (jobsList || []).filter(j => j.applied).length;
  const totalCount = (jobsList || []).length;
  const appliedCounterEl = document.getElementById("applied-jobs-counter");
  if (appliedCounterEl) {
    appliedCounterEl.textContent = `Applied: ${appliedCount} / ${totalCount}`;
    appliedCounterEl.style.display = totalCount > 0 ? "inline-block" : "none";
  }
}

function renderJobs(jobs) {
  jobsList = jobs || [];
  // Reset filter controls visually when new data arrives
  const keyword = document.getElementById("filter-keyword");
  const minScore = document.getElementById("filter-min-score");
  const workplace = document.getElementById("filter-workplace");
  const applyType = document.getElementById("filter-apply-type");
  if (keyword) keyword.value = "";
  if (minScore) minScore.value = "0";
  if (workplace) workplace.value = "";
  if (applyType) applyType.value = "";
  filteredJobsList = [...jobsList];
  currentPage = 1;
  updateAppliedCount();
  applyJobFilters(); // Applies filters (which will be none) and renders page 1
  saveAppState();
}

function displayPage(page, list) {
  const grid = document.getElementById("jobs-grid");
  const controls = document.getElementById("pagination-controls");
  const indicator = document.getElementById("page-indicator");
  const prevBtn = document.getElementById("prev-page-btn");
  const nextBtn = document.getElementById("next-page-btn");
  
  // Use provided list or fall back to current filtered state
  const displayList = list !== undefined ? list : filteredJobsList;

  if (!displayList || displayList.length === 0) {
    if (jobsList.length === 0) {
      grid.innerHTML = `
        <div class="card" style="text-align: center; padding: 60px 40px; color: var(--text-secondary);">
          <span style="font-size: 40px; display: block; margin-bottom: 16px;">💼</span>
          <h3>No Jobs Scanned Yet</h3>
          <p style="font-size: 13px; margin-top: 8px; max-width: 320px; margin-left: auto; margin-right: auto;">Click "Scan Job Boards" to start fetching listings and matching them against your profile.</p>
        </div>
      `;
    } else {
      grid.innerHTML = `
        <div class="card" style="text-align: center; padding: 40px; color: var(--text-secondary);">
          <span style="font-size: 36px; display: block; margin-bottom: 12px;">🔍</span>
          <h3>No Matching Jobs</h3>
          <p style="font-size: 13px; margin-top: 8px;">Your filters returned 0 results. Try broadening your search criteria.</p>
        </div>
      `;
    }
    controls.style.display = "none";
    return;
  }

  const totalPages = Math.ceil(displayList.length / jobsPerPage);
  currentPage = Math.max(1, Math.min(page, totalPages));

  // Slice jobs for current page
  const startIndex = (currentPage - 1) * jobsPerPage;
  const endIndex = Math.min(startIndex + jobsPerPage, displayList.length);
  const paginatedJobs = displayList.slice(startIndex, endIndex);

  let htmlContent = "";
  paginatedJobs.forEach(job => {
    const tags = (job.skills || []).map(skill => `<span class="job-tag">${escapeHtml(skill)}</span>`).join("");
    
    // Tailored resume view/download/diff buttons
    const tailorBtnHtml = job.tailored_pdf_path
      ? `
        <div style="display: flex; gap: 6px; width: 100%;">
          <button class="btn btn-secondary view-btn" style="flex: 1; font-size: 10px; padding: 8px 2px;" onclick="window.open('/api/jobs/${job.id}/tailor/view', '_blank')">
            <span>👁️</span> View
          </button>
          <button class="btn btn-secondary diff-btn" style="flex: 1; font-size: 10px; padding: 8px 2px;" onclick="compareResume('${job.id}')">
            <span>⚖️</span> Diff
          </button>
          <button class="btn btn-secondary download-btn" style="flex: 1; font-size: 10px; padding: 8px 2px;" onclick="window.location.href='/api/jobs/${job.id}/tailor/download'">
            <span>📥</span> Get PDF
          </button>
        </div>
        `
      : `
        <button class="btn btn-secondary tailor-btn" style="width: 100%;" onclick="tailorResume('${job.id}')">
          <span>✨</span> Tailor Resume
        </button>
        `;

    // Apply button state
    const isEasyApply = (job.apply_type || "Easy Apply") === "Easy Apply";
    const applyBtnText = isEasyApply ? "Auto Apply" : "Manual Apply";
    const applyBtnIcon = isEasyApply ? "🚀" : "🛠️";

    const applyBtnHtml = job.applied
      ? `
        <button class="btn btn-success applied-badge" style="width: 100%; cursor: not-allowed; background: rgba(16, 185, 129, 0.2); border-color: rgb(16, 185, 129); color: rgb(16, 185, 129);" disabled>
          <span>✓</span> Applied
        </button>
        `
      : `
        <button class="btn btn-primary apply-btn" style="width: 100%;" onclick="applyJob('${job.id}')">
          <span>${applyBtnIcon}</span> ${applyBtnText}
        </button>
        `;

    const applyTypeBadge = isEasyApply 
      ? `<span class="badge success" style="margin-left: 8px; font-size: 10px; padding: 2px 6px;">⚡ Easy Apply</span>`
      : `<span class="badge warning" style="margin-left: 8px; font-size: 10px; padding: 2px 6px; background: rgba(139, 92, 246, 0.2); border-color: rgb(139, 92, 246); color: rgb(216, 180, 254);">🛠️ Manual</span>`;

    const snippet = job.description.length > 120 
      ? job.description.substring(0, 120) + "..." 
      : job.description;

    htmlContent += `
      <div class="job-card" id="job-card-${job.id}">
        <div class="job-info-block">
          <div class="job-meta-header">
            <span class="job-company">${escapeHtml(job.company)}</span>
            <span class="job-location-span">• ${escapeHtml(job.location)} (${escapeHtml(job.workplace_type)})</span>
            ${applyTypeBadge}
          </div>
          <h4 class="job-title-h">
            ${job.url 
              ? `<a href="${escapeHtml(job.url)}" target="_blank" rel="noopener noreferrer" class="job-title-link">${escapeHtml(job.title)}</a>`
              : escapeHtml(job.title)
            }
          </h4>
          <p class="job-desc-p" style="margin-bottom: 12px;">${escapeHtml(snippet)}</p>
          
          <div class="accordion-item">
            <button type="button" class="accordion-header" onclick="event.stopPropagation(); toggleAccordion('${job.id}')">
              <span>View Full Description & Details</span>
              <span class="accordion-icon" id="accordion-icon-${job.id}">▼</span>
            </button>
            <div class="accordion-content" id="accordion-content-${job.id}">
              <div class="accordion-details">
                <div class="detail-row"><strong>Role Title:</strong> <span>${escapeHtml(job.title)}</span></div>
                <div class="detail-row"><strong>Company:</strong> <span>${escapeHtml(job.company)}</span></div>
                <div class="detail-row"><strong>Location:</strong> <span>${escapeHtml(job.location)} (${escapeHtml(job.workplace_type)})</span></div>
                <div class="detail-row"><strong>Apply Type:</strong> <span>${escapeHtml(job.apply_type || "Easy Apply")}</span></div>
                <div class="detail-row"><strong>Skills Match:</strong> <span>${(job.skills || []).join(", ") || "None"}</span></div>
                <hr style="border: 0; border-top: 1px solid var(--border-light); margin: 8px 0;">
                <div class="detail-description">
                  <strong>Full Job Description:</strong>
                  <p style="margin-top: 6px; white-space: pre-line; line-height: 1.6; color: var(--text-secondary);">${escapeHtml(job.description)}</p>
                </div>
                ${job.ats_audit ? `
                <hr style="border: 0; border-top: 1px solid var(--border-light); margin: 8px 0;">
                <div class="detail-description">
                  <strong>✨ ATS Optimization Audit</strong>
                  <div style="margin-top: 8px; display: flex; flex-direction: column; gap: 8px;">
                    <div>
                      <div style="font-size: 10px; text-transform: uppercase; color: var(--color-success); margin-bottom: 4px; font-weight: bold; letter-spacing: 0.05em;">Matched Keywords</div>
                      <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                        ${(job.ats_audit.matched_keywords || []).map(kw => `<span class="keyword-pill matched" style="font-size: 10px; padding: 2px 6px;">${escapeHtml(kw)}</span>`).join("") || `<span style="font-size: 11.5px; color: var(--text-muted);">None</span>`}
                      </div>
                    </div>
                    <div>
                      <div style="font-size: 10px; text-transform: uppercase; color: var(--color-danger); margin-bottom: 4px; font-weight: bold; letter-spacing: 0.05em;">Missing Keywords</div>
                      <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                        ${(job.ats_audit.missing_keywords || []).map(kw => `<span class="keyword-pill missing" style="font-size: 10px; padding: 2px 6px;">${escapeHtml(kw)}</span>`).join("") || `<span style="font-size: 11.5px; color: var(--text-muted);">None</span>`}
                      </div>
                    </div>
                    <div>
                      <div style="font-size: 10px; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 4px; font-weight: bold; letter-spacing: 0.05em;">Recommendations</div>
                      <ul style="margin-left: 14px; font-size: 12px; color: var(--text-secondary); line-height: 1.5; list-style-type: square; padding-left: 5px; margin-top: 4px;">
                        ${(job.ats_audit.recommendations || []).map(rec => `<li>${escapeHtml(rec)}</li>`).join("") || `<li>Format fully optimized!</li>`}
                      </ul>
                    </div>
                  </div>
                </div>
                ` : ''}
              </div>
            </div>
          </div>
          
          <div class="job-tags-list" style="margin-top: 14px;">${tags}</div>
        </div>
        <div class="job-action-block">
          <div class="job-score-badge">
            ${job.compatibility}%
            <span class="job-score-label">compatibility</span>
          </div>
          ${job.ats_audit ? `
          <div class="job-score-badge" style="background: rgba(16, 185, 129, 0.1); border-color: rgb(16, 185, 129); color: rgb(16, 185, 129); margin-top: 8px; box-shadow: 0 0 10px rgba(16, 185, 129, 0.15);">
            ${job.ats_audit.score}%
            <span class="job-score-label" style="color: rgb(16, 185, 129);">ATS match</span>
          </div>
          ` : ''}
          ${tailorBtnHtml}
          ${applyBtnHtml}
        </div>
      </div>
    `;
  });
  
  grid.innerHTML = htmlContent;

  // Update controls
  const totalLabel = displayList.length < jobsList.length
    ? `Page ${currentPage} of ${totalPages} (${displayList.length} filtered / ${jobsList.length} total)`
    : `Page ${currentPage} of ${totalPages} (${jobsList.length} total)`;
  indicator.textContent = totalLabel;
  prevBtn.disabled = currentPage === 1;
  nextBtn.disabled = currentPage === totalPages;
  controls.style.display = displayList.length > jobsPerPage ? "flex" : "none";
}

function handlePaginationClick(direction) {
  const targetPage = currentPage + direction;
  displayPage(targetPage, filteredJobsList);
  // Scroll back to top of jobs tab for smooth navigation
  document.getElementById("tab-jobs").scrollIntoView({ behavior: "smooth" });
}

/**
 * Apply live filter panel to the jobs list
 */
function applyJobFilters() {
  const keyword = (document.getElementById("filter-keyword")?.value || "").toLowerCase().trim();
  const minScore = parseInt(document.getElementById("filter-min-score")?.value || "0", 10);
  const workplaceType = (document.getElementById("filter-workplace")?.value || "");
  const applyType = (document.getElementById("filter-apply-type")?.value || "");

  filteredJobsList = jobsList.filter(job => {
    // Keyword match: title, company, skills
    if (keyword) {
      const haystack = [
        job.title || "",
        job.company || "",
        (job.skills || []).join(" "),
        job.description || ""
      ].join(" ").toLowerCase();
      if (!haystack.includes(keyword)) return false;
    }

    // Min compatibility score
    if (minScore > 0 && (job.compatibility || 0) < minScore) return false;

    // Workplace type
    if (workplaceType && job.workplace_type !== workplaceType) return false;

    // Apply type
    if (applyType && (job.apply_type || "") !== applyType) return false;

    return true;
  });

  // Update chip indicators
  const chips = document.getElementById("filter-chips");
  if (chips) {
    const parts = [];
    if (keyword) parts.push(`<span class="filter-chip">🔍 "${escapeHtml(keyword)}"</span>`);
    if (minScore > 0) parts.push(`<span class="filter-chip">📊 ≥${minScore}%</span>`);
    if (workplaceType) parts.push(`<span class="filter-chip">📍 ${escapeHtml(workplaceType)}</span>`);
    if (applyType) parts.push(`<span class="filter-chip">${applyType === "Easy Apply" ? "⚡" : "🛠️"} ${escapeHtml(applyType)}</span>`);
    
    const hasFilters = parts.length > 0;
    const resultText = hasFilters
      ? `<span style="font-size:11px; color: var(--text-muted); margin-left: 4px;">${filteredJobsList.length} of ${jobsList.length} jobs shown</span>`
      : (jobsList.length > 0 ? `<span style="font-size:11px; color: var(--text-muted);">${jobsList.length} jobs loaded</span>` : "");
    
    chips.innerHTML = parts.join("") + resultText;
  }

  currentPage = 1;
  displayPage(1, filteredJobsList);
}

/**
 * Reset all filter inputs and show all jobs
 */
function resetJobFilters() {
  const keyword = document.getElementById("filter-keyword");
  const minScore = document.getElementById("filter-min-score");
  const workplace = document.getElementById("filter-workplace");
  const applyType = document.getElementById("filter-apply-type");
  if (keyword) keyword.value = "";
  if (minScore) minScore.value = "0";
  if (workplace) workplace.value = "";
  if (applyType) applyType.value = "";
  showToast("Filters cleared — showing all jobs", "success");
  applyJobFilters();
}

async function scanResumeForFilters() {
  const btn = document.getElementById("scan-resume-filters-btn");
  btn.disabled = true;
  btn.textContent = "Scanning...";
  showToast("Scanning resume to extract skills and filters...", "success");

  try {
    const res = await fetch("/api/resume/scan-filters", { method: "POST" });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.detail || "Scanning failed.");
    }

    const data = await res.json();
    
    // Populate form fields
    if (data.positions && data.positions.length > 0) {
      document.getElementById("search-positions").value = data.positions.join(", ");
    }
    if (data.candidate_skills && data.candidate_skills.length > 0) {
      document.getElementById("search-skills").value = data.candidate_skills.join(", ");
    }
    if (data.candidate_experience_years !== undefined) {
      document.getElementById("search-experience-years").value = data.candidate_experience_years;
    }

    showToast("Resume parsed successfully! Target roles, skills, and experience populated.", "success");
  } catch (err) {
    console.error(err);
    showToast(`Scan failed: ${err.message}`, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<span>📄</span> Auto-Scan Resume for Filters`;
  }
}

async function tailorResume(jobId) {
  const card = document.getElementById(`job-card-${jobId}`);
  const tailorBtn = card ? card.querySelector(".tailor-btn") : null;
  const origContent = tailorBtn ? tailorBtn.innerHTML : "";
  
  showToast("Starting AI resume tailoring and customization...", "success");
  if (tailorBtn) {
    tailorBtn.disabled = true;
    tailorBtn.innerHTML = `<span>⏳</span> Tailoring...`;
  }
  
  // Display log message in Terminal
  const terminal = document.getElementById("terminal-body");
  terminal.innerHTML = `<div class="terminal-line system">[System] Initializing resume tailoring pipeline for Job ID '${jobId}'...</div>`;
  terminal.innerHTML += `<div class="terminal-line">[AI] Customizing career experience bullet points...</div>`;
  
  try {
    const bodyObj = {};
    if (hubUploadedResumeData) {
      bodyObj.resume_data = hubUploadedResumeData;
    }

    const res = await fetch(`/api/jobs/${jobId}/tailor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyObj)
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.detail || "Tailoring failed");
    }
    
    const data = await res.json();
    terminal.innerHTML += `<div class="terminal-line success">[Success] Resume tailored successfully! Path: ${data.pdf_path}</div>`;
    if (data.gdrive_link) {
      terminal.innerHTML += `<div class="terminal-line success">[Google Drive] Tailored resume synced! Link: ${data.gdrive_link}</div>`;
      showToast("Resume tailored & synced to Google Drive!", "success");
    } else {
      showToast("Resume tailored successfully!", "success");
    }
    
    if (data.gdrive_error) {
      terminal.innerHTML += `<div class="terminal-line error">[Google Drive Error] Sync failed: ${escapeHtml(data.gdrive_error)}</div>`;
      showToast("Google Drive Sync Failed: " + data.gdrive_error, "error");
    }
    
    // Refresh jobs panel lists to render view/download buttons
    loadJobs();
  } catch (err) {
    console.error(err);
    terminal.innerHTML += `<div class="terminal-line error">[Error] Resume tailoring failed: ${err.message}</div>`;
    showToast(`Tailor failed: ${err.message}`, "error");
  } finally {
    if (tailorBtn) {
      tailorBtn.disabled = false;
      tailorBtn.innerHTML = origContent;
    }
  }
}

async function applyJob(jobId) {
  const card = document.getElementById(`job-card-${jobId}`);
  const applyBtn = card ? card.querySelector(".apply-btn") : null;
  const origContent = applyBtn ? applyBtn.innerHTML : "";

  if (applyBtn) {
    applyBtn.disabled = true;
    applyBtn.innerHTML = `<span>⏳</span> Applying...`;
  }

  showToast("🚀 Starting Naukri auto-apply — switching to terminal view...", "success");

  try {
    const res = await fetch(`/api/jobs/${jobId}/apply`, { method: "POST" });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.detail || "Application API call failed");
    }

    if (data.status === "already_applied") {
      showToast("✅ Already applied to this job!", "success");
      if (applyBtn) {
        applyBtn.innerHTML = `<span>✓</span> Applied`;
        applyBtn.style.background = "rgba(16, 185, 129, 0.2)";
        applyBtn.style.borderColor = "rgb(16, 185, 129)";
        applyBtn.style.color = "rgb(16, 185, 129)";
        // Don't re-enable — keep as applied indicator
      }
      return;
    }

    // Switch to Control Center so user sees live terminal logs
    switchTab("dashboard");
    showToast("⚡ Apply engine running! Watch the terminal below for live status...", "success");

    // Start polling logs
    if (logInterval) clearInterval(logInterval);
    logInterval = setInterval(() => pollLogs("apply"), 1000);

    // After 90 seconds stop polling and refresh jobs to show applied state
    setTimeout(async () => {
      if (logInterval) clearInterval(logInterval);
      showToast("Apply run complete. Refreshing job status...", "success");
      // Reload jobs to check if applied = true
      const jobRes = await fetch("/api/jobs");
      if (jobRes.ok) {
        const jobData = await jobRes.json();
        renderJobs(jobData.jobs || []);
      }
    }, 90000);

  } catch (err) {
    console.error(err);
    showToast(`Application failed: ${err.message}`, "error");
    if (applyBtn) {
      applyBtn.disabled = false;
      applyBtn.innerHTML = origContent;
    }
  }
}

async function connectGDrive() {
  const btn = document.getElementById("connect-gdrive-btn");
  btn.disabled = true;
  btn.textContent = "Connecting...";
  
  showToast("Starting Google Drive connection flow...", "success");
  try {
    const res = await fetch("/api/gdrive/auth", { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || "Authentication init failed");
    }
    
    if (data.authorization_url) {
      window.open(data.authorization_url, "_blank");
      showToast("Google OAuth flow initiated. Please complete sign-in in the newly opened tab.", "success");
    } else {
      showToast("Google OAuth flow initiated. Please check your browser to login.", "success");
    }
    
    // Start polling status to update the badge
    let pollCount = 0;
    const interval = setInterval(async () => {
      pollCount++;
      const connected = await checkGDriveStatus();
      if (connected || pollCount > 30) {
        clearInterval(interval);
        btn.disabled = false;
        btn.textContent = "Connect Google Drive";
      }
    }, 2000);
  } catch (err) {
    showToast(`OAuth Error: ${err.message}`, "error");
    btn.disabled = false;
    btn.textContent = "Connect Google Drive";
  }
}

async function checkGDriveStatus() {
  const badge = document.getElementById("gdrive-status-badge");
  if (!badge) return false;
  try {
    const res = await fetch("/api/gdrive/status");
    if (!res.ok) return false;
    const data = await res.json();
    
    if (data.authenticated) {
      badge.textContent = "Connected";
      badge.className = "badge success";
      return true;
    } else {
      badge.textContent = "Disconnected";
      badge.className = "badge warning";
      return false;
    }
  } catch (err) {
    console.error("GDrive status check failed:", err);
    badge.textContent = "Disconnected";
    badge.className = "badge warning";
    return false;
  }
}

window.toggleAccordion = function(jobId) {
  const content = document.getElementById(`accordion-content-${jobId}`);
  const icon = document.getElementById(`accordion-icon-${jobId}`);
  if (!content || !icon) return;
  
  const isOpen = content.classList.contains("open");
  
  if (isOpen) {
    content.classList.remove("open");
    icon.classList.remove("open");
    content.style.maxHeight = null;
  } else {
    content.classList.add("open");
    icon.classList.add("open");
    content.style.maxHeight = content.scrollHeight + "px";
  }
};

window.closeCompareModal = function() {
  document.getElementById("compare-modal").style.display = "none";
};

function highlightTextDiff(origStr, tailStr) {
  if (!origStr) return { origHtml: "", tailHtml: escapeHtml(tailStr || "") };
  if (!tailStr) return { origHtml: escapeHtml(origStr || ""), tailHtml: "" };

  const origWords = origStr.split(/\s+/);
  const tailWords = tailStr.split(/\s+/);

  const origSet = new Set(origWords.map(w => w.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"")));
  const tailSet = new Set(tailWords.map(w => w.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"")));

  const origHtml = origWords.map(word => {
    const cleanWord = word.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
    if (!tailSet.has(cleanWord) && cleanWord.length > 2) {
      return `<span class="compare-highlight-del">${escapeHtml(word)}</span>`;
    }
    return escapeHtml(word);
  }).join(" ");

  const tailHtml = tailWords.map(word => {
    const cleanWord = word.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
    if (!origSet.has(cleanWord) && cleanWord.length > 2) {
      return `<span class="compare-highlight-add">${escapeHtml(word)}</span>`;
    }
    return escapeHtml(word);
  }).join(" ");

  return { origHtml, tailHtml };
}

function highlightSkillsDiff(origSkillsStr, tailSkillsStr) {
  if (!origSkillsStr) return { origHtml: "", tailHtml: escapeHtml(tailSkillsStr || "") };
  if (!tailSkillsStr) return { origHtml: escapeHtml(origSkillsStr || ""), tailHtml: "" };

  const origSkills = origSkillsStr.split(",").map(s => s.trim());
  const tailSkills = tailSkillsStr.split(",").map(s => s.trim());

  const origClean = new Set(origSkills.map(s => s.toLowerCase()));
  const tailClean = new Set(tailSkills.map(s => s.toLowerCase()));

  const origHtml = origSkills.map(skill => {
    if (!tailClean.has(skill.toLowerCase())) {
      return `<span class="compare-highlight-del">${escapeHtml(skill)}</span>`;
    }
    return escapeHtml(skill);
  }).join(", ");

  const tailHtml = tailSkills.map(skill => {
    if (!origClean.has(skill.toLowerCase())) {
      return `<span class="compare-highlight-add">${escapeHtml(skill)}</span>`;
    }
    return escapeHtml(skill);
  }).join(", ");

  return { origHtml, tailHtml };
}

function createCompareSection(title, origHtml, tailHtml) {
  return `
    <div class="compare-diff-item">
      <div class="compare-diff-item-title">${escapeHtml(title)}</div>
      <div class="compare-diff-row">
        <div class="compare-box original">${origHtml}</div>
        <div class="compare-box tailored">${tailHtml}</div>
      </div>
    </div>
  `;
}

window.compareResume = async function(jobId) {
  showToast("Fetching resume differences...", "success");

  try {
    // 1. Fetch original resume
    const origRes = await fetch("/api/resume/original");
    if (!origRes.ok) throw new Error("Failed to fetch original resume template.");
    const originalResume = await origRes.json();

    // 2. Fetch tailored resume data
    const tailRes = await fetch(`/api/jobs/${jobId}/tailored_data`);
    if (!tailRes.ok) throw new Error("Failed to fetch tailored resume data.");
    const tailoredResume = await tailRes.json();

    // Find the job to show in the header
    const job = jobsList.find(j => j.id === jobId);
    const jobTitleText = job ? `${job.title} at ${job.company}` : "";
    document.getElementById("compare-job-title").textContent = jobTitleText;

    // 3. Render differences
    const container = document.getElementById("compare-diff-container");
    container.innerHTML = "";

    // -- Dynamic Rendering for arbitrary custom sections and keys --
    for (const key of Object.keys(originalResume)) {
      if (key === "name" || key === "contact") continue;
      
      const valOrig = originalResume[key];
      const valTail = tailoredResume[key] || "";
      
      if (typeof valOrig === "string") {
        const diff = highlightTextDiff(valOrig, typeof valTail === "string" ? valTail : "");
        container.innerHTML += createCompareSection(key, diff.origHtml, diff.tailHtml);
      } else if (valOrig && typeof valOrig === "object" && !Array.isArray(valOrig)) {
        // Nested dictionary (like skills)
        let origHtml = "";
        let tailHtml = "";
        const subkeys = Object.keys(valOrig);
        subkeys.forEach(sub => {
          const sOrig = valOrig[sub] || "";
          const sTail = (valTail && typeof valTail === "object") ? (valTail[sub] || "") : "";
          const diff = highlightSkillsDiff(String(sOrig), String(sTail));
          origHtml += `<div style="margin-bottom: 12px;"><strong>${escapeHtml(sub)}:</strong><br><span style="font-size: 13px;">${diff.origHtml}</span></div>`;
          tailHtml += `<div style="margin-bottom: 12px;"><strong>${escapeHtml(sub)}:</strong><br><span style="font-size: 13px;">${diff.tailHtml}</span></div>`;
        });
        container.innerHTML += createCompareSection(key, origHtml, tailHtml);
      } else if (Array.isArray(valOrig)) {
        // List of items
        const valTailArr = Array.isArray(valTail) ? valTail : [];
        const maxLen = Math.max(valOrig.length, valTailArr.length);
        
        let listHtml = "";
        for (let idx = 0; idx < maxLen; idx++) {
          const oItem = valOrig[idx];
          const tItem = valTailArr[idx];
          
          if (typeof oItem === "string" || typeof tItem === "string") {
            const diff = highlightTextDiff(String(oItem || ""), String(tItem || ""));
            listHtml += `
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 6px; font-size: 12.5px; line-height: 1.5;">
                <div style="color: var(--text-secondary);">${oItem ? `• ${diff.origHtml}` : ""}</div>
                <div style="color: var(--text-primary);">${tItem ? `• ${diff.tailHtml}` : ""}</div>
              </div>
            `;
          } else if ((oItem && typeof oItem === "object") || (tItem && typeof tItem === "object")) {
            // Experience / Education items
            const oItemSafe = oItem || {};
            const tItemSafe = tItem || {};
            
            const roleKey = Object.keys(oItemSafe).find(k => ["role", "degree", "title"].includes(k.toLowerCase())) || "role";
            const compKey = Object.keys(oItemSafe).find(k => ["company", "institution", "school"].includes(k.toLowerCase())) || "company";
            const dateKey = Object.keys(oItemSafe).find(k => ["dates", "dates_active"].includes(k.toLowerCase())) || "dates";
            const bulletKey = Object.keys(oItemSafe).find(k => ["bullets", "details", "achievements"].includes(k.toLowerCase())) || "bullets";
            
            const roleDiff = highlightTextDiff(oItemSafe[roleKey] || "", tItemSafe[roleKey] || "");
            const companyDiff = highlightTextDiff(oItemSafe[compKey] || "", tItemSafe[compKey] || "");
            const datesDiff = highlightTextDiff(oItemSafe[dateKey] || "", tItemSafe[dateKey] || "");
            
            listHtml += `
              <div style="border-bottom: 1px dashed rgba(255,255,255,0.05); padding-bottom: 12px; margin-bottom: 12px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; font-weight: 600; margin-bottom: 8px;">
                  <div>
                    <span style="color: var(--text-primary);">${roleDiff.origHtml}</span> - 
                    <span style="color: var(--color-accent);">${companyDiff.origHtml}</span>
                    <div style="font-size: 11px; color: var(--text-muted); font-weight: normal; margin-top: 2px;">${datesDiff.origHtml}</div>
                  </div>
                  <div>
                    <span style="color: var(--text-primary);">${roleDiff.tailHtml}</span> - 
                    <span style="color: var(--color-accent);">${companyDiff.tailHtml}</span>
                    <div style="font-size: 11px; color: var(--text-muted); font-weight: normal; margin-top: 2px;">${datesDiff.tailHtml}</div>
                  </div>
                </div>
            `;
            
            // Nested bullets
            const oBullets = oItemSafe[bulletKey] || [];
            const tBullets = tItemSafe[bulletKey] || [];
            
            if (Array.isArray(oBullets) || Array.isArray(tBullets)) {
              const oBulletsArr = Array.isArray(oBullets) ? oBullets : [];
              const tBulletsArr = Array.isArray(tBullets) ? tBullets : [];
              const maxBullets = Math.max(oBulletsArr.length, tBulletsArr.length);
              
              for (let bIdx = 0; bIdx < maxBullets; bIdx++) {
                const oBullet = oBulletsArr[bIdx] || "";
                const tBullet = tBulletsArr[bIdx] || "";
                const bulletDiff = highlightTextDiff(oBullet, tBullet);
                
                listHtml += `
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 6px; font-size: 12.5px; line-height: 1.5;">
                    <div style="color: var(--text-secondary);">${oBullet ? `• ${bulletDiff.origHtml}` : ""}</div>
                    <div style="color: var(--text-primary);">${tBullet ? `• ${bulletDiff.tailHtml}` : ""}</div>
                  </div>
                `;
              }
            } else if (typeof oBullets === "string" || typeof tBullets === "string") {
              const bulletDiff = highlightTextDiff(String(oBullets || ""), String(tBullets || ""));
              listHtml += `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 6px; font-size: 12.5px; line-height: 1.5;">
                  <div style="color: var(--text-secondary);">${oBullets ? bulletDiff.origHtml : ""}</div>
                  <div style="color: var(--text-primary);">${tBullets ? bulletDiff.tailHtml : ""}</div>
                </div>
              `;
            }
            listHtml += `</div>`;
          }
        }
        
        container.innerHTML += `
          <div class="compare-diff-item">
            <div class="compare-diff-item-title">${escapeHtml(key)}</div>
            <div style="background: rgba(255, 255, 255, 0.01); border: 1px solid rgba(255, 255, 255, 0.04); border-radius: 8px; padding: 16px;">
              ${listHtml}
            </div>
          </div>
        `;
      }
    }

    // 4. Show modal
    document.getElementById("compare-modal").style.display = "flex";

  } catch (err) {
    console.error(err);
    showToast(`Failed to open comparison: ${err.message}`, "error");
  }
};

/**
 * Initialize autocompletes with public keyless APIs
 */
function initAutocompletes() {
  // 1. Technical Skills (StackExchange Tags API)
  setupAutocomplete("search-skills", "search-skills-suggestions", async (query) => {
    try {
      const res = await fetch(`https://api.stackexchange.com/2.3/tags?order=desc&sort=popular&site=stackoverflow&inname=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data && data.items) {
        return data.items.map(item => ({
          name: item.name,
          display: item.name
        }));
      }
    } catch (e) {
      console.error("StackExchange tags API failed:", e);
    }
    return [];
  });

  // 2. Company Exclusion Blacklist (Clearbit suggest API)
  setupAutocomplete("search-blacklist-companies", "search-blacklist-companies-suggestions", async (query) => {
    try {
      const res = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        return data.map(item => ({
          name: item.name,
          display: item.domain ? `${item.name} (${item.domain})` : item.name
        }));
      }
    } catch (e) {
      console.error("Clearbit suggest API failed:", e);
    }
    return [];
  });

  // 3. Title Exclusions Blacklist (Wikidata entity search API)
  setupAutocomplete("search-blacklist-titles", "search-blacklist-titles-suggestions", async (query) => {
    try {
      const res = await fetch(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&format=json&type=item&origin=*`);
      const data = await res.json();
      if (data && data.search) {
        return data.search.map(item => ({
          name: item.label,
          display: item.description ? `${item.label} (${item.description})` : item.label
        }));
      }
    } catch (e) {
      console.error("Wikidata entity search API failed:", e);
    }
    return [];
  });
}

/**
 * Setup autocomplete for a text input field supporting comma-separated inputs.
 */
function setupAutocomplete(inputId, suggestionsId, fetchFunction) {
  const input = document.getElementById(inputId);
  const container = document.getElementById(suggestionsId);
  if (!input || !container) return;

  let debounceTimer;

  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    const value = input.value;
    
    // Get the current token being typed (last item in comma list)
    const parts = value.split(",");
    const currentQuery = parts[parts.length - 1].trim();

    if (currentQuery.length < 2) {
      container.style.display = "none";
      return;
    }

    debounceTimer = setTimeout(async () => {
      try {
        const suggestions = await fetchFunction(currentQuery);
        if (suggestions && suggestions.length > 0) {
          container.innerHTML = "";
          suggestions.forEach(item => {
            const div = document.createElement("div");
            div.className = "suggestion-item";
            div.textContent = item.display || item.name;
            div.addEventListener("click", () => {
              // Replace the last part with the selected value
              parts[parts.length - 1] = " " + item.name;
              input.value = parts.join(", ").trim() + ", ";
              container.style.display = "none";
              input.focus();
            });
            container.appendChild(div);
          });
          container.style.display = "block";
        } else {
          container.style.display = "none";
        }
      } catch (err) {
        console.error("Autocomplete error:", err);
      }
    }, 300);
  });

  // Close suggestions if clicked outside
  document.addEventListener("click", (e) => {
    if (e.target !== input && e.target !== container && !container.contains(e.target)) {
      container.style.display = "none";
    }
  });
}


// ============================================================
// Resume PDF Upload Handler
// ============================================================

async function uploadResumeFile(file) {
  if (!file) return;
  const zone = document.getElementById("resume-upload-zone");
  const statusEl = document.getElementById("resume-upload-status");
  const pathDisplay = document.getElementById("resume-path-display");

  zone.classList.remove("upload-success");
  if (statusEl) statusEl.textContent = `⏳ Uploading ${file.name}...`;
  showToast(`Uploading resume: ${file.name}`, "success");

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch("/api/upload/resume", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Upload failed");

    zone.classList.add("upload-success");
    if (statusEl) statusEl.textContent = `✓ ${file.name} uploaded successfully`;
    if (pathDisplay) pathDisplay.innerHTML = `📄 Current file: <strong>${file.name}</strong> &mdash; stored in <code>assets/</code>`;
    // Show delete row, hide empty hint
    const deleteRow = document.getElementById("resume-delete-row");
    if (deleteRow) deleteRow.style.display = "flex";
    const emptyHint = document.getElementById("resume-path-display-empty");
    if (emptyHint) emptyHint.style.display = "none";
    const delBtn = document.getElementById("resume-delete-btn");
    if (delBtn) delBtn.dataset.filename = file.name;
    showToast(`Resume uploaded: ${file.name}`, "success");

    // Reload config to refresh RESUME_PATH in memory
    await loadConfigurations();
  } catch (err) {
    console.error(err);
    if (statusEl) statusEl.textContent = `❌ Upload failed: ${err.message}`;
    showToast(`Resume upload failed: ${err.message}`, "error");
  }
}

function handleResumeDrop(event) {
  event.preventDefault();
  const zone = document.getElementById("resume-upload-zone");
  zone.classList.remove("dragover");
  const file = event.dataTransfer?.files?.[0];
  if (file) uploadResumeFile(file);
}


// ============================================================
// Google Drive Credentials JSON Upload Handler
// ============================================================

async function uploadGdriveCredentials(file) {
  if (!file) return;
  const zone = document.getElementById("gdrive-creds-zone");
  const statusEl = document.getElementById("gdrive-creds-upload-status");

  zone.classList.remove("upload-success");
  if (statusEl) statusEl.textContent = `⏳ Uploading ${file.name}...`;
  showToast(`Uploading Google credentials: ${file.name}`, "success");

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch("/api/upload/gdrive-credentials", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Upload failed");

    zone.classList.add("upload-success");
    if (statusEl) statusEl.textContent = `✓ credentials.json uploaded successfully`;
    // Show delete row
    const deleteRow = document.getElementById("gdrive-creds-delete-row");
    if (deleteRow) deleteRow.style.display = "flex";
    showToast("Google Credentials JSON uploaded!", "success");

    // Reload config to refresh GDRIVE_CLIENT_SECRETS_PATH in memory
    await loadConfigurations();
  } catch (err) {
    console.error(err);
    if (statusEl) statusEl.textContent = `❌ Upload failed: ${err.message}`;
    showToast(`Credentials upload failed: ${err.message}`, "error");
  }
}

function handleGdriveCredsDrop(event) {
  event.preventDefault();
  const zone = document.getElementById("gdrive-creds-zone");
  zone.classList.remove("dragover");
  const file = event.dataTransfer?.files?.[0];
  if (file) uploadGdriveCredentials(file);
}


// ============================================================
// Screenshots Gallery Modal
// ============================================================

async function openScreenshotsModal() {
  const modal = document.getElementById("screenshots-modal");
  const grid = document.getElementById("screenshots-grid");
  const loading = document.getElementById("screenshots-loading");

  modal.style.display = "flex";
  document.body.style.overflow = "hidden";
  loading.style.display = "block";
  grid.innerHTML = "";

  try {
    const res = await fetch("/api/screenshots");
    if (!res.ok) throw new Error("Failed to fetch screenshots");
    const data = await res.json();
    const screenshots = data.screenshots || [];

    loading.style.display = "none";

    // Show/hide Delete All button and count badge
    const deleteAllBtn = document.getElementById("delete-all-screenshots-btn");
    const countBadge = document.getElementById("screenshots-count-badge");
    if (deleteAllBtn) deleteAllBtn.style.display = screenshots.length > 0 ? "inline-flex" : "none";
    if (countBadge) countBadge.textContent = screenshots.length > 0 ? `${screenshots.length} files` : "";

    if (screenshots.length === 0) {
      grid.innerHTML = `
        <div class="screenshots-empty">
          <span style="font-size:40px; display:block; margin-bottom:12px">📷</span>
          <h4>No screenshots yet</h4>
          <p style="font-size:12px; margin-top:6px">Screenshots are captured automatically during auto-apply sessions.</p>
        </div>`;
      return;
    }

    screenshots.forEach(shot => {
      const name = shot.filename;
      // Determine badge type from filename prefix
      let badgeClass = "final";
      let badgeLabel = "Final";
      if (name.startsWith("apply_before")) { badgeClass = "before"; badgeLabel = "Before Apply"; }
      else if (name.startsWith("apply_modal")) { badgeClass = "modal"; badgeLabel = "Modal"; }

      const ts = name.match(/(\d{10,})/)?.[1];
      const dateStr = ts ? new Date(parseInt(ts) * 1000).toLocaleString() : "";

      const card = document.createElement("div");
      card.className = "screenshot-card";
      card.id = `sshot-card-${shot.filename.replace(/[^\w]/g, '_')}`;
      card.innerHTML = `
        <img src="${shot.url}" alt="${escapeHtml(name)}" loading="lazy" onerror="this.style.display='none'">
        <button class="screenshot-delete-btn" title="Delete this screenshot" onclick="event.stopPropagation(); deleteScreenshot('${escapeHtml(name)}')">🗑</button>
        <div class="screenshot-card-info">
          <div class="screenshot-name" title="${escapeHtml(name)}">${escapeHtml(name)}</div>
          <span class="screenshot-type-badge ${badgeClass}">${badgeLabel}</span>
          ${dateStr ? `<div style="font-size:10px; color:var(--text-muted); margin-top:3px">${dateStr}</div>` : ""}
        </div>
      `;
      card.addEventListener("click", () => openScreenshotLightbox(shot.url, name, dateStr));
      grid.appendChild(card);
    });
  } catch (err) {
    loading.style.display = "none";
    grid.innerHTML = `<div class="screenshots-empty"><p>❌ Error loading screenshots: ${escapeHtml(err.message)}</p></div>`;
    console.error(err);
  }
}

function closeScreenshotsModal() {
  const modal = document.getElementById("screenshots-modal");
  if (modal) modal.style.display = "none";
  document.body.style.overflow = "";
}


// ============================================================
// Screenshot Lightbox
// ============================================================

function openScreenshotLightbox(url, filename, dateStr) {
  const lb = document.getElementById("screenshot-lightbox");
  const img = document.getElementById("lightbox-img");
  const caption = document.getElementById("lightbox-caption");
  if (!lb || !img) return;
  img.src = url;
  caption.textContent = `${filename}${dateStr ? " · " + dateStr : ""}`;
  lb.style.display = "flex";
  document.body.style.overflow = "hidden";
}

function closeScreenshotLightbox() {
  const lb = document.getElementById("screenshot-lightbox");
  if (lb) lb.style.display = "none";
  // Don't re-enable overflow if screenshots modal is still open
  if (document.getElementById("screenshots-modal")?.style.display !== "flex") {
    document.body.style.overflow = "";
  }
}

// Close modals on Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeScreenshotLightbox();
    closeScreenshotsModal();
  }
});


// ============================================================
// Delete Functions — Resume, Credentials, Screenshots
// ============================================================

async function deleteResumeFile() {
  const delBtn = document.getElementById("resume-delete-btn");
  const filename = delBtn?.dataset?.filename;
  if (!filename) { showToast("Could not determine file to delete.", "error"); return; }
  if (!confirm(`Delete "${filename}" from assets/?\nThis will also clear RESUME_PATH from config.`)) return;

  try {
    const res = await fetch(`/api/assets/${encodeURIComponent(filename)}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Delete failed");

    // Reset UI
    const zone = document.getElementById("resume-upload-zone");
    if (zone) zone.classList.remove("upload-success");
    const statusEl = document.getElementById("resume-upload-status");
    if (statusEl) statusEl.textContent = "or drag & drop here \u00b7 PDF only";
    const deleteRow = document.getElementById("resume-delete-row");
    if (deleteRow) deleteRow.style.display = "none";
    const emptyHint = document.getElementById("resume-path-display-empty");
    if (emptyHint) emptyHint.style.display = "";
    showToast(`"${filename}" deleted from assets/`, "success");
    await loadConfigurations();
  } catch (err) {
    console.error(err);
    showToast(`Delete failed: ${err.message}`, "error");
  }
}

async function deleteGdriveCredentials() {
  if (!confirm("Delete config/credentials.json?\nYou will need to re-upload it to use Google Drive.")) return;

  try {
    const res = await fetch("/api/gdrive-credentials", { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Delete failed");

    // Reset UI
    const zone = document.getElementById("gdrive-creds-zone");
    if (zone) zone.classList.remove("upload-success");
    const statusEl = document.getElementById("gdrive-creds-upload-status");
    if (statusEl) statusEl.textContent = "or drag & drop here \u00b7 JSON only";
    const deleteRow = document.getElementById("gdrive-creds-delete-row");
    if (deleteRow) deleteRow.style.display = "none";
    showToast("Google credentials file deleted.", "success");
    await loadConfigurations();
  } catch (err) {
    console.error(err);
    showToast(`Delete failed: ${err.message}`, "error");
  }
}

async function deleteScreenshot(filename) {
  if (!confirm(`Delete screenshot "${filename}"?`)) return;

  try {
    const res = await fetch(`/api/screenshots/${encodeURIComponent(filename)}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Delete failed");

    // Remove card from grid
    const cardId = `sshot-card-${filename.replace(/[^\w]/g, '_')}`;
    const card = document.getElementById(cardId);
    if (card) {
      card.style.opacity = "0";
      card.style.transform = "scale(0.85)";
      card.style.transition = "all 0.2s ease";
      setTimeout(() => card.remove(), 220);
    }

    // Update count badge and Delete All button
    const grid = document.getElementById("screenshots-grid");
    const remaining = (grid?.querySelectorAll(".screenshot-card").length || 1) - 1;
    const countBadge = document.getElementById("screenshots-count-badge");
    if (countBadge) countBadge.textContent = remaining > 0 ? `${remaining} files` : "";
    const deleteAllBtn = document.getElementById("delete-all-screenshots-btn");
    if (deleteAllBtn) deleteAllBtn.style.display = remaining > 0 ? "inline-flex" : "none";

    showToast(`Deleted: ${filename}`, "success");
  } catch (err) {
    console.error(err);
    showToast(`Delete failed: ${err.message}`, "error");
  }
}

async function deleteAllScreenshots() {
  const grid = document.getElementById("screenshots-grid");
  const count = grid?.querySelectorAll(".screenshot-card").length || 0;
  if (!confirm(`Delete all ${count} screenshot(s)?\nThis cannot be undone.`)) return;

  try {
    const res = await fetch("/api/screenshots", { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Delete all failed");

    // Clear grid, hide Delete All button, reset count badge
    if (grid) {
      grid.innerHTML = `
        <div class="screenshots-empty">
          <span style="font-size:40px; display:block; margin-bottom:12px">📷</span>
          <h4>No screenshots yet</h4>
          <p style="font-size:12px; margin-top:6px">Screenshots are captured automatically during auto-apply sessions.</p>
        </div>`;
    }
    const countBadge = document.getElementById("screenshots-count-badge");
    if (countBadge) countBadge.textContent = "";
    const deleteAllBtn = document.getElementById("delete-all-screenshots-btn");
    if (deleteAllBtn) deleteAllBtn.style.display = "none";
    showToast(data.message, "success");
  } catch (err) {
    console.error(err);
    showToast(`Delete all failed: ${err.message}`, "error");
  }
}

// =====================================================================
// RESUME HUB MODULE (PHASE 22)
// =====================================================================

// Drag & Drop event handlers
function handleHubResumeDrop(e) {
  e.preventDefault();
  const zone = document.getElementById("hub-resume-upload-zone");
  if (zone) zone.classList.remove("dragover");
  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
    uploadHubResumeFile(e.dataTransfer.files[0]);
  }
}

async function uploadHubResumeFile(file) {
  if (!file) return;
  const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
  if (ext !== ".pdf" && ext !== ".docx" && ext !== ".doc") {
    showToast("Invalid file type. Please upload a PDF or DOCX file.", "error");
    return;
  }

  const zone = document.getElementById("hub-resume-upload-zone");
  const title = document.getElementById("hub-upload-title");
  const status = document.getElementById("hub-upload-status");

  if (title) title.textContent = "Uploading & Structuring...";
  if (status) status.textContent = "Extracting text content and formatting via AI parser...";
  if (zone) zone.classList.add("uploading");

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch("/api/resume-hub/upload", {
      method: "POST",
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Upload failed");

    hubUploadedFilename = data.filename;
    hubUploadedResumeData = data.structured_data;

    // Show info row
    const infoRow = document.getElementById("hub-resume-info-row");
    const activeFn = document.getElementById("hub-active-filename");
    if (activeFn) activeFn.textContent = `📄 ${file.name} (Successfully Structured)`;
    if (infoRow) infoRow.style.display = "flex";
    if (zone) zone.style.display = "none";

    showToast("Resume parsed and structured successfully!", "success");
    saveAppState();
  } catch (err) {
    console.error(err);
    showToast(`Resume parsing failed: ${err.message}`, "error");
  } finally {
    if (zone) zone.classList.remove("uploading");
    if (title) title.textContent = "Click to upload Resume PDF or DOCX";
    if (status) status.textContent = "or drag & drop here · PDF / DOCX only";
  }
}

function clearHubUploadedResume() {
  hubUploadedFilename = "";
  hubUploadedResumeData = null;
  const zone = document.getElementById("hub-resume-upload-zone");
  const infoRow = document.getElementById("hub-resume-info-row");
  if (infoRow) infoRow.style.display = "none";
  if (zone) zone.style.display = "flex";
  document.getElementById("hub-resume-file-input").value = "";
  showToast("Uploaded resume cleared.", "success");
  saveAppState();
}

window.crawlAndTailorHubResume = async function() {
  console.log("[ATS:crawlAndTailorHubResume] === STARTING ===");
  const urlInput    = document.getElementById("hub-job-url");
  const manualJdEl  = document.getElementById("hub-manual-jd");
  const manualJdWrap = document.getElementById("hub-manual-jd-wrap");
  const url         = urlInput ? urlInput.value.trim() : "";
  const manualJd    = manualJdEl ? manualJdEl.value.trim() : "";

  if (!url) {
    showToast("Please enter a valid job listing URL.", "error");
    return;
  }

  const whitelistedDomains = [
    "naukri.com", "linkedin.com", "indeed.com", "glassdoor", "monster", 
    "foundit", "simplyhired", "ziprecruiter", "dice.com", "careerbuilder", 
    "internshala", "wellfound", "angel.co", "timesjobs", "shine.com",
    "greenhouse.io", "lever.co", "myworkdayjobs.com", "taleo.net", "icims.com",
    "smartrecruiters.com", "ashbyhq.com", "bamboohr.com", "recruitee.com", 
    "breezy.hr", "workable.com"
  ];
  const whitelistedKeywords = [
    "/careers", "/jobs", "/career", "/job", "job-listings", "job-detail", 
    "viewjob", "vacancy", "position", "recruit", "job-posting"
  ];
  const urlLower = url.toLowerCase();
  const isPortal = whitelistedDomains.some(d => urlLower.includes(d)) || 
                   whitelistedKeywords.some(kw => urlLower.includes(kw));
  if (!isPortal) {
    showToast("Please provide a correct job portal URL.", "error");
    return;
  }

  if (!hubUploadedFilename || !hubUploadedResumeData) {
    showToast("Please upload an original resume file first.", "error");
    return;
  }

  const loader     = document.getElementById("hub-crawler-loader");
  const loaderText = document.getElementById("hub-loader-text");
  const matchBtn   = document.getElementById("hub-match-btn");
  const analyzeBtn = document.getElementById("hub-analyze-btn");
  const origBtn    = document.getElementById("hub-analyze-orig-btn");
  const tailBtn    = document.getElementById("hub-analyze-new-btn");

  const setLoading = (on) => {
    if (loader)     loader.style.display = on ? "flex" : "none";
    if (matchBtn)   matchBtn.disabled   = on;
    if (analyzeBtn) analyzeBtn.disabled = on;
    if (origBtn)    origBtn.disabled    = on;
    if (tailBtn)    tailBtn.disabled    = on;
  };
  setLoading(true);

  try {
    let jobTitle     = "Position";
    let companyName  = "Target Employer";
    let jobDesc      = manualJd; // use manual JD if already pasted

    if (!jobDesc) {
      // 1. Crawl job board (only if no manual JD provided)
      if (loaderText) loaderText.textContent = "Crawling job listing...";
      console.log("[ATS:crawlAndTailorHubResume] Calling /api/resume-hub/crawl...");
      const crawlRes  = await fetch("/api/resume-hub/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_url: url })
      });
      const crawlData = await crawlRes.json();

      if (!crawlRes.ok) {
        // Show the manual JD textarea so user can paste it
        if (manualJdWrap) manualJdWrap.style.display = "flex";
        if (manualJdEl)   manualJdEl.focus();
        throw new Error(crawlData.detail || "Job portal crawl failed — please paste the job description manually above and retry.");
      }

      console.log("[ATS:crawlAndTailorHubResume] Crawl OK:", { title: crawlData.title, company: crawlData.company, descLen: crawlData.description?.length });
      jobTitle    = crawlData.title       || "Position";
      companyName = crawlData.company     || "Target Employer";
      jobDesc     = crawlData.description || "";
    } else {
      console.log(`[ATS:crawlAndTailorHubResume] Using manual JD (${jobDesc.length} chars). Skipping crawl.`);
      // Hide the textarea warning (it worked!)
      if (manualJdWrap) manualJdWrap.style.display = "none";
    }

    if (!jobDesc) {
      if (manualJdWrap) manualJdWrap.style.display = "flex";
      throw new Error("Job description is empty. Please paste it manually above.");
    }

    // 2. Tailor resume
    if (loaderText) loaderText.textContent = `Tailoring resume for ${companyName}...`;
    console.log("[ATS:crawlAndTailorHubResume] Calling /api/resume-hub/tailor...");
    const tailorRes  = await fetch("/api/resume-hub/tailor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename:        hubUploadedFilename,
        job_title:       jobTitle,
        job_company:     companyName,
        job_description: jobDesc,
        resume_data:     hubUploadedResumeData
      })
    });
    const tailorData = await tailorRes.json();
    if (!tailorRes.ok) throw new Error(tailorData.detail || "Resume tailoring failed");

    const origScore = tailorData.original_ats_audit?.score ?? null;
    const tailScore = tailorData.ats_audit?.score ?? null;
    console.log(`[ATS:crawlAndTailorHubResume] Tailor OK | origScore=${origScore}% | tailScore=${tailScore}% | pdfPath=${tailorData.pdf_path}`);

    if (origScore !== null && tailScore !== null && origScore === tailScore) {
      console.warn("[ATS:crawlAndTailorHubResume] WARNING: orig and tail scores are identical — possible scoring bug!");
    }

    // 3. Persist state
    hubTailoredPdfPath      = tailorData.pdf_path;
    hubTailoredResumeData   = tailorData.tailored_data;
    hubAtsAuditData         = tailorData.ats_audit;
    hubOriginalAtsAuditData = tailorData.original_ats_audit;
    hubCompany              = crawlData.company;
    hubJobTitle             = crawlData.title;
    hubJobDescription       = crawlData.description || "";

    // 4. Render scorecard details inline
    const emptyEl = document.getElementById("hub-scorecard-empty");
    const contentCard = document.getElementById("hub-scorecard-content");
    const jobTitleEl = document.getElementById("hub-scorecard-job-title");
    const companyEl = document.getElementById("hub-scorecard-company");

    if (emptyEl) emptyEl.style.display = "none";
    if (contentCard) contentCard.style.display = "block";
    if (jobTitleEl) jobTitleEl.textContent = jobTitle;
    if (companyEl) companyEl.textContent = companyName;

    // Enable Tailored button
    const analyzeNewBtnEl = document.getElementById("hub-analyze-new-btn");
    if (analyzeNewBtnEl) {
      analyzeNewBtnEl.disabled = false;
      analyzeNewBtnEl.style.opacity = "1";
    }

    // Original Score Gauge
    if (origScore !== null) {
      const origScoreValEl = document.getElementById("ats-score-value-orig");
      const origCircleInd = document.getElementById("ats-circle-indicator-orig");
      if (origScoreValEl) origScoreValEl.textContent = `${origScore}%`;
      if (origCircleInd) {
        origCircleInd.style.background = `conic-gradient(var(--color-danger) ${origScore}%, rgba(255,255,255,0.05) ${origScore}%)`;
      }
    }

    // Tailored Score Gauge
    if (tailScore !== null) {
      const scoreValEl = document.getElementById("ats-score-value");
      const circleInd = document.getElementById("ats-circle-indicator");
      if (scoreValEl) scoreValEl.textContent = `${tailScore}%`;
      if (circleInd) {
        circleInd.style.background = `conic-gradient(var(--color-accent) ${tailScore}%, rgba(255,255,255,0.05) ${tailScore}%)`;
      }
    }

    // Matched Keywords Pills (from tailored audit)
    const matchedGrid = document.getElementById("hub-matched-pills");
    if (matchedGrid) {
      const keywords = (tailorData.ats_audit && tailorData.ats_audit.matched_keywords) || [];
      matchedGrid.innerHTML = keywords.length > 0
        ? keywords.map(kw => `<span class="keyword-pill matched">${escapeHtml(kw)}</span>`).join("")
        : `<span style="font-size: 12px; color: var(--text-muted);">None detected</span>`;
    }

    // Missing Keywords Pills
    const missingGrid = document.getElementById("hub-missing-pills");
    if (missingGrid) {
      const keywords = (tailorData.ats_audit && tailorData.ats_audit.missing_keywords) || [];
      missingGrid.innerHTML = keywords.length > 0
        ? keywords.map(kw => `<span class="keyword-pill missing">${escapeHtml(kw)}</span>`).join("")
        : `<span style="font-size: 12px; color: var(--text-muted);">None detected</span>`;
    }

    // Recommendations Checklist
    const recsList = document.getElementById("hub-recs-list");
    if (recsList) {
      const recs = (tailorData.ats_audit && tailorData.ats_audit.recommendations) || [];
      recsList.innerHTML = recs.length > 0
        ? recs.map(rec => `<li>${escapeHtml(rec)}</li>`).join("")
        : `<li>Tailored resume is fully optimized. No critical edits recommended.</li>`;
    }

    loadHubFiles();
    saveAppState();
    showToast(`Resume tailored! Original: ${origScore}% → Tailored: ${tailScore}%`, "success");
    console.log("crawlAndTailorHubResume: Done.");

  } catch (err) {
    console.error("[ATS:crawlAndTailorHubResume] ERROR:", err);
    showToast(`Tailor failed: ${err.message}`, "error");
  } finally {
    setLoading(false);
  }
}


window.analyzeAtsHubResume = async function() {
  console.log("analyzeAtsHubResume: Starting ATS analysis workflow...");
  if (!hubUploadedFilename || !hubUploadedResumeData) {
    showToast("Please upload an original resume file first.", "error");
    return;
  }

  const urlInput = document.getElementById("hub-job-url");
  const url = urlInput ? urlInput.value.trim() : "";

  const loader = document.getElementById("hub-crawler-loader");
  const loaderText = document.getElementById("hub-loader-text");
  const matchBtn = document.getElementById("hub-match-btn");
  const analyzeBtn = document.getElementById("hub-analyze-btn");
  const analyzeOrigBtn = document.getElementById("hub-analyze-orig-btn");
  const analyzeNewBtn = document.getElementById("hub-analyze-new-btn");

  if (loader) loader.style.display = "flex";
  if (matchBtn) matchBtn.disabled = true;
  if (analyzeBtn) analyzeBtn.disabled = true;
  if (analyzeOrigBtn) analyzeOrigBtn.disabled = true;
  if (analyzeNewBtn) analyzeNewBtn.disabled = true;

  try {
    let jobTitle = "General Resume";
    let companyName = "ATS Review";
    let jobDescription = "";

    if (url) {
      // Domain and Keyword check for Job Portals and Career Pages
      const whitelistedDomains = [
        "naukri.com", "linkedin.com", "indeed.com", "glassdoor", "monster", 
        "foundit", "simplyhired", "ziprecruiter", "dice.com", "careerbuilder", 
        "internshala", "wellfound", "angel.co", "timesjobs", "shine.com",
        "greenhouse.io", "lever.co", "myworkdayjobs.com", "taleo.net", "icims.com",
        "smartrecruiters.com", "ashbyhq.com", "bamboohr.com", "recruitee.com", 
        "breezy.hr", "workable.com"
      ];
      const whitelistedKeywords = [
        "/careers", "/jobs", "/career", "/job", "job-listings", "job-detail", 
        "viewjob", "vacancy", "position", "recruit", "job-posting"
      ];
      
      const urlLower = url.toLowerCase();
      const isPortal = whitelistedDomains.some(d => urlLower.includes(d)) || 
                       whitelistedKeywords.some(kw => urlLower.includes(kw));
                       
      if (!isPortal) {
        showToast("Please provide correct job portal url.", "error");
        if (loader) loader.style.display = "none";
        if (matchBtn) matchBtn.disabled = false;
        if (analyzeBtn) analyzeBtn.disabled = false;
        return;
      }

      if (loaderText) loaderText.textContent = "Launching browser session to crawl listing details...";

      // 1. Crawl job board details
      const crawlRes = await fetch("/api/resume-hub/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_url: url })
      });
      const crawlData = await crawlRes.json();
      if (!crawlRes.ok) throw new Error(crawlData.detail || "Job portal crawl failed");

      jobTitle = crawlData.title;
      companyName = crawlData.company;
      jobDescription = crawlData.description;
    }

    if (loaderText) loaderText.textContent = url ? `Scraped job description from ${companyName}. Analyzing original ATS score...` : "Running general ATS audit on original resume...";

    // 2. Analyze original resume against job description
    const analyzeRes = await fetch("/api/resume-hub/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_title: jobTitle,
        job_company: companyName,
        job_description: jobDescription,
        resume_data: hubUploadedResumeData
      })
    });
    const analyzeData = await analyzeRes.json();
    if (!analyzeRes.ok) throw new Error(analyzeData.detail || "ATS Analysis failed");

    // 3. Update scorecard gauge
    console.log("analyzeAtsHubResume: Rendering original ATS score scorecard...");
    const emptyEl = document.getElementById("hub-scorecard-empty");
    const contentCard = document.getElementById("hub-scorecard-content");
    const jobTitleEl = document.getElementById("hub-scorecard-job-title");
    const companyEl = document.getElementById("hub-scorecard-company");
    const origScoreValEl = document.getElementById("ats-score-value-orig");
    const origCircleInd = document.getElementById("ats-circle-indicator-orig");

    if (emptyEl) emptyEl.style.display = "none";
    if (contentCard) contentCard.style.display = "block";
    if (jobTitleEl) jobTitleEl.textContent = jobTitle;
    if (companyEl) companyEl.textContent = companyName;

    // Dim the ATS (Tailored) button if no tailored data exists
    const analyzeNewBtnEl = document.getElementById("hub-analyze-new-btn");
    if (analyzeNewBtnEl) {
      analyzeNewBtnEl.disabled = !hubTailoredResumeData;
      analyzeNewBtnEl.style.opacity = hubTailoredResumeData ? "1" : "0.45";
    }

    const origScore = analyzeData.ats_audit.score || 40;
    if (origScoreValEl) origScoreValEl.textContent = `${origScore}%`;
    if (origCircleInd) {
      origCircleInd.style.background = `conic-gradient(var(--color-danger) ${origScore}%, rgba(255,255,255,0.05) ${origScore}%)`;
    }

    // Display original matched keywords pills
    const matchedGrid = document.getElementById("hub-matched-pills");
    if (matchedGrid) {
      const keywords = analyzeData.ats_audit.matched_keywords || [];
      matchedGrid.innerHTML = keywords.length > 0
        ? keywords.map(kw => `<span class="keyword-pill matched">${escapeHtml(kw)}</span>`).join("")
        : `<span style="font-size: 12px; color: var(--text-muted);">None detected</span>`;
    }

    // Display original missing keywords pills
    const missingGrid = document.getElementById("hub-missing-pills");
    if (missingGrid) {
      const keywords = analyzeData.ats_audit.missing_keywords || [];
      missingGrid.innerHTML = keywords.length > 0
        ? keywords.map(kw => `<span class="keyword-pill missing">${escapeHtml(kw)}</span>`).join("")
        : `<span style="font-size: 12px; color: var(--text-muted);">None detected</span>`;
    }

    // Display original recommendations checklist
    const recsList = document.getElementById("hub-recs-list");
    if (recsList) {
      const recs = analyzeData.ats_audit.recommendations || [];
      recsList.innerHTML = recs.length > 0
        ? recs.map(rec => `<li>${escapeHtml(rec)}</li>`).join("")
        : `<li>Format remains fully optimized. No critical edits recommended.</li>`;
    }

    // Preserve tailored state — don't wipe it when re-analyzing original
    hubOriginalAtsAuditData = analyzeData.ats_audit;
    if (!hubAtsAuditData) hubAtsAuditData = null; // Keep existing tailored audit if present
    hubCompany = companyName;
    hubJobTitle = jobTitle;
    if (url && jobDescription) hubJobDescription = jobDescription;

    // Tailored gauge: show stored score if tailored data exists, otherwise N/A
    const scoreValEl = document.getElementById("ats-score-value");
    const circleInd = document.getElementById("ats-circle-indicator");
    if (hubAtsAuditData && hubAtsAuditData.score) {
      const tailoredScore = hubAtsAuditData.score;
      if (scoreValEl) scoreValEl.textContent = `${tailoredScore}%`;
      if (circleInd) circleInd.style.background = `conic-gradient(var(--color-accent) ${tailoredScore}%, rgba(255,255,255,0.05) ${tailoredScore}%)`;
    } else {
      if (scoreValEl) scoreValEl.textContent = "N/A";
      if (circleInd) circleInd.style.background = `conic-gradient(#6b7280 100%, rgba(255,255,255,0.05) 100%)`;
    }

    showToast(url ? "ATS score for original resume audited! Run 'Tailor & Match' to optimize." : "General ATS Audit Completed! Run 'Tailor & Match' to customize for a job.", "success");
    saveAppState();
  } catch (err) {
    console.error(err);
    showToast(`ATS analysis failed: ${err.message}`, "error");
  } finally {
    if (loader) loader.style.display = "none";
    if (matchBtn) matchBtn.disabled = false;
    if (analyzeBtn) analyzeBtn.disabled = false;
    if (analyzeOrigBtn) analyzeOrigBtn.disabled = false;
    if (analyzeNewBtn) analyzeNewBtn.disabled = false;
  }
}

window.analyzeAtsTailoredResume = async function() {
  console.log("analyzeAtsTailoredResume: Analyzing ATS score for tailored resume...");
  if (!hubTailoredResumeData) {
    showToast("Please run 'Tailor & Match' first to generate a tailored resume.", "error");
    return;
  }

  const loader = document.getElementById("hub-crawler-loader");
  const loaderText = document.getElementById("hub-loader-text");
  const matchBtn = document.getElementById("hub-match-btn");
  const analyzeBtn = document.getElementById("hub-analyze-btn");
  const analyzeOrigBtn = document.getElementById("hub-analyze-orig-btn");
  const analyzeNewBtn = document.getElementById("hub-analyze-new-btn");

  if (loader) loader.style.display = "flex";
  if (loaderText) loaderText.textContent = "Running ATS audit on tailored resume...";
  if (matchBtn) matchBtn.disabled = true;
  if (analyzeBtn) analyzeBtn.disabled = true;
  if (analyzeOrigBtn) analyzeOrigBtn.disabled = true;
  if (analyzeNewBtn) analyzeNewBtn.disabled = true;

  try {
    const jobTitle = hubJobTitle || "General Resume";
    const companyName = hubCompany || "ATS Review";

    // Analyze the tailored resume data using the stored job description for accurate comparison
    const analyzeRes = await fetch("/api/resume-hub/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_title: jobTitle,
        job_company: companyName,
        job_description: hubJobDescription || "",
        resume_data: hubTailoredResumeData
      })
    });
    const analyzeData = await analyzeRes.json();
    if (!analyzeRes.ok) throw new Error(analyzeData.detail || "ATS Analysis of tailored resume failed");

    console.log("analyzeAtsTailoredResume: Updating tailored ATS score gauge...");

    // Update the tailored score gauge
    const scoreValEl = document.getElementById("ats-score-value");
    const circleInd = document.getElementById("ats-circle-indicator");
    const score = analyzeData.ats_audit.score || 50;
    if (scoreValEl) scoreValEl.textContent = `${score}%`;
    if (circleInd) {
      circleInd.style.background = `conic-gradient(var(--color-accent) ${score}%, rgba(255,255,255,0.05) ${score}%)`;
    }

    // Restore original score gauge if we have it
    if (hubOriginalAtsAuditData) {
      const origScoreValEl = document.getElementById("ats-score-value-orig");
      const origCircleInd = document.getElementById("ats-circle-indicator-orig");
      const origScore = hubOriginalAtsAuditData.score || 40;
      if (origScoreValEl) origScoreValEl.textContent = `${origScore}%`;
      if (origCircleInd) {
        origCircleInd.style.background = `conic-gradient(var(--color-danger) ${origScore}%, rgba(255,255,255,0.05) ${origScore}%)`;
      }
    }

    // Update keyword pills with tailored resume analysis
    const matchedGrid = document.getElementById("hub-matched-pills");
    if (matchedGrid) {
      const keywords = analyzeData.ats_audit.matched_keywords || [];
      matchedGrid.innerHTML = keywords.length > 0
        ? keywords.map(kw => `<span class="keyword-pill matched">${escapeHtml(kw)}</span>`).join("")
        : `<span style="font-size: 12px; color: var(--text-muted);">None detected</span>`;
    }

    const missingGrid = document.getElementById("hub-missing-pills");
    if (missingGrid) {
      const keywords = analyzeData.ats_audit.missing_keywords || [];
      missingGrid.innerHTML = keywords.length > 0
        ? keywords.map(kw => `<span class="keyword-pill missing">${escapeHtml(kw)}</span>`).join("")
        : `<span style="font-size: 12px; color: var(--text-muted);">None detected</span>`;
    }

    const recsList = document.getElementById("hub-recs-list");
    if (recsList) {
      const recs = analyzeData.ats_audit.recommendations || [];
      recsList.innerHTML = recs.length > 0
        ? recs.map(rec => `<li>${escapeHtml(rec)}</li>`).join("")
        : `<li>Tailored resume is fully optimized. No critical edits recommended.</li>`;
    }

    hubAtsAuditData = analyzeData.ats_audit;
    saveAppState();
    showToast("ATS Audit completed for tailored resume!", "success");
  } catch (err) {
    console.error(err);
    showToast(`ATS analysis of tailored resume failed: ${err.message}`, "error");
  } finally {
    if (loader) loader.style.display = "none";
    if (matchBtn) matchBtn.disabled = false;
    if (analyzeBtn) analyzeBtn.disabled = false;
    if (analyzeOrigBtn) analyzeOrigBtn.disabled = false;
    if (analyzeNewBtn) analyzeNewBtn.disabled = false;
  }
}
async function loadHubFiles() {
  const tbody = document.getElementById("hub-files-table-body");
  if (!tbody) return;

  try {
    const res = await fetch("/api/resume-hub/files");
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Files load failed");

    const files = data.files || [];
    if (files.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 24px; color: var(--text-muted);">No tailored resumes saved locally yet. Complete a match scan to populate your vault.</td>
        </tr>`;
      return;
    }

    tbody.innerHTML = files.map(file => {
      const formattedSize = (file.size / 1024).toFixed(1) + " KB";
      const formattedDate = new Date(file.created_at * 1000).toLocaleString();
      return `
        <tr>
          <td style="padding:12px;"><strong>${escapeHtml(file.company)}</strong></td>
          <td style="padding:12px; font-family: monospace; font-size:12px;">${escapeHtml(file.filename)}</td>
          <td style="padding:12px;">${formattedSize}</td>
          <td style="padding:12px;">${formattedDate}</td>
          <td style="padding:12px; text-align:right;">
            <div style="display:inline-flex; gap:6px;">
              <button class="btn btn-secondary" style="padding:4px 8px; font-size:11px;" onclick="viewHubFile('${escapeHtml(file.path.replace(/\\/g, '/'))}')">👁️ View</button>
              <button class="btn btn-secondary" style="padding:4px 8px; font-size:11px;" onclick="compareHubVaultResume('${escapeHtml(file.path.replace(/\\/g, '/'))}', '${escapeHtml(file.company)}')">⚖️ Diff</button>
              <button class="btn btn-secondary" style="padding:4px 8px; font-size:11px;" onclick="downloadHubFile('${escapeHtml(file.path.replace(/\\/g, '/'))}', '${escapeHtml(file.filename)}')">📥 Download</button>
              <button class="btn btn-secondary" style="padding:4px 8px; font-size:11px; color:#f87171;" onclick="deleteHubFile('${escapeHtml(file.path.replace(/\\/g, '/'))}')">🗑️ Delete</button>
            </div>
          </td>
        </tr>`;
    }).join("");
  } catch (err) {
    console.error(err);
    showToast(`Failed to load vault files: ${err.message}`, "error");
  }
}

function viewHubFile(path) {
  window.open(`/api/jobs/dummy/tailor/view?path=${encodeURIComponent(path)}`, "_blank");
}

function downloadHubFile(path, filename) {
  window.location.href = `/api/jobs/dummy/tailor/download?path=${encodeURIComponent(path)}&filename=${encodeURIComponent(filename)}`;
}

async function deleteHubFile(path) {
  if (!confirm("Are you sure you want to delete this tailored resume? This cannot be undone.")) return;

  try {
    const res = await fetch("/api/resume-hub/files", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: path })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Delete failed");

    showToast("Tailored resume deleted successfully.", "success");
    loadHubFiles();
  } catch (err) {
    console.error(err);
    showToast(`Delete failed: ${err.message}`, "error");
  }
}

// Viewer helpers for active tailored copy
function viewHubTailoredResume() {
  if (!hubTailoredPdfPath) {
    showToast("Please run 'Tailor & Match (New)' to generate and view the tailored resume.", "info");
    return;
  }
  viewHubFile(hubTailoredPdfPath);
}

function downloadHubTailoredResume() {
  if (!hubTailoredPdfPath) {
    showToast("Please run 'Tailor & Match (New)' to generate and download the tailored resume.", "info");
    return;
  }
  const parts = hubTailoredPdfPath.split(/[\\/]/);
  const fname = parts[parts.length - 1];
  downloadHubFile(hubTailoredPdfPath, fname);
}

// SMTP Email helpers
function openEmailHubModal() {
  if (!hubTailoredPdfPath) {
    showToast("No active tailored resume copy to send.", "error");
    return;
  }
  const modal = document.getElementById("email-hub-modal");
  const attachmentInput = document.getElementById("email-attachment-path");
  const recipientInput = document.getElementById("email-recipient");
  const subjectInput = document.getElementById("email-subject");
  const bodyInput = document.getElementById("email-body");

  if (attachmentInput) attachmentInput.value = hubTailoredPdfPath;
  if (recipientInput) recipientInput.value = currentConfig?.searches?.candidate_identity?.personal_details?.email || "";
  if (subjectInput) subjectInput.value = `Custom Tailored Resume - Application`;
  if (bodyInput) {
    bodyInput.value = `Hi,\n\nPlease find attached my custom tailored, ATS-optimized resume for your review.\n\nBest regards,\n${currentConfig?.searches?.candidate_identity?.personal_details?.first_name || ''} ${currentConfig?.searches?.candidate_identity?.personal_details?.last_name || ''}`;
  }

  if (modal) modal.style.display = "flex";
}

function closeEmailHubModal() {
  const modal = document.getElementById("email-hub-modal");
  if (modal) modal.style.display = "none";
}

async function sendHubResumeEmail() {
  const recipient = document.getElementById("email-recipient")?.value.trim();
  const subject = document.getElementById("email-subject")?.value.trim();
  const body = document.getElementById("email-body")?.value.trim();
  const path = document.getElementById("email-attachment-path")?.value;

  if (!recipient) {
    showToast("Please enter a recipient email address.", "error");
    return;
  }

  const submitBtn = document.getElementById("email-hub-submit-btn");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending...";
  }

  try {
    const res = await fetch("/api/resume-hub/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to_email: recipient,
        subject: subject,
        body: body,
        attachment_path: path
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Email transmission failed");

    showToast("Custom tailored resume sent successfully!", "success");
    closeEmailHubModal();
  } catch (err) {
    console.error(err);
    showToast(`Email sending failed: ${err.message}`, "error");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "✉️ Send Email";
    }
  }
}

// =====================================================================
// STATE PERSISTENCE & LOCALSTORAGE HELPERS (PHASE 23)
// =====================================================================

window.saveAppState = function() {
  localStorage.setItem("aegis_jobsList", JSON.stringify(jobsList || []));
  localStorage.setItem("aegis_hubUploadedFilename", hubUploadedFilename || "");
  localStorage.setItem("aegis_hubUploadedResumeData", JSON.stringify(hubUploadedResumeData));
  localStorage.setItem("aegis_hubTailoredPdfPath", hubTailoredPdfPath || "");
  localStorage.setItem("aegis_hubTailoredResumeData", JSON.stringify(hubTailoredResumeData));
  localStorage.setItem("aegis_hubAtsAuditData", JSON.stringify(hubAtsAuditData));
  localStorage.setItem("aegis_hubOriginalAtsAuditData", JSON.stringify(hubOriginalAtsAuditData));
  localStorage.setItem("aegis_hubCompany", hubCompany || "");
  localStorage.setItem("aegis_hubJobTitle", hubJobTitle || "");
  localStorage.setItem("aegis_hubJobDescription", hubJobDescription || "");
  
  const activeTab = document.querySelector(".nav-item.active");
  if (activeTab) {
    localStorage.setItem("aegis_activeTab", activeTab.getAttribute("data-tab"));
  }
};

window.loadAppState = function() {
  try {
    const savedJobs = localStorage.getItem("aegis_jobsList");
    if (savedJobs) {
      jobsList = JSON.parse(savedJobs);
      filteredJobsList = [...jobsList];
      const listToRender = filteredJobsList.length > 0 ? filteredJobsList : jobsList;
      displayPage(currentPage, listToRender);
    }
    
    hubUploadedFilename = localStorage.getItem("aegis_hubUploadedFilename") || "";
    const savedUploadedData = localStorage.getItem("aegis_hubUploadedResumeData");
    if (savedUploadedData) {
      hubUploadedResumeData = JSON.parse(savedUploadedData);
    }
    
    hubTailoredPdfPath = localStorage.getItem("aegis_hubTailoredPdfPath") || "";
    const savedTailoredData = localStorage.getItem("aegis_hubTailoredResumeData");
    if (savedTailoredData) {
      hubTailoredResumeData = JSON.parse(savedTailoredData);
    }
    
    const savedAtsAudit = localStorage.getItem("aegis_hubAtsAuditData");
    if (savedAtsAudit) {
      hubAtsAuditData = JSON.parse(savedAtsAudit);
    }
    
    const savedOrigAtsAudit = localStorage.getItem("aegis_hubOriginalAtsAuditData");
    if (savedOrigAtsAudit) {
      hubOriginalAtsAuditData = JSON.parse(savedOrigAtsAudit);
    }
    
    hubCompany = localStorage.getItem("aegis_hubCompany") || "";
    hubJobTitle = localStorage.getItem("aegis_hubJobTitle") || "";
    hubJobDescription = localStorage.getItem("aegis_hubJobDescription") || "";
    
    // Restore UI for uploaded resume
    if (hubUploadedFilename && hubUploadedResumeData) {
      const infoRow = document.getElementById("hub-resume-info-row");
      const activeFn = document.getElementById("hub-active-filename");
      const zone = document.getElementById("hub-resume-upload-zone");
      if (activeFn) activeFn.textContent = `📄 ${hubUploadedFilename} (Successfully Structured)`;
      if (infoRow) infoRow.style.display = "flex";
      if (zone) zone.style.display = "none";
    }
    
    // Restore UI for scorecard
    if (hubJobTitle && (hubAtsAuditData || hubOriginalAtsAuditData)) {
      console.log("loadAppState: Restoring scorecard UI state...");
      const emptyEl = document.getElementById("hub-scorecard-empty");
      const contentCard = document.getElementById("hub-scorecard-content");
      const jobTitleEl = document.getElementById("hub-scorecard-job-title");
      const companyEl = document.getElementById("hub-scorecard-company");
      const scoreValEl = document.getElementById("ats-score-value");
      const circleInd = document.getElementById("ats-circle-indicator");
      const origScoreValEl = document.getElementById("ats-score-value-orig");
      const origCircleInd = document.getElementById("ats-circle-indicator-orig");

      if (emptyEl) emptyEl.style.display = "none";
      if (contentCard) contentCard.style.display = "block";
      if (jobTitleEl) jobTitleEl.textContent = hubJobTitle;
      if (companyEl) companyEl.textContent = hubCompany;

      // Enable/disable ATS (Tailored) button based on whether tailored data exists
      const analyzeNewBtn = document.getElementById("hub-analyze-new-btn");
      if (analyzeNewBtn) {
        analyzeNewBtn.disabled = !hubTailoredResumeData;
        analyzeNewBtn.style.opacity = hubTailoredResumeData ? "1" : "0.45";
        analyzeNewBtn.title = hubTailoredResumeData ? "" : "Run Tailor & Match first to enable";
      }

      // 1. Original score
      const origScore = (hubOriginalAtsAuditData && hubOriginalAtsAuditData.score) || 40;
      if (origScoreValEl) origScoreValEl.textContent = `${origScore}%`;
      if (origCircleInd) {
        origCircleInd.style.background = `conic-gradient(var(--color-danger) ${origScore}%, rgba(255,255,255,0.05) ${origScore}%)`;
      }

      // 2. Tailored score
      if (hubTailoredPdfPath && hubAtsAuditData) {
        const score = hubAtsAuditData.score || 50;
        if (scoreValEl) scoreValEl.textContent = `${score}%`;
        if (circleInd) {
          circleInd.style.background = `conic-gradient(var(--color-accent) ${score}%, rgba(255,255,255,0.05) ${score}%)`;
        }
      } else {
        if (scoreValEl) scoreValEl.textContent = "N/A";
        if (circleInd) {
          circleInd.style.background = `conic-gradient(#6b7280 100%, rgba(255,255,255,0.05) 100%)`;
        }
      }

      // 3. Keywords & recommendations (use tailored if available, otherwise original)
      const activeAudit = (hubTailoredPdfPath && hubAtsAuditData) ? hubAtsAuditData : hubOriginalAtsAuditData;

      const matchedGrid = document.getElementById("hub-matched-pills");
      if (matchedGrid) {
        const keywords = activeAudit.matched_keywords || [];
        matchedGrid.innerHTML = keywords.length > 0
          ? keywords.map(kw => `<span class="keyword-pill matched">${escapeHtml(kw)}</span>`).join("")
          : `<span style="font-size: 12px; color: var(--text-muted);">None detected</span>`;
      }

      const missingGrid = document.getElementById("hub-missing-pills");
      if (missingGrid) {
        const keywords = activeAudit.missing_keywords || [];
        missingGrid.innerHTML = keywords.length > 0
          ? keywords.map(kw => `<span class="keyword-pill missing">${escapeHtml(kw)}</span>`).join("")
          : `<span style="font-size: 12px; color: var(--text-muted);">None detected</span>`;
      }

      const recsList = document.getElementById("hub-recs-list");
      if (recsList) {
        const recs = activeAudit.recommendations || [];
        recsList.innerHTML = recs.length > 0
          ? recs.map(rec => `<li>${escapeHtml(rec)}</li>`).join("")
          : `<li>Format remains fully optimized. No critical edits recommended.</li>`;
      }
    }
    
    // Restore tab
    const savedTab = localStorage.getItem("aegis_activeTab");
    if (savedTab) {
      const tabs = document.querySelectorAll(".nav-item");
      const panes = document.querySelectorAll(".tab-pane");
      const title = document.getElementById("page-title");
      const desc = document.getElementById("page-desc");
      
      const tabMeta = {
        dashboard: { title: "Control Center", desc: "Monitor pipeline actions, analyze job parsing metrics, and manage search automation execution." },
        jobs: { title: "Discovered Listings", desc: "Review compatibility-scored jobs, tailor your resume to match at least 85%, and submit applications." },
        "resume-hub": { title: "Resume Hub", desc: "Upload any PDF/DOCX resume, match it to any job URL, audit your ATS score, and email the tailored result." },
        search: { title: "Search Filters", desc: "Define roles, location scopes, distance bounds, and employer blacklist configurations." },
        identity: { title: "Candidate Profile Info", desc: "Edit personal credentials, contact endpoints, and demographic variables." },
        compliance: { title: "Compliance & EEO Preferences", desc: "Set standardized choices for application legal questionnaires and equal opportunity details." },
        credentials: { title: "Credentials & API Tokens", desc: "Manage logins, security secrets, resume file paths, and browser debugging addresses." }
      };

      tabs.forEach(t => t.classList.remove("active"));
      panes.forEach(p => p.classList.remove("active"));

      const activeTab = document.querySelector(`.nav-item[data-tab="${savedTab}"]`);
      if (activeTab) activeTab.classList.add("active");
      
      const activePane = document.getElementById(`tab-${savedTab}`);
      if (activePane) activePane.classList.add("active");

      if (title && tabMeta[savedTab]) title.textContent = tabMeta[savedTab].title;
      if (desc && tabMeta[savedTab]) desc.textContent = tabMeta[savedTab].desc;
      
      if (savedTab === "jobs") {
        loadJobs();
      } else if (savedTab === "resume-hub") {
        loadHubFiles();
      }
    }
  } catch (err) {
    console.error("Failed to load app state from localStorage:", err);
  }
};

window.compareHubResume = function() {
  if (!hubUploadedResumeData || !hubTailoredResumeData) {
    showToast("No tailored resume data to compare.", "error");
    return;
  }
  
  showToast("Fetching resume differences...", "success");

  try {
    const originalResume = hubUploadedResumeData;
    const tailoredResume = hubTailoredResumeData;

    const jobTitleText = hubCompany ? `${hubJobTitle} at ${hubCompany}` : `${hubJobTitle}`;
    document.getElementById("compare-job-title").textContent = jobTitleText;

    const container = document.getElementById("compare-diff-container");
    // -- Dynamic Rendering for arbitrary custom sections and keys --
    for (const key of Object.keys(originalResume)) {
      if (key === "name" || key === "contact") continue;
      
      const valOrig = originalResume[key];
      const valTail = tailoredResume[key] || "";
      
      if (typeof valOrig === "string") {
        const diff = highlightTextDiff(valOrig, typeof valTail === "string" ? valTail : "");
        container.innerHTML += createCompareSection(key, diff.origHtml, diff.tailHtml);
      } else if (valOrig && typeof valOrig === "object" && !Array.isArray(valOrig)) {
        // Nested dictionary (like skills)
        let origHtml = "";
        let tailHtml = "";
        const subkeys = Object.keys(valOrig);
        subkeys.forEach(sub => {
          const sOrig = valOrig[sub] || "";
          const sTail = (valTail && typeof valTail === "object") ? (valTail[sub] || "") : "";
          const diff = highlightSkillsDiff(String(sOrig), String(sTail));
          origHtml += `<div style="margin-bottom: 12px;"><strong>${escapeHtml(sub)}:</strong><br><span style="font-size: 13px;">${diff.origHtml}</span></div>`;
          tailHtml += `<div style="margin-bottom: 12px;"><strong>${escapeHtml(sub)}:</strong><br><span style="font-size: 13px;">${diff.tailHtml}</span></div>`;
        });
        container.innerHTML += createCompareSection(key, origHtml, tailHtml);
      } else if (Array.isArray(valOrig)) {
        // List of items
        const valTailArr = Array.isArray(valTail) ? valTail : [];
        const maxLen = Math.max(valOrig.length, valTailArr.length);
        
        let listHtml = "";
        for (let idx = 0; idx < maxLen; idx++) {
          const oItem = valOrig[idx];
          const tItem = valTailArr[idx];
          
          if (typeof oItem === "string" || typeof tItem === "string") {
            const diff = highlightTextDiff(String(oItem || ""), String(tItem || ""));
            listHtml += `
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 6px; font-size: 12.5px; line-height: 1.5;">
                <div style="color: var(--text-secondary);">${oItem ? `• ${diff.origHtml}` : ""}</div>
                <div style="color: var(--text-primary);">${tItem ? `• ${diff.tailHtml}` : ""}</div>
              </div>
            `;
          } else if ((oItem && typeof oItem === "object") || (tItem && typeof tItem === "object")) {
            // Experience / Education items
            const oItemSafe = oItem || {};
            const tItemSafe = tItem || {};
            
            const roleKey = Object.keys(oItemSafe).find(k => ["role", "degree", "title"].includes(k.toLowerCase())) || "role";
            const compKey = Object.keys(oItemSafe).find(k => ["company", "institution", "school"].includes(k.toLowerCase())) || "company";
            const dateKey = Object.keys(oItemSafe).find(k => ["dates", "dates_active"].includes(k.toLowerCase())) || "dates";
            const bulletKey = Object.keys(oItemSafe).find(k => ["bullets", "details", "achievements"].includes(k.toLowerCase())) || "bullets";
            
            const roleDiff = highlightTextDiff(oItemSafe[roleKey] || "", tItemSafe[roleKey] || "");
            const companyDiff = highlightTextDiff(oItemSafe[compKey] || "", tItemSafe[compKey] || "");
            const datesDiff = highlightTextDiff(oItemSafe[dateKey] || "", tItemSafe[dateKey] || "");
            
            listHtml += `
              <div style="border-bottom: 1px dashed rgba(255,255,255,0.05); padding-bottom: 12px; margin-bottom: 12px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; font-weight: 600; margin-bottom: 8px;">
                  <div>
                    <span style="color: var(--text-primary);">${roleDiff.origHtml}</span> - 
                    <span style="color: var(--color-accent);">${companyDiff.origHtml}</span>
                    <div style="font-size: 11px; color: var(--text-muted); font-weight: normal; margin-top: 2px;">${datesDiff.origHtml}</div>
                  </div>
                  <div>
                    <span style="color: var(--text-primary);">${roleDiff.tailHtml}</span> - 
                    <span style="color: var(--color-accent);">${companyDiff.tailHtml}</span>
                    <div style="font-size: 11px; color: var(--text-muted); font-weight: normal; margin-top: 2px;">${datesDiff.tailHtml}</div>
                  </div>
                </div>
            `;
            
            // Nested bullets
            const oBullets = oItemSafe[bulletKey] || [];
            const tBullets = tItemSafe[bulletKey] || [];
            
            if (Array.isArray(oBullets) || Array.isArray(tBullets)) {
              const oBulletsArr = Array.isArray(oBullets) ? oBullets : [];
              const tBulletsArr = Array.isArray(tBullets) ? tBullets : [];
              const maxBullets = Math.max(oBulletsArr.length, tBulletsArr.length);
              
              for (let bIdx = 0; bIdx < maxBullets; bIdx++) {
                const oBullet = oBulletsArr[bIdx] || "";
                const tBullet = tBulletsArr[bIdx] || "";
                const bulletDiff = highlightTextDiff(oBullet, tBullet);
                
                listHtml += `
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 6px; font-size: 12.5px; line-height: 1.5;">
                    <div style="color: var(--text-secondary);">${oBullet ? `• ${bulletDiff.origHtml}` : ""}</div>
                    <div style="color: var(--text-primary);">${tBullet ? `• ${bulletDiff.tailHtml}` : ""}</div>
                  </div>
                `;
              }
            } else if (typeof oBullets === "string" || typeof tBullets === "string") {
              const bulletDiff = highlightTextDiff(String(oBullets || ""), String(tBullets || ""));
              listHtml += `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 6px; font-size: 12.5px; line-height: 1.5;">
                  <div style="color: var(--text-secondary);">${oBullets ? bulletDiff.origHtml : ""}</div>
                  <div style="color: var(--text-primary);">${tBullets ? bulletDiff.tailHtml : ""}</div>
                </div>
              `;
            }
            listHtml += `</div>`;
          }
        }
        
        container.innerHTML += `
          <div class="compare-diff-item">
            <div class="compare-diff-item-title">${escapeHtml(key)}</div>
            <div style="background: rgba(255, 255, 255, 0.01); border: 1px solid rgba(255, 255, 255, 0.04); border-radius: 8px; padding: 16px;">
              ${listHtml}
            </div>
          </div>
        `;
      }
    }

    document.getElementById("compare-modal").style.display = "flex";

  } catch (err) {
    console.error(err);
    showToast(`Failed to open comparison: ${err.message}`, "error");
  }
};

window.compareHubVaultResume = async function(filePath, companyName) {
  if (!hubUploadedResumeData) {
    showToast("Please upload an original resume file first to perform comparison.", "error");
    return;
  }
  
  showToast("Fetching tailored JSON data for comparison...", "success");

  try {
    const origRes = hubUploadedResumeData;
    
    const tailRes = await fetch(`/api/resume-hub/tailored_data?path=${encodeURIComponent(filePath)}`);
    if (!tailRes.ok) throw new Error("Could not load the matching tailored resume JSON data.");
    const tailoredResume = await tailRes.json();

    document.getElementById("compare-job-title").textContent = `Tailored Resume for ${companyName}`;

    const container = document.getElementById("compare-diff-container");
    container.innerHTML = "";

    // -- Dynamic Rendering for arbitrary custom sections and keys --
    for (const key of Object.keys(origRes)) {
      if (key === "name" || key === "contact") continue;
      
      const valOrig = origRes[key];
      const valTail = tailoredResume[key] || "";
      
      if (typeof valOrig === "string") {
        const diff = highlightTextDiff(valOrig, typeof valTail === "string" ? valTail : "");
        container.innerHTML += createCompareSection(key, diff.origHtml, diff.tailHtml);
      } else if (valOrig && typeof valOrig === "object" && !Array.isArray(valOrig)) {
        // Nested dictionary (like skills)
        let origHtml = "";
        let tailHtml = "";
        const subkeys = Object.keys(valOrig);
        subkeys.forEach(sub => {
          const sOrig = valOrig[sub] || "";
          const sTail = (valTail && typeof valTail === "object") ? (valTail[sub] || "") : "";
          const diff = highlightSkillsDiff(String(sOrig), String(sTail));
          origHtml += `<div style="margin-bottom: 12px;"><strong>${escapeHtml(sub)}:</strong><br><span style="font-size: 13px;">${diff.origHtml}</span></div>`;
          tailHtml += `<div style="margin-bottom: 12px;"><strong>${escapeHtml(sub)}:</strong><br><span style="font-size: 13px;">${diff.tailHtml}</span></div>`;
        });
        container.innerHTML += createCompareSection(key, origHtml, tailHtml);
      } else if (Array.isArray(valOrig)) {
        // List of items
        const valTailArr = Array.isArray(valTail) ? valTail : [];
        const maxLen = Math.max(valOrig.length, valTailArr.length);
        
        let listHtml = "";
        for (let idx = 0; idx < maxLen; idx++) {
          const oItem = valOrig[idx];
          const tItem = valTailArr[idx];
          
          if (typeof oItem === "string" || typeof tItem === "string") {
            const diff = highlightTextDiff(String(oItem || ""), String(tItem || ""));
            listHtml += `
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 6px; font-size: 12.5px; line-height: 1.5;">
                <div style="color: var(--text-secondary);">${oItem ? `• ${diff.origHtml}` : ""}</div>
                <div style="color: var(--text-primary);">${tItem ? `• ${diff.tailHtml}` : ""}</div>
              </div>
            `;
          } else if ((oItem && typeof oItem === "object") || (tItem && typeof tItem === "object")) {
            // Experience / Education items
            const oItemSafe = oItem || {};
            const tItemSafe = tItem || {};
            
            const roleKey = Object.keys(oItemSafe).find(k => ["role", "degree", "title"].includes(k.toLowerCase())) || "role";
            const compKey = Object.keys(oItemSafe).find(k => ["company", "institution", "school"].includes(k.toLowerCase())) || "company";
            const dateKey = Object.keys(oItemSafe).find(k => ["dates", "dates_active"].includes(k.toLowerCase())) || "dates";
            const bulletKey = Object.keys(oItemSafe).find(k => ["bullets", "details", "achievements"].includes(k.toLowerCase())) || "bullets";
            
            const roleDiff = highlightTextDiff(oItemSafe[roleKey] || "", tItemSafe[roleKey] || "");
            const companyDiff = highlightTextDiff(oItemSafe[compKey] || "", tItemSafe[compKey] || "");
            const datesDiff = highlightTextDiff(oItemSafe[dateKey] || "", tItemSafe[dateKey] || "");
            
            listHtml += `
              <div style="border-bottom: 1px dashed rgba(255,255,255,0.05); padding-bottom: 12px; margin-bottom: 12px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; font-weight: 600; margin-bottom: 8px;">
                  <div>
                    <span style="color: var(--text-primary);">${roleDiff.origHtml}</span> - 
                    <span style="color: var(--color-accent);">${companyDiff.origHtml}</span>
                    <div style="font-size: 11px; color: var(--text-muted); font-weight: normal; margin-top: 2px;">${datesDiff.origHtml}</div>
                  </div>
                  <div>
                    <span style="color: var(--text-primary);">${roleDiff.tailHtml}</span> - 
                    <span style="color: var(--color-accent);">${companyDiff.tailHtml}</span>
                    <div style="font-size: 11px; color: var(--text-muted); font-weight: normal; margin-top: 2px;">${datesDiff.tailHtml}</div>
                  </div>
                </div>
            `;
            
            // Nested bullets
            const oBullets = oItemSafe[bulletKey] || [];
            const tBullets = tItemSafe[bulletKey] || [];
            
            if (Array.isArray(oBullets) || Array.isArray(tBullets)) {
              const oBulletsArr = Array.isArray(oBullets) ? oBullets : [];
              const tBulletsArr = Array.isArray(tBullets) ? tBullets : [];
              const maxBullets = Math.max(oBulletsArr.length, tBulletsArr.length);
              
              for (let bIdx = 0; bIdx < maxBullets; bIdx++) {
                const oBullet = oBulletsArr[bIdx] || "";
                const tBullet = tBulletsArr[bIdx] || "";
                const bulletDiff = highlightTextDiff(oBullet, tBullet);
                
                listHtml += `
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 6px; font-size: 12.5px; line-height: 1.5;">
                    <div style="color: var(--text-secondary);">${oBullet ? `• ${bulletDiff.origHtml}` : ""}</div>
                    <div style="color: var(--text-primary);">${tBullet ? `• ${bulletDiff.tailHtml}` : ""}</div>
                  </div>
                `;
              }
            } else if (typeof oBullets === "string" || typeof tBullets === "string") {
              const bulletDiff = highlightTextDiff(String(oBullets || ""), String(tBullets || ""));
              listHtml += `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 6px; font-size: 12.5px; line-height: 1.5;">
                  <div style="color: var(--text-secondary);">${oBullets ? bulletDiff.origHtml : ""}</div>
                  <div style="color: var(--text-primary);">${tBullets ? bulletDiff.tailHtml : ""}</div>
                </div>
              `;
            }
            listHtml += `</div>`;
          }
        }
        
        container.innerHTML += `
          <div class="compare-diff-item">
            <div class="compare-diff-item-title">${escapeHtml(key)}</div>
            <div style="background: rgba(255, 255, 255, 0.01); border: 1px solid rgba(255, 255, 255, 0.04); border-radius: 8px; padding: 16px;">
              ${listHtml}
            </div>
          </div>
        `;
      }
    }

    document.getElementById("compare-modal").style.display = "flex";

  } catch (err) {
    console.error(err);
    showToast(`Failed to load comparison: ${err.message}`, "error");
  }
};
