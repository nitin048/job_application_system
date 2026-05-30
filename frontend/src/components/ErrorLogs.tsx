import React, { useState, useEffect } from "react";
import { Trash2, AlertOctagon, Terminal, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

interface ErrorLogsProps {
  showToast: (msg: string, type: "success" | "error" | "warning") => void;
}

export default function ErrorLogs({ showToast }: ErrorLogsProps) {
  const [errors, setErrors] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedIndices, setExpandedIndices] = useState<number[]>([]);

  const fetchErrors = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/errors");
      if (!res.ok) throw new Error("Could not fetch error logs.");
      const data = await res.json();
      setErrors(data.errors || []);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Failed to load error logs.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const clearErrors = async () => {
    if (!confirm("Are you sure you want to delete all runtime error logs?")) return;

    try {
      const res = await fetch("/api/errors", { method: "DELETE" });
      if (!res.ok) throw new Error("Could not clear logs.");
      showToast("Error logs database cleared successfully.", "success");
      setErrors([]);
      setExpandedIndices([]);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Failed to clear error logs.", "error");
    }
  };

  useEffect(() => {
    fetchErrors();
  }, []);

  const toggleExpand = (idx: number) => {
    if (expandedIndices.includes(idx)) {
      setExpandedIndices(expandedIndices.filter((i) => i !== idx));
    } else {
      setExpandedIndices([...expandedIndices, idx]);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header Card */}
      <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <AlertOctagon size={16} className="text-rose-500" />
            Runtime Logs & Exception Tracking
          </h3>
          <p className="text-[11px] text-zinc-550 mt-1">
            Logs all unhandled backend crashes and uncaught frontend script exceptions in real-time.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={fetchErrors}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 disabled:opacity-50 text-xs font-semibold text-zinc-350 hover:text-white rounded-lg cursor-pointer transition select-none"
          >
            <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
            Reload
          </button>
          {errors.length > 0 && (
            <button
              onClick={clearErrors}
              className="flex items-center gap-1.5 px-4 py-2 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500 text-xs font-semibold text-rose-400 hover:text-white rounded-lg cursor-pointer transition select-none"
            >
              <Trash2 size={13} />
              Clear Logs Database
            </button>
          )}
        </div>
      </div>

      {/* Main logs display list */}
      <div className="flex flex-col gap-4">
        {isLoading && errors.length === 0 ? (
          <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-12 flex flex-col items-center justify-center text-center">
            <RefreshCw className="animate-spin text-indigo-400 mb-3" size={24} />
            <span className="text-xs text-zinc-500 font-semibold">Fetching runtime exceptions...</span>
          </div>
        ) : errors.length === 0 ? (
          <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-12 flex flex-col items-center justify-center text-center text-zinc-550">
            <span className="text-4xl mb-4">💚</span>
            <h3 className="font-bold text-sm text-zinc-300">Clean Slate</h3>
            <p className="text-xs text-zinc-500 mt-1 max-w-[280px] mx-auto leading-relaxed">
              No unhandled runtime crashes or JS runtime errors have occurred in this session.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {errors.map((error, idx) => {
              const isExpanded = expandedIndices.includes(idx);
              const isBackend = error.category === "backend";

              return (
                <div
                  key={idx}
                  className="bg-zinc-900/40 border border-zinc-800/80 hover:border-zinc-700/80 rounded-xl overflow-hidden transition-all duration-200"
                >
                  {/* Summary Bar */}
                  <div
                    onClick={() => toggleExpand(idx)}
                    className="p-4 flex items-center justify-between gap-4 cursor-pointer select-none bg-zinc-950/20 hover:bg-zinc-900/20 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`text-[9px] px-2 py-0.5 font-black uppercase tracking-wider rounded-full border ${
                          isBackend
                            ? "bg-indigo-500/10 border-indigo-500/25 text-indigo-400"
                            : "bg-purple-500/10 border-purple-500/25 text-purple-400"
                        }`}
                      >
                        {error.category}
                      </span>
                      <span className="text-xs text-zinc-500 font-mono font-semibold whitespace-nowrap">
                        {error.timestamp}
                      </span>
                      <span className="text-xs text-rose-350 font-bold truncate max-w-[250px] md:max-w-md lg:max-w-xl">
                        {error.message}
                      </span>
                    </div>

                    <div className="text-zinc-500 hover:text-zinc-300 transition">
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>

                  {/* Expanded Traceback Detail */}
                  {isExpanded && (
                    <div className="p-4 border-t border-zinc-850/40 bg-zinc-950/40 font-mono text-[10.5px] leading-relaxed text-zinc-300">
                      <div className="flex items-center gap-1.5 text-zinc-500 mb-2 border-b border-zinc-900 pb-2">
                        <Terminal size={12} />
                        <span>Execution Traceback / Error Details:</span>
                      </div>
                      <pre className="overflow-x-auto whitespace-pre-wrap select-text text-zinc-300 max-h-[350px]">
                        {error.details || "No traceback details provided."}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
