/**
 * AuthContext.tsx — Centrally-managed authentication provider integrated with MongoDB.
 *
 * Manages user registration, login, logout, password reset, and profile updates.
 * Session tokens persist in localStorage/sessionStorage.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { hashPassword } from "../utils/crypto";

// ─── Types ────────────────────────────────────────────────

export interface User {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  bio: string;
  avatarColor: string;
  avatarImage?: string;
  createdAt: string;
  securityQuestion: string;
  securityAnswer?: string; // optional on client
  securityAnswerSalt?: string; // optional on client
  passwordHash?: string; // optional on client
  passwordSalt?: string; // optional on client
}

export type AuthView = "login" | "signup" | "forgot-password";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authView: AuthView;
  setAuthView: (view: AuthView) => void;
  login: (email: string, password: string, remember: boolean) => Promise<{ success: boolean; error?: string }>;
  signup: (data: SignUpData) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  resetPassword: (email: string, securityAnswer: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  getSecurityQuestion: (email: string) => string | null;
  updateProfile: (
    updates: Partial<Pick<User, "fullName" | "email" | "phone" | "bio" | "avatarImage">> & {
      securityQuestion?: string;
      securityAnswer?: string;
    }
  ) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  deleteAccount: (password: string) => Promise<{ success: boolean; error?: string }>;
}

interface SignUpData {
  fullName: string;
  email: string;
  password: string;
  securityQuestion: string;
  securityAnswer: string;
}

// ─── Constants ────────────────────────────────────────────

const SESSION_KEY = "aegis_auth_session";

const AVATAR_COLORS = [
  "from-indigo-500 to-purple-600",
  "from-emerald-500 to-teal-600",
  "from-rose-500 to-pink-600",
  "from-amber-500 to-orange-600",
  "from-cyan-500 to-blue-600",
  "from-violet-500 to-fuchsia-600",
];

// ─── Context ──────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authView, setAuthView] = useState<AuthView>("login");

  // Auto-login on mount
  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
        if (token) {
          const res = await fetch("/api/auth/me", {
            headers: {
              "Authorization": `Bearer ${token}`
            }
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.user) {
              setUser(data.user);
            } else {
              localStorage.removeItem(SESSION_KEY);
              sessionStorage.removeItem(SESSION_KEY);
            }
          } else {
            localStorage.removeItem(SESSION_KEY);
            sessionStorage.removeItem(SESSION_KEY);
          }
        }
      } catch (err) {
        console.error("Auth auto-login failed:", err);
        localStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem(SESSION_KEY);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = useCallback(
    async (email: string, password: string, remember: boolean): Promise<{ success: boolean; error?: string }> => {
      try {
        // 1. Fetch salt for email
        const saltRes = await fetch(`/api/auth/salt?email=${encodeURIComponent(email)}`);
        if (!saltRes.ok) {
          const errData = await saltRes.json();
          return { success: false, error: errData.detail || "Failed to fetch login salt." };
        }
        const saltData = await saltRes.json();
        
        // 2. Compute passwordHash using the salt
        const { hash: passwordHash } = await hashPassword(password, saltData.passwordSalt);
        
        // 3. Post to /api/auth/login
        const loginRes = await fetch("/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            passwordHash
          })
        });
        
        if (!loginRes.ok) {
          const errData = await loginRes.json();
          return { success: false, error: errData.detail || "Login failed." };
        }
        
        const loginData = await loginRes.json();
        if (loginData.success && loginData.token) {
          setUser(loginData.user);
          if (remember) {
            localStorage.setItem(SESSION_KEY, loginData.token);
          } else {
            sessionStorage.setItem(SESSION_KEY, loginData.token);
          }
          return { success: true };
        }
        return { success: false, error: "Login response was invalid." };
      } catch (err: any) {
        return { success: false, error: err.message || "An unexpected error occurred during login." };
      }
    },
    []
  );

  const signup = useCallback(
    async (data: SignUpData): Promise<{ success: boolean; error?: string }> => {
      try {
        const { hash: passwordHash, salt: passwordSalt } = await hashPassword(data.password);
        const { hash: securityAnswer, salt: securityAnswerSalt } = await hashPassword(
          data.securityAnswer.trim().toLowerCase()
        );

        const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            fullName: data.fullName.trim(),
            email: data.email.trim().toLowerCase(),
            phone: "",
            bio: "",
            avatarColor,
            securityQuestion: data.securityQuestion,
            securityAnswer,
            securityAnswerSalt,
            passwordHash,
            passwordSalt
          })
        });

        if (!res.ok) {
          const errData = await res.json();
          return { success: false, error: errData.detail || "Signup failed." };
        }

        const signupData = await res.json();
        if (signupData.success && signupData.token) {
          setUser(signupData.user);
          localStorage.setItem(SESSION_KEY, signupData.token);
          return { success: true };
        }
        return { success: false, error: "Signup response was invalid." };
      } catch (err: any) {
        return { success: false, error: err.message || "An unexpected error occurred during signup." };
      }
    },
    []
  );

  const logout = useCallback(async () => {
    const token = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
    if (token) {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
      } catch (err) {
        console.error("Logout API call failed:", err);
      }
    }
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    setAuthView("login");
  }, []);

  const getSecurityQuestion = useCallback((email: string): string | null => {
    // Left as stub for backward compatibility with getSecurityQuestion in interface
    return null;
  }, []);

  const resetPassword = useCallback(
    async (
      email: string,
      securityAnswer: string,
      newPassword: string
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        // 1. Get security answer salt
        const saltRes = await fetch(`/api/auth/security-question?email=${encodeURIComponent(email)}`);
        if (!saltRes.ok) {
          const errData = await saltRes.json();
          return { success: false, error: errData.detail || "Account not found." };
        }
        const saltData = await saltRes.json();
        
        // 2. Hash the security answer with its salt
        const { hash: securityAnswerHash } = await hashPassword(
          securityAnswer.trim().toLowerCase(),
          saltData.securityAnswerSalt
        );
        
        let newPasswordHash = undefined;
        let newPasswordSalt = undefined;
        if (newPassword) {
          const { hash, salt } = await hashPassword(newPassword);
          newPasswordHash = hash;
          newPasswordSalt = salt;
        }
        
        // 3. Post to /api/auth/reset-password
        const res = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            securityAnswerHash,
            newPasswordHash,
            newPasswordSalt
          })
        });
        
        if (!res.ok) {
          const errData = await res.json();
          return { success: false, error: errData.detail || "Reset failed." };
        }
        
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message || "An unexpected error occurred during password reset." };
      }
    },
    []
  );

  const updateProfile = useCallback(
    async (
      updates: Partial<Pick<User, "fullName" | "email" | "phone" | "bio" | "avatarImage">> & {
        securityQuestion?: string;
        securityAnswer?: string;
      }
    ): Promise<void> => {
      if (!user) return;
      try {
        const { securityQuestion, securityAnswer, ...rest } = updates;
        const payload: any = { ...rest };
        
        if (securityQuestion) {
          payload.securityQuestion = securityQuestion;
        }
        
        if (securityQuestion && securityAnswer) {
          const { hash, salt } = await hashPassword(securityAnswer.trim().toLowerCase());
          payload.securityAnswer = hash;
          payload.securityAnswerSalt = salt;
        }
        
        const token = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
        const res = await fetch("/api/auth/profile", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
        
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.detail || "Failed to update profile.");
        }
        
        const data = await res.json();
        if (data.success && data.user) {
          setUser(data.user);
        }
      } catch (err) {
        console.error("Profile update failed:", err);
        throw err;
      }
    },
    [user]
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
      if (!user) return { success: false, error: "Not authenticated." };
      
      try {
        const saltRes = await fetch(`/api/auth/salt?email=${encodeURIComponent(user.email)}`);
        if (!saltRes.ok) {
          return { success: false, error: "Failed to load authentication salts." };
        }
        const saltData = await saltRes.json();
        
        const { hash: currentPasswordHash } = await hashPassword(currentPassword, saltData.passwordSalt);
        const { hash: newPasswordHash, salt: newPasswordSalt } = await hashPassword(newPassword);
        
        const token = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
        const res = await fetch("/api/auth/change-password", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            currentPasswordHash,
            newPasswordHash,
            newPasswordSalt
          })
        });
        
        if (!res.ok) {
          const errData = await res.json();
          return { success: false, error: errData.detail || "Failed to change password." };
        }
        
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message || "An unexpected error occurred." };
      }
    },
    [user]
  );

  const deleteAccount = useCallback(
    async (password: string): Promise<{ success: boolean; error?: string }> => {
      if (!user) return { success: false, error: "Not authenticated." };
      
      try {
        const saltRes = await fetch(`/api/auth/salt?email=${encodeURIComponent(user.email)}`);
        if (!saltRes.ok) {
          return { success: false, error: "Failed to load authentication salts." };
        }
        const saltData = await saltRes.json();
        
        const { hash: passwordHash } = await hashPassword(password, saltData.passwordSalt);
        
        const token = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
        const res = await fetch("/api/auth/delete-account", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            passwordHash
          })
        });
        
        if (!res.ok) {
          const errData = await res.json();
          return { success: false, error: errData.detail || "Failed to delete account." };
        }
        
        logout();
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message || "An unexpected error occurred during account deletion." };
      }
    },
    [user, logout]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        authView,
        setAuthView,
        login,
        signup,
        logout,
        resetPassword,
        getSecurityQuestion,
        updateProfile,
        changePassword,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Async Security Question Loader ──────────────────────

export async function loadSecurityQuestionForEmail(email: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/auth/security-question?email=${encodeURIComponent(email)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.securityQuestion || null;
  } catch (err) {
    console.error("Failed to load security question:", err);
    return null;
  }
}
