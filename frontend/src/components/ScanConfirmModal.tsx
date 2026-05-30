import React from "react";
import { X, AlertTriangle, Key, FileText, RefreshCw, LogIn } from "lucide-react";

interface PendingItem {
  type: "credentials" | "resume" | "gemini" | "gdrive";
  label: string;
  description: string;
}

interface ScanConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onNavigateToSettings: () => void;
  pendingItems: PendingItem[];
}

export default function ScanConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  onNavigateToSettings,
  pendingItems
}: ScanConfirmModalProps) {
  if (!isOpen) return null;

  const getIcon = (type: PendingItem["type"]) => {
    switch (type) {
      case "credentials":
        return <LogIn className="text-amber-400 w-4 h-4" />;
      case "resume":
        return <FileText className="text-amber-400 w-4 h-4" />;
      case "gemini":
        return <Key className="text-amber-400 w-4 h-4" />;
      case "gdrive":
        return <RefreshCw className="text-amber-400 w-4 h-4" />;
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-850 flex justify-between items-center bg-zinc-900/30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                Scan Warnings & Prerequisites
              </h3>
              <p className="text-[11px] text-zinc-550 mt-0.5">
                Some recommended configurations are pending.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white cursor-pointer hover:bg-zinc-800 transition"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 max-h-[50vh]">
          <p className="text-xs text-zinc-400 leading-relaxed">
            The job board scanner is ready to run. However, the following optional settings are currently unconfigured or pending:
          </p>

          <div className="flex flex-col gap-3">
            {pendingItems.map((item, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-3 bg-zinc-900/40 border border-zinc-850/80 rounded-xl hover:border-zinc-800/80 transition duration-150"
              >
                <div className="mt-0.5 p-1.5 rounded-lg bg-zinc-950 border border-zinc-850">
                  {getIcon(item.type)}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-semibold text-zinc-200">{item.label}</h4>
                  <p className="text-[10px] text-zinc-500 mt-0.5 leading-normal">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-850 bg-zinc-900/10 flex justify-end gap-3">
          <button
            onClick={onNavigateToSettings}
            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-xs font-semibold text-zinc-350 hover:text-white rounded-xl transition cursor-pointer select-none"
          >
            Configure Settings
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white rounded-xl shadow-[0_0_15px_rgba(99,102,241,0.25)] transition cursor-pointer select-none"
          >
            Start Scan Anyway
          </button>
        </div>
      </div>
    </div>
  );
}
