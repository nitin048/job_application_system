import React, { useState, useEffect } from "react";
import { Search, Loader2, Sparkles, Eye, Scale, Download, Check, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import CompareModal from "./CompareModal";

interface DiscoveredJobsProps {
  jobs: any[];
  loadJobs: () => Promise<void>;
  isScanning: boolean;
  setIsScanning: (scanning: boolean) => void;
  triggerJobScan: () => Promise<void>;
  showToast: (msg: string, type: "success" | "error" | "warning") => void;
  setActiveTab: (tab: string) => void;
  applyingJobId: string | null;
  setApplyingJobId: (jobId: string | null) => void;
  setActiveTask: (task: string | null) => void;
  setLogs: (logs: string | ((prev: string) => string)) => void;
}

export default function DiscoveredJobs({
  jobs,
  loadJobs,
  isScanning,
  setIsScanning,
  triggerJobScan,
  showToast,
  setActiveTab,
  applyingJobId,
  setApplyingJobId,
  setActiveTask,
  setLogs
}: DiscoveredJobsProps) {
  // Filter States
  const [keyword, setKeyword] = useState("");
  const [minScore, setMinScore] = useState(0);
  const [workplace, setWorkplace] = useState("");
  const [applyType, setApplyType] = useState("");

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const jobsPerPage = 10;

  // Accordion expanded card IDs
  const [expandedCardIds, setExpandedCardIds] = useState<string[]>([]);

  // Local loading states for buttons
  const [tailoringJobId, setTailoringJobId] = useState<string | null>(null);

  // Compare Modal State
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [compareData, setCompareData] = useState({
    title: "",
    original: null as any,
    tailored: null as any
  });

  // Reset filters
  const resetFilters = () => {
    setKeyword("");
    setMinScore(0);
    setWorkplace("");
    setApplyType("");
    setCurrentPage(1);
  };

  // Toggle Accordion Card
  const toggleAccordion = (jobId: string) => {
    if (expandedCardIds.includes(jobId)) {
      setExpandedCardIds(expandedCardIds.filter((id) => id !== jobId));
    } else {
      setExpandedCardIds([...expandedCardIds, jobId]);
    }
  };

  // Trigger tailor resume
  const handleTailorResume = async (jobId: string) => {
    setTailoringJobId(jobId);
    showToast("Generating tailored resume...", "success");
    try {
      const res = await fetch(`/api/jobs/${jobId}/tailor`, { method: "POST" });
      if (!res.ok) throw new Error("Resume tailoring failed.");
      const data = await res.json();
      if (data.status === "success") {
        showToast("Resume tailored and ATS audited successfully!", "success");
        await loadJobs();
      } else {
        throw new Error(data.message || "Unknown error occurred.");
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Failed to tailor resume.", "error");
    } finally {
      setTailoringJobId(null);
    }
  };

  // Compare resume diff
  const handleCompareResume = async (jobId: string, jobTitle: string, company: string) => {
    showToast("Loading comparison details...", "success");
    try {
      // 1. Fetch original
      const origRes = await fetch("/api/resume/original");
      if (!origRes.ok) throw new Error("Failed to load original resume.");
      const original = await origRes.json();

      // 2. Fetch tailored
      const tailRes = await fetch(`/api/jobs/${jobId}/tailored_data`);
      if (!tailRes.ok) throw new Error("Failed to load tailored data.");
      const tailored = await tailRes.json();

      setCompareData({
        title: `${jobTitle} at ${company}`,
        original,
        tailored
      });
      setCompareModalOpen(true);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Failed to fetch difference matrix.", "error");
    }
  };

  // Trigger Apply
  const handleApply = async (jobId: string, jobTitle: string) => {
    setApplyingJobId(jobId);
    showToast(`Launching application script for: ${jobTitle}`, "success");
    try {
      const res = await fetch(`/api/jobs/${jobId}/apply`, { method: "POST" });
      if (!res.ok) throw new Error("Apply request failed.");
      const data = await res.json();
      if (data.status === "started") {
        setLogs(`[System] Initializing auto-apply routine for '${jobTitle}'...\n`);
        setActiveTask(`apply-${jobId}`);
        showToast("Automated application process running in background.", "success");
      } else {
        showToast(data.message || "Already applied or error.", "warning");
        setApplyingJobId(null);
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Apply trigger failed.", "error");
      setApplyingJobId(null);
      setActiveTask(null);
    }
  };

  // Filters application
  const filteredJobs = jobs.filter((job) => {
    if (keyword) {
      const haystack = [
        job.title || "",
        job.company || "",
        (job.skills || []).join(" "),
        job.description || ""
      ].join(" ").toLowerCase();
      if (!haystack.includes(keyword.toLowerCase().trim())) return false;
    }
    if (minScore > 0 && (job.compatibility || 0) < minScore) return false;
    if (workplace && job.workplace_type !== workplace) return false;
    if (applyType && (job.apply_type || "Easy Apply") !== applyType) return false;
    return true;
  });

  // Calculate pagination
  const totalPages = Math.ceil(filteredJobs.length / jobsPerPage) || 1;
  const activePage = Math.max(1, Math.min(currentPage, totalPages));
  const startIndex = (activePage - 1) * jobsPerPage;
  const paginatedJobs = filteredJobs.slice(startIndex, startIndex + jobsPerPage);

  const appliedJobsCount = jobs.filter((j) => j.applied).length;

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header Card */}
      <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            Active Scans
            {jobs.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 font-bold rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
                Applied: {appliedJobsCount} / {jobs.length}
              </span>
            )}
          </h3>
          <p className="text-[11px] text-zinc-550 mt-1">
            Aggregate listings from boards and review their compatibility matrix
          </p>
        </div>
        <button
          onClick={triggerJobScan}
          disabled={isScanning}
          id="scan-jobs-btn"
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-[0_0_15px_rgba(99,102,241,0.35)] transition"
        >
          {isScanning ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Scanning Portals...
            </>
          ) : (
            <>
              <span>🔍</span>
              Scan Job Boards
            </>
          )}
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-4 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            🎚️ Filter Results
          </span>

          <div className="flex-1 min-w-[200px] relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search title, company, skill..."
              className="w-full bg-zinc-950 border border-zinc-850 hover:border-zinc-800 focus:border-indigo-500 text-xs px-3 py-2 pl-9 rounded-lg outline-none text-zinc-200 transition"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[10px] text-zinc-400 font-semibold uppercase">Min Score</label>
            <select
              value={minScore}
              onChange={(e) => {
                setMinScore(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-zinc-950 border border-zinc-850 hover:border-zinc-800 text-xs px-3 py-2 rounded-lg outline-none text-zinc-300 cursor-pointer"
            >
              <option value="0">All</option>
              <option value="60">60%+</option>
              <option value="70">70%+</option>
              <option value="80">80%+</option>
              <option value="90">90%+</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[10px] text-zinc-400 font-semibold uppercase">Workplace</label>
            <select
              value={workplace}
              onChange={(e) => {
                setWorkplace(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-zinc-950 border border-zinc-850 hover:border-zinc-800 text-xs px-3 py-2 rounded-lg outline-none text-zinc-300 cursor-pointer"
            >
              <option value="">All</option>
              <option value="Remote">Remote</option>
              <option value="Hybrid">Hybrid</option>
              <option value="On-site">On-site</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[10px] text-zinc-400 font-semibold uppercase">Apply Type</label>
            <select
              value={applyType}
              onChange={(e) => {
                setApplyType(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-zinc-950 border border-zinc-850 hover:border-zinc-800 text-xs px-3 py-2 rounded-lg outline-none text-zinc-300 cursor-pointer"
            >
              <option value="">All</option>
              <option value="Easy Apply">⚡ Easy Apply</option>
              <option value="Manual Intervention">🛠️ Manual</option>
            </select>
          </div>

          <button
            onClick={resetFilters}
            className="px-3 py-2 text-xs font-semibold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg cursor-pointer transition duration-200"
          >
            ✕ Clear
          </button>
        </div>
      </div>

      {/* Loading state during crawl */}
      {isScanning && jobs.length === 0 && (
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-12 flex flex-col items-center justify-center text-center">
          <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
            <Loader2 className="animate-spin text-amber-500" size={20} />
          </div>
          <p className="text-sm text-zinc-400 font-medium">
            Running web crawls and matching job descriptions against your resume...
          </p>
        </div>
      )}

      {/* Jobs Grid Container */}
      <div className="flex flex-col gap-4">
        {paginatedJobs.length > 0 ? (
          paginatedJobs.map((job) => {
            const isEasyApply = (job.apply_type || "Easy Apply") === "Easy Apply";
            const isExpanded = expandedCardIds.includes(job.id);
            const isTailored = !!job.tailored_pdf_path;

            return (
              <div
                key={job.id}
                className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 hover:border-zinc-700/80 transition-all duration-200 flex flex-col gap-4"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  {/* Metadata Header */}
                  <div className="flex-1 flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold text-zinc-500 tracking-wider">
                      <span className="text-zinc-300 font-bold">{job.company}</span>
                      <span>•</span>
                      <span>{job.location}</span>
                      <span>•</span>
                      <span>{job.workplace_type}</span>
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          isEasyApply
                            ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                            : "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                        }`}
                      >
                        {isEasyApply ? "⚡ Easy Apply" : "🛠️ Manual"}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-white mt-1 hover:text-indigo-400 transition">
                      {job.url ? (
                        <a href={job.url} target="_blank" rel="noopener noreferrer">
                          {job.title}
                        </a>
                      ) : (
                        job.title
                      )}
                    </h4>

                    <p className="text-xs text-zinc-450 mt-1 line-clamp-2 leading-relaxed">
                      {job.description}
                    </p>
                  </div>

                  {/* Compatibility Badge / Right Action Row */}
                  <div className="flex flex-col md:items-end justify-between self-stretch gap-4 md:min-w-[170px]">
                    <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-850 px-3 py-1.5 rounded-xl self-start md:self-auto shadow-inner">
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">
                        Score
                      </span>
                      <span
                        className={`text-xs font-black ${
                          job.compatibility >= 80
                            ? "text-emerald-400"
                            : job.compatibility >= 60
                            ? "text-amber-400"
                            : "text-zinc-400"
                        }`}
                      >
                        {job.compatibility}%
                      </span>
                    </div>

                    {/* Quick Action Buttons */}
                    <div className="flex flex-col gap-2 w-full">
                      {/* Tailor state buttons */}
                      {isTailored ? (
                        <div className="grid grid-cols-3 gap-1.5 w-full">
                          <button
                            onClick={() => window.open(`/api/jobs/${job.id}/tailor/view`, "_blank")}
                            title="View tailored PDF"
                            className="flex items-center justify-center p-2 bg-zinc-950 border border-zinc-850 hover:border-zinc-700 hover:bg-zinc-900 rounded-lg text-zinc-400 hover:text-white cursor-pointer transition text-xs font-semibold"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={() => handleCompareResume(job.id, job.title, job.company)}
                            title="Compare original vs tailored details"
                            className="flex items-center justify-center p-2 bg-zinc-950 border border-zinc-850 hover:border-zinc-700 hover:bg-zinc-900 rounded-lg text-zinc-400 hover:text-white cursor-pointer transition text-xs font-semibold"
                          >
                            <Scale size={14} />
                          </button>
                          <button
                            onClick={() => (window.location.href = `/api/jobs/${job.id}/tailor/download`)}
                            title="Download tailored PDF"
                            className="flex items-center justify-center p-2 bg-zinc-950 border border-zinc-850 hover:border-zinc-700 hover:bg-zinc-900 rounded-lg text-zinc-400 hover:text-white cursor-pointer transition text-xs font-semibold"
                          >
                            <Download size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleTailorResume(job.id)}
                          disabled={tailoringJobId === job.id}
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-zinc-950 border border-zinc-850 hover:border-zinc-750 hover:bg-zinc-900 disabled:opacity-50 text-white rounded-lg text-xs font-semibold cursor-pointer transition"
                        >
                          {tailoringJobId === job.id ? (
                            <Loader2 size={13} className="animate-spin text-indigo-400" />
                          ) : (
                            <Sparkles size={13} className="text-indigo-400" />
                          )}
                          Tailor Resume
                        </button>
                      )}

                      {/* Apply button state */}
                      {job.applied ? (
                        <div className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-bold select-none">
                          <Check size={14} />
                          Applied
                        </div>
                      ) : (
                        <button
                          onClick={() => handleApply(job.id, job.title)}
                          disabled={applyingJobId === job.id}
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold cursor-pointer transition"
                        >
                          {applyingJobId === job.id ? (
                            <Loader2 size={13} className="animate-spin text-white" />
                          ) : (
                            <span>{isEasyApply ? "🚀" : "🛠️"}</span>
                          )}
                          {isEasyApply ? "Auto Apply" : "Manual Apply"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Accordion Expand Link */}
                <div className="border-t border-zinc-900/50 pt-3 flex flex-col gap-2">
                  <button
                    onClick={() => toggleAccordion(job.id)}
                    className="flex justify-between items-center text-[10px] font-semibold text-zinc-500 hover:text-zinc-300 transition cursor-pointer select-none"
                  >
                    <span>View Full Description & Details</span>
                    <span>{isExpanded ? "▲" : "▼"}</span>
                  </button>

                  {isExpanded && (
                    <div className="flex flex-col gap-4 mt-2 text-xs leading-relaxed text-zinc-400 bg-zinc-950/20 p-4 border border-zinc-900/60 rounded-xl">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-3 border-b border-zinc-900/40">
                        <div>
                          <strong>Role Title:</strong> {job.title}
                        </div>
                        <div>
                          <strong>Company:</strong> {job.company}
                        </div>
                        <div>
                          <strong>Location:</strong> {job.location} ({job.workplace_type})
                        </div>
                        <div>
                          <strong>Apply Type:</strong> {job.apply_type || "Easy Apply"}
                        </div>
                        <div className="md:col-span-2">
                          <strong>Skills Match:</strong>{" "}
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {job.skills && job.skills.length > 0 ? (
                              job.skills.map((skill: string) => (
                                <span
                                  key={skill}
                                  className="px-2 py-0.5 text-[10px] rounded bg-zinc-900 border border-zinc-800 text-zinc-400 font-medium"
                                >
                                  {skill}
                                </span>
                              ))
                            ) : (
                              <span className="text-zinc-600 italic text-[11px]">None</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div>
                        <strong>Full Job Description:</strong>
                        <p className="mt-2 whitespace-pre-line text-zinc-400 font-sans leading-relaxed text-xs">
                          {job.description}
                        </p>
                      </div>

                      {/* ATS Optimization Audit block */}
                      {job.ats_audit && (
                        <div className="border-t border-zinc-900/50 pt-4 flex flex-col gap-3">
                          <strong className="text-white flex items-center gap-1.5">
                            <span>✨</span> ATS Optimization Audit
                          </strong>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
                            {/* Matched Keywords */}
                            <div>
                              <span className="text-[10px] uppercase font-bold text-emerald-500 tracking-wider block mb-2">
                                Matched Keywords
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {job.ats_audit.matched_keywords &&
                                job.ats_audit.matched_keywords.length > 0 ? (
                                  job.ats_audit.matched_keywords.map((kw: string) => (
                                    <span
                                      key={kw}
                                      className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                                    >
                                      {kw}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-zinc-650 italic text-[11px]">None</span>
                                )}
                              </div>
                            </div>

                            {/* Missing Keywords */}
                            <div>
                              <span className="text-[10px] uppercase font-bold text-rose-500 tracking-wider block mb-2">
                                Missing Keywords
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {job.ats_audit.missing_keywords &&
                                job.ats_audit.missing_keywords.length > 0 ? (
                                  job.ats_audit.missing_keywords.map((kw: string) => (
                                    <span
                                      key={kw}
                                      className="px-2 py-0.5 rounded text-[10px] font-medium bg-rose-500/10 border border-rose-500/20 text-rose-450"
                                    >
                                      {kw}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-zinc-650 italic text-[11px]">None</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Recommendations */}
                          {job.ats_audit.recommendations &&
                            job.ats_audit.recommendations.length > 0 && (
                              <div className="mt-2">
                                <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider block mb-2">
                                  Recommendations
                                </span>
                                <ul className="list-disc pl-4 space-y-1 text-zinc-450 text-[11px]">
                                  {job.ats_audit.recommendations.map((rec: string, idx: number) => (
                                    <li key={idx}>{rec}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-12 flex flex-col items-center justify-center text-center text-zinc-550">
            <span className="text-4xl mb-4">💼</span>
            <h3 className="font-bold text-sm text-zinc-300">No Jobs Found</h3>
            <p className="text-xs text-zinc-500 mt-1 max-w-[320px] mx-auto leading-relaxed">
              Your filter parameters returned 0 results. Try resetting filters or clicking "Scan Job Boards" to load new jobs.
            </p>
          </div>
        )}
      </div>

      {/* Pagination Footer Controls */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-6 py-4 flex-shrink-0">
          <button
            onClick={() => setCurrentPage(activePage - 1)}
            disabled={activePage === 1}
            className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 disabled:opacity-30 disabled:hover:border-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-semibold cursor-pointer transition select-none"
          >
            <ChevronLeft size={14} />
            Previous
          </button>
          <span className="text-xs text-zinc-500 font-medium font-mono">
            Page {activePage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(activePage + 1)}
            disabled={activePage === totalPages}
            className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 disabled:opacity-30 disabled:hover:border-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-semibold cursor-pointer transition select-none"
          >
            Next
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Comparison Diff Modal */}
      <CompareModal
        isOpen={compareModalOpen}
        onClose={() => setCompareModalOpen(false)}
        title={compareData.title}
        original={compareData.original}
        tailored={compareData.tailored}
      />
    </div>
  );
}
