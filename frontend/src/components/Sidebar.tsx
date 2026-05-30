import React from "react";
import {
  Home,
  Sliders,
  Briefcase,
  FileText,
  Search,
  User,
  Scale,
  KeyRound,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Info
} from "lucide-react";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  isScanning: boolean;
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
  isScanning
}: SidebarProps) {
  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: Home },
    { id: "control-center", label: "Control Center", icon: Sliders },
    { id: "jobs", label: "Discovered Jobs", icon: Briefcase },
    { id: "resume-hub", label: "Resume Hub", icon: FileText },
    { id: "search", label: "1. Search Filters", icon: Search },
    { id: "identity", label: "2. Profile Details", icon: User },
    { id: "compliance", label: "3. Legal & EEO", icon: Scale },
    { id: "credentials", label: "4. Secrets & Keys", icon: KeyRound },
    { id: "errors", label: "Runtime Logs", icon: AlertTriangle },
    { id: "about", label: "About", icon: Info },
  ];

  return (
    <>
      {/* Mobile Menu Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar navigation */}
      <aside
        className={`fixed top-0 bottom-0 left-0 bg-zinc-950/95 border-r border-zinc-800/80 z-[1000] flex flex-col p-4 transition-all duration-300 lg:sticky lg:translate-x-0 ${
          collapsed ? "w-20" : "w-64"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Desktop Collapse Button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex absolute top-1/2 -right-4 -translate-y-1/2 w-8 h-8 rounded-full border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white items-center justify-center cursor-pointer shadow-lg hover:scale-105 transition"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* Logo Section */}
        <div className="flex items-center justify-between mb-8 px-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.4)] flex-shrink-0">
              <div className="w-4 h-4 rounded-sm bg-white/30" />
            </div>
            {!collapsed && (
              <div className="overflow-hidden whitespace-nowrap">
                <h2 className="font-semibold text-white tracking-tight text-sm font-display">Aegis Flow</h2>
                <span className="text-[10px] text-zinc-500 font-medium">AI Application Client</span>
              </div>
            )}
          </div>
          {/* Mobile Close Button */}
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden text-zinc-400 hover:text-white p-1"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav Menu */}
        <nav className="flex-1 flex flex-col gap-1.5 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileOpen(false);
                }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "bg-indigo-600/10 text-indigo-400 border-l-2 border-indigo-500 font-medium shadow-[inset_10px_0_20px_-10px_rgba(99,102,241,0.15)]"
                    : "text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200"
                } ${collapsed ? "justify-center" : ""}`}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={18} className="flex-shrink-0" />
                {!collapsed && <span className="text-xs truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="pt-4 border-t border-zinc-800/80 mt-auto">
          <div className={`flex items-center gap-3 ${collapsed ? "justify-center" : "px-2"}`}>
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isScanning ? "bg-amber-500 shadow-[0_0_10px_#f59e0b] animate-pulse" : "bg-emerald-500 shadow-[0_0_10px_#10b981]"
              }`}
            />
            {!collapsed && (
              <span className="text-xs text-zinc-400 font-medium">
                {isScanning ? "Job Scan Running" : "Server Connected"}
              </span>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
