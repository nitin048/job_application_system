/**
 * ForgotPassword.tsx — 3-step security-question-based password reset.
 */

import React, { useState } from "react";
import { Eye, EyeOff, Loader2, ArrowRight, ChevronLeft, Shield, Mail, HelpCircle, Lock, Check } from "lucide-react";
import { useAuth, loadSecurityQuestionForEmail } from "../../contexts/AuthContext";
import { calcPasswordStrength } from "../../utils/crypto";

export default function ForgotPassword() {
  const { resetPassword, setAuthView } = useAuth();

  // 3-step wizard
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1
  const [email, setEmail] = useState("");

  // Step 2
  const [securityQuestion, setSecurityQuestion] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");

  // Step 3
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // UI
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [success, setSuccess] = useState(false);

  const strength = calcPasswordStrength(newPassword);
  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;

  const strengthBarColor = {
    weak: "bg-rose-500",
    medium: "bg-amber-500",
    strong: "bg-emerald-500",
    "very-strong": "bg-cyan-400",
  }[strength.level];

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  };

  // Step 1: Verify email exists
  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      triggerShake();
      return;
    }

    setIsSubmitting(true);
    const question = await loadSecurityQuestionForEmail(email);
    setIsSubmitting(false);

    if (!question) {
      setError("No account found with this email address.");
      triggerShake();
      return;
    }

    setSecurityQuestion(question);
    setStep(2);
  };

  // Step 2: Verify security answer
  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!securityAnswer.trim()) {
      setError("Please enter your security answer.");
      triggerShake();
      return;
    }

    setIsSubmitting(true);
    const result = await resetPassword(email, securityAnswer, "");
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error || "Verification failed.");
      triggerShake();
      return;
    }

    setStep(3);
  };

  // Step 3: Set new password
  const handleStep3 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      triggerShake();
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      triggerShake();
      return;
    }

    setIsSubmitting(true);
    const result = await resetPassword(email, securityAnswer, newPassword);
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error || "Password reset failed.");
      triggerShake();
      return;
    }

    setSuccess(true);
  };

  const steps = [
    { num: 1, label: "Email", icon: Mail },
    { num: 2, label: "Verify", icon: HelpCircle },
    { num: 3, label: "Reset", icon: Lock },
  ];

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-zinc-950 p-6">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="auth-float-shape w-96 h-96 rounded-full bg-indigo-500/5 blur-3xl absolute top-1/4 -left-20" style={{ animationDelay: "0s" }} />
        <div className="auth-float-shape w-72 h-72 rounded-full bg-purple-500/5 blur-3xl absolute bottom-1/4 right-10" style={{ animationDelay: "2s" }} />
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(rgba(99,102,241,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.02) 1px, transparent 1px)`,
          backgroundSize: "60px 60px"
        }} />
      </div>

      <div className={`relative z-10 w-full max-w-md auth-fade-in-up ${shake ? "auth-shake" : ""}`}>
        {/* Back button */}
        <button
          type="button"
          onClick={() => {
            if (step === 1) {
              setAuthView("login");
            } else {
              setStep((s) => (s - 1) as 1 | 2 | 3);
              setError("");
            }
          }}
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 mb-6 cursor-pointer transition"
        >
          <ChevronLeft size={14} /> {step === 1 ? "Back to Login" : "Previous Step"}
        </button>

        {/* Card */}
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-8">
          {/* Icon */}
          <div className="w-14 h-14 mx-auto mb-5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-[0_0_25px_rgba(99,102,241,0.3)]">
            <Shield size={24} className="text-white/90" />
          </div>

          <h2 className="text-xl font-black text-white tracking-tight text-center">Reset Password</h2>
          <p className="text-xs text-zinc-500 text-center mt-1 mb-6">
            {success
              ? "Your password has been updated"
              : step === 1
              ? "Enter your email to get started"
              : step === 2
              ? "Answer your security question"
              : "Choose a new secure password"}
          </p>

          {/* Step indicator */}
          {!success && (
            <div className="flex items-center justify-center gap-2 mb-8">
              {steps.map((s, idx) => (
                <React.Fragment key={s.num}>
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all duration-300 ${
                    step >= s.num
                      ? "bg-indigo-500/15 text-indigo-400 border border-indigo-500/25"
                      : "bg-zinc-900 text-zinc-600 border border-zinc-800"
                  }`}>
                    <s.icon size={11} />
                    {s.label}
                  </div>
                  {idx < steps.length - 1 && (
                    <div className={`w-6 h-px transition-colors duration-300 ${step > s.num ? "bg-indigo-500/40" : "bg-zinc-800"}`} />
                  )}
                </React.Fragment>
              ))}
            </div>
          )}

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 mb-5 flex items-center gap-2.5 auth-fade-in-up">
              <span className="text-rose-400 text-xs font-bold">⚠</span>
              <span className="text-xs text-rose-300 font-medium">{error}</span>
            </div>
          )}

          {/* Success State */}
          {success ? (
            <div className="flex flex-col items-center gap-4 auth-fade-in-up">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Check size={28} className="text-emerald-400" />
              </div>
              <p className="text-sm text-zinc-300 text-center">
                Your password has been successfully reset. You can now sign in with your new password.
              </p>
              <button
                type="button"
                onClick={() => setAuthView("login")}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-sm font-bold text-white rounded-xl cursor-pointer shadow-[0_0_20px_rgba(99,102,241,0.25)] transition-all duration-300 mt-2"
              >
                Back to Login
              </button>
            </div>
          ) : step === 1 ? (
            /* Step 1: Email */
            <form onSubmit={handleStep1} className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your registered email"
                  autoComplete="email"
                  autoFocus
                  className="w-full bg-zinc-950/60 border border-zinc-800 focus:border-indigo-500 text-sm px-4 py-3 rounded-xl outline-none text-zinc-200 transition auth-input-glow placeholder:text-zinc-600"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="group w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-sm font-bold text-white rounded-xl cursor-pointer transition-all duration-300"
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <>Continue <ArrowRight size={14} /></>}
              </button>
            </form>
          ) : step === 2 ? (
            /* Step 2: Security Question */
            <form onSubmit={handleStep2} className="flex flex-col gap-5 auth-fade-in-up">
              <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-3.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">Security Question</span>
                <p className="text-sm text-indigo-300 font-medium">{securityQuestion}</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Your Answer</label>
                <input
                  type="text"
                  value={securityAnswer}
                  onChange={(e) => setSecurityAnswer(e.target.value)}
                  placeholder="Enter your answer (case-insensitive)"
                  autoFocus
                  className="w-full bg-zinc-950/60 border border-zinc-800 focus:border-indigo-500 text-sm px-4 py-3 rounded-xl outline-none text-zinc-200 transition auth-input-glow placeholder:text-zinc-600"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="group w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-sm font-bold text-white rounded-xl cursor-pointer transition-all duration-300"
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <>Verify Answer <ArrowRight size={14} /></>}
              </button>
            </form>
          ) : (
            /* Step 3: New Password */
            <form onSubmit={handleStep3} className="flex flex-col gap-4 auth-fade-in-up">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">New Password</label>
                <div className="relative">
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    autoComplete="new-password"
                    autoFocus
                    className="w-full bg-zinc-950/60 border border-zinc-800 focus:border-indigo-500 text-sm px-4 py-3 pr-11 rounded-xl outline-none text-zinc-200 transition auth-input-glow placeholder:text-zinc-600"
                  />
                  <button
                    type="button"
                    onMouseDown={() => setShowNew(true)}
                    onMouseUp={() => setShowNew(false)}
                    onMouseLeave={() => setShowNew(false)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition cursor-pointer"
                  >
                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {newPassword && (
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${strengthBarColor}`} style={{ width: `${strength.score}%` }} />
                    </div>
                    <span className={`text-[10px] font-bold ${
                      { weak: "text-rose-400", medium: "text-amber-400", strong: "text-emerald-400", "very-strong": "text-cyan-400" }[strength.level]
                    }`}>{strength.label}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    autoComplete="new-password"
                    className={`w-full bg-zinc-950/60 border text-sm px-4 py-3 pr-11 rounded-xl outline-none text-zinc-200 transition auth-input-glow placeholder:text-zinc-600 ${
                      confirmPassword && !passwordsMatch ? "border-rose-500/50" : passwordsMatch ? "border-emerald-500/50" : "border-zinc-800 focus:border-indigo-500"
                    }`}
                  />
                  <button
                    type="button"
                    onMouseDown={() => setShowConfirm(true)}
                    onMouseUp={() => setShowConfirm(false)}
                    onMouseLeave={() => setShowConfirm(false)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition cursor-pointer"
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="group w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-sm font-bold text-white rounded-xl cursor-pointer transition-all duration-300 mt-1"
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <>Reset Password <Check size={14} /></>}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-[10px] text-zinc-600 mt-5">
          Remember your password?{" "}
          <button type="button" onClick={() => setAuthView("login")} className="text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer transition">
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}
