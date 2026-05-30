import React, { useState, useEffect } from "react";
import { UploadCloud, Mail, Sparkles, Scale, Download, Eye, Trash2, Loader2, Send } from "lucide-react";
import CompareModal from "./CompareModal";

interface ResumeHubProps {
  showToast: (msg: string, type: "success" | "error" | "warning") => void;
}

export default function ResumeHub({ showToast }: ResumeHubProps) {
  // Hub states
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeFilename, setResumeFilename] = useState("");
  const [uploadedResumeData, setUploadedResumeData] = useState<any | null>(null);
  const [jobUrl, setJobUrl] = useState("");
  const [isCrawling, setIsCrawling] = useState(false);
  const [crawlerStatus, setCrawlerStatus] = useState("Launching browser session...");
  const [isAuditing, setIsAuditing] = useState(false);
  const [atsScorecard, setAtsScorecard] = useState<any | null>(null);
  const [tailoredFiles, setTailoredFiles] = useState<any[]>([]);

  // Email state
  const [activeEmailFile, setActiveEmailFile] = useState<any | null>(null);
  const [emailForm, setEmailForm] = useState({
    toEmail: "",
    subject: "",
    body: ""
  });
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Compare Modal State
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [compareData, setCompareData] = useState({
    title: "",
    original: null as any,
    tailored: null as any
  });

  // Load tailored files list
  const loadTailoredFiles = async () => {
    try {
      const res = await fetch("/api/resume-hub/files");
      if (!res.ok) throw new Error("Could not retrieve tailored files.");
      const data = await res.json();
      setTailoredFiles(data.files || []);
    } catch (err) {
      console.error("Hub files list load error: ", err);
    }
  };

  useEffect(() => {
    loadTailoredFiles();
  }, []);

  // Upload Resume handler
  const handleResumeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setResumeFile(file);
    setResumeFilename(file.name);

    const formData = new FormData();
    formData.append("file", file);

    showToast("Uploading resume file to hub...", "success");
    try {
      const res = await fetch("/api/resume-hub/upload", {
        method: "POST",
        body: formData
      });
      if (!res.ok) throw new Error("File upload failed.");
      const data = await res.json();
      setUploadedResumeData(data.structured_data);
      showToast("Resume successfully uploaded to hub workspace!", "success");
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Failed to upload file.", "error");
    }
  };

  const clearUploadedResume = () => {
    setResumeFile(null);
    setResumeFilename("");
    setUploadedResumeData(null);
  };

  // Crawl and Tailor handler
  const handleCrawlAndTailor = async () => {
    if (!resumeFilename || !uploadedResumeData) {
      showToast("Please upload a resume PDF or DOCX first.", "warning");
      return;
    }
    if (!jobUrl) {
      showToast("Please enter a job description URL first.", "warning");
      return;
    }

    setIsCrawling(true);
    setCrawlerStatus("Spinning up browser driver...");
    setAtsScorecard(null);

    try {
      // 1. Crawl URL
      setCrawlerStatus("Crawling job posting details...");
      const crawlRes = await fetch("/api/resume-hub/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: jobUrl })
      });
      if (!crawlRes.ok) throw new Error("Could not crawl job listing portal.");
      const jobDetails = await crawlRes.json();

      // 2. Tailor Resume
      setCrawlerStatus("AI tailoring and matching resume contents...");
      const tailorRes = await fetch("/api/resume-hub/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: resumeFilename,
          job_title: jobDetails.title || "Target Role",
          job_company: jobDetails.company || "Target Company",
          job_description: jobDetails.description || "",
          resume_data: uploadedResumeData
        })
      });
      if (!tailorRes.ok) throw new Error("Failed to match resume contents.");
      const auditResult = await tailorRes.json();

      setAtsScorecard({
        ...auditResult,
        filename: resumeFilename,
        job_title: jobDetails.title || "Target Role",
        company: jobDetails.company || "Target Company"
      });
      showToast("Resume tailored successfully!", "success");
      loadTailoredFiles();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Failed to match resume details.", "error");
    } finally {
      setIsCrawling(false);
    }
  };

  // Analyze ATS handler
  const handleAnalyzeAts = async () => {
    if (!resumeFilename || !uploadedResumeData) {
      showToast("Please upload a resume PDF or DOCX first.", "warning");
      return;
    }

    setIsAuditing(true);
    setAtsScorecard(null);

    try {
      let jobDetails = {
        title: "",
        company: "",
        description: ""
      };

      if (jobUrl) {
        // 1. Crawl URL if provided
        const crawlRes = await fetch("/api/resume-hub/crawl", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: jobUrl })
        });
        if (!crawlRes.ok) throw new Error("Failed to crawl listing details.");
        jobDetails = await crawlRes.json();
      }

      // 2. Analyze
      const analyzeRes = await fetch("/api/resume-hub/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_title: jobDetails.title || "",
          job_company: jobDetails.company || "",
          job_description: jobDetails.description || "",
          resume_data: uploadedResumeData
        })
      });
      const auditData = await analyzeRes.json();

      setAtsScorecard({
        ...auditData,
        filename: resumeFilename,
        job_title: jobUrl ? (jobDetails.title || "Target Role") : "General ATS Critique",
        company: jobUrl ? (jobDetails.company || "Target Company") : "Baseline Audit"
      });
      showToast("ATS audit completed!", "success");
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "ATS audit failed.", "error");
    } finally {
      setIsAuditing(false);
    }
  };

  // Delete tailored file
  const handleDeleteFile = async (filePath: string, company: string) => {
    if (!confirm(`Are you sure you want to delete the tailored resume for ${company}?`)) return;

    try {
      const res = await fetch("/api/resume-hub/files", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: filePath })
      });
      if (!res.ok) throw new Error("File deletion failed.");
      showToast(`Cleaned up tailored copy for ${company}`, "success");
      loadTailoredFiles();
      if (activeEmailFile?.path === filePath) {
        setActiveEmailFile(null);
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Failed to remove file.", "error");
    }
  };

  // Click comparison diff
  const handleCompareFile = async (filePath: string, company: string) => {
    showToast("Loading comparison details...", "success");
    try {
      // 1. Fetch original
      const origRes = await fetch(`/api/resume-hub/original_data?path=${encodeURIComponent(filePath)}`);
      if (!origRes.ok) throw new Error("Failed to load original resume.");
      const original = await origRes.json();

      // 2. Fetch tailored from path
      const tailRes = await fetch(`/api/resume-hub/tailored_data?path=${encodeURIComponent(filePath)}`);
      if (!tailRes.ok) throw new Error("Failed to load tailored data.");
      const tailored = await tailRes.json();

      setCompareData({
        title: `Tailored Resume for ${company}`,
        original,
        tailored
      });
      setCompareModalOpen(true);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Failed to fetch difference matrix.", "error");
    }
  };

  // Trigger send email
  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEmailFile) return;

    setIsSendingEmail(true);
    showToast("Decrypting server keys and sending email...", "success");

    try {
      const res = await fetch("/api/resume-hub/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to_email: emailForm.toEmail,
          subject: emailForm.subject,
          body: emailForm.body,
          attachment_path: activeEmailFile.path
        })
      });
      if (!res.ok) throw new Error("Failed to deliver email message.");
      showToast("Email successfully sent with tailored resume!", "success");
      setEmailForm({ toEmail: "", subject: "", body: "" });
      setActiveEmailFile(null);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Email delivery failed.", "error");
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Title Card */}
      <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          📄 Resume Hub
        </h3>
        <p className="text-[11px] text-zinc-550 mt-1">
          Upload any PDF/DOCX resume, match it to any job URL, audit your ATS score, and email the tailored result.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Side: Upload & Crawl */}
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 flex flex-col gap-5">
          <h4 className="text-xs uppercase font-bold text-zinc-400 tracking-wider">
            1. Upload Original Resume
          </h4>

          {/* Upload Zone */}
          <div className="border-2 border-dashed border-zinc-800 hover:border-indigo-500/50 hover:bg-zinc-900/10 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition relative">
            <input
              type="file"
              accept=".pdf,.docx"
              onChange={handleResumeChange}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <UploadCloud size={32} className="text-zinc-500 mb-2" />
            <strong className="text-xs text-white block">Click to upload Resume PDF or DOCX</strong>
            <span className="text-[10px] text-zinc-550 block mt-1">or drag & drop here · PDF / DOCX only</span>
          </div>

          {resumeFilename && (
            <div className="flex items-center justify-between bg-zinc-950/60 border border-zinc-850 rounded-lg p-3">
              <span className="text-xs font-semibold text-zinc-300 truncate max-w-[200px]">
                {resumeFilename}
              </span>
              <button
                onClick={clearUploadedResume}
                className="text-[10px] px-2.5 py-1 text-rose-400 hover:text-white bg-rose-500/5 hover:bg-rose-500/15 border border-rose-500/15 rounded transition"
              >
                ✕ Remove
              </button>
            </div>
          )}

          <div className="border-t border-zinc-850 pt-5 mt-2 flex flex-col gap-4">
            <h4 className="text-xs uppercase font-bold text-zinc-400 tracking-wider">
              2. Job Details &amp; ATS Audit
            </h4>
            <div className="flex flex-col gap-3">
              <input
                type="text"
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
                placeholder="Paste job portal listing URL (Naukri, LinkedIn, etc.)"
                className="w-full bg-zinc-950 border border-zinc-850 focus:border-indigo-500 text-xs px-3 py-2.5 rounded-lg outline-none text-zinc-200 transition"
              />
              <button
                type="button"
                onClick={handleCrawlAndTailor}
                disabled={isCrawling || isAuditing}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold cursor-pointer transition shadow-[0_0_15px_rgba(99,102,241,0.2)]"
              >
                {isCrawling ? <Loader2 size={13} className="animate-spin text-white" /> : <span>✨</span>}
                Tailor &amp; Match (New)
              </button>
            </div>

            {isCrawling && (
              <div className="flex items-center gap-2 bg-zinc-950/40 p-3 border border-zinc-850/50 rounded-lg">
                <Loader2 size={12} className="animate-spin text-amber-500" />
                <span className="text-[11px] text-zinc-500 font-medium">{crawlerStatus}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: ATS Compatibility Scorecard */}
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 flex flex-col justify-center min-h-[300px]">
          {!atsScorecard && !isCrawling && !isAuditing ? (
            <div className="flex flex-col items-center gap-3 text-center py-8">
              <span className="text-4xl">📊</span>
              <h3 className="font-bold text-sm text-zinc-300">ATS Compatibility Audit</h3>
              <p className="text-[11.5px] text-zinc-550 max-w-[280px] mx-auto leading-relaxed">
                Upload a resume and click below to run a general ATS audit, or paste a job URL on the left to tailor it!
              </p>
              <button
                onClick={handleAnalyzeAts}
                disabled={isCrawling || isAuditing}
                className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white rounded-lg text-xs font-semibold cursor-pointer transition flex items-center gap-1.5"
              >
                {isAuditing ? <Loader2 size={13} className="animate-spin" /> : <span>📊</span>}
                Analyze ATS
              </button>
            </div>
          ) : (isAuditing ? (
            <div className="flex flex-col items-center justify-center text-center py-12">
              <Loader2 className="animate-spin text-indigo-400 mb-3" size={24} />
              <span className="text-xs text-zinc-500 font-medium">Running ATS scoring check...</span>
            </div>
          ) : atsScorecard && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-zinc-850 pb-4">
                <div>
                  <h3 className="font-bold text-sm text-white truncate max-w-[200px]">
                    {atsScorecard.job_title || atsScorecard.filename || "General Audit"}
                  </h3>
                  <p className="text-[10px] text-indigo-400 font-bold mt-0.5">
                    {atsScorecard.company || "ATS Scorecard"}
                  </p>
                </div>

                <div className="flex gap-4">
                  {/* Original Score */}
                  {atsScorecard.original_ats_audit && (
                    <div className="flex flex-col items-center">
                      <span className="text-[8px] text-zinc-500 uppercase tracking-wider mb-1 font-bold">
                        Original
                      </span>
                      <div className="w-11 h-11 rounded-full bg-zinc-950 border border-zinc-850 flex items-center justify-center text-xs font-black text-zinc-400">
                        {atsScorecard.original_ats_audit.score}%
                      </div>
                    </div>
                  )}
                  {/* Tailored/Final Score */}
                  <div className="flex flex-col items-center">
                    <span className="text-[8px] text-zinc-500 uppercase tracking-wider mb-1 font-bold">
                      {atsScorecard.original_ats_audit ? "Tailored" : "Score"}
                    </span>
                    <div className="w-11 h-11 rounded-full bg-indigo-500/10 border border-indigo-500/40 flex items-center justify-center text-xs font-black text-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.15)]">
                      {atsScorecard.ats_audit?.score || atsScorecard.score}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Keyword Badges */}
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                <div>
                  <span className="text-[9px] uppercase font-bold text-emerald-500 tracking-wider block mb-1.5">
                    Matched Keywords
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {(atsScorecard.ats_audit?.matched_keywords || atsScorecard.matched_keywords || []).map(
                      (kw: string) => (
                        <span
                          key={kw}
                          className="px-2 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                        >
                          {kw}
                        </span>
                      )
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-[9px] uppercase font-bold text-rose-500 tracking-wider block mb-1.5">
                    Missing Keywords
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {(atsScorecard.ats_audit?.missing_keywords || atsScorecard.missing_keywords || []).map(
                      (kw: string) => (
                        <span
                          key={kw}
                          className="px-2 py-0.5 rounded text-[9px] font-semibold bg-rose-500/10 border border-rose-500/20 text-rose-450"
                        >
                          {kw}
                        </span>
                      )
                    )}
                  </div>
                </div>

                {(atsScorecard.ats_audit?.recommendations || atsScorecard.recommendations) && (
                  <div>
                    <span className="text-[9px] uppercase font-bold text-indigo-400 tracking-wider block mb-1.5">
                      Recommendations
                    </span>
                    <ul className="list-disc pl-4 space-y-1 text-zinc-450 text-[10.5px]">
                      {(atsScorecard.ats_audit?.recommendations || atsScorecard.recommendations).map(
                        (rec: string, idx: number) => (
                          <li key={idx}>{rec}</li>
                        )
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Split section: File database list & Email form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Local database list of tailored PDFs */}
        <div className="lg:col-span-2 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 flex flex-col gap-4">
          <div>
            <h4 className="text-xs uppercase font-bold text-zinc-400 tracking-wider">
              Local Database Copies
            </h4>
            <span className="text-[10px] text-zinc-550">
              List of generated PDF resumes residing inside assets/ folder
            </span>
          </div>

          <div className="overflow-y-auto max-h-[300px] border border-zinc-850 rounded-xl">
            {tailoredFiles.length > 0 ? (
              <table className="w-full border-collapse text-left text-xs text-zinc-400">
                <thead className="bg-zinc-950/60 text-[9px] uppercase tracking-wider text-zinc-500 font-bold border-b border-zinc-850 select-none">
                  <tr>
                    <th className="px-4 py-3">Company</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900/50 bg-zinc-900/10">
                  {tailoredFiles.map((file, idx) => (
                    <tr key={idx} className="hover:bg-zinc-900/40 transition">
                      <td className="px-4 py-3 font-semibold text-zinc-300 max-w-[150px] truncate">
                        {file.company}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 text-[10.5px]">
                        {new Date(file.created_at * 1000).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-1.5">
                          <button
                            onClick={() => window.open(`/api/jobs/some_id/tailor/view?path=${encodeURIComponent(file.path)}`, "_blank")}
                            title="View PDF"
                            className="p-1.5 bg-zinc-950 border border-zinc-850 text-zinc-400 hover:text-white rounded hover:bg-zinc-900 transition cursor-pointer"
                          >
                            <Eye size={12} />
                          </button>
                          <button
                            onClick={() => handleCompareFile(file.path, file.company)}
                            title="Compare original vs tailored"
                            className="p-1.5 bg-zinc-950 border border-zinc-850 text-zinc-400 hover:text-white rounded hover:bg-zinc-900 transition cursor-pointer"
                          >
                            <Scale size={12} />
                          </button>
                          <button
                            onClick={() => (window.location.href = `/api/jobs/some_id/tailor/download?path=${encodeURIComponent(file.path)}&filename=${encodeURIComponent(file.filename)}`)}
                            title="Download PDF"
                            className="p-1.5 bg-zinc-950 border border-zinc-850 text-zinc-400 hover:text-white rounded hover:bg-zinc-900 transition cursor-pointer"
                          >
                            <Download size={12} />
                          </button>
                          <button
                            onClick={() => setActiveEmailFile(file)}
                            title="Attach to email client"
                            className="p-1.5 bg-zinc-950 border border-zinc-850 text-indigo-400 hover:text-indigo-300 rounded hover:bg-zinc-900 transition cursor-pointer"
                          >
                            <Mail size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteFile(file.path, file.company)}
                            title="Delete file"
                            className="p-1.5 bg-zinc-950 border border-zinc-850 text-rose-450 hover:text-rose-400 rounded hover:bg-zinc-900 transition cursor-pointer"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-zinc-600 italic">No tailored files found on disk.</div>
            )}
          </div>
        </div>

        {/* Email Client form */}
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 flex flex-col gap-4">
          <div>
            <h4 className="text-xs uppercase font-bold text-zinc-400 tracking-wider">
              Email Client
            </h4>
            <span className="text-[10px] text-zinc-550">
              Email custom PDF copies using configured SMTP parameters
            </span>
          </div>

          {activeEmailFile ? (
            <form onSubmit={handleSendEmail} className="flex flex-col gap-3">
              <div className="text-[10.5px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 rounded-lg p-2.5 flex items-center justify-between">
                <span className="truncate max-w-[150px]">
                  📎 Attached: <strong>{activeEmailFile.filename}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setActiveEmailFile(null)}
                  className="text-zinc-400 hover:text-white font-bold ml-2"
                >
                  ✕
                </button>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase font-bold text-zinc-550 tracking-wider">To Address</label>
                <input
                  type="email"
                  required
                  value={emailForm.toEmail}
                  onChange={(e) => setEmailForm({ ...emailForm, toEmail: e.target.value })}
                  placeholder="recipient@company.com"
                  className="w-full bg-zinc-950 border border-zinc-850 focus:border-indigo-500 text-xs px-3 py-2 rounded-lg outline-none text-zinc-200 transition"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase font-bold text-zinc-550 tracking-wider">Subject</label>
                <input
                  type="text"
                  required
                  value={emailForm.subject}
                  onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
                  placeholder="Job Application - Software Engineer"
                  className="w-full bg-zinc-950 border border-zinc-850 focus:border-indigo-500 text-xs px-3 py-2 rounded-lg outline-none text-zinc-200 transition"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase font-bold text-zinc-550 tracking-wider">Body</label>
                <textarea
                  required
                  rows={4}
                  value={emailForm.body}
                  onChange={(e) => setEmailForm({ ...emailForm, body: e.target.value })}
                  placeholder="Dear Hiring Team, Please find my resume attached..."
                  className="w-full bg-zinc-950 border border-zinc-850 focus:border-indigo-500 text-xs px-3 py-2 rounded-lg outline-none text-zinc-200 transition resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSendingEmail}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold cursor-pointer transition shadow-[0_0_10px_rgba(99,102,241,0.2)] mt-2"
              >
                {isSendingEmail ? (
                  <Loader2 size={13} className="animate-spin text-white" />
                ) : (
                  <Send size={13} />
                )}
                Deliver Email
              </button>
            </form>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-zinc-950/20 border border-zinc-900 border-dashed rounded-xl text-zinc-550">
              <Mail size={24} className="text-zinc-600 mb-2" />
              <span className="text-[11.5px] max-w-[200px] leading-relaxed">
                Click the ✉ button next to any local PDF file to attach it here and drafts will appear.
              </span>
            </div>
          )}
        </div>
      </div>

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
