import React from "react";
import { Github, Linkedin, Heart, ShieldAlert, Cpu, Code2, ShieldCheck, Mail } from "lucide-react";

export default function About() {
  return (
    <div className="flex flex-col gap-8 max-w-4xl mx-auto">
      {/* Hero Header Section */}
      <div className="relative bg-zinc-900/40 border border-zinc-800/80 rounded-3xl p-8 overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-[0_0_30px_rgba(99,102,241,0.35)] flex-shrink-0">
            <Cpu size={32} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight font-display">Aegis Flow</h1>
            <p className="text-xs text-indigo-400 font-bold mt-1 uppercase tracking-wider">
              Autonomous AI Job Application & Ingestion System
            </p>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
              An advanced end-to-end automation platform that leverages generative AI and secure robotic process automation to simplify, match, and speed up the modern job application pipeline.
            </p>
          </div>
        </div>
      </div>

      {/* Grid: About App & About Author */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Card: The Application Features */}
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6 flex flex-col gap-4 shadow-xl">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-zinc-800 pb-3">
            <Code2 size={16} className="text-indigo-400" />
            Core Capabilities
          </h2>
          <ul className="space-y-3.5 text-zinc-400 text-xs leading-relaxed">
            <li className="flex items-start gap-2.5">
              <span className="text-indigo-400 mt-0.5">•</span>
              <div>
                <strong className="text-zinc-200 block">AI-Powered Resume Customizer</strong>
                Tailors summaries, skills matrices, and professional experience bullets dynamically against job listings using Gemini to cross an 85%+ ATS threshold.
              </div>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-indigo-400 mt-0.5">•</span>
              <div>
                <strong className="text-zinc-200 block">Stealth Automations Driver</strong>
                Executes form submissions via Playwright using custom anti-detection scripts (e.g. webdriver bypass) and stateful cookie preservation.
              </div>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-indigo-400 mt-0.5">•</span>
              <div>
                <strong className="text-zinc-200 block">Binary Signature scramble</strong>
                Appends randomized metadata attributes to ReportLab PDF compilations, giving each resume a unique MD5 signature to rank higher on board indexes.
              </div>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-indigo-400 mt-0.5">•</span>
              <div>
                <strong className="text-zinc-200 block">Cryptographic Key Vault</strong>
                Ensures credential parameters, emails, and third-party passwords are encrypted symmetrically on disk using Fernet encryption keys.
              </div>
            </li>
          </ul>
        </div>

        {/* Right Card: About the Author */}
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6 flex flex-col justify-between shadow-xl">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-zinc-800 pb-3 mb-4">
              <ShieldCheck size={16} className="text-purple-400" />
              About the Author
            </h2>
            
            <div className="flex items-center gap-4 mb-4">
              <div className="relative w-14 h-14 rounded-full border border-zinc-700/80 overflow-hidden shadow-inner flex-shrink-0 bg-zinc-800 flex items-center justify-center">
                <img
                  src="/avatar.jpg"
                  alt="Nitin Pradhan Avatar"
                  className="w-full h-full object-cover object-[center_28%]"
                />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Nitin Pradhan</h3>
                <span className="text-[10px] text-zinc-550 font-semibold block mt-0.5">
                  Senior Software Engineer | Full-Stack Developer
                </span>
              </div>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed mb-4">
              Nitin is a dedicated Senior Software Engineer and Full-Stack Developer passionate about solving complex real-world problems. With expert proficiency in designing robust systems with <strong>.NET Core, React, and AWS</strong>, he is an active advocate of autonomous agent systems, public learning, and crafting premium, developer-centric software applications.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5 pt-4 border-t border-zinc-900/50">
            <a
              href="https://github.com/nitin048/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-950 border border-zinc-850 hover:border-zinc-700 text-zinc-300 hover:text-white rounded-lg text-[10.5px] font-semibold transition"
            >
              <Github size={12} />
              GitHub Profile
            </a>
            <a
              href="https://www.linkedin.com/in/nitin001/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/15 border border-indigo-500/20 hover:border-indigo-500/40 text-indigo-400 hover:text-indigo-300 rounded-lg text-[10.5px] font-semibold transition"
            >
              <Linkedin size={12} />
              LinkedIn Profile
            </a>
          </div>
        </div>
      </div>

      {/* Disclaimers & Copyright Cards */}
      <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6 flex flex-col gap-4 shadow-xl">
        <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-zinc-800 pb-3">
          <ShieldAlert size={16} className="text-rose-450" />
          Legal Disclaimer &amp; Terms
        </h2>
        <div className="space-y-3 text-[11px] text-zinc-500 leading-relaxed">
          <p>
            <strong>Usage Policy:</strong> Aegis Flow is an open-source productivity framework intended strictly for automating job board filtering, ATS optimization research, and personal applications assistance. Users assume full liability for the operational parameters configured inside this tool. 
          </p>
          <p>
            <strong>Third-Party Compliance:</strong> The software interfaces with platforms like Naukri, LinkedIn, and external applicant tracking systems (Workday, Greenhouse, Lever, etc.). Aegis Flow is not sponsored, endorsed, or affiliated with any of these third-party platforms. It is the user's sole responsibility to ensure that automated crawl scripts and bot evasion features conform to the respective websites' Terms of Service, Robots.txt, and acceptable use guidelines.
          </p>
          <p>
            <strong>Warranty:</strong> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE.
          </p>
        </div>
      </div>

      {/* Made With Love Footer Credits */}
      <div className="flex flex-col items-center justify-center text-center py-6 border-t border-zinc-900 mt-2 gap-1.5 select-none">
        <div className="flex items-center gap-1 text-zinc-400 text-xs font-semibold">
          <span>Developed with</span>
          <Heart size={12} className="text-rose-500 fill-rose-500 animate-pulse" />
          <span>by</span>
          <a
            href="https://github.com/nitin048/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white hover:text-indigo-400 transition underline decoration-zinc-800 hover:decoration-indigo-400 decoration-2 underline-offset-4"
          >
            Nitin Pradhan
          </a>
        </div>
        <div className="text-[10px] text-zinc-600 font-medium">
          Copyright &copy; 2026 Aegis Flow. All rights reserved.
        </div>
      </div>
    </div>
  );
}
