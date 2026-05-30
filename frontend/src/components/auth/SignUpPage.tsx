/**
 * SignUpPage.tsx — Modern registration with password strength meter.
 */

import React, { useState, useMemo } from "react";
import { Eye, EyeOff, Loader2, ArrowRight, Shield, ChevronLeft, Check, X } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { calcPasswordStrength } from "../../utils/crypto";

const SECURITY_QUESTIONS = [
  "What was your first pet's name?",
  "What city were you born in?",
  "What is your mother's maiden name?",
  "What was the name of your first school?",
  "What is your favorite book?",
  "What was your childhood nickname?",
  "What is the name of your favorite childhood friend?",
];

export default function SignUpPage() {
  const { signup, setAuthView } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [securityQuestion, setSecurityQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);

  const strength = useMemo(() => calcPasswordStrength(password), [password]);

  const passwordsMatch = password && confirmPassword && password === confirmPassword;
  const passwordsMismatch = confirmPassword && password !== confirmPassword;

  const strengthBarColor = {
    weak: "bg-rose-500",
    medium: "bg-amber-500",
    strong: "bg-emerald-500",
    "very-strong": "bg-cyan-400",
  }[strength.level];

  const strengthTextColor = {
    weak: "text-rose-400",
    medium: "text-amber-400",
    strong: "text-emerald-400",
    "very-strong": "text-cyan-400",
  }[strength.level];

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  };

  const validate = (): string | null => {
    if (!fullName.trim()) return "Please enter your full name.";
    if (!email.trim()) return "Please enter your email address.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Please enter a valid email address.";
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (password !== confirmPassword) return "Passwords do not match.";
    if (!securityAnswer.trim()) return "Please answer the security question.";
    if (!acceptTerms) return "Please accept the terms to continue.";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const err = validate();
    if (err) {
      setError(err);
      triggerShake();
      return;
    }

    setIsSubmitting(true);
    const result = await signup({
      fullName,
      email,
      password,
      securityQuestion,
      securityAnswer,
    });
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error || "Sign up failed.");
      triggerShake();
    }
  };

  return (
    <div className="fixed inset-0 flex bg-zinc-950">
      {/* Left — Brand panel (same as login) */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-gradient-to-br from-purple-950 via-zinc-950 to-indigo-950 items-center justify-center">
        <div className="absolute inset-0 overflow-hidden">
          <div className="auth-float-shape w-72 h-72 rounded-full bg-purple-500/8 blur-3xl absolute -top-20 -right-20" style={{ animationDelay: "0s" }} />
          <div className="auth-float-shape w-96 h-96 rounded-full bg-indigo-500/8 blur-3xl absolute bottom-10 left-10" style={{ animationDelay: "2s" }} />
          <div className="auth-float-shape w-48 h-48 rounded-full bg-emerald-500/5 blur-2xl absolute top-1/2 right-1/3" style={{ animationDelay: "4s" }} />
          <div className="absolute inset-0" style={{
            backgroundImage: `linear-gradient(rgba(168,85,247,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(168,85,247,0.03) 1px, transparent 1px)`,
            backgroundSize: "60px 60px"
          }} />
          <div className="auth-float-geo absolute top-1/4 right-1/4 w-14 h-14 border border-purple-500/15 rounded-xl rotate-12" style={{ animationDelay: "1s" }} />
          <div className="auth-float-geo absolute bottom-1/4 left-1/4 w-10 h-10 border border-indigo-500/15 rounded-lg -rotate-12" style={{ animationDelay: "3s" }} />
        </div>

        <div className="relative z-10 text-center px-12 max-w-lg auth-fade-in-up">
          <div className="w-20 h-20 mx-auto mb-8 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-[0_0_40px_rgba(168,85,247,0.4)]">
            <Shield size={36} className="text-white/90" />
          </div>
          <h1 className="auth-shimmer text-4xl font-black text-white tracking-tight mb-4">
            Join Aegis Flow
          </h1>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Create your secure local profile to begin automating your job application pipeline with AI-powered precision.
          </p>
          <div className="flex items-center justify-center gap-6 mt-10">
            {["Encrypted", "Offline-First", "Zero Tracking"].map((feat) => (
              <div key={feat} className="flex items-center gap-2 text-xs text-zinc-500">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                {feat}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — Sign Up Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 overflow-y-auto">
        <div className={`w-full max-w-md auth-fade-in-up ${shake ? "auth-shake" : ""}`}>
          <button
            type="button"
            onClick={() => setAuthView("login")}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 mb-6 cursor-pointer transition"
          >
            <ChevronLeft size={14} /> Back to Login
          </button>

          <h2 className="text-2xl font-black text-white tracking-tight">Create your account</h2>
          <p className="text-sm text-zinc-500 mt-1 mb-8">Set up your secure local profile</p>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3.5 mb-6 flex items-center gap-2.5 auth-fade-in-up">
              <span className="text-rose-400 text-xs font-bold">⚠</span>
              <span className="text-xs text-rose-300 font-medium">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Full Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
                autoComplete="name"
                className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-indigo-500 text-sm px-4 py-3 rounded-xl outline-none text-zinc-200 transition auth-input-glow placeholder:text-zinc-600"
              />
            </div>

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Email Address</label>
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
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
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
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Strength meter */}
              {password && (
                <div className="flex items-center gap-3 mt-1 auth-fade-in-up">
                  <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${strengthBarColor}`}
                      style={{ width: `${strength.score}%` }}
                    />
                  </div>
                  <span className={`text-[10px] font-bold ${strengthTextColor}`}>{strength.label}</span>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  autoComplete="new-password"
                  className={`w-full bg-zinc-900/60 border text-sm px-4 py-3 pr-11 rounded-xl outline-none text-zinc-200 transition auth-input-glow placeholder:text-zinc-600 ${
                    passwordsMismatch
                      ? "border-rose-500/50 focus:border-rose-500"
                      : passwordsMatch
                      ? "border-emerald-500/50 focus:border-emerald-500"
                      : "border-zinc-800 focus:border-indigo-500"
                  }`}
                />
                <button
                  type="button"
                  onMouseDown={() => setShowConfirm(true)}
                  onMouseUp={() => setShowConfirm(false)}
                  onMouseLeave={() => setShowConfirm(false)}
                  onTouchStart={() => setShowConfirm(true)}
                  onTouchEnd={() => setShowConfirm(false)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition cursor-pointer"
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {confirmPassword && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  {passwordsMatch ? (
                    <>
                      <Check size={12} className="text-emerald-400" />
                      <span className="text-[10px] text-emerald-400 font-medium">Passwords match</span>
                    </>
                  ) : (
                    <>
                      <X size={12} className="text-rose-400" />
                      <span className="text-[10px] text-rose-400 font-medium">Passwords don't match</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Security Question */}
            <div className="flex flex-col gap-1.5 mt-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Security Question <span className="text-zinc-600">(for password recovery)</span>
              </label>
              <select
                value={securityQuestion}
                onChange={(e) => setSecurityQuestion(e.target.value)}
                className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-indigo-500 text-sm px-4 py-3 rounded-xl outline-none text-zinc-300 cursor-pointer transition"
              >
                {SECURITY_QUESTIONS.map((q) => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </select>
            </div>

            {/* Security Answer */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Security Answer</label>
              <input
                type="text"
                value={securityAnswer}
                onChange={(e) => setSecurityAnswer(e.target.value)}
                placeholder="Your answer (case-insensitive)"
                className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-indigo-500 text-sm px-4 py-3 rounded-xl outline-none text-zinc-200 transition auth-input-glow placeholder:text-zinc-600"
              />
            </div>

            {/* Terms */}
            <div className="flex items-start gap-2.5 mt-1">
              <input
                type="checkbox"
                id="auth-terms"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="w-4 h-4 mt-0.5 bg-zinc-900 border-zinc-700 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <label htmlFor="auth-terms" className="text-xs text-zinc-400 cursor-pointer select-none leading-relaxed">
                I understand that all data is stored locally on this device and I'm responsible for my own backups.
              </label>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="group w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-sm font-bold text-white rounded-xl cursor-pointer shadow-[0_0_20px_rgba(168,85,247,0.25)] hover:shadow-[0_0_30px_rgba(168,85,247,0.4)] transition-all duration-300 select-none mt-2"
            >
              {isSubmitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  Create Account
                  <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-zinc-500 mt-8">
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => setAuthView("login")}
              className="text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer transition"
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
