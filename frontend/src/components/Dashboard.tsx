import React, { useState } from "react";
import { Briefcase, FileText, Settings, Terminal, Shield, CheckCircle, ArrowRight, Activity, Zap, HardDrive } from "lucide-react";

interface DashboardProps {
  jobs: any[];
  config: any;
  setActiveTab: (tab: string) => void;
  isScanning: boolean;
  user?: any;
}

export default function Dashboard({
  jobs,
  config,
  setActiveTab,
  isScanning,
  user
}: DashboardProps) {
  // Safe checks for metrics
  const positions = config?.searches?.search_parameters?.positions || [];
  const locations = config?.searches?.search_parameters?.locations || [];
  const geminiKey = config?.constants?.GEMINI_API_KEY || "";
  const naukriUser = config?.constants?.USERNAME || "";
  const naukriPass = config?.constants?.PASSWORD || "";
  const resumePath = config?.constants?.RESUME_PATH || "";
  const gdriveSync = config?.constants?.GDRIVE_SYNC_ENABLED || false;

  // Onboarding status calculations
  const isResumeConfigured = !!resumePath && resumePath.endsWith(".pdf");
  const isNaukriConfigured = !!naukriUser && !!naukriPass && naukriUser !== "candidate_auth@domain.local";
  const isGeminiConfigured = !!geminiKey;
  const isGDriveConfigured = !!gdriveSync;

  const checklistItems = [
    { label: "Search scope configured", complete: positions.length > 0 && locations.length > 0 },
    { label: "Original resume PDF uploaded", complete: isResumeConfigured },
    { label: "Naukri credentials setup", complete: isNaukriConfigured },
    { label: "Google Gemini API key bound", complete: isGeminiConfigured },
    { label: "Google Drive sync active", complete: isGDriveConfigured }
  ];

  const completedCount = checklistItems.filter(item => item.complete).length;
  const progressPercent = Math.round((completedCount / checklistItems.length) * 100);

  // Statistics calculation
  const totalScanned = jobs.length;
  const appliedJobs = jobs.filter(j => j.applied).length;
  const tailoredJobs = jobs.filter(j => j.tailored_file_path || j.gdrive_file_id || j.applied).length;

  const getGreeting = () => {
    const hrs = new Date().getHours();
    const name = user ? user.fullName.split(" ")[0] : "Candidate";
    if (hrs < 12) return `Good morning, ${name}!`;
    if (hrs < 18) return `Good afternoon, ${name}!`;
    return `Good evening, ${name}!`;
  };

  return (
    <div className="flex flex-col gap-8 pb-10">
      
      {/* 3D Tech Showcase & Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-zinc-900/50 via-zinc-950/80 to-indigo-950/15 border border-zinc-800/60 rounded-3xl p-6 lg:p-10 flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl">
        <div className="flex-1 flex flex-col gap-4 max-w-lg z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-bold uppercase tracking-wider w-fit">
            <Activity size={10} className="animate-pulse" /> Autonomous AI Job Assistant
          </div>
          <h2 className="text-2xl lg:text-3xl font-black text-white tracking-tight leading-tight font-display">
            {getGreeting()}
          </h2>
          <p className="text-zinc-400 text-xs leading-relaxed">
            An autonomous multi-threaded agent suite designed to scan global job portals, contextually tailor resumes utilizing LLM inference, bypass security CAPTCHAs, and automate application form fills cleanly.
          </p>
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={() => setActiveTab("control-center")}
              className="flex items-center gap-1.5 px-4.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white rounded-xl cursor-pointer shadow-[0_0_15px_rgba(99,102,241,0.3)] transition select-none group"
            >
              Launch Control Center <ArrowRight size={13} className="group-hover:translate-x-0.5 transition duration-150" />
            </button>
            <button
              onClick={() => setActiveTab("jobs")}
              className="flex items-center gap-1.5 px-4.5 py-2.5 bg-zinc-900 border border-zinc-850 hover:border-zinc-700 text-xs font-semibold text-zinc-300 hover:text-white rounded-xl cursor-pointer transition select-none"
            >
              Browse Matches
            </button>
          </div>
        </div>

        {/* Dynamic GPU-Accelerated 3D CSS Animation Container */}
        <div className="w-56 h-56 flex-shrink-0 relative flex items-center justify-center select-none overflow-visible">
          {/* perspective field */}
          <div className="absolute inset-0 flex items-center justify-center" style={{ perspective: "600px" }}>
            {/* rotating constellation */}
            <div 
              className="w-40 h-40 relative flex items-center justify-center"
              style={{
                transformStyle: "preserve-3d",
                animation: "spinConstellation 20s linear infinite"
              }}
            >
              {/* Orb Core */}
              <div 
                className="absolute w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 shadow-[0_0_30px_#6366f1] flex items-center justify-center border border-white/20"
                style={{ transform: "translateZ(0px)" }}
              >
                <div className="w-4 h-4 rounded-full bg-white/20 animate-ping" />
              </div>

              {/* Rings */}
              <div 
                className="absolute w-24 h-24 rounded-full border border-indigo-500/25 flex items-center justify-center"
                style={{ transform: "rotateX(75deg) translateZ(0px)", transformStyle: "preserve-3d" }}
              >
                <div className="w-20 h-20 rounded-full border border-dashed border-purple-500/35 animate-spin" />
              </div>
              <div 
                className="absolute w-36 h-36 rounded-full border border-purple-500/20"
                style={{ transform: "rotateY(75deg) rotateX(15deg) translateZ(0px)" }}
              />
              <div 
                className="absolute w-40 h-40 rounded-full border border-zinc-850"
                style={{ transform: "rotateX(30deg) rotateY(-45deg) translateZ(0px)" }}
              />

              {/* Nodes orbiting in 3D */}
              <div 
                className="absolute w-4 h-4 rounded-lg bg-zinc-900 border border-indigo-400/50 flex items-center justify-center text-[8px] font-bold shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                style={{ transform: "rotateY(0deg) translateZ(65deg) rotateY(0deg)" }}
              >
                AI
              </div>
              <div 
                className="absolute w-4 h-4 rounded-full bg-zinc-900 border border-purple-400/50 flex items-center justify-center text-[7px] font-bold shadow-[0_0_10px_rgba(168,85,247,0.5)]"
                style={{ transform: "rotateY(120deg) translateZ(65deg) rotateY(-120deg)" }}
              >
                PDF
              </div>
              <div 
                className="absolute w-4 h-4 rounded-full bg-zinc-900 border border-emerald-400/50 flex items-center justify-center text-[7px] font-bold shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                style={{ transform: "rotateY(240deg) translateZ(65deg) rotateY(-240deg)" }}
              >
                API
              </div>
            </div>
          </div>
          {/* Subtle scanning lines */}
          <div className="absolute w-full h-0.5 bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent top-1/4 animate-[pulse_2s_infinite] pointer-events-none" />
          <div className="absolute w-full h-0.5 bg-gradient-to-r from-transparent via-purple-500/30 to-transparent bottom-1/4 animate-[pulse_3s_infinite] pointer-events-none" />
        </div>
      </div>

      {/* Animation CSS Rules Injector */}
      <style>{`
        @keyframes spinConstellation {
          0% { transform: rotateX(60deg) rotateY(0deg) rotateZ(0deg); }
          100% { transform: rotateX(60deg) rotateY(360deg) rotateZ(360deg); }
        }
      `}</style>

      {/* Core Overview Statistics Gauges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Stat 1 */}
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 flex flex-col justify-between min-h-[110px] hover:border-zinc-700/50 transition">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Discovered Jobs</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 text-xs">
              <Briefcase size={13} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-white tracking-tight">{totalScanned}</h3>
            <p className="text-[10px] text-zinc-500 mt-1">Compatibilities evaluated progressively</p>
          </div>
        </div>

        {/* Stat 2 */}
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 flex flex-col justify-between min-h-[110px] hover:border-zinc-700/50 transition">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Completed Applies</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 text-xs">
              <CheckCircle size={13} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-white tracking-tight">{appliedJobs}</h3>
            <p className="text-[10px] text-zinc-500 mt-1">Submitted with customized credentials</p>
          </div>
        </div>

        {/* Stat 3 */}
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 flex flex-col justify-between min-h-[110px] hover:border-zinc-700/50 transition">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Resumes Tailored</span>
            <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 text-xs">
              <FileText size={13} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-white tracking-tight">{tailoredJobs}</h3>
            <p className="text-[10px] text-zinc-500 mt-1">Optimized metadata PDFs generated</p>
          </div>
        </div>

        {/* Stat 4 */}
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 flex flex-col justify-between min-h-[110px] hover:border-zinc-700/50 transition">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Stealth Driver</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 text-xs">
              <Shield size={13} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-lg font-black text-white tracking-tight">Active (CDP)</h3>
            <p className="text-[10px] text-zinc-500 mt-1">Anti-detection automation rules</p>
          </div>
        </div>
      </div>

      {/* Services Grid & Onboarding Status Check */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Onboarding Checklist Card */}
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 flex flex-col gap-4 lg:col-span-1">
          <div>
            <h3 className="text-sm font-bold text-white">Setup & Onboarding</h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">Initialize credentials to run automation</p>
          </div>

          <div className="flex flex-col gap-2.5">
            {/* Progress Bar */}
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-zinc-400 font-medium">Profile completeness</span>
              <strong className="text-indigo-400 font-bold">{progressPercent}%</strong>
            </div>
            <div className="w-full bg-zinc-950 rounded-full h-2 overflow-hidden border border-zinc-850 p-0.5">
              <div 
                className="bg-gradient-to-r from-indigo-500 to-purple-600 h-full rounded-full transition-all duration-500" 
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Checklist List */}
            <ul className="flex flex-col gap-2.5 mt-2">
              {checklistItems.map((item, idx) => (
                <li key={idx} className="flex items-center gap-2.5 text-xs">
                  <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold text-[9px] ${
                    item.complete ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25" : "bg-zinc-850 text-zinc-650 border border-zinc-800"
                  }`}>
                    {item.complete ? "✓" : ""}
                  </span>
                  <span className={item.complete ? "text-zinc-350" : "text-zinc-550"}>{item.label}</span>
                </li>
              ))}
            </ul>

            {progressPercent < 100 && (
              <button
                onClick={() => setActiveTab("search")}
                className="w-full mt-4 flex items-center justify-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white rounded-lg cursor-pointer transition"
              >
                Configure Settings <Settings size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Services Showcase Cards */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Card 1 */}
          <div className="bg-zinc-900/30 border border-zinc-850 rounded-2xl p-5 flex flex-col gap-3 hover:border-zinc-700/50 hover:bg-zinc-900/40 transition duration-200">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 text-sm">
              🔍
            </div>
            <div>
              <h4 className="font-bold text-xs text-white">Autonomous Portal Scanning</h4>
              <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                Parallel crawlers scan portal feeds (like Naukri) progressively and filter matches based on your targeted position filters.
              </p>
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-zinc-900/30 border border-zinc-850 rounded-2xl p-5 flex flex-col gap-3 hover:border-zinc-700/50 hover:bg-zinc-900/40 transition duration-200">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 text-sm">
              📄
            </div>
            <div>
              <h4 className="font-bold text-xs text-white">LLM Context Customizer</h4>
              <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                Tailors resume keywords and profiles dynamically using Gemini, and applies cryptographic hash modifiers to ensure unique PDF prints.
              </p>
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-zinc-900/30 border border-zinc-850 rounded-2xl p-5 flex flex-col gap-3 hover:border-zinc-700/50 hover:bg-zinc-900/40 transition duration-200">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 text-sm">
              ⚡
            </div>
            <div>
              <h4 className="font-bold text-xs text-white">Anti-Detection Browser Driver</h4>
              <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                Leverages hardened browser automation rules and solver API keys to bypass Cloudflare Turnstile and complete EEO forms cleanly.
              </p>
            </div>
          </div>

          {/* Card 4 */}
          <div className="bg-zinc-900/30 border border-zinc-850 rounded-2xl p-5 flex flex-col gap-3 hover:border-zinc-700/50 hover:bg-zinc-900/40 transition duration-200">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 text-sm">
              <HardDrive size={16} />
            </div>
            <div>
              <h4 className="font-bold text-xs text-white">Cloud Resume Vault</h4>
              <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                Automatically synchronizes custom-tailored PDFs into organized folders on Google Drive and offers direct email client triggers.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Launch Panel */}
      <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 flex flex-col gap-4">
        <div>
          <h3 className="text-sm font-bold text-white">Quick Actions</h3>
          <p className="text-[11px] text-zinc-500 mt-0.5">Jump directly to active modules</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => setActiveTab("jobs")}
            className="flex items-center justify-between px-4 py-3 bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 hover:border-zinc-750 text-xs font-bold text-zinc-300 hover:text-white rounded-xl transition cursor-pointer select-none"
          >
            <span>Scan Portal Jobs</span>
            <ArrowRight size={13} className="text-zinc-500" />
          </button>
          <button
            onClick={() => setActiveTab("resume-hub")}
            className="flex items-center justify-between px-4 py-3 bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 hover:border-zinc-750 text-xs font-bold text-zinc-300 hover:text-white rounded-xl transition cursor-pointer select-none"
          >
            <span>Resume tailoring & Audits</span>
            <ArrowRight size={13} className="text-zinc-500" />
          </button>
          <button
            onClick={() => setActiveTab("control-center")}
            className="flex items-center justify-between px-4 py-3 bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 hover:border-zinc-750 text-xs font-bold text-zinc-300 hover:text-white rounded-xl transition cursor-pointer select-none"
          >
            <span>Naukri bump Visibility</span>
            <ArrowRight size={13} className="text-zinc-500" />
          </button>
          <button
            onClick={() => setActiveTab("errors")}
            className="flex items-center justify-between px-4 py-3 bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 hover:border-zinc-750 text-xs font-bold text-zinc-300 hover:text-white rounded-xl transition cursor-pointer select-none"
          >
            <span>Review Runtime Logs</span>
            <ArrowRight size={13} className="text-zinc-500" />
          </button>
        </div>
      </div>

    </div>
  );
}
