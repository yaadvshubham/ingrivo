"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { auth, googleProvider, isFirebaseConfigured } from "@/lib/firebase";
import {
  triggerUniversalGoogleSignIn,
  processGoogleRedirectHash,
  GoogleUserProfile,
} from "@/lib/googleAuth";
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from "firebase/auth";

export interface UserProfile {
  uid: string;
  email: string;
  phone?: string;
  name?: string;
  photoURL?: string;
  role?: string;
}

export interface UserPreferences {
  dietary_preferences: string[];
  allergens: string[];
  health_goals: string[];
}

export type AuthModalTab = "signin" | "signup" | "otp" | "forgot";

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAdmin: boolean;
  preferences: UserPreferences;
  isLoading: boolean;
  isAuthModalOpen: boolean;
  authModalTab: AuthModalTab;
  openAuthModal: (tab?: AuthModalTab) => void;
  closeAuthModal: () => void;
  loginWithGoogle: (googleUserOverride?: { email?: string; name?: string; photoURL?: string; idToken?: string }) => Promise<any>;
  loginWithPassword: (emailOrPhone: string, pass: string) => Promise<any>;
  signUpWithPassword: (emailOrPhone: string, pass: string, name: string) => Promise<any>;
  requestOtp: (email: string, purpose?: "login" | "forgot_password" | "signup") => Promise<{ success: boolean; message: string }>;
  verifyOtpAndLogin: (email: string, code: string) => Promise<void>;
  requestMobileOtp: (phone: string, purpose?: "login" | "forgot_password" | "signup") => Promise<{ success: boolean; message: string }>;
  verifyMobileOtpAndLogin: (phone: string, code: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; message: string }>;
  resetPassword: (email: string, code: string, newPass: string) => Promise<{ success: boolean; message: string }>;
  resetPasswordMobile: (phone: string, code: string, newPass: string) => Promise<{ success: boolean; message: string }>;
  updatePreferences: (newPrefs: Partial<UserPreferences>) => Promise<void>;
  logout: () => Promise<void>;
}

const defaultPreferences: UserPreferences = {
  dietary_preferences: [],
  allergens: [],
  health_goals: [],
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
const TOKEN_KEY = "ingrivo.auth.token";
const USER_KEY = "ingrivo.auth.user";
const PREFS_KEY = "ingrivo.auth.preferences";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<AuthModalTab>("signin");

  // Load local session on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const savedToken = localStorage.getItem(TOKEN_KEY);
      const savedUser = localStorage.getItem(USER_KEY);
      const savedPrefs = localStorage.getItem(PREFS_KEY);

      if (savedToken && savedUser) {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      }
      if (savedPrefs) {
        setPreferences(JSON.parse(savedPrefs));
      }
    } catch (e) {
      console.warn("Could not read auth from localStorage:", e);
    } finally {
      setIsLoading(false);
    }

    // Check if returning from Google redirect flow in URL hash
    processGoogleRedirectHash()
      .then((redirectProfile) => {
        if (redirectProfile) {
          syncGoogleUserWithBackend({
            email: redirectProfile.email,
            name: redirectProfile.name,
            photo_url: redirectProfile.photoURL,
            id_token: redirectProfile.idToken,
          }).catch((e) => console.warn("Google redirect auto-sync error:", e));
        }
      })
      .catch((e) => console.warn("Could not parse redirect hash:", e));

    // Listen to Firebase auth changes if configured
    if (auth && isFirebaseConfigured()) {
      const unsubscribe = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
        if (fbUser) {
          const idToken = await fbUser.getIdToken();
          const profile: UserProfile = {
            uid: fbUser.uid,
            email: fbUser.email || "",
            name: fbUser.displayName || fbUser.email?.split("@")[0],
            photoURL: fbUser.photoURL || undefined,
          };
          setUser(profile);
          setToken(idToken);
          localStorage.setItem(TOKEN_KEY, idToken);
          localStorage.setItem(USER_KEY, JSON.stringify(profile));
          fetchPreferences(idToken);
        }
      });
      return () => unsubscribe();
    }
  }, []);

  const openAuthModal = useCallback((tab: AuthModalTab = "signin") => {
    setAuthModalTab(tab);
    setIsAuthModalOpen(false);
    if (typeof window !== "undefined") {
      const current = window.location.pathname;
      const redirect = current && current !== "/login" ? `?redirect=${encodeURIComponent(current + window.location.search)}` : "";
      const mode = tab === "signup" ? (redirect ? "&mode=signup" : "?mode=signup") : "";
      router.push(`/login${redirect}${mode}`);
    }
  }, [router]);

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
  }, []);

  const saveSession = useCallback((newToken: string, newUser: UserProfile) => {
    const role = newUser.role || (newUser.email?.toLowerCase() === "yaadvshubham01@gmail.com" ? "admin" : "user");
    const userWithRole: UserProfile = { ...newUser, role };
    setToken(newToken);
    setUser(userWithRole);
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(userWithRole));
    fetchPreferences(newToken);
  }, []);

  const syncGoogleUserWithBackend = useCallback(
    async (payload: { email?: string; name?: string; photo_url?: string; id_token?: string }) => {
      const res = await fetch(`${API_BASE}/api/v1/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail?.split(":")[1] || errData.detail || "Failed to authenticate with Google.");
      }

      const data = await res.json();
      const role = data.user.role || (data.user.email?.toLowerCase() === "yaadvshubham01@gmail.com" ? "admin" : "user");
      const profile: UserProfile = {
        uid: data.user.uid,
        email: data.user.email,
        name: data.user.name,
        photoURL: data.user.photo_url || payload.photo_url,
        role: role,
      };

      saveSession(data.access_token, profile);
      closeAuthModal();
      return profile;
    },
    [saveSession, closeAuthModal]
  );

  const fetchPreferences = async (authToken: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          const role = data.user.role || (data.user.email?.toLowerCase() === "yaadvshubham01@gmail.com" ? "admin" : "user");
          setUser((prev) => {
            if (!prev) return { ...data.user, role };
            return { ...prev, ...data.user, role };
          });
        }
        if (data.preferences) {
          setPreferences(data.preferences);
          localStorage.setItem(PREFS_KEY, JSON.stringify(data.preferences));
        }
      }
    } catch (e) {
      console.warn("Could not load user preferences:", e);
    }
  };

  // 1. Universal Google Sign-in & Sign-up (Windows, Mac, Android, iOS)
  const loginWithGoogle = async (googleUserOverride?: {
    email?: string;
    name?: string;
    photoURL?: string;
    idToken?: string;
  }) => {
    setIsLoading(true);
    try {
      const email = googleUserOverride?.email || "";
      const name = googleUserOverride?.name || "";
      const photoURL = googleUserOverride?.photoURL || "";
      const idToken = googleUserOverride?.idToken;

      // Case A: User profile or id_token already provided
      if (email || idToken) {
        return await syncGoogleUserWithBackend({
          email,
          name,
          photo_url: photoURL,
          id_token: idToken,
        });
      }

      // Case B: If Firebase is configured with real credentials
      if (auth && googleProvider && isFirebaseConfigured()) {
        try {
          const res = await signInWithPopup(auth, googleProvider);
          return await syncGoogleUserWithBackend({
            email: res.user.email || "",
            name: res.user.displayName || "",
            photo_url: res.user.photoURL || "",
          });
        } catch (fbErr: any) {
          console.warn("Firebase popup skipped/failed, using universal Google OAuth:", fbErr);
        }
      }

      // Case C: Universal Cross-Platform Google Sign-In (Desktop popup with fallback or mobile redirect)
      return await new Promise<UserProfile>((resolve, reject) => {
        triggerUniversalGoogleSignIn({
          onSuccess: async (profile) => {
            try {
              const synced = await syncGoogleUserWithBackend({
                email: profile.email,
                name: profile.name,
                photo_url: profile.photoURL,
                id_token: profile.idToken,
              });
              resolve(synced);
            } catch (syncErr) {
              reject(syncErr);
            }
          },
          onError: (err) => {
            reject(err);
          },
        });
      });
    } catch (err: any) {
      console.error("Google sign in error:", err);
      throw new Error(err.message || "Failed to sign in with Google.");
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Email / Mobile + Password Login
  const loginWithPassword = async (identifier: string, pass: string) => {
    setIsLoading(true);
    try {
      const cleanIdent = identifier.trim();
      const isEmail = cleanIdent.includes("@");

      if (isEmail && auth && isFirebaseConfigured()) {
        try {
          const cred = await signInWithEmailAndPassword(auth, cleanIdent, pass);
          const idToken = await cred.user.getIdToken();
          const profile: UserProfile = {
            uid: cred.user.uid,
            email: cred.user.email || cleanIdent,
            name: cred.user.displayName || cleanIdent.split("@")[0],
          };
          saveSession(idToken, profile);
          closeAuthModal();
          return profile;
        } catch (fbErr: any) {
          console.warn("Firebase signin failed, checking backend database:", fbErr.message);
        }
      }

      // Backend password check (supports email or phone number)
      const res = await fetch(`${API_BASE}/api/v1/auth/login-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: cleanIdent, password: pass }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail?.split(":")[1] || data.detail || "Invalid login credentials.");
      }

      saveSession(data.access_token, data.user);
      closeAuthModal();
      return data.user;
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Email / Mobile + Password Sign Up
  const signUpWithPassword = async (identifier: string, pass: string, name: string) => {
    setIsLoading(true);
    try {
      const cleanIdent = identifier.trim();
      const isEmail = cleanIdent.includes("@");

      if (isEmail && auth && isFirebaseConfigured()) {
        try {
          const cred = await createUserWithEmailAndPassword(auth, cleanIdent, pass);
          await updateProfile(cred.user, { displayName: name });
        } catch (fbErr: any) {
          console.warn("Firebase createUser skipped/failed, proceeding to backend registration:", fbErr.message);
        }
      }

      // Register in backend database
      const res = await fetch(`${API_BASE}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: cleanIdent, password: pass, name }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail?.split(":")[1] || data.detail || "Failed to create account.");
      }

      saveSession(data.access_token, data.user);
      closeAuthModal();
      return data.user;
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Request 6-digit OTP
  const requestOtp = async (email: string, purpose: "login" | "forgot_password" | "signup" = "login") => {
    const res = await fetch(`${API_BASE}/api/v1/auth/send-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, purpose }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail?.split(":")[1] || data.detail || "Failed to send OTP code.");
    }
    return data;
  };

  // 5. Verify 6-digit OTP and Log In
  const verifyOtpAndLogin = async (email: string, code: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail?.split(":")[1] || data.detail || "Invalid verification code.");
      }

      saveSession(data.access_token, data.user);
      closeAuthModal();
    } finally {
      setIsLoading(false);
    }
  };

  // 6. Request Password Reset OTP
  const requestPasswordReset = async (email: string) => {
    const res = await fetch(`${API_BASE}/api/v1/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail?.split(":")[1] || data.detail || "Failed to send reset code.");
    }
    return data;
  };

  // 7. Reset Password with OTP
  const resetPassword = async (email: string, code: string, newPass: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, new_password: newPass }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail?.split(":")[1] || data.detail || "Failed to reset password.");
      }
      return data;
    } finally {
      setIsLoading(false);
    }
  };

  // 7b. Request Mobile OTP
  const requestMobileOtp = async (phone: string, purpose: "login" | "forgot_password" | "signup" = "login") => {
    const res = await fetch(`${API_BASE}/api/v1/auth/send-mobile-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, purpose }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail?.split(":")[1] || data.detail || "Failed to send mobile verification code.");
    }
    return data;
  };

  // 7c. Verify Mobile OTP & Log In
  const verifyMobileOtpAndLogin = async (phone: string, code: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/verify-mobile-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail?.split(":")[1] || data.detail || "Invalid mobile verification code.");
      }

      saveSession(data.access_token, data.user);
      closeAuthModal();
    } finally {
      setIsLoading(false);
    }
  };

  // 7d. Reset Password with Mobile OTP
  const resetPasswordMobile = async (phone: string, code: string, newPass: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/reset-password-mobile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code, new_password: newPass }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail?.split(":")[1] || data.detail || "Failed to reset password.");
      }
      return data;
    } finally {
      setIsLoading(false);
    }
  };

  // 8. Update Dietary & Allergen Preferences
  const updatePreferences = async (newPrefs: Partial<UserPreferences>) => {
    const merged = { ...preferences, ...newPrefs };
    setPreferences(merged);
    localStorage.setItem(PREFS_KEY, JSON.stringify(merged));

    if (token) {
      try {
        await fetch(`${API_BASE}/api/v1/auth/preferences`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(merged),
        });
      } catch (e) {
        console.warn("Could not sync preferences with cloud:", e);
      }
    }
  };

  // 9. Logout
  const logout = async () => {
    if (auth) {
      try {
        await firebaseSignOut(auth);
      } catch (e) {
        // ignore
      }
    }
    setUser(null);
    setToken(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  };

  const isAdmin = Boolean(
    user && (user.role === "admin" || user.email?.toLowerCase() === "yaadvshubham01@gmail.com")
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAdmin,
        preferences,
        isLoading,
        isAuthModalOpen,
        authModalTab,
        openAuthModal,
        closeAuthModal,
        loginWithGoogle,
        loginWithPassword,
        signUpWithPassword,
        requestOtp,
        verifyOtpAndLogin,
        requestMobileOtp,
        verifyMobileOtpAndLogin,
        requestPasswordReset,
        resetPassword,
        resetPasswordMobile,
        updatePreferences,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    if (process.env.NODE_ENV === "test") {
      const mockUser: UserProfile = {
        uid: "test_user_id",
        email: "test@example.com",
        name: "Test User",
        photoURL: "https://lh3.googleusercontent.com/test-photo.jpg",
        role: "user",
      };
      return {
        user: mockUser,
        token: "test_jwt_token",
        isAdmin: false,
        isLoading: false,
        isAuthModalOpen: false,
        authModalTab: "signin",
        preferences: defaultPreferences,
        openAuthModal: () => {},
        closeAuthModal: () => {},
        loginWithGoogle: async () => mockUser,
        loginWithPassword: async () => mockUser,
        signUpWithPassword: async () => mockUser,
        requestOtp: async () => ({ success: true, message: "Code sent" }),
        verifyOtpAndLogin: async () => {},
        requestMobileOtp: async () => ({ success: true, message: "Code sent" }),
        verifyMobileOtpAndLogin: async () => {},
        requestPasswordReset: async () => ({ success: true, message: "Reset code sent" }),
        resetPassword: async () => ({ success: true, message: "Password updated" }),
        resetPasswordMobile: async () => ({ success: true, message: "Password updated" }),
        updatePreferences: async () => {},
        logout: async () => {},
      };
    }
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
