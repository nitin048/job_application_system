/**
 * ProfilePage.tsx — Premium dashboard page for account profile management.
 * 
 * Supports:
 * - Editing personal info (Full Name, Email, Phone, Bio)
 * - Pencil edit/save toggle with read-only layout
 * - Password change with real-time strength meter
 * - Updating security question & recovery answer
 * - Danger Zone (Delete Account with password confirmation)
 */

import React, { useState, useMemo, useRef } from "react";
import { 
  Pencil, 
  Save, 
  X, 
  Lock, 
  Shield, 
  Trash2, 
  Eye, 
  EyeOff, 
  Check, 
  Loader2, 
  User as UserIcon, 
  Phone, 
  Mail, 
  FileText, 
  HelpCircle,
  Camera,
  RotateCw,
  Sliders,
  ZoomIn
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { calcPasswordStrength } from "../utils/crypto";

const SECURITY_QUESTIONS = [
  "What was your first pet's name?",
  "What city were you born in?",
  "What is your mother's maiden name?",
  "What was the name of your first school?",
  "What is your favorite book?",
  "What was your childhood nickname?",
  "What is the name of your favorite childhood friend?",
];

export default function ProfilePage() {
  const { 
    user, 
    updateProfile, 
    changePassword, 
    deleteAccount 
  } = useAuth();
 
  // Image Upload & Editing State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editorImage, setEditorImage] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270 degrees
  const [selectedFilter, setSelectedFilter] = useState("none");
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isSavingImage, setIsSavingImage] = useState(false);

  const PHOTO_FILTERS = [
    { id: "none", label: "Original", css: "none" },
    { id: "grayscale", label: "Mono", css: "grayscale(100%)" },
    { id: "sepia", label: "Vintage", css: "sepia(80%)" },
    { id: "high-contrast", label: "Contrast", css: "contrast(130%) brightness(95%)" },
    { id: "warm", label: "Warm", css: "sepia(20%) saturate(130%)" },
    { id: "brighten", label: "Bright", css: "brightness(115%) contrast(105%)" },
  ];

  // Drag Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setDragOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    setIsDragging(true);
    setDragStart({
      x: e.touches[0].clientX - dragOffset.x,
      y: e.touches[0].clientY - dragOffset.y
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    setDragOffset({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setProfileError("Please select a valid image file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setEditorImage(reader.result as string);
      setZoom(1);
      setRotation(0);
      setSelectedFilter("none");
      setDragOffset({ x: 0, y: 0 });
      setShowEditor(true);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const saveEditedPhoto = () => {
    if (!editorImage) return;
    setIsSavingImage(true);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, 512, 512);
      ctx.translate(256, 256);
      const filterCss = PHOTO_FILTERS.find(f => f.id === selectedFilter)?.css || "none";
      ctx.filter = filterCss;
      ctx.rotate((rotation * Math.PI) / 180);
      const canvasScale = 512 / 280;
      const imgWidth = img.naturalWidth;
      const imgHeight = img.naturalHeight;
      const ratio = Math.min(280 / imgWidth, 280 / imgHeight);
      const renderWidth = imgWidth * ratio;
      const renderHeight = imgHeight * ratio;
      const drawX = dragOffset.x * canvasScale;
      const drawY = dragOffset.y * canvasScale;
      const drawW = renderWidth * zoom * canvasScale;
      const drawH = renderHeight * zoom * canvasScale;
      ctx.drawImage(img, drawX - drawW / 2, drawY - drawH / 2, drawW, drawH);
      const croppedUrl = canvas.toDataURL("image/jpeg", 0.85);
      updateProfile({ avatarImage: croppedUrl })
        .then(() => {
          setEditorImage(null);
          setShowEditor(false);
          setProfileSuccess("Profile picture updated successfully!");
        })
        .catch((err) => {
          console.error(err);
          setProfileError("Failed to save avatar image.");
        })
        .finally(() => {
          setIsSavingImage(false);
        });
    };
    img.src = editorImage;
  };

  // Profile Details State
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Security Question State
  const [isEditingSecurity, setIsEditingSecurity] = useState(false);
  const [securityQuestion, setSecurityQuestion] = useState(user?.securityQuestion || SECURITY_QUESTIONS[0]);
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [securityError, setSecurityError] = useState("");
  const [securitySuccess, setSecuritySuccess] = useState("");
  const [isSavingSecurity, setIsSavingSecurity] = useState(false);

  // Delete Account State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Calculate new password strength
  const strength = useMemo(() => calcPasswordStrength(newPassword), [newPassword]);
  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;
  const passwordsMismatch = confirmPassword && newPassword !== confirmPassword;

  const strengthBarColor = {
    weak: "bg-rose-500",
    medium: "bg-amber-500",
    strong: "bg-emerald-500",
    "very-strong": "bg-cyan-400",
  }[strength.level];

  const strengthTextColor = {
    weak: "text-rose-455",
    medium: "text-amber-450",
    strong: "text-emerald-400",
    "very-strong": "text-cyan-400",
  }[strength.level];

  if (!user) return null;

  // Handle Initials
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  // Profile Save
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError("");
    setProfileSuccess("");

    if (!fullName.trim()) {
      setProfileError("Full Name is required.");
      return;
    }
    if (!email.trim()) {
      setProfileError("Email address is required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setProfileError("Please enter a valid email address.");
      return;
    }

    setIsSavingProfile(true);
    try {
      await updateProfile({
        fullName,
        email,
        phone,
        bio,
      });
      setProfileSuccess("Profile details updated successfully.");
      setIsEditing(false);
    } catch (err: any) {
      setProfileError(err.message || "Failed to update profile.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleCancelProfile = () => {
    setFullName(user.fullName);
    setEmail(user.email);
    setPhone(user.phone);
    setBio(user.bio);
    setProfileError("");
    setIsEditing(false);
  };

  // Change Password Submit
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (!currentPassword) {
      setPasswordError("Please enter your current password.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    setIsChangingPassword(true);
    const result = await changePassword(currentPassword, newPassword);
    setIsChangingPassword(false);

    if (result.success) {
      setPasswordSuccess("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      setPasswordError(result.error || "Failed to update password.");
    }
  };

  // Security Question Save
  const handleSaveSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityError("");
    setSecuritySuccess("");

    if (!securityAnswer.trim()) {
      setSecurityError("Please enter a recovery answer.");
      return;
    }

    setIsSavingSecurity(true);
    try {
      await updateProfile({
        securityQuestion,
        securityAnswer,
      });
      setSecuritySuccess("Security question updated successfully.");
      setSecurityAnswer("");
      setIsEditingSecurity(false);
    } catch (err: any) {
      setSecurityError(err.message || "Failed to update recovery question.");
    } finally {
      setIsSavingSecurity(false);
    }
  };

  const handleCancelSecurity = () => {
    setSecurityQuestion(user.securityQuestion);
    setSecurityAnswer("");
    setSecurityError("");
    setIsEditingSecurity(false);
  };

  // Delete Account Submit
  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError("");

    if (!deletePassword) {
      setDeleteError("Please enter your password to confirm account deletion.");
      return;
    }

    if (!confirm("CRITICAL WARNING: This will permanently delete your account and all associated encrypted credentials. This action CANNOT be undone. Are you sure you wish to proceed?")) {
      return;
    }

    setIsDeleting(true);
    const result = await deleteAccount(deletePassword);
    setIsDeleting(false);

    if (!result.success) {
      setDeleteError(result.error || "Incorrect password. Could not delete account.");
    }
  };

  return (
    <div className="flex flex-col gap-8 max-w-4xl mx-auto pb-12 auth-fade-in-up">
      {/* Top Banner Card */}
      <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center gap-6 relative overflow-hidden">
        {/* Floating background gradient */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
          <div className={`auth-float-shape w-40 h-40 rounded-full bg-gradient-to-br ${user.avatarColor} opacity-5 blur-2xl absolute -top-10 -right-10`} />
        </div>

        {/* Profile Avatar Container with Upload trigger */}
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="relative w-20 h-20 rounded-2xl overflow-hidden cursor-pointer group flex-shrink-0 border border-white/10 shadow-[0_0_20px_rgba(99,102,241,0.25)] select-none"
          title="Upload Profile Picture"
        >
          {user.avatarImage ? (
            <img 
              src={user.avatarImage} 
              alt={user.fullName} 
              className="w-full h-full object-cover" 
            />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${user.avatarColor} flex items-center justify-center text-white text-2xl font-black`}>
              {getInitials(user.fullName)}
            </div>
          )}
          
          {/* Hover Camera Overlay */}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity duration-200">
            <Camera size={18} className="mb-0.5" />
            <span className="text-[9px] font-bold uppercase tracking-wider">Change</span>
          </div>
        </div>
        
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImageSelect}
          accept="image/*"
          className="hidden"
        />

        <div className="flex-1 text-center md:text-left">
          <h2 className="text-xl font-black text-white tracking-tight flex items-center justify-center md:justify-start gap-2.5">
            {user.fullName}
            <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-bold border border-indigo-500/10">
              Active Session
            </span>
          </h2>
          <p className="text-xs text-zinc-400 mt-1 flex items-center justify-center md:justify-start gap-1.5">
            <Mail size={12} className="text-zinc-550" />
            {user.email}
          </p>
          <p className="text-[10.5px] text-zinc-500 mt-1">
            Registered on {new Date(user.createdAt).toLocaleDateString(undefined, { dateStyle: "long" })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column — Profile Details Info */}
        <div className="lg:col-span-2 flex flex-col gap-8">
          {/* Account Profile Details Section */}
          <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6 flex flex-col gap-6 relative">
            <div className="flex items-center justify-between border-b border-zinc-850 pb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <UserIcon size={16} className="text-indigo-400" />
                  Personal Account Details
                </h3>
                <p className="text-[11px] text-zinc-550 mt-0.5">
                  General personal details used to identify you on the application client.
                </p>
              </div>

              {/* Pencil Edit Mode Button */}
              {!isEditing ? (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="p-2 text-zinc-400 hover:text-white bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-800 rounded-xl transition cursor-pointer flex items-center justify-center"
                  title="Edit Profile"
                >
                  <Pencil size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCancelProfile}
                  className="p-2 text-zinc-400 hover:text-rose-400 bg-zinc-800/50 hover:bg-rose-500/5 border border-zinc-800 hover:border-rose-550/20 rounded-xl transition cursor-pointer flex items-center justify-center"
                  title="Cancel editing"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {profileError && (
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3.5 flex items-center gap-2.5">
                <span className="text-rose-455 text-xs font-bold">⚠</span>
                <span className="text-xs text-rose-300 font-medium">{profileError}</span>
              </div>
            )}

            {profileSuccess && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3.5 flex items-center gap-2.5">
                <span className="text-emerald-400 text-xs font-bold">✓</span>
                <span className="text-xs text-emerald-350 font-medium">{profileSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Full Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-505">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={!isEditing}
                  className={`w-full text-xs px-3 py-2.5 rounded-lg outline-none transition ${
                    isEditing 
                      ? "bg-zinc-950 border border-zinc-855 focus:border-indigo-500 text-zinc-200" 
                      : "bg-zinc-900/20 border border-zinc-850/30 text-zinc-400 cursor-not-allowed select-all"
                  }`}
                />
              </div>

              {/* Email Address */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-505">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!isEditing}
                  className={`w-full text-xs px-3 py-2.5 rounded-lg outline-none transition ${
                    isEditing 
                      ? "bg-zinc-950 border border-zinc-855 focus:border-indigo-500 text-zinc-200" 
                      : "bg-zinc-900/20 border border-zinc-850/30 text-zinc-400 cursor-not-allowed select-all"
                  }`}
                />
              </div>

              {/* Phone Number */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-505">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={!isEditing}
                  placeholder={isEditing ? "+1 (555) 019-2834" : "Not set"}
                  className={`w-full text-xs px-3 py-2.5 rounded-lg outline-none transition ${
                    isEditing 
                      ? "bg-zinc-950 border border-zinc-855 focus:border-indigo-500 text-zinc-200" 
                      : "bg-zinc-900/20 border border-zinc-850/30 text-zinc-400 cursor-not-allowed"
                  }`}
                />
              </div>

              {/* Bio */}
              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-505">
                  Bio / Brief Summary
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  disabled={!isEditing}
                  placeholder={isEditing ? "Introduce yourself briefly..." : "No description provided"}
                  rows={4}
                  className={`w-full text-xs px-3 py-2.5 rounded-lg outline-none transition resize-none ${
                    isEditing 
                      ? "bg-zinc-950 border border-zinc-855 focus:border-indigo-500 text-zinc-200" 
                      : "bg-zinc-900/20 border border-zinc-850/30 text-zinc-400 cursor-not-allowed"
                  }`}
                />
              </div>

              {/* Save Button (shows only when editing) */}
              {isEditing && (
                <div className="md:col-span-2 flex justify-end gap-3 border-t border-zinc-850 pt-4 mt-2">
                  <button
                    type="button"
                    onClick={handleCancelProfile}
                    className="flex items-center gap-1.5 px-4 py-2 border border-zinc-800 hover:border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white rounded-lg cursor-pointer transition select-none"
                  >
                    Discard
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-xs font-semibold text-white rounded-lg cursor-pointer transition select-none"
                  >
                    {isSavingProfile ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Save size={13} />
                    )}
                    Save Details
                  </button>
                </div>
              )}
            </form>
          </div>

          {/* Security Question Recovery Section */}
          <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6 flex flex-col gap-6 relative">
            <div className="flex items-center justify-between border-b border-zinc-850 pb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Shield size={16} className="text-indigo-400" />
                  Security Question & Recovery
                </h3>
                <p className="text-[11px] text-zinc-550 mt-0.5">
                  Used to verify your identity and reset your password if you ever get locked out.
                </p>
              </div>

              {!isEditingSecurity ? (
                <button
                  type="button"
                  onClick={() => setIsEditingSecurity(true)}
                  className="p-2 text-zinc-400 hover:text-white bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-800 rounded-xl transition cursor-pointer flex items-center justify-center"
                  title="Change Security Question"
                >
                  <Pencil size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCancelSecurity}
                  className="p-2 text-zinc-400 hover:text-rose-400 bg-zinc-800/50 hover:bg-rose-500/5 border border-zinc-800 hover:border-rose-550/20 rounded-xl transition cursor-pointer flex items-center justify-center"
                  title="Cancel editing"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {securityError && (
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3.5 flex items-center gap-2.5">
                <span className="text-rose-455 text-xs font-bold">⚠</span>
                <span className="text-xs text-rose-300 font-medium">{securityError}</span>
              </div>
            )}

            {securitySuccess && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3.5 flex items-center gap-2.5">
                <span className="text-emerald-400 text-xs font-bold">✓</span>
                <span className="text-xs text-emerald-350 font-medium">{securitySuccess}</span>
              </div>
            )}

            <form onSubmit={handleSaveSecurity} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-505">
                  Recovery Question
                </label>
                {isEditingSecurity ? (
                  <select
                    value={securityQuestion}
                    onChange={(e) => setSecurityQuestion(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-855 text-xs px-3 py-2.5 rounded-lg outline-none text-zinc-300 cursor-pointer transition"
                  >
                    {SECURITY_QUESTIONS.map((q) => (
                      <option key={q} value={q}>{q}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={user.securityQuestion}
                    disabled
                    className="w-full bg-zinc-900/20 border border-zinc-850/30 text-zinc-400 text-xs px-3 py-2.5 rounded-lg outline-none cursor-not-allowed"
                  />
                )}
              </div>

              {isEditingSecurity && (
                <div className="flex flex-col gap-1.5 animate-[fadeIn_0.2s_ease-out]">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-505">
                    Security Question Answer
                  </label>
                  <input
                    type="text"
                    value={securityAnswer}
                    onChange={(e) => setSecurityAnswer(e.target.value)}
                    placeholder="Enter answer (case-insensitive)"
                    className="w-full bg-zinc-950 border border-zinc-855 focus:border-indigo-500 text-xs px-3 py-2.5 rounded-lg outline-none text-zinc-200 transition placeholder:text-zinc-600"
                  />
                  <small className="text-[9.5px] text-zinc-550 leading-relaxed">
                    Make sure this is memorable. All credentials are locally encrypted, meaning we cannot recover your account if you lose this answer.
                  </small>
                </div>
              )}

              {isEditingSecurity && (
                <div className="flex justify-end gap-3 border-t border-zinc-850 pt-4 mt-1">
                  <button
                    type="button"
                    onClick={handleCancelSecurity}
                    className="flex items-center gap-1.5 px-4 py-2 border border-zinc-800 hover:border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white rounded-lg cursor-pointer transition select-none"
                  >
                    Discard
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingSecurity}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-xs font-semibold text-white rounded-lg cursor-pointer transition select-none"
                  >
                    {isSavingSecurity ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Save size={13} />
                    )}
                    Update Security
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Right Column — Change Password & Danger Zone */}
        <div className="flex flex-col gap-8">
          {/* Change Password Card */}
          <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6 flex flex-col gap-5">
            <div className="border-b border-zinc-850 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Lock size={15} className="text-indigo-400" />
                Change Password
              </h3>
              <p className="text-[11px] text-zinc-550 mt-0.5">
                Update your vault pass code.
              </p>
            </div>

            {passwordError && (
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3.5 flex items-center gap-2.5">
                <span className="text-rose-455 text-xs font-bold">⚠</span>
                <span className="text-xs text-rose-300 font-medium">{passwordError}</span>
              </div>
            )}

            {passwordSuccess && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3.5 flex items-center gap-2.5">
                <span className="text-emerald-400 text-xs font-bold">✓</span>
                <span className="text-xs text-emerald-355 font-medium">{passwordSuccess}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
              {/* Current Password */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-505">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrent ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full bg-zinc-950 border border-zinc-855 focus:border-indigo-500 text-xs px-3 py-2.5 pr-9 rounded-lg outline-none text-zinc-200 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-350 cursor-pointer"
                  >
                    {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-505">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    className="w-full bg-zinc-950 border border-zinc-855 focus:border-indigo-500 text-xs px-3 py-2.5 pr-9 rounded-lg outline-none text-zinc-200 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-350 cursor-pointer"
                  >
                    {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>

                {/* Password strength meter */}
                {newPassword && (
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${strengthBarColor}`}
                        style={{ width: `${strength.score}%` }}
                      />
                    </div>
                    <span className={`text-[9px] font-bold leading-none ${strengthTextColor}`}>
                      {strength.label}
                    </span>
                  </div>
                )}
              </div>

              {/* Confirm New Password */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-505">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className={`w-full bg-zinc-950 border text-xs px-3 py-2.5 pr-9 rounded-lg outline-none text-zinc-200 transition ${
                      passwordsMismatch 
                        ? "border-rose-500/40 focus:border-rose-500" 
                        : passwordsMatch 
                        ? "border-emerald-500/40 focus:border-emerald-500" 
                        : "border-zinc-855 focus:border-indigo-500"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-350 cursor-pointer"
                  >
                    {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {confirmPassword && (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {passwordsMatch ? (
                      <>
                        <Check size={11} className="text-emerald-400" />
                        <span className="text-[9px] text-emerald-400 font-medium">Passwords match</span>
                      </>
                    ) : (
                      <>
                        <X size={11} className="text-rose-455" />
                        <span className="text-[9px] text-rose-455 font-medium">Passwords mismatch</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isChangingPassword}
                className="w-full flex items-center justify-center gap-1.5 mt-2 py-2.5 bg-zinc-850 hover:bg-zinc-800 text-xs font-bold text-white rounded-lg cursor-pointer border border-zinc-800 transition"
              >
                {isChangingPassword ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <>
                    <Lock size={12} />
                    Update Password
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Danger Zone */}
          <div className="border border-rose-500/20 bg-rose-500/5 rounded-2xl p-6 flex flex-col gap-4">
            <div>
              <h3 className="text-sm font-bold text-rose-400 flex items-center gap-2">
                <Trash2 size={15} />
                Danger Zone
              </h3>
              <p className="text-[10.5px] text-zinc-450 mt-1 leading-relaxed">
                Permanently delete your account. This removes all stored configuration files, credentials, and scan files.
              </p>
            </div>

            {!showDeleteConfirm ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-xs font-bold text-rose-400 rounded-lg cursor-pointer transition"
              >
                Delete Account
              </button>
            ) : (
              <form onSubmit={handleDeleteAccount} className="flex flex-col gap-3 mt-1 animate-[fadeIn_0.2s_ease-out]">
                {deleteError && (
                  <div className="bg-rose-500/15 border border-rose-500/20 rounded-lg p-2.5 text-[10.5px] text-rose-300 font-medium">
                    {deleteError}
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <label className="text-[9.5px] font-bold uppercase tracking-wider text-rose-455">
                    Enter Password to Confirm
                  </label>
                  <div className="relative">
                    <input
                      type={showDeletePassword ? "text" : "password"}
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      placeholder="Verify password"
                      className="w-full bg-zinc-950 border border-rose-500/35 focus:border-rose-500 text-xs px-3 py-2 pr-9 rounded-lg outline-none text-zinc-200 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowDeletePassword(!showDeletePassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-350 cursor-pointer"
                    >
                      {showDeletePassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeletePassword("");
                      setDeleteError("");
                    }}
                    className="flex-1 py-2 bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-300 rounded-lg hover:bg-zinc-800 cursor-pointer transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isDeleting}
                    className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-xs font-bold text-white rounded-lg cursor-pointer transition flex items-center justify-center gap-1.5"
                  >
                    {isDeleting ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      "Confirm Delete"
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Modern Profile Image Editor Modal */}
      {showEditor && editorImage && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[10000] flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 max-w-md w-full flex flex-col items-center gap-5 shadow-2xl animate-[scaleIn_0.2s_ease-out] select-none">
            <div className="w-full flex justify-between items-center border-b border-zinc-850 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Camera size={16} className="text-indigo-400" />
                Edit Profile Photo
              </h3>
              <button
                type="button"
                onClick={() => {
                  setEditorImage(null);
                  setShowEditor(false);
                }}
                className="text-zinc-500 hover:text-white transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Interactive Viewport Box */}
            <div className="relative w-[280px] h-[280px] bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-800 flex items-center justify-center">
              <div 
                className="w-full h-full flex items-center justify-center cursor-move"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                <img
                  src={editorImage}
                  alt="Editor target"
                  style={{
                    transform: `translate(${dragOffset.x}px, ${dragOffset.y}px) rotate(${rotation}deg) scale(${zoom})`,
                    filter: PHOTO_FILTERS.find(f => f.id === selectedFilter)?.css || "none",
                    maxHeight: "100%",
                    maxWidth: "100%",
                    pointerEvents: "none",
                  }}
                  className="transition-transform duration-75 ease-out object-contain"
                />
              </div>
              
              {/* Circular Cutout Overlay with Ring & Shadow */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-[200px] h-[200px] rounded-full border border-indigo-500/50 shadow-[0_0_0_280px_rgba(9,9,11,0.75)]" />
              </div>
            </div>

            <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider text-center">
              Drag photo to adjust position inside the circle
            </p>

            {/* Zoom Slider */}
            <div className="w-full flex flex-col gap-2">
              <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                <span className="flex items-center gap-1"><ZoomIn size={12} className="text-zinc-500" /> Zoom</span>
                <span>{Math.round(zoom * 100)}%</span>
              </div>
              <input
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>

            {/* Rotate Button */}
            <div className="w-full flex justify-between items-center bg-zinc-950/40 p-3 rounded-xl border border-zinc-850">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Orientation</span>
              <button
                type="button"
                onClick={() => setRotation((prev) => (prev + 90) % 360)}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-lg text-xs font-bold cursor-pointer transition"
              >
                <RotateCw size={12} />
                Rotate 90°
              </button>
            </div>

            {/* Filter Effects Presets */}
            <div className="w-full flex flex-col gap-2.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                <Sliders size={12} className="text-zinc-500" /> Filter Effects
              </label>
              <div className="grid grid-cols-3 gap-2 w-full">
                {PHOTO_FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSelectedFilter(f.id)}
                    className={`py-2 px-1 text-[10px] font-bold rounded-lg border transition text-center cursor-pointer ${
                      selectedFilter === f.id
                        ? "bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/10"
                        : "bg-zinc-950 border-zinc-850/80 text-zinc-450 hover:text-zinc-200"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="w-full flex gap-3 border-t border-zinc-850 pt-4 mt-2">
              <button
                type="button"
                onClick={() => {
                  setEditorImage(null);
                  setShowEditor(false);
                }}
                className="flex-1 py-2.5 border border-zinc-800 hover:border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEditedPhoto}
                disabled={isSavingImage}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-xs font-bold text-white rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isSavingImage ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  "Save Photo"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
