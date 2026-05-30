/**
 * AuthContext.tsx — Loosely-coupled authentication provider.
 *
 * Manages user registration, login, logout, password reset, and profile updates.
 * All user data is stored in localStorage as an AES-GCM encrypted blob.
 * Session tokens persist in localStorage for auto-login on return visits.
 *
 * Architecture: Swap this provider with an OAuth/Firebase implementation
 * later without touching any consuming components.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { hashPassword, verifyPassword, encryptData, decryptData } from "../utils/crypto";

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
  securityAnswer: string; // hashed
  securityAnswerSalt: string;
  passwordHash: string;
  passwordSalt: string;
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

const USERS_DB_KEY = "aegis_users_db";
const SESSION_KEY = "aegis_auth_session";

const AVATAR_COLORS = [
  "from-indigo-500 to-purple-600",
  "from-emerald-500 to-teal-600",
  "from-rose-500 to-pink-600",
  "from-amber-500 to-orange-600",
  "from-cyan-500 to-blue-600",
  "from-violet-500 to-fuchsia-600",
];

// ─── Helpers ──────────────────────────────────────────────

async function loadUsersDB(): Promise<User[]> {
  const raw = localStorage.getItem(USERS_DB_KEY);
  if (!raw) return [];
  try {
    const decrypted = await decryptData(raw);
    return JSON.parse(decrypted);
  } catch {
    return [];
  }
}

async function saveUsersDB(users: User[]): Promise<void> {
  const encrypted = await encryptData(JSON.stringify(users));
  localStorage.setItem(USERS_DB_KEY, encrypted);
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

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
        const sessionUserId = localStorage.getItem(SESSION_KEY);
        if (sessionUserId) {
          const users = await loadUsersDB();
          const found = users.find((u) => u.id === sessionUserId);
          if (found) {
            setUser(found);
          } else {
            localStorage.removeItem(SESSION_KEY);
          }
        }
      } catch (err) {
        console.error("Auth auto-login failed:", err);
        localStorage.removeItem(SESSION_KEY);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = useCallback(
    async (email: string, password: string, remember: boolean): Promise<{ success: boolean; error?: string }> => {
      const users = await loadUsersDB();
      const found = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (!found) {
        return { success: false, error: "No account found with this email address." };
      }
      const valid = await verifyPassword(password, found.passwordHash, found.passwordSalt);
      if (!valid) {
        return { success: false, error: "Incorrect password. Please try again." };
      }
      setUser(found);
      if (remember) {
        localStorage.setItem(SESSION_KEY, found.id);
      } else {
        sessionStorage.setItem(SESSION_KEY, found.id);
      }
      return { success: true };
    },
    []
  );

  const signup = useCallback(
    async (data: SignUpData): Promise<{ success: boolean; error?: string }> => {
      const users = await loadUsersDB();
      const exists = users.some((u) => u.email.toLowerCase() === data.email.toLowerCase());
      if (exists) {
        return { success: false, error: "An account with this email already exists." };
      }

      const { hash: passwordHash, salt: passwordSalt } = await hashPassword(data.password);
      const { hash: securityAnswer, salt: securityAnswerSalt } = await hashPassword(
        data.securityAnswer.trim().toLowerCase()
      );

      const newUser: User = {
        id: generateId(),
        fullName: data.fullName.trim(),
        email: data.email.trim().toLowerCase(),
        phone: "",
        bio: "",
        avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
        createdAt: new Date().toISOString(),
        securityQuestion: data.securityQuestion,
        securityAnswer,
        securityAnswerSalt,
        passwordHash,
        passwordSalt,
      };

      users.push(newUser);
      await saveUsersDB(users);

      setUser(newUser);
      localStorage.setItem(SESSION_KEY, newUser.id);
      return { success: true };
    },
    []
  );

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    setAuthView("login");
  }, []);

  const getSecurityQuestion = useCallback((email: string): string | null => {
    // Synchronous check — users DB is small enough to cache
    const raw = localStorage.getItem(USERS_DB_KEY);
    if (!raw) return null;
    // For the sync path, we need to attempt decryption which is async.
    // Instead, we return null and let the caller use an async flow.
    return null; // Handled async in resetPassword
  }, []);

  const resetPassword = useCallback(
    async (
      email: string,
      securityAnswer: string,
      newPassword: string
    ): Promise<{ success: boolean; error?: string }> => {
      const users = await loadUsersDB();
      const idx = users.findIndex((u) => u.email.toLowerCase() === email.toLowerCase());
      if (idx === -1) {
        return { success: false, error: "No account found with this email." };
      }

      const target = users[idx];

      // If newPassword is empty, we're just verifying the security answer
      if (!newPassword) {
        const valid = await verifyPassword(
          securityAnswer.trim().toLowerCase(),
          target.securityAnswer,
          target.securityAnswerSalt
        );
        return valid
          ? { success: true }
          : { success: false, error: "Security answer is incorrect." };
      }

      // Verify answer then update password
      const answerValid = await verifyPassword(
        securityAnswer.trim().toLowerCase(),
        target.securityAnswer,
        target.securityAnswerSalt
      );
      if (!answerValid) {
        return { success: false, error: "Security answer is incorrect." };
      }

      const { hash, salt } = await hashPassword(newPassword);
      users[idx] = { ...target, passwordHash: hash, passwordSalt: salt };
      await saveUsersDB(users);

      return { success: true };
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
      const users = await loadUsersDB();
      const idx = users.findIndex((u) => u.id === user.id);
      if (idx === -1) return;

      const { securityQuestion, securityAnswer, ...rest } = updates;
      const updated = { ...users[idx], ...rest };

      if (updates.email) {
        updated.email = updates.email.trim().toLowerCase();
      }

      if (securityQuestion) {
        updated.securityQuestion = securityQuestion;
      }

      if (securityQuestion && securityAnswer) {
        const { hash, salt } = await hashPassword(securityAnswer.trim().toLowerCase());
        updated.securityAnswer = hash;
        updated.securityAnswerSalt = salt;
      }

      users[idx] = updated;
      await saveUsersDB(users);
      setUser(updated);
    },
    [user]
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
      if (!user) return { success: false, error: "Not authenticated." };

      const valid = await verifyPassword(currentPassword, user.passwordHash, user.passwordSalt);
      if (!valid) {
        return { success: false, error: "Current password is incorrect." };
      }

      const { hash, salt } = await hashPassword(newPassword);
      const users = await loadUsersDB();
      const idx = users.findIndex((u) => u.id === user.id);
      if (idx === -1) return { success: false, error: "User not found." };

      users[idx] = { ...users[idx], passwordHash: hash, passwordSalt: salt };
      await saveUsersDB(users);
      setUser(users[idx]);
      return { success: true };
    },
    [user]
  );

  const deleteAccount = useCallback(
    async (password: string): Promise<{ success: boolean; error?: string }> => {
      if (!user) return { success: false, error: "Not authenticated." };

      const valid = await verifyPassword(password, user.passwordHash, user.passwordSalt);
      if (!valid) {
        return { success: false, error: "Password is incorrect." };
      }

      const users = await loadUsersDB();
      const filtered = users.filter((u) => u.id !== user.id);
      await saveUsersDB(filtered);
      logout();
      return { success: true };
    },
    [user, logout]
  );

  // Also check sessionStorage for non-persistent sessions
  useEffect(() => {
    if (!user && !isLoading) {
      const sessionId = sessionStorage.getItem(SESSION_KEY);
      if (sessionId) {
        (async () => {
          const users = await loadUsersDB();
          const found = users.find((u) => u.id === sessionId);
          if (found) setUser(found);
        })();
      }
    }
  }, [user, isLoading]);

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
  const users = await loadUsersDB();
  const found = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  return found ? found.securityQuestion : null;
}
