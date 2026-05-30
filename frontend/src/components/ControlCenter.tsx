import React, { useState, useEffect, useRef } from "react";
import { Play, Zap, CheckCircle, XCircle, Terminal, Copy, Trash2 } from "lucide-react";

interface ControlCenterProps {
  config: any;
  logs: string;
  setLogs: (logs: string) => void;
  triggerAction: (actionName: string) => Promise<void>;
  isScanning: boolean;
  showToast: (msg: string, type: "success" | "error" | "warning") => void;
}

export default function ControlCenter({
  config,
  logs,
  setLogs,
  triggerAction,
  isScanning,
  showToast
}: ControlCenterProps) {
  const [simFields, setSimFields] = useState({
    firstName: "",
    lastName: "",
    email: "",
    relocate: ""
  });

  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Parse logs to animate sandbox
  useEffect(() => {
    if (!logs) {
      setSimFields({ firstName: "", lastName: "", email: "", relocate: "" });
      return;
    }

    const fnMatch = logs.match(/Field \[first_name_input\]: '([^']+)'/) || logs.match(/Field \[first_name\]: '([^']+)'/) || logs.match(/Filling text '([^']+)' for field: 'First Name'/i);
    const lnMatch = logs.match(/Field \[last_name\]: '([^']+)'/) || logs.match(/Filling text '([^']+)' for field: 'Last Name'/i);
    const emMatch = logs.match(/Field \[email_input\]: '([^']+)'/) || logs.match(/Field \[email\]: '([^']+)'/) || logs.match(/Filling text '([^']+)' for field: 'Email'/i) || logs.match(/Filling text '([^']+)' for field: 'Email Address'/i);
    const relMatch = logs.match(/Field \[relocate\]: '([^']+)'/) || logs.match(/Selecting option '([^']+)' for field: 'Willing to relocate\?'/i) || logs.match(/Selecting option '([^']+)' for field: 'relocat'/i);

    setSimFields({
      firstName: fnMatch ? fnMatch[1] : "",
      lastName: lnMatch ? lnMatch[1] : "",
      email: emMatch ? emMatch[1] : "",
      relocate: relMatch ? relMatch[1] : ""
    });
  }, [logs]);

  // Scroll to bottom of terminal
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const copyLogs = () => {
    navigator.clipboard.writeText(logs);
    showToast("Logs copied to clipboard!", "success");
  };

  const clearLogs = () => {
    setLogs("");
    showToast("Terminal screen cleared.", "success");
  };

  // Safe checks for metrics
  const positions = config?.searches?.search_parameters?.positions || [];
  const locations = config?.searches?.search_parameters?.locations || [];
  const geminiKey = config?.constants?.GEMINI_API_KEY || "";
  const resumePath = config?.constants?.RESUME_PATH || "";

  // Onboarding checklist
  const isResumeConfigured = !!resumePath && resumePath.endsWith(".pdf");
  const isGeminiConfigured = !!geminiKey;

  const portalsList = [
    { id: "LINKEDIN", label: "LinkedIn" },
    { id: "INSTAHYRE", label: "Instahyre" },
    { id: "CUTSHORT", label: "Cutshort" },
    { id: "WELLFOUND", label: "Wellfound" },
    { id: "HIRIST", label: "Hirist" },
    { id: "NAUKRI", label: "Naukri" },
    { id: "INDEED", label: "Indeed" },
    { id: "FOUNDIT", label: "Foundit" },
    { id: "SHINE", label: "Shine" },
    { id: "TIMESJOBS", label: "TimesJobs" },
    { id: "GLASSDOOR", label: "Glassdoor" }
  ];

  const configuredPortals = portalsList.filter(portal => {
    const isNaukri = portal.id === "NAUKRI";
    const consts = config?.constants || {};
    if (isNaukri) {
      return !!consts.USERNAME && !!consts.PASSWORD && consts.USERNAME !== "candidate_auth@domain.local";
    } else {
      return !!consts[`${portal.id}_USERNAME`] && !!consts[`${portal.id}_PASSWORD`];
    }
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-2xl text-indigo-400">
            🎯
          </div>
          <div>
            <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">Job Targets</span>
            <h3 className="text-base font-bold text-zinc-100 mt-0.5">
              {positions.length} Target{positions.length === 1 ? "" : "s"}
            </h3>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-2xl text-indigo-400">
            📍
          </div>
          <div>
            <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">Geographic Scopes</span>
            <h3 className="text-base font-bold text-zinc-100 mt-0.5">
              {locations.length} Location{locations.length === 1 ? "" : "s"}
            </h3>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-2xl text-indigo-400">
            🛡️
          </div>
          <div>
            <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">Stealth Protection</span>
            <h3 className="text-base font-bold text-zinc-100 mt-0.5">Hardened (CDP)</h3>
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-2xl text-indigo-400">
            🔑
          </div>
          <div>
            <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">Gemini API Key</span>
            <div>
              <span
                className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded mt-1 ${
                  isGeminiConfigured
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25"
                    : "bg-rose-500/10 text-rose-400 border border-rose-500/25"
                }`}
              >
                {isGeminiConfigured ? "Configured" : "Missing"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_300px_1fr] gap-6">
        {/* Left Action Panel */}
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 flex flex-col gap-5">
          <div>
            <h3 className="text-sm font-bold text-white">System Actions</h3>
            <span className="text-[11px] text-zinc-500">Trigger application pipelines</span>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => triggerAction("test-graph")}
              disabled={isScanning}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-zinc-800 hover:bg-zinc-700/85 disabled:opacity-50 text-white rounded-xl text-xs font-semibold cursor-pointer border border-zinc-700 transition"
            >
              <Play size={14} className="text-zinc-400" />
              Run Mock Graph Validation
            </button>
            <button
              onClick={() => triggerAction("bump-naukri")}
              disabled={isScanning}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-[0_0_15px_rgba(99,102,241,0.35)] hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] transition"
            >
              <Zap size={14} />
              Bump Naukri Visibility
            </button>
          </div>

          <div className="mt-4 border-t border-zinc-850 pt-4 flex-1">
            <h4 className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-3">
              Engine Status Checklist
            </h4>
            <ul className="flex flex-col gap-3">
              <li className="flex items-center gap-2.5 text-xs text-zinc-400">
                {isResumeConfigured ? (
                  <CheckCircle size={14} className="text-emerald-500 flex-shrink-0" />
                ) : (
                  <XCircle size={14} className="text-zinc-650 flex-shrink-0" />
                )}
                <span className={isResumeConfigured ? "text-zinc-200" : ""}>
                  Resume PDF path configured
                </span>
              </li>
              {configuredPortals.map(portal => (
                <li key={portal.id} className="flex items-center gap-2.5 text-xs text-zinc-400">
                  <CheckCircle size={14} className="text-emerald-500 flex-shrink-0" />
                  <span className="text-zinc-200">{portal.label} login setup</span>
                </li>
              ))}
              {configuredPortals.length === 0 && (
                <li className="flex items-center gap-2.5 text-xs text-zinc-450">
                  <XCircle size={14} className="text-zinc-650 flex-shrink-0" />
                  <span>No portals configured</span>
                </li>
              )}
              <li className="flex items-center gap-2.5 text-xs text-zinc-400">
                {isGeminiConfigured ? (
                  <CheckCircle size={14} className="text-emerald-500 flex-shrink-0" />
                ) : (
                  <XCircle size={14} className="text-zinc-650 flex-shrink-0" />
                )}
                <span className={isGeminiConfigured ? "text-zinc-200" : ""}>Gemini API configured</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Middle Visual Form Simulator Sandbox */}
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-bold text-white">Visual Form Simulator</h3>
            <span className="text-[11px] text-zinc-500">Real-time simulation of form fill actions</span>
          </div>

          <div className="flex-1 flex flex-col gap-4 bg-zinc-950 p-4 border border-zinc-850 rounded-xl max-h-[300px] overflow-y-auto">
            <div className="flex flex-col gap-1">
              <label className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">First Name</label>
              <input
                type="text"
                readOnly
                value={simFields.firstName}
                placeholder={simFields.firstName ? "" : "Waiting..."}
                className={`w-full bg-zinc-900/30 border text-xs px-3 py-2 rounded-lg outline-none transition duration-350 ${
                  simFields.firstName
                    ? "border-emerald-500/50 bg-emerald-500/5 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.1)]"
                    : "border-zinc-800 text-zinc-500"
                }`}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">Last Name</label>
              <input
                type="text"
                readOnly
                value={simFields.lastName}
                placeholder={simFields.lastName ? "" : "Waiting..."}
                className={`w-full bg-zinc-900/30 border text-xs px-3 py-2 rounded-lg outline-none transition duration-350 ${
                  simFields.lastName
                    ? "border-emerald-500/50 bg-emerald-500/5 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.1)]"
                    : "border-zinc-800 text-zinc-500"
                }`}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">Email Address</label>
              <input
                type="text"
                readOnly
                value={simFields.email}
                placeholder={simFields.email ? "" : "Waiting..."}
                className={`w-full bg-zinc-900/30 border text-xs px-3 py-2 rounded-lg outline-none transition duration-350 ${
                  simFields.email
                    ? "border-emerald-500/50 bg-emerald-500/5 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.1)]"
                    : "border-zinc-800 text-zinc-500"
                }`}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">Willing to Relocate?</label>
              <input
                type="text"
                readOnly
                value={simFields.relocate}
                placeholder={simFields.relocate ? "" : "Waiting..."}
                className={`w-full bg-zinc-900/30 border text-xs px-3 py-2 rounded-lg outline-none transition duration-350 ${
                  simFields.relocate
                    ? "border-emerald-500/50 bg-emerald-500/5 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.1)]"
                    : "border-zinc-800 text-zinc-500"
                }`}
              />
            </div>
          </div>
        </div>

        {/* Right Terminal Console Logs */}
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl flex flex-col overflow-hidden min-h-[300px]">
          <div className="bg-zinc-950 px-4 py-3 border-b border-zinc-850 flex justify-between items-center flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <div className="flex items-center gap-1 text-[10px] uppercase font-bold text-zinc-500 tracking-wider ml-2.5">
                <Terminal size={12} />
                Output Terminal
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={copyLogs}
                title="Copy Terminal Logs"
                className="p-1 text-zinc-500 hover:text-white cursor-pointer transition"
              >
                <Copy size={14} />
              </button>
              <button
                onClick={clearLogs}
                title="Clear logs"
                className="p-1 text-zinc-500 hover:text-white cursor-pointer transition"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          <div className="flex-1 bg-zinc-950 p-4 font-mono text-[11px] leading-relaxed overflow-y-auto max-h-[360px]">
            {logs ? (
              logs.split("\n").map((line, idx) => {
                if (!line && idx === logs.split("\n").length - 1) return null;
                let colorClass = "text-zinc-400";
                if (line.includes("Error") || line.includes("FAILED") || line.toLowerCase().includes("[error]")) {
                  colorClass = "text-rose-400";
                } else if (
                  line.includes("OK") ||
                  line.includes("successfully") ||
                  line.includes("finished") ||
                  line.toLowerCase().includes("[success]")
                ) {
                  colorClass = "text-emerald-400";
                } else if (line.startsWith("[System]")) {
                  colorClass = "text-indigo-400";
                }
                return (
                  <div key={idx} className={colorClass}>
                    {line}
                  </div>
                );
              })
            ) : (
              <div className="text-zinc-650 italic">Waiting for process start...</div>
            )}
            <div ref={terminalEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
