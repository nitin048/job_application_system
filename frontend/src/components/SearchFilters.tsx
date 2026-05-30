import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

const POPULAR_POSITIONS = [
  "Software Engineer",
  "Full Stack Developer",
  "Backend Engineer",
  "Frontend Engineer",
  "DevOps Engineer",
  "Data Scientist",
  "AI Engineer",
  "QA Engineer",
  "Solutions Architect",
  "Python Developer",
  "React Developer"
];

const POPULAR_LOCATIONS = [
  "Remote",
  "Pune",
  "Mumbai",
  "Bangalore",
  "Delhi",
  "Hyderabad",
  "London",
  "New York",
  "San Francisco"
];

const POPULAR_SKILLS = [
  "React",
  "TypeScript",
  "JavaScript",
  "Python",
  "Node.js",
  "AWS",
  "C#",
  ".NET Core",
  "Docker",
  "PostgreSQL",
  "SQL Server",
  "Go",
  "Kubernetes",
  "Microservices",
  "Git",
  "Java"
];

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

  const [positionsText, setPositionsText] = useState((sp.positions || []).join(", "));
  const [locationsText, setLocationsText] = useState((sp.locations || []).join(", "));
  const [skillsText, setSkillsText] = useState((sp.candidate_skills || []).join(", "));
  const [companyBlacklistText, setCompanyBlacklistText] = useState((sp.companyBlacklist || []).join(", "));
  const [titleBlacklistText, setTitleBlacklistText] = useState((sp.titleBlacklist || []).join(", "));

  // Suggestion focus states
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Sync from props only when fields are not active/focused
  useEffect(() => {
    if (document.activeElement?.id !== "positions-input") {
      setPositionsText((sp.positions || []).join(", "));
    }
  }, [sp.positions]);

  useEffect(() => {
    if (document.activeElement?.id !== "locations-input") {
      setLocationsText((sp.locations || []).join(", "));
    }
  }, [sp.locations]);

  useEffect(() => {
    if (document.activeElement?.id !== "skills-input") {
      setSkillsText((sp.candidate_skills || []).join(", "));
    }
  }, [sp.candidate_skills]);

  useEffect(() => {
    if (document.activeElement?.id !== "company-blacklist-input") {
      setCompanyBlacklistText((sp.companyBlacklist || []).join(", "));
    }
  }, [sp.companyBlacklist]);

  useEffect(() => {
    if (document.activeElement?.id !== "title-blacklist-input") {
      setTitleBlacklistText((sp.titleBlacklist || []).join(", "));
    }
  }, [sp.titleBlacklist]);

  const handleInputChange = (field: string, textVal: string, setter: (val: string) => void, configKey: string) => {
    setter(textVal);
    const list = textVal.split(",").map((v) => v.trim()).filter((v) => v !== "");
    updateSearchParameters(configKey, list);
  };

  const getFilteredSuggestions = (inputText: string, popularList: string[]) => {
    const parts = inputText.split(",");
    const lastPart = parts[parts.length - 1].trim().toLowerCase();
    if (!lastPart) return popularList;
    return popularList.filter(item => item.toLowerCase().includes(lastPart));
  };

  const selectSuggestion = (field: string, suggestion: string) => {
    let currentText = "";
    let setter: any = null;
    let configKey = "";

    if (field === "positions") {
      currentText = positionsText;
      setter = setPositionsText;
      configKey = "positions";
    } else if (field === "locations") {
      currentText = locationsText;
      setter = setLocationsText;
      configKey = "locations";
    } else if (field === "skills") {
      currentText = skillsText;
      setter = setSkillsText;
      configKey = "candidate_skills";
    }

    if (!setter) return;

    // Replace the last typed token with the selected suggestion
    const parts = currentText.split(",");
    if (parts.length > 0) {
      parts[parts.length - 1] = suggestion;
    } else {
      parts.push(suggestion);
    }

    const items = parts.map(p => p.trim()).filter(p => p !== "");
    const uniqueItems = Array.from(new Set(items));
    const newText = uniqueItems.join(", ");
    
    setter(newText);
    updateSearchParameters(configKey, uniqueItems);
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
      const sessionConfig = sessionStorage.getItem("aegis_flow_config");
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };
      if (sessionConfig) {
        headers["X-Session-Config"] = sessionConfig;
      }

      const res = await fetch("/api/resume/scan-filters", {
        method: "POST",
        headers
      });
      if (!res.ok) {
        let errMsg = "Resume filter extraction failed.";
        try {
          const errData = await res.json();
          if (errData && errData.detail) {
            errMsg = errData.detail;
          }
        } catch (_) {}
        throw new Error(errMsg);
      }
      
      const resData = await res.json();
      showToast("Successfully updated filters from resume parsing! Please click 'Save Settings' to save.", "success");
      
      // Update form state parameters
      const updatedConfig = {
        ...formData,
        searches: {
          ...formData.searches,
          search_parameters: {
            ...sp,
            positions: resData.positions || sp.positions || [],
            candidate_skills: resData.candidate_skills || sp.candidate_skills || [],
            candidate_experience_years: resData.candidate_experience_years !== undefined ? resData.candidate_experience_years : sp.candidate_experience_years
          }
        }
      };

      // Explicitly update local string inputs for instant feedback
      if (resData.positions) {
        setPositionsText(resData.positions.join(", "));
      }
      if (resData.candidate_skills) {
        setSkillsText(resData.candidate_skills.join(", "));
      }

      onChange(updatedConfig);
      sessionStorage.setItem("aegis_flow_config", JSON.stringify(updatedConfig));
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
        <div className="flex flex-col gap-1.5 md:col-span-2 relative">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Target Job Titles (Comma Separated)
          </label>
          <input
            id="positions-input"
            type="text"
            value={positionsText}
            onChange={(e) => handleInputChange("positions", e.target.value, setPositionsText, "positions")}
            onFocus={() => setFocusedField("positions")}
            onBlur={() => setTimeout(() => setFocusedField(null), 200)}
            placeholder="e.g. Software Engineer, Full Stack Developer, Data Scientist"
            className="w-full bg-zinc-950 border border-zinc-850 focus:border-indigo-500 text-xs px-3 py-2.5 rounded-lg outline-none text-zinc-200 transition"
          />
          {focusedField === "positions" && (
            <div className="absolute top-[68px] left-0 right-0 z-50 max-h-48 overflow-y-auto backdrop-blur-md bg-zinc-950/95 border border-zinc-800 rounded-xl shadow-2xl p-2.5 flex flex-wrap gap-2 animate-[fadeIn_0.15s_ease-out]">
              <span className="text-[9px] text-zinc-500 w-full px-1.5 py-0.5 font-bold uppercase tracking-wider">Popular Job Titles:</span>
              {getFilteredSuggestions(positionsText, POPULAR_POSITIONS).map((pos) => (
                <button
                  key={pos}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectSuggestion("positions", pos);
                  }}
                  className="px-2.5 py-1.5 bg-zinc-900/60 hover:bg-indigo-600 border border-zinc-800 hover:border-indigo-500 rounded-lg text-[10px] font-semibold text-zinc-300 hover:text-white cursor-pointer transition duration-150"
                >
                  + {pos}
                </button>
              ))}
            </div>
          )}
          <small className="text-[10px] text-zinc-650">
            Job positions to scan. Separate multiple values with commas.
          </small>
        </div>

        <div className="flex flex-col gap-1.5 relative">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Locations (Comma Separated)
          </label>
          <input
            id="locations-input"
            type="text"
            value={locationsText}
            onChange={(e) => handleInputChange("locations", e.target.value, setLocationsText, "locations")}
            onFocus={() => setFocusedField("locations")}
            onBlur={() => setTimeout(() => setFocusedField(null), 200)}
            placeholder="e.g. Remote, London, New York"
            className="w-full bg-zinc-950 border border-zinc-850 focus:border-indigo-500 text-xs px-3 py-2.5 rounded-lg outline-none text-zinc-200 transition"
          />
          {focusedField === "locations" && (
            <div className="absolute top-[68px] left-0 right-0 z-50 max-h-48 overflow-y-auto backdrop-blur-md bg-zinc-950/95 border border-zinc-800 rounded-xl shadow-2xl p-2.5 flex flex-wrap gap-2 animate-[fadeIn_0.15s_ease-out]">
              <span className="text-[9px] text-zinc-500 w-full px-1.5 py-0.5 font-bold uppercase tracking-wider">Popular Locations:</span>
              {getFilteredSuggestions(locationsText, POPULAR_LOCATIONS).map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectSuggestion("locations", loc);
                  }}
                  className="px-2.5 py-1.5 bg-zinc-900/60 hover:bg-indigo-600 border border-zinc-800 hover:border-indigo-500 rounded-lg text-[10px] font-semibold text-zinc-300 hover:text-white cursor-pointer transition duration-150"
                >
                  + {loc}
                </button>
              ))}
            </div>
          )}
          <small className="text-[10px] text-zinc-650">
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

        <div className="flex flex-col gap-1.5 relative">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Candidate Technical Skills (Comma Separated)
          </label>
          <input
            id="skills-input"
            type="text"
            value={skillsText}
            onChange={(e) => handleInputChange("skills", e.target.value, setSkillsText, "candidate_skills")}
            onFocus={() => setFocusedField("skills")}
            onBlur={() => setTimeout(() => setFocusedField(null), 200)}
            placeholder="e.g. C#, .NET Core, React, TypeScript, AWS, SQL Server"
            className="w-full bg-zinc-950 border border-zinc-850 focus:border-indigo-500 text-xs px-3 py-2.5 rounded-lg outline-none text-zinc-200 transition"
          />
          {focusedField === "skills" && (
            <div className="absolute top-[68px] left-0 right-0 z-50 max-h-48 overflow-y-auto backdrop-blur-md bg-zinc-950/95 border border-zinc-800 rounded-xl shadow-2xl p-2.5 flex flex-wrap gap-2 animate-[fadeIn_0.15s_ease-out]">
              <span className="text-[9px] text-zinc-500 w-full px-1.5 py-0.5 font-bold uppercase tracking-wider">Popular Technical Skills:</span>
              {getFilteredSuggestions(skillsText, POPULAR_SKILLS).map((skill) => (
                <button
                  key={skill}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectSuggestion("skills", skill);
                  }}
                  className="px-2.5 py-1.5 bg-zinc-900/60 hover:bg-indigo-600 border border-zinc-800 hover:border-indigo-500 rounded-lg text-[10px] font-semibold text-zinc-300 hover:text-white cursor-pointer transition duration-150"
                >
                  + {skill}
                </button>
              ))}
            </div>
          )}
          <small className="text-[10px] text-zinc-650">Your primary skills list.</small>
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-1 bg-zinc-950/20 p-4 border border-zinc-850 rounded-xl">
            {[
              { id: "linkedin", label: "LinkedIn Jobs" },
              { id: "instahyre", label: "Instahyre" },
              { id: "cutshort", label: "Cutshort" },
              { id: "wellfound", label: "Wellfound (AngelList)" },
              { id: "hirist", label: "Hirist.tech" },
              { id: "naukri", label: "Naukri.com" },
              { id: "indeed", label: "Indeed India" },
              { id: "foundit", label: "Foundit (Monster)" },
              { id: "shine", label: "Shine.com" },
              { id: "timesjobs", label: "TimesJobs" },
              { id: "glassdoor", label: "Glassdoor Jobs" }
            ].map((portal) => (
              <div key={portal.id} className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  id={`portal-${portal.id}`}
                  checked={sp.target_portals?.[portal.id] !== false}
                  onChange={(e) =>
                    updateSearchParameters("target_portals", {
                      ...sp.target_portals,
                      [portal.id]: e.target.checked
                    })
                  }
                  className="w-4 h-4 bg-zinc-950 border-zinc-850 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor={`portal-${portal.id}`} className="text-xs text-zinc-350 cursor-pointer select-none">
                  {portal.label}
                </label>
              </div>
            ))}
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
            id="company-blacklist-input"
            type="text"
            value={companyBlacklistText}
            onChange={(e) => handleInputChange("companyBlacklist", e.target.value, setCompanyBlacklistText, "companyBlacklist")}
            placeholder="e.g. Unwanted Corporation X, Staffing Agency Inc"
            className="w-full bg-zinc-950 border border-zinc-850 focus:border-indigo-500 text-xs px-3 py-2.5 rounded-lg outline-none text-zinc-200 transition"
          />
          <small className="text-[10px] text-zinc-650">
            Avoid applying to these companies under any circumstances.
          </small>
        </div>

        <div className="flex flex-col gap-1.5 md:col-span-2">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Title Exclusions Blacklist (Comma Separated)
          </label>
          <input
            id="title-blacklist-input"
            type="text"
            value={titleBlacklistText}
            onChange={(e) => handleInputChange("titleBlacklist", e.target.value, setTitleBlacklistText, "titleBlacklist")}
            placeholder="e.g. Sales, Manager, Director"
            className="w-full bg-zinc-950 border border-zinc-850 focus:border-indigo-500 text-xs px-3 py-2.5 rounded-lg outline-none text-zinc-200 transition"
          />
          <small className="text-[10px] text-zinc-650">
            Discard jobs containing these keywords in their title.
          </small>
        </div>
      </div>
    </div>
  );
}
