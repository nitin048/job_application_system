import React from "react";

interface ProfileDetailsProps {
  formData: any;
  onChange: (data: any) => void;
}

export default function ProfileDetails({ formData, onChange }: ProfileDetailsProps) {
  const identity = formData?.searches?.candidate_identity || {};
  const personal = identity.personal_details || {};
  const demographics = identity.demographics || {};

  const handlePersonalChange = (field: string, val: string) => {
    onChange({
      ...formData,
      searches: {
        ...formData.searches,
        candidate_identity: {
          ...identity,
          personal_details: {
            ...personal,
            [field]: val
          }
        }
      }
    });
  };

  const handleDemographicChange = (field: string, val: string) => {
    onChange({
      ...formData,
      searches: {
        ...formData.searches,
        candidate_identity: {
          ...identity,
          demographics: {
            ...demographics,
            [field]: val
          }
        }
      }
    });
  };

  return (
    <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6 flex flex-col gap-6">
      <div className="border-b border-zinc-850 pb-4">
        <h3 className="text-sm font-bold text-white">Personal Profile Details</h3>
        <p className="text-[11px] text-zinc-550 mt-0.5">
          Personal contact credentials used by form fillers to complete submission inputs.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-505">
            First Name
          </label>
          <input
            type="text"
            value={personal.first_name || ""}
            onChange={(e) => handlePersonalChange("first_name", e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-855 focus:border-indigo-500 text-xs px-3 py-2.5 rounded-lg outline-none text-zinc-200 transition"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-505">
            Last Name
          </label>
          <input
            type="text"
            value={personal.last_name || ""}
            onChange={(e) => handlePersonalChange("last_name", e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-855 focus:border-indigo-500 text-xs px-3 py-2.5 rounded-lg outline-none text-zinc-200 transition"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-505">
            Personal Email Address
          </label>
          <input
            type="email"
            value={personal.email || ""}
            onChange={(e) => handlePersonalChange("email", e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-855 focus:border-indigo-500 text-xs px-3 py-2.5 rounded-lg outline-none text-zinc-200 transition"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-505">
            Contact Mobile Number (with country code)
          </label>
          <input
            type="text"
            value={personal.phone || ""}
            onChange={(e) => handlePersonalChange("phone", e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-855 focus:border-indigo-500 text-xs px-3 py-2.5 rounded-lg outline-none text-zinc-200 transition"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-505">
            Gender Identity
          </label>
          <input
            type="text"
            value={demographics.gender || ""}
            onChange={(e) => handleDemographicChange("gender", e.target.value)}
            placeholder="e.g. Male, Female, Non-binary"
            className="w-full bg-zinc-950 border border-zinc-855 focus:border-indigo-500 text-xs px-3 py-2.5 rounded-lg outline-none text-zinc-200 transition"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-505">
            Pronouns
          </label>
          <input
            type="text"
            value={demographics.pronouns || ""}
            onChange={(e) => handleDemographicChange("pronouns", e.target.value)}
            placeholder="e.g. They/Them, He/Him, She/Her"
            className="w-full bg-zinc-950 border border-zinc-855 focus:border-indigo-500 text-xs px-3 py-2.5 rounded-lg outline-none text-zinc-200 transition"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-505">
            Race / Ethnic Declaration
          </label>
          <input
            type="text"
            value={demographics.ethnicity || ""}
            onChange={(e) => handleDemographicChange("ethnicity", e.target.value)}
            placeholder="e.g. Declined to State"
            className="w-full bg-zinc-950 border border-zinc-855 focus:border-indigo-500 text-xs px-3 py-2.5 rounded-lg outline-none text-zinc-200 transition"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-505">
            Veteran Declaration
          </label>
          <select
            value={demographics.veteran_status || "No"}
            onChange={(e) => handleDemographicChange("veteran_status", e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-855 text-xs px-3 py-2.5 rounded-lg outline-none text-zinc-300 cursor-pointer"
          >
            <option value="No">No</option>
            <option value="Yes">Yes</option>
            <option value="Declined to State">Declined to State</option>
          </select>
        </div>
      </div>
    </div>
  );
}
