/**
 * LoginPage.tsx — Premium split-screen login with animated backdrop.
 */

import React, { useState } from "react";
import { Eye, EyeOff, Loader2, ArrowRight, Shield } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

export default function LoginPage() {
  const { login, setAuthView } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Please enter your email address.");
      triggerShake();
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      triggerShake();
      return;
    }

    setIsSubmitting(true);
    const result = await login(email, password, remember);
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error || "Login failed.");
      triggerShake();
    }
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  };

  return (
    <div className="fixed inset-0 flex bg-zinc-950">
      {/* Left — Animated Brand Panel */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-gradient-to-br from-indigo-950 via-zinc-950 to-purple-950 items-center justify-center">
        {/* Floating shapes */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="auth-float-shape w-72 h-72 rounded-full bg-indigo-500/8 blur-3xl absolute -top-20 -left-20" style={{ animationDelay: "0s" }} />
          <div className="auth-float-shape w-96 h-96 rounded-full bg-purple-500/8 blur-3xl absolute bottom-10 right-10" style={{ animationDelay: "2s" }} />
          <div className="auth-float-shape w-48 h-48 rounded-full bg-cyan-500/5 blur-2xl absolute top-1/3 right-1/4" style={{ animationDelay: "4s" }} />
          
          {/* Geometric grid lines */}
          <div className="absolute inset-0" style={{
            backgroundImage: `linear-gradient(rgba(99,102,241,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.03) 1px, transparent 1px)`,
            backgroundSize: "60px 60px"
          }} />

          {/* Floating geometric shapes */}
          <div className="auth-float-geo absolute top-1/4 left-1/4 w-16 h-16 border border-indigo-500/15 rounded-xl rotate-45" style={{ animationDelay: "1s" }} />
          <div className="auth-float-geo absolute bottom-1/3 right-1/3 w-12 h-12 border border-purple-500/15 rounded-lg rotate-12" style={{ animationDelay: "3s" }} />
          <div className="auth-float-geo absolute top-2/3 left-1/3 w-8 h-8 border border-cyan-500/20 rounded-md -rotate-12" style={{ animationDelay: "5s" }} />
        </div>

        {/* Brand content */}
        <div className="relative z-10 text-center px-12 max-w-lg auth-fade-in-up">
          <div className="w-20 h-20 mx-auto mb-8 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-[0_0_40px_rgba(99,102,241,0.4)]">
            <Shield size={36} className="text-white/90" />
          </div>
          <h1 className="auth-shimmer text-4xl font-black text-white tracking-tight mb-4">
            Aegis Flow
          </h1>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Your autonomous AI-powered job application engine. Scan portals, tailor resumes, and automate applications — all in one place.
          </p>
          <div className="flex items-center justify-center gap-6 mt-10">
            {["11 Portals", "AI Tailoring", "Auto Apply"].map((feat) => (
              <div key={feat} className="flex items-center gap-2 text-xs text-zinc-500">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                {feat}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className={`w-full max-w-md auth-fade-in-up ${shake ? "auth-shake" : ""}`}>
          {/* Mobile brand */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.3)]">
              <Shield size={20} className="text-white/90" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">Aegis Flow</h2>
              <span className="text-[10px] text-zinc-500">AI Application Client</span>
            </div>
          </div>

          <h2 className="text-2xl font-black text-white tracking-tight">Welcome back</h2>
          <p className="text-sm text-zinc-500 mt-1 mb-8">Sign in to your account to continue</p>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3.5 mb-6 flex items-center gap-2.5 auth-fade-in-up">
              <span className="text-rose-400 text-xs font-bold">⚠</span>
              <span className="text-xs text-rose-300 font-medium">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-indigo-500 text-sm px-4 py-3 rounded-xl outline-none text-zinc-200 transition auth-input-glow placeholder:text-zinc-600"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setAuthView("forgot-password")}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer transition"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-indigo-500 text-sm px-4 py-3 pr-11 rounded-xl outline-none text-zinc-200 transition auth-input-glow placeholder:text-zinc-600"
                />
                <button
                  type="button"
                  onMouseDown={() => setShowPassword(true)}
                  onMouseUp={() => setShowPassword(false)}
                  onMouseLeave={() => setShowPassword(false)}
                  onTouchStart={() => setShowPassword(true)}
                  onTouchEnd={() => setShowPassword(false)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition cursor-pointer"
                  title="Hold to reveal"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                id="auth-remember"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 bg-zinc-900 border-zinc-700 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <label htmlFor="auth-remember" className="text-xs text-zinc-400 cursor-pointer select-none">
                Remember me on this device
              </label>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="group w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-sm font-bold text-white rounded-xl cursor-pointer shadow-[0_0_20px_rgba(99,102,241,0.25)] hover:shadow-[0_0_30px_rgba(99,102,241,0.4)] transition-all duration-300 select-none"
            >
              {isSubmitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  Sign In
                  <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-8">
            <div className="flex-1 h-px bg-zinc-800" />
            <span className="text-[10px] text-zinc-600 font-medium uppercase tracking-wider">New here?</span>
            <div className="flex-1 h-px bg-zinc-800" />
          </div>

          {/* Sign up link */}
          <button
            type="button"
            onClick={() => setAuthView("signup")}
            className="w-full py-3 border border-zinc-800 hover:border-zinc-700 bg-zinc-900/30 hover:bg-zinc-900/60 text-sm font-semibold text-zinc-300 hover:text-white rounded-xl cursor-pointer transition select-none"
          >
            Create an Account
          </button>

          <p className="text-center text-[10px] text-zinc-600 mt-6">
            By signing in, you agree to Aegis Flow's local terms of use.
          </p>
        </div>
      </div>
    </div>
  );
}
