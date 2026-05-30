import React, { useState, useEffect } from "react";
import { Menu, Save, RotateCcw, AlertTriangle, Loader2 } from "lucide-react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import ControlCenter from "./components/ControlCenter";
import DiscoveredJobs from "./components/DiscoveredJobs";
import ResumeHub from "./components/ResumeHub";
import SearchFilters from "./components/SearchFilters";
import LegalEeo from "./components/LegalEeo";
import SecretsKeys from "./components/SecretsKeys";
import About from "./components/About";
import ProfilePage from "./components/ProfilePage";
import LoginPage from "./components/auth/LoginPage";
import SignUpPage from "./components/auth/SignUpPage";
import ForgotPassword from "./components/auth/ForgotPassword";
import { useAuth } from "./contexts/AuthContext";
import ScanConfirmModal from "./components/ScanConfirmModal";

export default function App() {
  const { isAuthenticated, isLoading, user, authView, logout } = useAuth();

  // Navigation & UI States
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // App Configurations & Cache
  const [config, setConfig] = useState<any>(null);
  const [localConfig, setLocalConfig] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [logs, setLogs] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTask, setActiveTask] = useState<string | null>(null);
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null);
  const [showScanConfirmModal, setShowScanConfirmModal] = useState(false);
  const [pendingItems, setPendingItems] = useState<any[]>([]);

  // Toasts Notification System
  const [toasts, setToasts] = useState<any[]>([]);

  const showToast = (message: string, type: "success" | "error" | "warning" = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  // Helper to sync user profile account details to config personal_details
  const syncUserToConfig = (configData: any, currentUser: any) => {
    if (!currentUser || !configData) return configData;
    const nameParts = currentUser.fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    const updated = { ...configData };
    if (!updated.searches) updated.searches = {};
    if (!updated.searches.candidate_identity) updated.searches.candidate_identity = {};
    if (!updated.searches.candidate_identity.personal_details) {
      updated.searches.candidate_identity.personal_details = {};
    }

    const personal = updated.searches.candidate_identity.personal_details;
    personal.first_name = firstName;
    personal.last_name = lastName;
    personal.email = currentUser.email;
    personal.phone = currentUser.phone || "";

    return updated;
  };

  // Load Configurations
  const loadConfig = async () => {
    try {
      const savedConfig = sessionStorage.getItem("aegis_flow_config");
      let data: any;
      if (savedConfig) {
        data = JSON.parse(savedConfig);
      } else {
        const res = await fetch("/api/config");
        if (!res.ok) throw new Error("Could not retrieve setup variables.");
        data = await res.json();
      }

      const syncedData = syncUserToConfig(data, user);
      setConfig(syncedData);
      setLocalConfig(JSON.parse(JSON.stringify(syncedData))); // Deep clone for local edits
      sessionStorage.setItem("aegis_flow_config", JSON.stringify(syncedData));
    } catch (err: any) {
      console.error(err);
      showToast("Error loading configurations.", "error");
    }
  };

  // Load Jobs
  const loadJobs = async () => {
    try {
      const res = await fetch("/api/jobs");
      if (!res.ok) throw new Error("Could not load jobs cache.");
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch (err) {
      console.error("Jobs fetch error: ", err);
    }
  };

  // Check GDrive connection
  const checkScanningStatus = async () => {
    try {
      const res = await fetch("/api/jobs/scan/status");
      if (!res.ok) return;
      const data = await res.json();
      setIsScanning(data.is_scanning);
    } catch (err) {
      console.error(err);
    }
  };

  // Startup Hooks
  useEffect(() => {
    if (!isAuthenticated) {
      setActiveTab("dashboard");
      return;
    }
    loadConfig();
    loadJobs();
    checkScanningStatus();
    
    // Set up global exception listeners
    const handleGlobalError = (event: ErrorEvent) => {
      fetch("/api/errors/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: event.message || "Unhandled script error",
          details: event.error?.stack || `Error at line ${event.lineno}:${event.colno} in ${event.filename}`
        })
      }).catch((e) => console.error("Logger reporting fail:", e));
    };

    const handlePromiseRejection = (event: PromiseRejectionEvent) => {
      fetch("/api/errors/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: event.reason?.message || "Unhandled Promise Rejection",
          details: event.reason?.stack || String(event.reason)
        })
      }).catch((e) => console.error("Logger reporting fail:", e));
    };

    window.addEventListener("error", handleGlobalError);
    window.addEventListener("unhandledrejection", handlePromiseRejection);

    return () => {
      window.removeEventListener("error", handleGlobalError);
      window.removeEventListener("unhandledrejection", handlePromiseRejection);
    };
  }, [isAuthenticated]);

  // Sync config when user changes (e.g. edited name, phone, etc.)
  useEffect(() => {
    if (!user || !config) return;
    const nameParts = user.fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    const personal = config.searches?.candidate_identity?.personal_details || {};
    if (
      personal.first_name !== firstName ||
      personal.last_name !== lastName ||
      personal.email !== user.email ||
      personal.phone !== user.phone
    ) {
      const synced = syncUserToConfig(config, user);
      setConfig(synced);
      setLocalConfig(JSON.parse(JSON.stringify(synced)));
      sessionStorage.setItem("aegis_flow_config", JSON.stringify(synced));
    }
  }, [user]);

  // Polling loop for logs and scan status
  useEffect(() => {
    let logInterval: any = null;
    let scanInterval: any = null;

    if (activeTask) {
      logInterval = setInterval(async () => {
        try {
          const res = await fetch("/api/logs");
          if (!res.ok) return;
          const data = await res.json();
          const cleanLogs = data.logs || "";
          setLogs(cleanLogs);

          if (
            cleanLogs.includes("Execution finished") || 
            cleanLogs.includes("Job status updated in local database") || 
            cleanLogs.includes("Apply pipeline failed")
          ) {
            setActiveTask(null);
            setApplyingJobId(null);
            showToast("Pipeline action completed successfully!", "success");
            loadJobs();
          }
        } catch (err) {
          console.error(err);
        }
      }, 1000);
    }

    if (isScanning) {
      scanInterval = setInterval(async () => {
        try {
          const res = await fetch("/api/jobs/scan/status");
          if (!res.ok) return;
          const data = await res.json();
          setIsScanning(data.is_scanning);
          
          // Progressive fetch jobs
          loadJobs();

          if (!data.is_scanning) {
            clearInterval(scanInterval);
            showToast("Portal scan completed!", "success");
          }
        } catch (err) {
          console.error(err);
        }
      }, 2000);
    }

    return () => {
      if (logInterval) clearInterval(logInterval);
      if (scanInterval) clearInterval(scanInterval);
    };
  }, [activeTask, isScanning]);

  // Action Triggers
  const triggerAction = async (actionName: string) => {
    setLogs(`[System] Initializing process execution for '${actionName}'...\n`);
    setActiveTask(actionName);
    showToast(`Starting pipeline action: ${actionName}`, "success");

    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionName })
      });
      if (!res.ok) throw new Error("Trigger request blocked.");
      showToast(`Background process ${actionName} started!`, "success");
    } catch (err: any) {
      setLogs((prev) => prev + `[Error] Trigger request failed: ${err.message}\n`);
      setActiveTask(null);
    }
  };

  // Helper to start the scan
  const startJobScan = async (activeConfig: any) => {
    setIsScanning(true);
    setJobs([]);
    showToast("Starting background job scan...", "success");

    try {
      const headers: Record<string, string> = {};
      if (activeConfig) {
        headers["X-Session-Config"] = JSON.stringify(activeConfig);
      }

      const res = await fetch("/api/jobs/scan", {
        method: "POST",
        headers
      });
      if (!res.ok) throw new Error("Job scan request failed.");
      const data = await res.json();
      if (data.status === "scanning") {
        showToast("Job scan is already running in the background.", "warning");
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to start job search backend.", "error");
      setIsScanning(false);
    }
  };

  // Job Scanning Action
  const triggerJobScan = async () => {
    const sessionConfigStr = sessionStorage.getItem("aegis_flow_config");
    let activeConfig = localConfig || config;
    if (sessionConfigStr) {
      try {
        activeConfig = JSON.parse(sessionConfigStr);
      } catch (e) {
        console.error(e);
      }
    }

    const targetPortals = activeConfig?.searches?.search_parameters?.target_portals || {};
    const portalIds = ["linkedin", "instahyre", "cutshort", "wellfound", "hirist", "naukri", "indeed", "foundit", "shine", "timesjobs", "glassdoor"];
    const activePortals = portalIds.filter(id => targetPortals[id] !== false);

    if (activePortals.length === 0) {
      showToast("Minimum Criteria Failed: Please enable at least one job portal in 'Search Filters' to scan.", "error");
      return;
    }

    const positions = activeConfig?.searches?.search_parameters?.positions || [];
    const locations = activeConfig?.searches?.search_parameters?.locations || [];

    if (positions.length === 0) {
      showToast("Minimum Criteria Failed: Please configure at least one job position in 'Search Scope' to scan.", "error");
      return;
    }

    if (locations.length === 0) {
      showToast("Minimum Criteria Failed: Please configure at least one geographic location in 'Search Scope' to scan.", "error");
      return;
    }

    const consts = activeConfig?.constants || {};
    const hasNaukriCreds = !!(consts.USERNAME && consts.PASSWORD && consts.USERNAME !== "candidate_auth@domain.local");
    const otherPortals = [
      "LINKEDIN", "INSTAHYRE", "CUTSHORT", "WELLFOUND", "HIRIST", 
      "INDEED", "FOUNDIT", "SHINE", "TIMESJOBS", "GLASSDOOR"
    ];
    const hasAnyOtherCreds = otherPortals.some(portal => {
      return !!(consts[`${portal}_USERNAME`] && consts[`${portal}_PASSWORD`]);
    });

    const portalsRequiringCreds = ["instahyre", "cutshort", "wellfound", "hirist", "foundit", "shine", "timesjobs", "glassdoor"];
    const enabledRequiringCreds = activePortals.filter(id => portalsRequiringCreds.includes(id));
    const enabledPublicOrHasCreds = activePortals.filter(id => {
      if (id === "linkedin" || id === "indeed" || id === "naukri") return true;
      const upper = id.toUpperCase();
      return !!(consts[`${upper}_USERNAME`] && consts[`${upper}_PASSWORD`]);
    });

    if (enabledPublicOrHasCreds.length === 0) {
      showToast("Minimum Criteria Failed: Missing credentials for credential-locked portals. Please enable a public portal (LinkedIn, Indeed, Naukri) or add credentials under 'Secrets & Keys'.", "error");
      return;
    }

    // Now detect optional pending items
    const detectedPending: any[] = [];

    // 1. Missing credentials for enabled portals
    const portalsWithMissingCreds = activePortals.filter(id => {
      if (id === "naukri") {
        return !hasNaukriCreds;
      }
      const upper = id.toUpperCase();
      return !consts[`${upper}_USERNAME`] || !consts[`${upper}_PASSWORD`];
    });

    if (portalsWithMissingCreds.length > 0) {
      const names = portalsWithMissingCreds.map(id => id.charAt(0).toUpperCase() + id.slice(1)).join(", ");
      detectedPending.push({
        type: "credentials",
        label: "Missing credentials for enabled portals",
        description: `Credentials are missing for: ${names}. These portals will default to fallback listings.`
      });
    }

    // 2. Resume PDF missing
    if (!consts.RESUME_PATH || !consts.RESUME_PATH.toLowerCase().endsWith(".pdf")) {
      detectedPending.push({
        type: "resume",
        label: "Original resume PDF path not configured",
        description: "You have not set a valid local path to a PDF resume. Scanning will run, but you won't be able to run automated applies or LLM tailoring."
      });
    }

    // 3. Gemini Key missing
    if (!consts.GEMINI_API_KEY) {
      detectedPending.push({
        type: "gemini",
        label: "Gemini API key missing",
        description: "No Gemini LLM API key has been configured. Descriptions will be summarized using local fallback parser rules instead of high-fidelity AI models."
      });
    }

    // 4. GDrive sync disabled
    if (consts.GDRIVE_SYNC_ENABLED !== true) {
      detectedPending.push({
        type: "gdrive",
        label: "Google Drive Sync is inactive",
        description: "Google Drive synchronization is disabled. Tailored resumes won't be automatically backed up to cloud vault storage folders."
      });
    }

    if (detectedPending.length > 0) {
      setPendingItems(detectedPending);
      setShowScanConfirmModal(true);
    } else {
      // All optional settings are perfectly configured, start scan immediately!
      startJobScan(activeConfig);
    }
  };

  // Save Config handler
  const handleSaveConfig = async () => {
    setIsSaving(true);
    showToast("Saving configurations...", "success");

    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(localConfig)
      });
      if (!res.ok) throw new Error("Could not update configs.");
      
      // Store config dynamically in sessionStorage
      sessionStorage.setItem("aegis_flow_config", JSON.stringify(localConfig));
      setConfig(JSON.parse(JSON.stringify(localConfig)));
      showToast("Configurations saved to browser session successfully!", "success");
    } catch (err: any) {
      console.error(err);
      showToast("Failed to save configurations.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelConfig = () => {
    setLocalConfig(JSON.parse(JSON.stringify(config)));
    showToast("Local edits discarded.", "warning");
  };

  // Check if current tab is settings
  const isSettingsTab = ["search", "compliance", "credentials"].includes(activeTab);

  // Check if config has been modified
  const isConfigModified = JSON.stringify(config) !== JSON.stringify(localConfig);

  const getPageMeta = () => {
    switch (activeTab) {
      case "profile":
        return { title: "Account Settings", desc: "Update your profile details, change security passwords, or manage your recovery keys." };
      case "dashboard":
        return { title: "Dashboard", desc: "Overview of your job application pipeline, system setup progress, and core microservices." };
      case "control-center":
        return { title: "Control Center", desc: "Run background processes, trigger automated portal visibility bumps, and inspect live sandbox simulation logs." };
      case "jobs":
        return { title: "Discovered Jobs", desc: "View and filter compatibility-scored listings and trigger direct matches." };
      case "resume-hub":
        return { title: "Resume Hub", desc: "Upload and tailor distinct resumes, review ATS audits, and email PDFs." };
      case "search":
        return { title: "Search Scope", desc: "Define positions, experience filters, and company blacklists." };
      case "compliance":
        return { title: "EEO & Declarations", desc: "Manage EEO demographics and compliance preferences." };
      case "credentials":
        return { title: "Secrets & Keys", desc: "Secure passwords, API tokens, and GDrive settings." };
      case "about":
        return { title: "About", desc: "Learn more about Aegis Flow system design and the author behind the system." };
      default:
        return { title: "Control Center", desc: "" };
    }
  };

  const meta = getPageMeta();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full bg-zinc-950 text-zinc-500">
        <Loader2 className="animate-spin text-indigo-500 mb-3" size={28} />
        <span className="text-xs font-semibold">Decrypting credentials vault...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (authView === "login") {
      return <LoginPage />;
    }
    if (authView === "signup") {
      return <SignUpPage />;
    }
    if (authView === "forgot-password") {
      return <ForgotPassword />;
    }
  }

  return (
    <ErrorBoundary>
      <div className="flex h-screen w-full bg-zinc-950 text-zinc-200 overflow-hidden font-sans relative">
        
        {/* Toast Notifications */}
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2.5 pointer-events-none">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-xl max-w-sm pointer-events-auto animate-[slideIn_0.2s_ease-out] transition duration-300 ${
                toast.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                  : toast.type === "error"
                  ? "bg-rose-500/10 border-rose-500/25 text-rose-400"
                  : "bg-amber-500/10 border-amber-500/25 text-amber-400"
              }`}
            >
              <span className="font-bold text-xs">{toast.type === "success" ? "✓" : "⚠"}</span>
              <span className="text-xs font-semibold">{toast.message}</span>
            </div>
          ))}
        </div>

        {/* Sidebar Nav */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
          mobileOpen={mobileMenuOpen}
          setMobileOpen={setMobileMenuOpen}
          isScanning={isScanning}
          user={user}
          onLogout={logout}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-zinc-900/10">
          
          {/* Header Bar */}
          <header className="flex justify-between items-center px-6 lg:px-10 py-5 border-b border-zinc-900/60 bg-zinc-950/20 flex-shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-1 text-zinc-400 hover:text-white cursor-pointer"
              >
                <Menu size={20} />
              </button>
              <div>
                <h1 className="text-base lg:text-lg font-black text-white tracking-tight font-display">{meta.title}</h1>
                <p className="text-[11px] text-zinc-500 mt-0.5">{meta.desc}</p>
              </div>
            </div>
          </header>

          {/* Onboarding progress roadmap banner for configuration tabs */}
          {isSettingsTab && (
            <div className="flex items-center justify-between px-6 lg:px-10 py-3.5 bg-zinc-950/45 border-b border-zinc-900/50 flex-shrink-0 select-none overflow-x-auto whitespace-nowrap scrollbar-none">
              <div
                onClick={() => setActiveTab("search")}
                className={`flex items-center gap-2 cursor-pointer transition ${activeTab === "search" ? "opacity-100" : "opacity-50 hover:opacity-85"}`}
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${activeTab === "search" ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400"}`}>1</div>
                <div className="text-[10px] font-bold text-zinc-300">Search Scope</div>
              </div>
              <div className="w-10 h-px bg-zinc-800 mx-2" />
              <div
                onClick={() => setActiveTab("compliance")}
                className={`flex items-center gap-2 cursor-pointer transition ${activeTab === "compliance" ? "opacity-100" : "opacity-50 hover:opacity-85"}`}
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${activeTab === "compliance" ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400"}`}>2</div>
                <div className="text-[10px] font-bold text-zinc-300">EEO & Declarations</div>
              </div>
              <div className="w-10 h-px bg-zinc-800 mx-2" />
              <div
                onClick={() => setActiveTab("credentials")}
                className={`flex items-center gap-2 cursor-pointer transition ${activeTab === "credentials" ? "opacity-100" : "opacity-50 hover:opacity-85"}`}
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${activeTab === "credentials" ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400"}`}>3</div>
                <div className="text-[10px] font-bold text-zinc-300">Secrets & Keys</div>
              </div>
            </div>
          )}

          {/* Scrollable tab-content panels */}
          <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-6">
            {config && localConfig ? (
              <>
                {activeTab === "dashboard" && (
                  <Dashboard
                    jobs={jobs}
                    config={config}
                    setActiveTab={setActiveTab}
                    isScanning={isScanning}
                    user={user}
                  />
                )}
                {activeTab === "control-center" && (
                  <ControlCenter
                    config={config}
                    logs={logs}
                    setLogs={setLogs}
                    triggerAction={triggerAction}
                    isScanning={isScanning}
                    showToast={showToast}
                  />
                )}
                {activeTab === "jobs" && (
                  <DiscoveredJobs
                    jobs={jobs}
                    loadJobs={loadJobs}
                    isScanning={isScanning}
                    setIsScanning={setIsScanning}
                    triggerJobScan={triggerJobScan}
                    showToast={showToast}
                    setActiveTab={setActiveTab}
                    applyingJobId={applyingJobId}
                    setApplyingJobId={setApplyingJobId}
                    setActiveTask={setActiveTask}
                    setLogs={setLogs}
                  />
                )}
                {activeTab === "resume-hub" && (
                  <ResumeHub showToast={showToast} />
                )}
                {activeTab === "search" && (
                  <SearchFilters
                    formData={localConfig}
                    onChange={setLocalConfig}
                    showToast={showToast}
                    loadConfig={loadConfig}
                  />
                )}
                {activeTab === "compliance" && (
                  <LegalEeo
                    formData={localConfig}
                    onChange={setLocalConfig}
                  />
                )}
                {activeTab === "credentials" && (
                  <SecretsKeys
                    formData={localConfig}
                    onChange={setLocalConfig}
                    showToast={showToast}
                    loadConfig={loadConfig}
                  />
                )}
                {activeTab === "about" && (
                  <About />
                )}
                {activeTab === "profile" && (
                  <ProfilePage />
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-zinc-500 py-12">
                <Loader2 className="animate-spin text-indigo-500 mb-3" size={24} />
                <span className="text-xs font-semibold">Decrypting local credentials database...</span>
              </div>
            )}
          </div>

          {/* Sticky footer Save Settings bar for configuration forms */}
          {isSettingsTab && isConfigModified && (
            <div className="px-6 lg:px-10 py-4 border-t border-zinc-900 bg-zinc-950/80 flex items-center justify-between flex-shrink-0 animate-[slideUp_0.2s_ease-out]">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-500">
                <AlertTriangle size={15} />
                <span>You have unsaved changes in your configurations.</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleCancelConfig}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-4 py-2 border border-zinc-800 hover:border-zinc-700 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-xs font-semibold text-zinc-300 hover:text-white rounded-lg cursor-pointer transition select-none"
                >
                  <RotateCcw size={13} />
                  Discard
                </button>
                <button
                  onClick={handleSaveConfig}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-xs font-semibold text-white rounded-lg cursor-pointer transition select-none"
                >
                  {isSaving ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Save size={13} />
                  )}
                  Save Settings
                </button>
              </div>
            </div>
          )}
          <ScanConfirmModal
            isOpen={showScanConfirmModal}
            onClose={() => setShowScanConfirmModal(false)}
            onConfirm={() => {
              const sessionConfigStr = sessionStorage.getItem("aegis_flow_config");
              let activeConfig = localConfig || config;
              if (sessionConfigStr) {
                try {
                  activeConfig = JSON.parse(sessionConfigStr);
                } catch (e) {}
              }
              startJobScan(activeConfig);
              setShowScanConfirmModal(false);
            }}
            onNavigateToSettings={() => {
              setShowScanConfirmModal(false);
              setActiveTab("credentials");
            }}
            pendingItems={pendingItems}
          />
        </div>
      </div>
    </ErrorBoundary>
  );
}
