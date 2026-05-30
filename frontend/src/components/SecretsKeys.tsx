import React, { useState, useEffect, useCallback } from "react";
import { UploadCloud, Trash2, Eye, EyeOff, Loader2, Link, Image as ImageIcon, X, Trash, Pencil, Save, Lock, Shield } from "lucide-react";

interface SecretsKeysProps {
  formData: any;
  onChange: (data: any) => void;
  showToast: (msg: string, type: "success" | "error" | "warning") => void;
  loadConfig: () => Promise<void>;
}

export default function SecretsKeys({
  formData,
  onChange,
  showToast,
  loadConfig
}: SecretsKeysProps) {
  // GDrive status polling
  const [gdriveStatus, setGDriveStatus] = useState("Checking...");
  const [gdriveClass, setGDriveClass] = useState("bg-zinc-800 text-zinc-400 border border-zinc-700");
  const [isGDriveConnecting, setIsGDriveConnecting] = useState(false);

  // Screenshots state
  const [screenshotsOpen, setScreenshotsOpen] = useState(false);
  const [screenshots, setScreenshots] = useState<any[]>([]);
  const [isScreenshotsLoading, setIsScreenshotsLoading] = useState(false);

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImg, setLightboxImg] = useState("");
  const [lightboxCaption, setLightboxCaption] = useState("");

  // Portal credentials edit mode
  const [isPortalEditing, setIsPortalEditing] = useState(false);
  // Track which password fields are currently being "peeked" (held down)
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());

  const consts = formData?.constants || {};

  // --- Frontend obfuscation helpers for localStorage ---
  // Note: Real encryption happens server-side via Fernet in crypto_manager.py.
  // This provides a basic base64 obfuscation layer in localStorage.
  const obfuscate = (value: string): string => {
    if (!value) return "";
    if (value.startsWith("OBF::")) return value; // already obfuscated
    try {
      return "OBF::" + btoa(unescape(encodeURIComponent(value)));
    } catch {
      return value;
    }
  };

  const deobfuscate = (value: string): string => {
    if (!value) return "";
    if (!value.startsWith("OBF::")) return value;
    try {
      return decodeURIComponent(escape(atob(value.slice(5))));
    } catch {
      return value;
    }
  };

  const handleFieldChange = (field: string, val: any) => {
    onChange({
      ...formData,
      constants: {
        ...consts,
        [field]: val
      }
    });
  };

  // Google Drive connection status check
  const checkGDriveStatus = async () => {
    try {
      const res = await fetch("/api/gdrive/status");
      if (!res.ok) return;
      const data = await res.json();
      if (data.authenticated) {
        setGDriveStatus("Connected");
        setGDriveClass("bg-emerald-500/10 text-emerald-400 border border-emerald-500/25");
      } else {
        setGDriveStatus("Disconnected");
        setGDriveClass("bg-rose-500/10 text-rose-450 border border-rose-500/25");
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    checkGDriveStatus();
  }, [consts.GDRIVE_SYNC_ENABLED]);

  // Connect Google Drive
  const handleConnectGDrive = async () => {
    setIsGDriveConnecting(true);
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

      // Poll connection status
      let pollCount = 0;
      const interval = setInterval(async () => {
        pollCount++;
        const res2 = await fetch("/api/gdrive/status");
        if (res2.ok) {
          const data2 = await res2.json();
          if (data2.authenticated || pollCount > 30) {
            clearInterval(interval);
            setIsGDriveConnecting(false);
            checkGDriveStatus();
          }
        }
      }, 2000);
    } catch (err: any) {
      showToast(`OAuth Error: ${err.message}`, "error");
      setIsGDriveConnecting(false);
    }
  };

  // Upload original resume file
  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const data = new FormData();
    data.append("file", file);

    showToast("Uploading original resume PDF to server...", "success");
    try {
      const res = await fetch("/api/upload/resume", {
        method: "POST",
        body: data
      });
      if (!res.ok) throw new Error("Upload failed.");
      const resData = await res.json();
      showToast("Resume uploaded successfully! Please click 'Save Settings' to save this path.", "success");
      
      const updatedConfig = {
        ...formData,
        constants: {
          ...consts,
          RESUME_PATH: resData.path
        }
      };
      onChange(updatedConfig);
      sessionStorage.setItem("aegis_flow_config", JSON.stringify(updatedConfig));
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Failed to upload resume file.", "error");
    }
  };

  // Delete original resume file
  const handleDeleteResume = async () => {
    if (!confirm("Are you sure you want to delete the uploaded resume?")) return;

    const path = consts.RESUME_PATH || "";
    const filename = path.split(/[\\/]/).pop();
    if (!filename) return;

    showToast("Deleting resume file...", "success");
    try {
      const res = await fetch(`/api/assets/${encodeURIComponent(filename)}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error("Deletion failed.");
      showToast("Resume deleted from local server storage. Please click 'Save Settings' to save this change.", "success");
      
      const updatedConfig = {
        ...formData,
        constants: {
          ...consts,
          RESUME_PATH: ""
        }
      };
      onChange(updatedConfig);
      sessionStorage.setItem("aegis_flow_config", JSON.stringify(updatedConfig));
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Failed to delete resume.", "error");
    }
  };

  // Upload GDrive OAuth secrets
  const handleGDriveCredsUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const data = new FormData();
    data.append("file", file);

    showToast("Uploading GDrive secrets json...", "success");
    try {
      const res = await fetch("/api/upload/gdrive-credentials", {
        method: "POST",
        body: data
      });
      if (!res.ok) throw new Error("Upload failed.");
      const resData = await res.json();
      showToast("GDrive credentials.json uploaded successfully!", "success");
      
      const updatedConfig = {
        ...formData,
        constants: {
          ...consts,
          GDRIVE_CLIENT_SECRETS_PATH: resData.path
        }
      };
      onChange(updatedConfig);
      sessionStorage.setItem("aegis_flow_config", JSON.stringify(updatedConfig));
      await loadConfig();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Failed to upload GDrive credentials.", "error");
    }
  };

  // Delete GDrive secrets
  const handleDeleteGDriveCreds = async () => {
    if (!confirm("Are you sure you want to delete credentials.json?")) return;

    showToast("Deleting GDrive credentials...", "success");
    try {
      const res = await fetch("/api/gdrive-credentials", { method: "DELETE" });
      if (!res.ok) throw new Error("Deletion failed.");
      showToast("Google Drive secrets file deleted.", "success");
      
      const updatedConfig = {
        ...formData,
        constants: {
          ...consts,
          GDRIVE_CLIENT_SECRETS_PATH: ""
        }
      };
      onChange(updatedConfig);
      sessionStorage.setItem("aegis_flow_config", JSON.stringify(updatedConfig));
      await loadConfig();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Failed to delete credentials.", "error");
    }
  };

  // Load screenshots list
  const loadScreenshots = async () => {
    setIsScreenshotsLoading(true);
    try {
      const res = await fetch("/api/screenshots");
      if (!res.ok) throw new Error("Could not load screenshots.");
      const data = await res.json();
      setScreenshots(data.screenshots || []);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Failed to fetch screenshots list.", "error");
    } finally {
      setIsScreenshotsLoading(false);
    }
  };

  // Open screenshots viewer modal
  const handleOpenScreenshots = () => {
    setScreenshotsOpen(true);
    loadScreenshots();
  };

  // Delete screenshot
  const handleDeleteScreenshot = async (filename: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this screenshot?")) return;

    try {
      const res = await fetch(`/api/screenshots/${encodeURIComponent(filename)}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error("Delete failed.");
      showToast("Screenshot deleted.", "success");
      loadScreenshots();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Failed to delete screenshot.", "error");
    }
  };

  // Delete all screenshots
  const handleDeleteAllScreenshots = async () => {
    if (!confirm("Are you sure you want to delete ALL screenshots?")) return;

    try {
      const res = await fetch("/api/screenshots", { method: "DELETE" });
      if (!res.ok) throw new Error("Delete all failed.");
      showToast("All screenshots cleared.", "success");
      loadScreenshots();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Failed to clear screenshots.", "error");
    }
  };

  const openLightbox = (url: string, name: string) => {
    setLightboxImg(url);
    setLightboxCaption(name);
    setLightboxOpen(true);
  };

  const getResumeName = () => {
    if (!consts.RESUME_PATH) return "";
    return consts.RESUME_PATH.split(/[\\/]/).pop() || consts.RESUME_PATH;
  };

  return (
    <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6 flex flex-col gap-6">
      <div className="border-b border-zinc-850 pb-4">
        <h3 className="text-sm font-bold text-white">System Credentials & File Paths</h3>
        <p className="text-[11px] text-zinc-550 mt-0.5">
          These variables are encrypted and stored locally in config/constants.py to secure your private keys.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Resume Upload Zone */}
        <div className="flex flex-col gap-1.5 md:col-span-2">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-505">
            Resume PDF File
          </label>
          <div className="border-2 border-dashed border-zinc-800 hover:border-indigo-500/50 hover:bg-zinc-900/10 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition relative">
            <input
              type="file"
              accept=".pdf"
              onChange={handleResumeUpload}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <UploadCloud size={24} className="text-zinc-500 mb-1" />
            <strong className="text-xs text-white block">Click to upload your Resume PDF</strong>
            <span className="text-[10px] text-zinc-550 block mt-0.5">
              {consts.RESUME_PATH ? "Click to replace current PDF file" : "or drag & drop here · PDF only"}
            </span>
          </div>

          {consts.RESUME_PATH ? (
            <div className="flex items-center justify-between bg-zinc-950/60 border border-zinc-850 rounded-lg p-3 mt-1.5">
              <span className="text-[10.5px] text-zinc-400">
                📄 Current file: <strong className="text-zinc-300 font-semibold">{getResumeName()}</strong> — stored in <code>assets/</code>
              </span>
              <button
                type="button"
                onClick={handleDeleteResume}
                className="text-[10px] px-2.5 py-1 text-rose-455 hover:text-white bg-rose-500/5 hover:bg-rose-500/15 border border-rose-500/15 rounded transition cursor-pointer flex items-center gap-1"
              >
                <Trash2 size={11} /> Delete file
              </button>
            </div>
          ) : (
            <small className="text-[10px] text-zinc-600">Stored in: assets/ folder inside the project</small>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-505">
            Google Gemini API Token Key
          </label>
          <input
            type="password"
            value={consts.GEMINI_API_KEY || ""}
            onChange={(e) => handleFieldChange("GEMINI_API_KEY", e.target.value)}
            placeholder="AI Model parsing token"
            className="w-full bg-zinc-950 border border-zinc-855 focus:border-indigo-500 text-xs px-3 py-2.5 rounded-lg outline-none text-zinc-200 transition"
          />
          <small className="text-[10px] text-zinc-600">Used for contextual parsing and custom questionnaires.</small>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-505">
            CapSolver API Token Key
          </label>
          <input
            type="password"
            value={consts.SOLVER_API_KEY || ""}
            onChange={(e) => handleFieldChange("SOLVER_API_KEY", e.target.value)}
            placeholder="CAPTCHA bypass key"
            className="w-full bg-zinc-950 border border-zinc-855 focus:border-indigo-500 text-xs px-3 py-2.5 rounded-lg outline-none text-zinc-200 transition"
          />
          <small className="text-[10px] text-zinc-600 font-mono">Used to automatically bypass Turnstile and hCaptcha guards.</small>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-505">
            Local Debugger Port (CDP)
          </label>
          <input
            type="text"
            value={consts.AGENT_BROWSER_CDP || ""}
            onChange={(e) => handleFieldChange("AGENT_BROWSER_CDP", e.target.value)}
            placeholder="e.g. localhost:9222"
            className="w-full bg-zinc-950 border border-zinc-855 focus:border-indigo-500 text-xs px-3 py-2.5 rounded-lg outline-none text-zinc-200 transition"
          />
          <small className="text-[10px] text-zinc-600">Keeps session active by connecting to your open browser profile.</small>
        </div>

        <div className="flex items-center gap-3 pt-3">
          <input
            type="checkbox"
            id="const-browser-headed"
            checked={!!consts.AGENT_BROWSER_HEADED}
            onChange={(e) => handleFieldChange("AGENT_BROWSER_HEADED", e.target.checked)}
            className="w-4 h-4 bg-zinc-950 border-zinc-850 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          />
          <label htmlFor="const-browser-headed" className="text-xs text-zinc-350 cursor-pointer select-none">
            Run headed browser window (Visible UI)
          </label>
        </div>

        {/* Google Drive Header */}
        <div className="md:col-span-2 border-t border-zinc-850 pt-5 mt-2">
          <h4 className="font-semibold text-xs text-zinc-300">Google Drive Sync Settings</h4>
          <p className="text-[10.5px] text-zinc-500 mt-1">
            Synchronize your tailored resumes to a <code>_resume/companyname_resume</code> folder structure automatically.
          </p>
        </div>

        {/* GDrive secrets credentials */}
        <div className="flex flex-col gap-1.5 md:col-span-2">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-505">
            Google OAuth Credentials JSON
          </label>
          <div className="border-2 border-dashed border-zinc-800 hover:border-indigo-500/50 hover:bg-zinc-900/10 rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition relative">
            <input
              type="file"
              accept=".json"
              onChange={handleGDriveCredsUpload}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <UploadCloud size={24} className="text-zinc-500 mb-1" />
            <strong className="text-xs text-white block">Click to upload credentials.json</strong>
            <span className="text-[10px] text-zinc-550 block mt-0.5">
              {consts.GDRIVE_CLIENT_SECRETS_PATH ? "credentials.json already uploaded" : "or drag & drop here · JSON only"}
            </span>
          </div>

          {consts.GDRIVE_CLIENT_SECRETS_PATH && (
            <div className="flex items-center justify-between bg-zinc-950/60 border border-zinc-850 rounded-lg p-3 mt-1.5">
              <span className="text-[10.5px] text-zinc-400">
                ✓ Saved to <code>config/credentials.json</code>
              </span>
              <button
                type="button"
                onClick={handleDeleteGDriveCreds}
                className="text-[10px] px-2.5 py-1 text-rose-455 hover:text-white bg-rose-500/5 hover:bg-rose-500/15 border border-rose-500/15 rounded transition cursor-pointer flex items-center gap-1"
              >
                <Trash2 size={11} /> Delete file
              </button>
            </div>
          )}
          <small className="text-[10px] text-zinc-600">
            Download OAuth Client ID JSON from the{" "}
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noreferrer"
              className="text-indigo-400 hover:underline"
            >
              Google Cloud Console
            </a>
          </small>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-505">
            Google Drive Token Path
          </label>
          <input
            type="text"
            value={consts.GDRIVE_TOKEN_PATH || "data/token.json"}
            onChange={(e) => handleFieldChange("GDRIVE_TOKEN_PATH", e.target.value)}
            placeholder="e.g. data/token.json"
            className="w-full bg-zinc-950 border border-zinc-855 focus:border-indigo-500 text-xs px-3 py-2.5 rounded-lg outline-none text-zinc-200 transition"
          />
          <small className="text-[10px] text-zinc-600 font-mono">Location where OAuth user token will be stored.</small>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between md:col-span-2 bg-zinc-950/40 p-4 border border-zinc-850 rounded-xl mt-1 gap-3">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="const-gdrive-sync-enabled"
              checked={!!consts.GDRIVE_SYNC_ENABLED}
              onChange={(e) => handleFieldChange("GDRIVE_SYNC_ENABLED", e.target.checked)}
              className="w-4 h-4 bg-zinc-950 border-zinc-850 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
            <label htmlFor="const-gdrive-sync-enabled" className="text-xs text-zinc-350 cursor-pointer select-none font-semibold">
              Enable Google Drive Sync
            </label>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-block px-2.5 py-1 text-[10px] font-bold rounded-full ${gdriveClass}`}>
              {gdriveStatus}
            </span>
            <button
              type="button"
              onClick={handleConnectGDrive}
              disabled={isGDriveConnecting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-905 border border-zinc-800 hover:border-zinc-700 disabled:opacity-50 text-xs text-white rounded-lg cursor-pointer transition"
            >
              {isGDriveConnecting ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Link size={12} />
              )}
              Connect Google Drive
            </button>
          </div>
        </div>

        {/* SMTP Header */}
        <div className="md:col-span-2 border-t border-zinc-850 pt-5 mt-2">
          <h4 className="font-semibold text-xs text-zinc-300">SMTP Email Configuration Settings</h4>
          <p className="text-[10.5px] text-zinc-500 mt-1">
            Set up your SMTP email server details to safely send custom tailored resumes directly from the Resume Hub page.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-505">
            SMTP Server Host
          </label>
          <input
            type="text"
            value={consts.SMTP_HOST || ""}
            onChange={(e) => handleFieldChange("SMTP_HOST", e.target.value)}
            placeholder="e.g. smtp.gmail.com"
            className="w-full bg-zinc-950 border border-zinc-855 focus:border-indigo-500 text-xs px-3 py-2.5 rounded-lg outline-none text-zinc-200 transition"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-505">
            SMTP Server Port
          </label>
          <input
            type="number"
            value={consts.SMTP_PORT || ""}
            onChange={(e) => handleFieldChange("SMTP_PORT", e.target.value === "" ? "" : Number(e.target.value))}
            placeholder="e.g. 587"
            className="w-full bg-zinc-950 border border-zinc-855 focus:border-indigo-500 text-xs px-3 py-2.5 rounded-lg outline-none text-zinc-200 transition"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-505">
            SMTP Sender Email Address
          </label>
          <input
            type="text"
            value={consts.SMTP_USER || ""}
            onChange={(e) => handleFieldChange("SMTP_USER", e.target.value)}
            placeholder="e.g. your_email@gmail.com"
            className="w-full bg-zinc-950 border border-zinc-855 focus:border-indigo-500 text-xs px-3 py-2.5 rounded-lg outline-none text-zinc-200 transition"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-505">
            SMTP Sender Password (App Password)
          </label>
          <input
            type="password"
            value={consts.SMTP_PASSWORD || ""}
            onChange={(e) => handleFieldChange("SMTP_PASSWORD", e.target.value)}
            placeholder="Enter secure SMTP pass"
            className="w-full bg-zinc-950 border border-zinc-855 focus:border-indigo-500 text-xs px-3 py-2.5 rounded-lg outline-none text-zinc-200 transition"
          />
        </div>

        {/* Portal Authentication Secrets Header */}
        <div className="md:col-span-2 border-t border-zinc-850 pt-5 mt-2">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-xs text-zinc-350 flex items-center gap-1.5">
              🔑 Portal Authentication Credentials (Optional)
            </h4>
            <button
              type="button"
              onClick={() => {
                if (isPortalEditing) {
                  // Saving — obfuscate passwords in sessionStorage
                  const currentConfig = JSON.parse(sessionStorage.getItem("aegis_flow_config") || "{}");
                  const updatedConstants = { ...currentConfig.constants };
                  const passwordFields = [
                    "PASSWORD", "LINKEDIN_PASSWORD", "INSTAHYRE_PASSWORD", "CUTSHORT_PASSWORD",
                    "WELLFOUND_PASSWORD", "HIRIST_PASSWORD", "INDEED_PASSWORD",
                    "FOUNDIT_PASSWORD", "SHINE_PASSWORD", "TIMESJOBS_PASSWORD", "GLASSDOOR_PASSWORD"
                  ];
                  passwordFields.forEach(field => {
                    const val = consts[field];
                    if (val && !val.startsWith("OBF::")) {
                      updatedConstants[field] = obfuscate(val);
                    }
                  });
                  const newConfig = { ...currentConfig, constants: updatedConstants };
                  sessionStorage.setItem("aegis_flow_config", JSON.stringify(newConfig));
                  showToast("Portal credentials saved securely.", "success");
                }
                setIsPortalEditing(!isPortalEditing);
                setVisiblePasswords(new Set());
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold rounded-lg border transition-all duration-200 cursor-pointer ${
                isPortalEditing
                  ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300"
              }`}
              title={isPortalEditing ? "Save & lock credentials" : "Edit credentials"}
            >
              {isPortalEditing ? (
                <><Save size={12} /> Save & Lock</>
              ) : (
                <><Pencil size={12} /> Edit</>
              )}
            </button>
          </div>
          <p className="text-[10.5px] text-zinc-500 mt-1">
            Provide optional credentials. If configured, Aegis Flow will automatically log in to perform deep discovery scrapes, otherwise it will safely fall back to public APIs.
          </p>
          <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-3.5 mt-3 flex items-start gap-2.5">
            <span className="text-xs">⚠️</span>
            <div className="flex flex-col gap-0.5">
              <strong className="text-[10.5px] font-bold text-amber-400">Important Credentials Disclaimer</strong>
              <p className="text-[10px] text-zinc-400 leading-normal">
                Please double-check and enter the correct login IDs and passwords for each configured portal. If incorrect credentials are saved, automated routines (such as deep crawls and search visibility bumps) will fail to authenticate or could trigger secondary security challenges.
              </p>
            </div>
          </div>
          {!isPortalEditing && (
            <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-lg p-2.5 mt-2 flex items-center gap-2">
              <Lock size={12} className="text-indigo-400 flex-shrink-0" />
              <span className="text-[10px] text-indigo-300/80">
                Credentials are locked. Click the <strong>Edit</strong> button above to modify.
              </span>
            </div>
          )}
        </div>

        {[
          { id: "LINKEDIN", label: "LinkedIn Jobs" },
          { id: "INSTAHYRE", label: "Instahyre" },
          { id: "CUTSHORT", label: "Cutshort" },
          { id: "WELLFOUND", label: "Wellfound (AngelList)" },
          { id: "HIRIST", label: "Hirist.tech" },
          { id: "NAUKRI", label: "Naukri.com" },
          { id: "INDEED", label: "Indeed India" },
          { id: "FOUNDIT", label: "Foundit (Monster)" },
          { id: "SHINE", label: "Shine.com" },
          { id: "TIMESJOBS", label: "TimesJobs" },
          { id: "GLASSDOOR", label: "Glassdoor Jobs" }
        ].map((portal) => {
          const isNaukri = portal.id === "NAUKRI";
          const usernameVal = isNaukri ? consts.USERNAME : consts[`${portal.id}_USERNAME`];
          const passwordVal = isNaukri ? consts.PASSWORD : consts[`${portal.id}_PASSWORD`];
          const isConfigured = isNaukri ? !!(consts.USERNAME && consts.PASSWORD) : !!(consts[`${portal.id}_USERNAME`] && consts[`${portal.id}_PASSWORD`]);
          const usernameField = isNaukri ? "USERNAME" : `${portal.id}_USERNAME`;
          const passwordField = isNaukri ? "PASSWORD" : `${portal.id}_PASSWORD`;
          const isPwdVisible = visiblePasswords.has(passwordField);

          return (
            <div key={portal.id} className={`md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 border p-4 rounded-xl transition-all duration-200 ${
              isPortalEditing
                ? "bg-zinc-950/30 border-indigo-500/15"
                : "bg-zinc-950/20 border-zinc-850/60"
            }`}>
              <div className="md:col-span-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {!isPortalEditing && <Shield size={12} className="text-zinc-600" />}
                  <span className="text-xs font-bold text-zinc-350">{portal.label}</span>
                </div>
                <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border transition-colors ${
                  isConfigured 
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-450" 
                    : "bg-zinc-900 border-zinc-800 text-zinc-550"
                }`}>
                  {isConfigured ? "✓ Configured" : "Not Configured"}
                </span>
              </div>

              {/* --- EDIT MODE --- */}
              {isPortalEditing ? (
                <>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Username / Email</label>
                    <input
                      type="text"
                      value={usernameVal || ""}
                      onChange={(e) => handleFieldChange(usernameField, e.target.value)}
                      placeholder="Enter email or username"
                      className="w-full bg-zinc-950 border border-zinc-850 focus:border-indigo-500 text-[11px] px-3 py-2 rounded-lg outline-none text-zinc-250 transition"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Password</label>
                    <div className="relative">
                      <input
                        type={isPwdVisible ? "text" : "password"}
                        value={passwordVal || ""}
                        onChange={(e) => handleFieldChange(passwordField, e.target.value)}
                        placeholder="Enter secure password"
                        className="w-full bg-zinc-950 border border-zinc-850 focus:border-indigo-500 text-[11px] px-3 py-2 pr-9 rounded-lg outline-none text-zinc-250 transition"
                      />
                      {/* Eye button — hold to peek, release to hide */}
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setVisiblePasswords(prev => new Set(prev).add(passwordField));
                        }}
                        onMouseUp={(e) => {
                          e.preventDefault();
                          setVisiblePasswords(prev => {
                            const next = new Set(prev);
                            next.delete(passwordField);
                            return next;
                          });
                        }}
                        onMouseLeave={() => {
                          setVisiblePasswords(prev => {
                            const next = new Set(prev);
                            next.delete(passwordField);
                            return next;
                          });
                        }}
                        onTouchStart={(e) => {
                          e.preventDefault();
                          setVisiblePasswords(prev => new Set(prev).add(passwordField));
                        }}
                        onTouchEnd={(e) => {
                          e.preventDefault();
                          setVisiblePasswords(prev => {
                            const next = new Set(prev);
                            next.delete(passwordField);
                            return next;
                          });
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-300 transition cursor-pointer rounded"
                        title="Hold to reveal password"
                      >
                        {isPwdVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                /* --- READ-ONLY MODE --- */
                <>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Username / Email</label>
                    <div className="w-full bg-zinc-950/50 border border-zinc-850/50 text-[11px] px-3 py-2 rounded-lg text-zinc-400 select-none flex items-center gap-2">
                      {usernameVal ? (
                        <span className="text-zinc-300">{usernameVal}</span>
                      ) : (
                        <span className="text-zinc-600 italic">Not set</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Password</label>
                    <div className="w-full bg-zinc-950/50 border border-zinc-850/50 text-[11px] px-3 py-2 rounded-lg text-zinc-400 select-none flex items-center gap-2">
                      <Lock size={11} className="text-zinc-600 flex-shrink-0" />
                      {passwordVal ? (
                        <span className="text-zinc-500 tracking-widest">••••••••</span>
                      ) : (
                        <span className="text-zinc-600 italic">Not set</span>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })}

        {/* Screenshots Card viewer */}
        <div className="md:col-span-2 border-t border-zinc-850 pt-5 mt-2 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h4 className="font-semibold text-xs text-zinc-350">📸 Apply Screenshots</h4>
            <p className="text-[10.5px] text-zinc-550 mt-1">
              Browser screenshots captured during automated apply sessions. Useful for diagnosing partial applies.
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenScreenshots}
            className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-semibold text-zinc-300 hover:text-white rounded-lg cursor-pointer transition select-none"
          >
            <ImageIcon size={13} />
            View Screenshots
          </button>
        </div>
      </div>

      {/* Screenshots Modal Viewer */}
      {screenshotsOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-4xl h-[80vh] bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-zinc-850 flex justify-between items-center bg-zinc-900/30">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>🖼️</span> Captured Screenshots
                </h3>
                {screenshots.length > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 font-bold">
                    {screenshots.length} files
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {screenshots.length > 0 && (
                  <button
                    onClick={handleDeleteAllScreenshots}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-450 hover:bg-rose-500 hover:text-white text-[10.5px] rounded transition cursor-pointer"
                  >
                    <Trash size={12} /> Clear All
                  </button>
                )}
                <button
                  onClick={() => setScreenshotsOpen(false)}
                  className="p-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white cursor-pointer hover:bg-zinc-800 transition"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* List Body */}
            <div className="flex-1 p-6 overflow-y-auto bg-zinc-950/40">
              {isScreenshotsLoading ? (
                <div className="flex flex-col items-center justify-center h-full text-zinc-500 py-12">
                  <Loader2 className="animate-spin text-indigo-400 mb-3" size={24} />
                  <span className="text-xs font-semibold">Loading screenshot library...</span>
                </div>
              ) : screenshots.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center h-full text-zinc-550 py-12">
                  <span className="text-4xl mb-3">📷</span>
                  <h4 className="font-bold text-sm text-zinc-300">No screenshots found</h4>
                  <p className="text-xs text-zinc-500 mt-1 max-w-[280px] leading-relaxed">
                    Browser images are automatically saved here during automated apply procedures to help audit issues.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                  {screenshots.map((shot, idx) => {
                    const name = shot.filename;
                    let typeBadgeClass = "bg-indigo-500/10 border-indigo-500/20 text-indigo-400";
                    let typeLabel = "Final";
                    if (name.startsWith("apply_before")) {
                      typeBadgeClass = "bg-amber-500/10 border-amber-500/20 text-amber-400";
                      typeLabel = "Before Apply";
                    } else if (name.startsWith("apply_modal")) {
                      typeBadgeClass = "bg-purple-500/10 border-purple-500/20 text-purple-400";
                      typeLabel = "Modal";
                    }

                    const tsMatch = name.match(/(\d{10,})/);
                    const dateStr = tsMatch ? new Date(parseInt(tsMatch[1]) * 1000).toLocaleString() : "";

                    return (
                      <div
                        key={idx}
                        onClick={() => openLightbox(shot.url, name)}
                        className="bg-zinc-900/30 border border-zinc-850 rounded-xl overflow-hidden hover:border-zinc-700/80 transition-all duration-200 cursor-pointer flex flex-col group relative"
                      >
                        <div className="aspect-video w-full bg-zinc-950 flex items-center justify-center overflow-hidden border-b border-zinc-900">
                          <img
                            src={shot.url}
                            alt={name}
                            loading="lazy"
                            className="object-cover w-full h-full group-hover:scale-105 transition duration-300"
                          />
                        </div>
                        <button
                          onClick={(e) => handleDeleteScreenshot(name, e)}
                          title="Delete screenshot"
                          className="absolute top-2 right-2 p-1.5 bg-zinc-950/80 border border-zinc-850 hover:bg-rose-500 hover:text-white rounded text-rose-450 opacity-0 group-hover:opacity-100 transition duration-200 cursor-pointer"
                        >
                          <Trash2 size={12} />
                        </button>
                        <div className="p-3 flex flex-col gap-1.5 flex-1 justify-between bg-zinc-950/30">
                          <div className="text-[10px] font-bold text-zinc-350 truncate" title={name}>
                            {name}
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-2 mt-1">
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold border ${typeBadgeClass}`}>
                              {typeLabel}
                            </span>
                            {dateStr && (
                              <span className="text-[9px] text-zinc-550 font-mono">{dateStr}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox for large view */}
      {lightboxOpen && (
        <div
          onClick={() => setLightboxOpen(false)}
          className="fixed inset-0 z-[3000] flex flex-col items-center justify-center p-4 bg-black/95 backdrop-blur-md cursor-zoom-out"
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 p-2 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white rounded-lg transition"
          >
            <X size={18} />
          </button>
          <img src={lightboxImg} alt="Lightbox large view" className="max-w-full max-h-[85vh] object-contain rounded-lg" />
          <div className="mt-4 text-xs font-mono text-zinc-400 select-all bg-zinc-950 px-4 py-2 border border-zinc-850 rounded-xl">
            {lightboxCaption}
          </div>
        </div>
      )}
    </div>
  );
}
