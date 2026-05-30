import React from "react";
import { X } from "lucide-react";
import { highlightTextDiff, highlightSkillsDiff } from "../utils/diff";

interface CompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  original: any;
  tailored: any;
}

export default function CompareModal({ isOpen, onClose, title, original, tailored }: CompareModalProps) {
  if (!isOpen || !original || !tailored) return null;

  const renderComparisonSection = (sectionName: string, origVal: any, tailVal: any) => {
    if (sectionName === "name" || sectionName === "contact") return null;

    let origHtml = "";
    let tailHtml = "";

    if (typeof origVal === "string") {
      const diff = highlightTextDiff(origVal, typeof tailVal === "string" ? tailVal : "");
      origHtml = diff.origHtml;
      tailHtml = diff.tailHtml;
    } else if (origVal && typeof origVal === "object" && !Array.isArray(origVal)) {
      // Nested dictionary (like skills)
      const subkeys = Object.keys(origVal);
      subkeys.forEach((sub) => {
        const sOrig = origVal[sub] || "";
        const sTail = (tailVal && typeof tailVal === "object") ? (tailVal[sub] || "") : "";
        const diff = highlightSkillsDiff(String(sOrig), String(sTail));
        origHtml += `<div class="mb-3"><strong>${sub}:</strong><br><span class="text-xs text-zinc-400">${diff.origHtml}</span></div>`;
        tailHtml += `<div class="mb-3"><strong>${sub}:</strong><br><span class="text-xs text-zinc-300">${diff.tailHtml}</span></div>`;
      });
    } else if (Array.isArray(origVal)) {
      const tailArr = Array.isArray(tailVal) ? tailVal : [];
      const maxLen = Math.max(origVal.length, tailArr.length);

      for (let idx = 0; idx < maxLen; idx++) {
        const oItem = origVal[idx];
        const tItem = tailArr[idx];

        if (typeof oItem === "string" || typeof tItem === "string") {
          const diff = highlightTextDiff(String(oItem || ""), String(tItem || ""));
          origHtml += `<div class="mb-1 text-xs text-zinc-400">• ${diff.origHtml}</div>`;
          tailHtml += `<div class="mb-1 text-xs text-zinc-300">• ${diff.tailHtml}</div>`;
        } else if ((oItem && typeof oItem === "object") || (tItem && typeof tItem === "object")) {
          // Experience / Education items
          const oItemSafe = oItem || {};
          const tItemSafe = tItem || {};

          const roleKey = Object.keys(oItemSafe).find((k) => ["role", "degree", "title"].includes(k.toLowerCase())) || "role";
          const compKey = Object.keys(oItemSafe).find((k) => ["company", "institution", "school"].includes(k.toLowerCase())) || "company";
          const dateKey = Object.keys(oItemSafe).find((k) => ["dates", "dates_active"].includes(k.toLowerCase())) || "dates";
          const bulletKey = Object.keys(oItemSafe).find((k) => ["bullets", "details", "achievements"].includes(k.toLowerCase())) || "bullets";

          const roleDiff = highlightTextDiff(oItemSafe[roleKey] || "", tItemSafe[roleKey] || "");
          const companyDiff = highlightTextDiff(oItemSafe[compKey] || "", tItemSafe[compKey] || "");
          const datesDiff = highlightTextDiff(oItemSafe[dateKey] || "", tItemSafe[dateKey] || "");

          let bulletsOrig = "";
          let bulletsTail = "";

          const oBullets = oItemSafe[bulletKey];
          const tBullets = tItemSafe[bulletKey];

          if (Array.isArray(oBullets) || Array.isArray(tBullets)) {
            const oBArr = Array.isArray(oBullets) ? oBullets : [];
            const tBArr = Array.isArray(tBullets) ? tBullets : [];
            const maxBullets = Math.max(oBArr.length, tBArr.length);

            for (let bIdx = 0; bIdx < maxBullets; bIdx++) {
              const diff = highlightTextDiff(oBArr[bIdx] || "", tBArr[bIdx] || "");
              if (oBArr[bIdx]) bulletsOrig += `<li class="ml-4 list-disc mb-1 text-[11.5px] text-zinc-450">${diff.origHtml}</li>`;
              if (tBArr[bIdx]) bulletsTail += `<li class="ml-4 list-disc mb-1 text-[11.5px] text-zinc-350">${diff.tailHtml}</li>`;
            }
          } else {
            const diff = highlightTextDiff(String(oBullets || ""), String(tBullets || ""));
            bulletsOrig = `<p class="text-xs text-zinc-400 pl-2 border-l border-zinc-800">${diff.origHtml}</p>`;
            bulletsTail = `<p class="text-xs text-zinc-300 pl-2 border-l border-zinc-700">${diff.tailHtml}</p>`;
          }

          origHtml += `
            <div class="mb-4 pb-4 border-b border-zinc-900/50">
              <div class="font-semibold text-xs text-zinc-300 mb-1">
                ${roleDiff.origHtml} — <span class="text-indigo-400">${companyDiff.origHtml}</span>
              </div>
              <div class="text-[10px] text-zinc-500 mb-2">${datesDiff.origHtml}</div>
              <ul class="space-y-1">${bulletsOrig}</ul>
            </div>
          `;

          tailHtml += `
            <div class="mb-4 pb-4 border-b border-zinc-900/50">
              <div class="font-semibold text-xs text-zinc-200 mb-1">
                ${roleDiff.tailHtml} — <span class="text-indigo-400">${companyDiff.tailHtml}</span>
              </div>
              <div class="text-[10px] text-zinc-500 mb-2">${datesDiff.tailHtml}</div>
              <ul class="space-y-1">${bulletsTail}</ul>
            </div>
          `;
        }
      }
    }

    return (
      <div key={sectionName} className="border border-zinc-800 bg-zinc-900/10 rounded-xl overflow-hidden mb-4">
        <div className="bg-zinc-900/40 px-4 py-2 border-b border-zinc-800 font-semibold text-xs uppercase tracking-wider text-zinc-450 font-display">
          {sectionName}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-zinc-800">
          <div className="p-4 bg-zinc-950/20 text-xs overflow-y-auto max-h-[350px]">
            <div dangerouslySetInnerHTML={{ __html: origHtml || '<span class="text-zinc-600 italic">No original content</span>' }} />
          </div>
          <div className="p-4 bg-zinc-950/40 text-xs overflow-y-auto max-h-[350px]">
            <div dangerouslySetInnerHTML={{ __html: tailHtml || '<span class="text-zinc-650 italic">No tailored content</span>' }} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="relative w-full max-w-6xl h-[85vh] bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-850 flex justify-between items-center bg-zinc-900/30">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>⚖️</span> Resume Comparison Diff
            </h3>
            <p className="text-[11px] text-zinc-450 mt-0.5">{title}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white cursor-pointer hover:bg-zinc-800 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Labels bar */}
        <div className="grid grid-cols-1 md:grid-cols-2 divide-x divide-zinc-800 border-b border-zinc-850 bg-zinc-950/60 font-semibold text-[10px] uppercase tracking-wider text-zinc-500 select-none">
          <div className="px-6 py-2 text-left">Original Resume Info</div>
          <div className="px-6 py-2 text-left">ATS Tailored Copy</div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-zinc-950/40">
          {Object.keys(original).map((key) => renderComparisonSection(key, original[key], tailored[key]))}
        </div>
      </div>
    </div>
  );
}
