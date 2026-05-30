import React, { useState } from "react";
import { Loader2 } from "lucide-react";

interface SearchFiltersProps {
  formData: any;
  onChange: (data: any) => void;
  showToast: (msg: string, type: "success" | "error" | "warning") => void;
  loadConfig: () => Promise<void>;
}

export default function SearchFilters({
  formData,
  onChange,
  showToast,
  loadConfig
}: SearchFiltersProps) {
  const [isScanningFilters, setIsScanningFilters] = useState(false);

  const sp = formData?.searches?.search_parameters || {};

  const handleTextChange = (field: string, val: string) => {
    const list = val.split(",").map((v) => v.trim()).filter((v) => v !== "");
    updateSearchParameters(field, list);
  };

  const updateSearchParameters = (field: string, val: any) => {
    onChange({
      ...formData,
      searches: {
        ...formData.searches,
        search_parameters: {
          ...sp,
          [field]: val
        }
      }
    });
  };

  const handleAutoScanFilters = async () => {
    setIsScanningFilters(true);
    showToast("Analyzing resume to extract target filters...", "success");
    try {
      const res = await fetch("/api/resume/scan-filters", { method: "POST" });
      if (!res.ok) throw new Error("Resume filter extraction failed.");
      showToast("Successfully updated filters from resume parsing!", "success");
      await loadConfig();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Failed to scan resume filters.", "error");
    } finally {
      setIsScanningFilters(false);
    }
  };

  return (
    <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6 flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-850 pb-4">
        <div>
          <h3 className="text-sm font-bold text-white">Search Scope & Targets</h3>
          <p className="text-[11px] text-zinc-550 mt-0.5">
            Manage queries used by matching engines to poll portal postings.
          </p>
        </div>
        <button
          type="button"
          onClick={handleAutoScanFilters}
          disabled={isScanningFilters}
          className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 disabled:opacity-50 text-xs font-semibold text-zinc-300 hover:text-white rounded-lg cursor-pointer transition"
        >
          {isScanningFilters ? (
            <Loader2 size={13} className="animate-spin text-indigo-400" />
          ) : (
            <span>📄</span>
          )}
          Auto-Scan Resume for Filters
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="flex flex-col gap-1.5 md:col-span-2">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Target Job Titles (Comma Separated)
          </label>
          <input
            type="text"
            value={(sp.positions || []).join(", ")}
            onChange={(e) => handleTextChange("positions", e.target.value)}
            placeholder="e.g. Software Engineer, Full Stack Developer, Data Scientist"
            className="w-full bg-zinc-950 border border-zinc-850 focus:border-indigo-500 text-xs px-3 py-2.5 rounded-lg outline-none text-zinc-200 transition"
          />
          <small className="text-[10px] text-zinc-600">
            Job positions to scan. Separate multiple values with commas.
          </small>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Locations (Comma Separated)
          </label>
          <input
            type="text"
            value={(sp.locations || []).join(", ")}
            onChange={(e) => handleTextChange("locations", e.target.value)}
            placeholder="e.g. Remote, London, New York"
            className="w-full bg-zinc-950 border border-zinc-850 focus:border-indigo-500 text-xs px-3 py-2.5 rounded-lg outline-none text-zinc-200 transition"
          />
          <small className="text-[10px] text-zinc-600">
            Locations to check. Use "Remote" for offsite positions.
          </small>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Radius limit (miles)
          </label>
          <select
            value={sp.distance !== null && sp.distance !== undefined ? sp.distance : ""}
            onChange={(e) =>
              updateSearchParameters(
                "distance",
                e.target.value === "" ? null : Number(e.target.value)
              )
            }
            className="w-full bg-zinc-950 border border-zinc-850 text-xs px-3 py-2.5 rounded-lg outline-none text-zinc-300 cursor-pointer"
          >
            <option value="">Optional (Any Distance)</option>
            <option value="5">5 miles</option>
            <option value="10">10 miles</option>
            <option value="15">15 miles</option>
            <option value="25">25 miles</option>
            <option value="50">50 miles</option>
            <option value="100">100 miles</option>
            <option value="250">250 miles</option>
            <option value="500">500 miles</option>
          </select>
          <small className="text-[10px] text-zinc-600">Distance limit for onsite/hybrid listings.</small>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Candidate Years of Experience
          </label>
          <select
            value={
              sp.candidate_experience_years !== null && sp.candidate_experience_years !== undefined
                ? sp.candidate_experience_years
                : ""
            }
            onChange={(e) =>
              updateSearchParameters(
                "candidate_experience_years",
                e.target.value === "" ? null : Number(e.target.value)
              )
            }
            className="w-full bg-zinc-950 border border-zinc-850 text-xs px-3 py-2.5 rounded-lg outline-none text-zinc-300 cursor-pointer"
          >
            <option value="">Optional (Any Experience)</option>
            <option value="0">Entry Level (0 years)</option>
            <option value="1">1 year</option>
            <option value="2">2 years</option>
            <option value="3">3 years</option>
            <option value="4">4 years</option>
            <option value="5">5 years</option>
            <option value="6">6 years</option>
            <option value="7">7 years</option>
            <option value="8">8 years</option>
            <option value="9">9 years</option>
            <option value="10">10+ years</option>
            <option value="12">12+ years</option>
            <option value="15">15+ years</option>
            <option value="20">20+ years</option>
          </select>
          <small className="text-[10px] text-zinc-600">
            Used for precise matching against job requirements. Auto-parsed from resume.
          </small>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Candidate Technical Skills (Comma Separated)
          </label>
          <input
            type="text"
            value={(sp.candidate_skills || []).join(", ")}
            onChange={(e) => handleTextChange("candidate_skills", e.target.value)}
            placeholder="e.g. C#, .NET Core, React, TypeScript, AWS, SQL Server"
            className="w-full bg-zinc-950 border border-zinc-850 focus:border-indigo-500 text-xs px-3 py-2.5 rounded-lg outline-none text-zinc-200 transition"
          />
          <small className="text-[10px] text-zinc-600">Your primary skills list.</small>
        </div>

        <div className="flex items-center gap-3 pt-2 md:pt-4">
          <input
            type="checkbox"
            id="search-remote"
            checked={!!sp.remote}
            onChange={(e) => updateSearchParameters("remote", e.target.checked)}
            className="w-4 h-4 bg-zinc-950 border-zinc-850 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          />
          <label htmlFor="search-remote" className="text-xs text-zinc-350 cursor-pointer">
            Filter for Remote-only Listings
          </label>
        </div>

         <div className="flex items-center gap-3 pt-2 md:pt-4">
          <input
            type="checkbox"
            id="search-apply-once"
            checked={!!sp.apply_once_at_company}
            onChange={(e) => updateSearchParameters("apply_once_at_company", e.target.checked)}
            className="w-4 h-4 bg-zinc-950 border-zinc-850 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          />
          <label htmlFor="search-apply-once" className="text-xs text-zinc-350 cursor-pointer">
            Avoid duplicate company applications
          </label>
        </div>

        <div className="flex flex-col gap-2.5 md:col-span-2 border-t border-zinc-850 pt-4">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Target Portals & Platforms
          </label>
          <div className="flex flex-wrap gap-6 mt-1">
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                id="portal-naukri"
                checked={sp.target_portals?.naukri !== false}
                onChange={(e) =>
                  updateSearchParameters("target_portals", {
                    ...sp.target_portals,
                    naukri: e.target.checked
                  })
                }
                className="w-4 h-4 bg-zinc-950 border-zinc-850 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <label htmlFor="portal-naukri" className="text-xs text-zinc-350 cursor-pointer">
                Naukri
              </label>
            </div>

            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                id="portal-linkedin"
                checked={sp.target_portals?.linkedin !== false}
                onChange={(e) =>
                  updateSearchParameters("target_portals", {
                    ...sp.target_portals,
                    linkedin: e.target.checked
                  })
                }
                className="w-4 h-4 bg-zinc-950 border-zinc-850 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <label htmlFor="portal-linkedin" className="text-xs text-zinc-350 cursor-pointer">
                LinkedIn
              </label>
            </div>

            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                id="portal-indeed"
                checked={sp.target_portals?.indeed !== false}
                onChange={(e) =>
                  updateSearchParameters("target_portals", {
                    ...sp.target_portals,
                    indeed: e.target.checked
                  })
                }
                className="w-4 h-4 bg-zinc-950 border-zinc-850 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <label htmlFor="portal-indeed" className="text-xs text-zinc-350 cursor-pointer">
                Indeed
              </label>
            </div>
          </div>
          <small className="text-[10px] text-zinc-650">
            Select the platforms to scan in parallel when running job discovery checks.
          </small>
        </div>

        <div className="flex flex-col gap-1.5 md:col-span-2">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Company Exclusion Blacklist (Comma Separated)
          </label>
          <input
            type="text"
            value={(sp.companyBlacklist || []).join(", ")}
            onChange={(e) => handleTextChange("companyBlacklist", e.target.value)}
            placeholder="e.g. Unwanted Corporation X, Staffing Agency Inc"
            className="w-full bg-zinc-950 border border-zinc-850 focus:border-indigo-500 text-xs px-3 py-2.5 rounded-lg outline-none text-zinc-200 transition"
          />
          <small className="text-[10px] text-zinc-600">
            Avoid applying to these companies under any circumstances.
          </small>
        </div>

        <div className="flex flex-col gap-1.5 md:col-span-2">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Title Exclusions Blacklist (Comma Separated)
          </label>
          <input
            type="text"
            value={(sp.titleBlacklist || []).join(", ")}
            onChange={(e) => handleTextChange("titleBlacklist", e.target.value)}
            placeholder="e.g. Sales, Manager, Director"
            className="w-full bg-zinc-950 border border-zinc-850 focus:border-indigo-500 text-xs px-3 py-2.5 rounded-lg outline-none text-zinc-200 transition"
          />
          <small className="text-[10px] text-zinc-600">
            Discard jobs containing these keywords in their title.
          </small>
        </div>
      </div>
    </div>
  );
}
