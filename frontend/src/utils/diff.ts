export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

export interface DiffResult {
  origHtml: string;
  tailHtml: string;
}

export function highlightTextDiff(origStr: string, tailStr: string): DiffResult {
  if (!origStr) return { origHtml: "", tailHtml: escapeHtml(tailStr || "") };
  if (!tailStr) return { origHtml: escapeHtml(origStr || ""), tailHtml: "" };

  const origWords = origStr.split(/\s+/);
  const tailWords = tailStr.split(/\s+/);

  const clean = (w: string) => w.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");

  const origSet = new Set(origWords.map(clean));
  const tailSet = new Set(tailWords.map(clean));

  const origHtml = origWords
    .map((word) => {
      const cleanWord = clean(word);
      if (!tailSet.has(cleanWord) && cleanWord.length > 2) {
        return `<span class="bg-rose-500/20 text-rose-300 px-1 rounded line-through border border-rose-500/20">${escapeHtml(word)}</span>`;
      }
      return escapeHtml(word);
    })
    .join(" ");

  const tailHtml = tailWords
    .map((word) => {
      const cleanWord = clean(word);
      if (!origSet.has(cleanWord) && cleanWord.length > 2) {
        return `<span class="bg-emerald-500/20 text-emerald-300 px-1 rounded font-medium border border-emerald-500/20">${escapeHtml(word)}</span>`;
      }
      return escapeHtml(word);
    })
    .join(" ");

  return { origHtml, tailHtml };
}

export function highlightSkillsDiff(origSkillsStr: string, tailSkillsStr: string): DiffResult {
  if (!origSkillsStr) return { origHtml: "", tailHtml: escapeHtml(tailSkillsStr || "") };
  if (!tailSkillsStr) return { origHtml: escapeHtml(origSkillsStr || ""), tailHtml: "" };

  const origSkills = origSkillsStr.split(",").map((s) => s.trim());
  const tailSkills = tailSkillsStr.split(",").map((s) => s.trim());

  const origClean = new Set(origSkills.map((s) => s.toLowerCase()));
  const tailClean = new Set(tailSkills.map((s) => s.toLowerCase()));

  const origHtml = origSkills
    .map((skill) => {
      if (!tailClean.has(skill.toLowerCase())) {
        return `<span class="bg-rose-500/20 text-rose-300 px-1 rounded line-through border border-rose-500/20">${escapeHtml(skill)}</span>`;
      }
      return escapeHtml(skill);
    })
    .join(", ");

  const tailHtml = tailSkills
    .map((skill) => {
      if (!origClean.has(skill.toLowerCase())) {
        return `<span class="bg-emerald-500/20 text-emerald-300 px-1 rounded font-medium border border-emerald-500/20">${escapeHtml(skill)}</span>`;
      }
      return escapeHtml(skill);
    })
    .join(", ");

  return { origHtml, tailHtml };
}
