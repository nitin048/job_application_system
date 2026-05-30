import React from "react";

interface LegalEeoProps {
  formData: any;
  onChange: (data: any) => void;
}

export default function LegalEeo({ formData, onChange }: LegalEeoProps) {
  const compliance = formData?.searches?.compliance_preferences || {};

  const handleComplianceChange = (field: string, val: string) => {
    onChange({
      ...formData,
      searches: {
        ...formData.searches,
        compliance_preferences: {
          ...compliance,
          [field]: val
        }
      }
    });
  };

  return (
    <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6 flex flex-col gap-6">
      <div className="border-b border-zinc-850 pb-4">
        <h3 className="text-sm font-bold text-white">Waivers & Questionnaire Compliance</h3>
        <p className="text-[11px] text-zinc-550 mt-0.5">
          Define automatic selections for legal compliance checkboxes and eligibility criteria.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-505">
            Are you open to remote arrangements?
          </label>
          <select
            value={compliance.remote_work || "Yes"}
            onChange={(e) => handleComplianceChange("remote_work", e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-855 text-xs px-3 py-2.5 rounded-lg outline-none text-zinc-300 cursor-pointer"
          >
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-505">
            Are you open to in-person/office attendance?
          </label>
          <select
            value={compliance.in_person_work || "No"}
            onChange={(e) => handleComplianceChange("in_person_work", e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-855 text-xs px-3 py-2.5 rounded-lg outline-none text-zinc-300 cursor-pointer"
          >
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-505">
            Are you open to relocation?
          </label>
          <select
            value={compliance.open_to_relocation || "No"}
            onChange={(e) => handleComplianceChange("open_to_relocation", e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-855 text-xs px-3 py-2.5 rounded-lg outline-none text-zinc-300 cursor-pointer"
          >
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-505">
            Desired Relocation Destinations
          </label>
          <input
            type="text"
            value={compliance.relocation_destinations || ""}
            onChange={(e) => handleComplianceChange("relocation_destinations", e.target.value)}
            placeholder="e.g. London, UK, Europe, Pune"
            className="w-full bg-zinc-950 border border-zinc-855 focus:border-indigo-500 text-xs px-3 py-2.5 rounded-lg outline-none text-zinc-200 transition"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-505">
            Are you willing to take skills assessments?
          </label>
          <select
            value={compliance.willing_to_complete_assessments || "Yes"}
            onChange={(e) => handleComplianceChange("willing_to_complete_assessments", e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-855 text-xs px-3 py-2.5 rounded-lg outline-none text-zinc-300 cursor-pointer"
          >
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-505">
            Are you willing to undergo drug tests?
          </label>
          <select
            value={compliance.willing_to_undergo_drug_tests || "No"}
            onChange={(e) => handleComplianceChange("willing_to_undergo_drug_tests", e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-855 text-xs px-3 py-2.5 rounded-lg outline-none text-zinc-300 cursor-pointer"
          >
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-505">
            Do you authorize background screening?
          </label>
          <select
            value={compliance.willing_to_undergo_background_checks || "Yes"}
            onChange={(e) => handleComplianceChange("willing_to_undergo_background_checks", e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-855 text-xs px-3 py-2.5 rounded-lg outline-none text-zinc-300 cursor-pointer"
          >
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        </div>
      </div>
    </div>
  );
}
