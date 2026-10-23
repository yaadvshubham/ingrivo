"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth, AuthModalTab } from "@/context/AuthContext";
import { isFirebaseConfigured } from "@/lib/firebase";
import {
  X,
  Mail,
  Lock,
  User,
  KeyRound,
  ArrowRight,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Info,
  ExternalLink,
} from "lucide-react";
import { LogoIcon } from "@/components/brand/Logo";

export function AuthModal() {
  const {
    isAuthModalOpen,
    authModalTab,
    openAuthModal,
    closeAuthModal,
    loginWithGoogle,
    loginWithPassword,
    signUpWithPassword,
    requestOtp,
    verifyOtpAndLogin,
    requestPasswordReset,
    resetPassword,
  } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Reset errors and fields on modal open or tab change
  useEffect(() => {
    if (isAuthModalOpen) {
      setErrorMsg(null);
      setSuccessMsg(null);
      setOtpSent(false);
      setOtpDigits(["", "", "", "", "", ""]);
    }
  }, [isAuthModalOpen, authModalTab]);

  // Resend cooldown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  // Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isAuthModalOpen) {
        closeAuthModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAuthModalOpen, closeAuthModal]);

  if (!isAuthModalOpen) return null;

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newDigits = [...otpDigits];
    newDigits[index] = value.slice(-1);
    setOtpDigits(newDigits);

    // Auto advance
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;

    const newDigits = [...otpDigits];
    for (let i = 0; i < pasted.length; i++) {
      newDigits[i] = pasted[i];
    }
    setOtpDigits(newDigits);
    const nextIdx = Math.min(pasted.length, 5);
    otpInputRefs.current[nextIdx]?.focus();
  };

  // Google Login Handler
  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setIsLoading(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to log in with Google.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickSignIn = async (userEmail: string, userName: string) => {
    setErrorMsg(null);
    setIsLoading(true);
    try {
      await loginWithGoogle({ email: userEmail, name: userName });
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to sign in.");
    } finally {
      setIsLoading(false);
    }
  };

  // Sign In with Password
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg("Please enter both email and password.");
      return;
    }
    setErrorMsg(null);
    setIsLoading(true);
    try {
      await loginWithPassword(email, password);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to sign in. Check your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  // Sign Up with Password
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg("Please enter email and password.");
      return;
    }
    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters.");
      return;
    }
    setErrorMsg(null);
    setIsLoading(true);
    try {
      await signUpWithPassword(email, password, name || email.split("@")[0]);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to register.");
    } finally {
      setIsLoading(false);
    }
  };

  // Request OTP for Login
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email) {
      setErrorMsg("Please enter your email address.");
      return;
    }
    setErrorMsg(null);
    setIsLoading(true);
    try {
      const res = await requestOtp(email, "login");
      setOtpSent(true);
      setCooldown(30);
      setSuccessMsg(res.message || "Verification code sent to your email!");
      setTimeout(() => otpInputRefs.current[0]?.focus(), 200);
    } catch (err: any) {
      setErrorMsg(err.message || "Could not send OTP code.");
    } finally {
      setIsLoading(false);
    }
  };

  // Verify OTP & Login
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otpDigits.join("");
    if (code.length < 6) {
      setErrorMsg("Please enter the complete 6-digit verification code.");
      return;
    }
    setErrorMsg(null);
    setIsLoading(true);
    try {
      await verifyOtpAndLogin(email, code);
    } catch (err: any) {
      setErrorMsg(err.message || "Invalid or expired verification code.");
    } finally {
      setIsLoading(false);
    }
  };

  // Request Forgot Password OTP
  const handleSendForgotOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMsg("Please enter your registered email address.");
      return;
    }
    setErrorMsg(null);
    setIsLoading(true);
    try {
      const res = await requestPasswordReset(email);
      setOtpSent(true);
      setCooldown(30);
      setSuccessMsg(res.message || "Password reset code sent to your email!");
      setTimeout(() => otpInputRefs.current[0]?.focus(), 200);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to send password reset code.");
    } finally {
      setIsLoading(false);
    }
  };

  // Complete Password Reset
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otpDigits.join("");
    if (code.length < 6) {
      setErrorMsg("Please enter the 6-digit reset code sent to your email.");
      return;
    }
    if (newPassword.length < 6) {
      setErrorMsg("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }
    setErrorMsg(null);
    setIsLoading(true);
    try {
      const res = await resetPassword(email, code, newPassword);
      setSuccessMsg(res.message || "Password changed! Signing you in...");
      // Auto login with new password
      await loginWithPassword(email, newPassword);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to reset password. Check the code.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="relative w-full max-w-md bg-[#FBF8F2] border border-[#E4DEC3] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header Ribbon */}
        <div className="relative px-6 pt-6 pb-4 bg-gradient-to-b from-[#EFEAE0] to-[#FBF8F2] border-b border-[#E4DEC3]/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <LogoIcon size={32} className="shrink-0" />
              <div>
                <h2 id="auth-modal-title" className="text-base font-bold text-[#1B2A22]">
                  {authModalTab === "signin" && "Welcome Back to Pinfo"}
                  {authModalTab === "signup" && "Create Your Account"}
                  {authModalTab === "otp" && "Email OTP Verification"}
                  {authModalTab === "forgot" && "Reset Your Password"}
                </h2>
                <p className="text-xs text-[#64748B]">Personalized Food Intelligence</p>
              </div>
            </div>
            <button
              onClick={closeAuthModal}
              className="p-1.5 rounded-lg text-[#64748B] hover:text-[#1B2A22] hover:bg-black/5 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 mt-4 p-1 bg-white/70 rounded-xl border border-[#E4DEC3]">
            <button
              onClick={() => openAuthModal("signin")}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                authModalTab === "signin"
                  ? "bg-[#1E5B45] text-white shadow-xs"
                  : "text-[#64748B] hover:text-[#1B2A22]"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => openAuthModal("signup")}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                authModalTab === "signup"
                  ? "bg-[#1E5B45] text-white shadow-xs"
                  : "text-[#64748B] hover:text-[#1B2A22]"
              }`}
            >
              Sign Up
            </button>
            <button
              onClick={() => openAuthModal("otp")}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                authModalTab === "otp"
                  ? "bg-[#1E5B45] text-white shadow-xs"
                  : "text-[#64748B] hover:text-[#1B2A22]"
              }`}
            >
              OTP Login
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {/* Error Message */}
          {errorMsg && (
            <div className="flex flex-col gap-2 p-3 text-xs bg-red-50 text-red-800 border border-red-200 rounded-xl">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                <div className="flex-1">{errorMsg.replace(/^GOOGLE_POPUP_CLOSED:/, "")}</div>
              </div>
              {(errorMsg.includes("origin") || errorMsg.includes("GOOGLE_POPUP_CLOSED") || errorMsg.includes("401")) && (
                <div className="mt-1 pt-2 border-t border-red-200/60 flex flex-col gap-1.5 text-[11px] text-red-900">
                  <p>
                    <strong>Fix for Google Sign-In:</strong> Add <code className="bg-white/80 px-1 py-0.5 rounded font-mono font-bold">http://localhost:3000</code> to <em>Authorized JavaScript Origins</em> in Google Cloud Console.
                  </p>
                  <div className="flex items-center gap-3">
                    <a
                      href="https://console.cloud.google.com/apis/credentials"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-bold text-[#1E5B45] underline hover:text-[#164634]"
                    >
                      Google Cloud Console <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => handleQuickSignIn("yaadvshubham01@gmail.com", "Shubham Yadav")}
                      className="font-bold text-[#1E5B45] underline hover:text-[#164634]"
                    >
                      Sign in as yaadvshubham01@gmail.com now
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Success Message */}
          {successMsg && (
            <div className="flex items-start gap-2.5 p-3 text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              <div className="flex-1">{successMsg}</div>
            </div>
          )}

          {/* Google One-Click Login Button */}
          {authModalTab !== "forgot" && (
            <>
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-white hover:bg-neutral-50 text-[#1B2A22] text-xs font-semibold rounded-xl border border-[#D5CEB8] shadow-xs transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="relative flex items-center justify-center">
                <div className="border-t border-[#E4DEC3] w-full" />
                <span className="bg-[#FBF8F2] px-3 text-[11px] uppercase tracking-wider text-[#94A3B8] font-medium">
                  or with email
                </span>
              </div>
            </>
          )}

          {/* TAB 1: SIGN IN */}
          {authModalTab === "signin" && (
            <form onSubmit={handleSignIn} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#1B2A22] mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-2.5 text-[#94A3B8]" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#D5CEB8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E5B45]"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-[#1B2A22]">Password</label>
                  <button
                    type="button"
                    onClick={() => openAuthModal("forgot")}
                    className="text-[11px] font-medium text-[#1E5B45] hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-2.5 text-[#94A3B8]" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#D5CEB8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E5B45]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-[#1E5B45] hover:bg-[#164634] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 hover:shadow-md disabled:opacity-50"
              >
                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                <span>Sign In</span>
              </button>
            </form>
          )}

          {/* TAB 2: SIGN UP */}
          {authModalTab === "signup" && (
            <form onSubmit={handleSignUp} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#1B2A22] mb-1">Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-2.5 text-[#94A3B8]" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your Name"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#D5CEB8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E5B45]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B2A22] mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-2.5 text-[#94A3B8]" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#D5CEB8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E5B45]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B2A22] mb-1">Password (min 6 chars)</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-2.5 text-[#94A3B8]" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a password"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#D5CEB8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E5B45]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-[#1E5B45] hover:bg-[#164634] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 hover:shadow-md disabled:opacity-50"
              >
                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>Create Account</span>
              </button>
            </form>
          )}

          {/* TAB 3: OTP LOGIN */}
          {authModalTab === "otp" && (
            <div className="space-y-3">
              {!otpSent ? (
                <form onSubmit={handleSendOtp} className="space-y-3">
                  <p className="text-xs text-[#64748B]">
                    No password required. Enter your email and we will send you a 6-digit verification code.
                  </p>
                  <div>
                    <label className="block text-xs font-semibold text-[#1B2A22] mb-1">Email Address</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3 top-2.5 text-[#94A3B8]" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#D5CEB8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E5B45]"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 px-4 bg-[#1E5B45] hover:bg-[#164634] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 hover:shadow-md disabled:opacity-50"
                  >
                    {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                    <span>Send 6-Digit OTP</span>
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="text-center">
                    <p className="text-xs text-[#64748B]">
                      Enter the 6-digit code sent to <strong className="text-[#1B2A22]">{email}</strong>:
                    </p>
                  </div>

                  {/* 6 Digit Input Boxes */}
                  <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
                    {otpDigits.map((digit, i) => (
                      <input
                        key={i}
                        ref={(el) => {
                          otpInputRefs.current[i] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(i, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                        className="w-10 h-12 text-center text-lg font-mono font-bold bg-white border border-[#D5CEB8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E5B45] focus:border-[#1E5B45]"
                      />
                    ))}
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || otpDigits.join("").length < 6}
                    className="w-full py-2.5 px-4 bg-[#1E5B45] hover:bg-[#164634] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 hover:shadow-md disabled:opacity-50"
                  >
                    {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    <span>Verify & Log In</span>
                  </button>

                  <div className="flex items-center justify-between text-xs text-[#64748B]">
                    <button
                      type="button"
                      onClick={() => setOtpSent(false)}
                      className="hover:underline text-[#1E5B45]"
                    >
                      Change email
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendOtp()}
                      disabled={cooldown > 0}
                      className="hover:underline disabled:opacity-50"
                    >
                      {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 4: FORGOT PASSWORD */}
          {authModalTab === "forgot" && (
            <div className="space-y-3">
              {!otpSent ? (
                <form onSubmit={handleSendForgotOtp} className="space-y-3">
                  <p className="text-xs text-[#64748B]">
                    Enter your email address and we will email you a 6-digit verification code to reset your password.
                  </p>
                  <div>
                    <label className="block text-xs font-semibold text-[#1B2A22] mb-1">Email Address</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3 top-2.5 text-[#94A3B8]" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#D5CEB8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E5B45]"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 px-4 bg-[#1E5B45] hover:bg-[#164634] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 hover:shadow-md disabled:opacity-50"
                  >
                    {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                    <span>Send Reset Code</span>
                  </button>
                </form>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-3">
                  <div className="text-center">
                    <p className="text-xs text-[#64748B]">
                      Enter the 6-digit code sent to <strong className="text-[#1B2A22]">{email}</strong>:
                    </p>
                  </div>

                  {/* 6 Digit Input Boxes */}
                  <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
                    {otpDigits.map((digit, i) => (
                      <input
                        key={i}
                        ref={(el) => {
                          otpInputRefs.current[i] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(i, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                        className="w-9 h-11 text-center text-lg font-mono font-bold bg-white border border-[#D5CEB8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E5B45]"
                      />
                    ))}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#1B2A22] mb-1">New Password (min 6 chars)</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="w-full px-3 py-2 text-xs bg-white border border-[#D5CEB8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E5B45]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#1B2A22] mb-1">Confirm New Password</label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat new password"
                      className="w-full px-3 py-2 text-xs bg-white border border-[#D5CEB8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E5B45]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || otpDigits.join("").length < 6}
                    className="w-full py-2.5 px-4 bg-[#1E5B45] hover:bg-[#164634] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 hover:shadow-md disabled:opacity-50"
                  >
                    {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    <span>Update Password & Log In</span>
                  </button>

                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => openAuthModal("signin")}
                      className="text-xs text-[#1E5B45] hover:underline"
                    >
                      Back to Sign In
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Footer Note */}
        <div className="px-6 py-3 bg-[#EFEAE0]/50 border-t border-[#E4DEC3]/50 flex items-center justify-between text-[11px] text-[#64748B]">
          <span>Protected by Firebase & Pinfo Shield</span>
          <span className="flex items-center gap-1">
            <Info className="w-3 h-3" /> Real SMTP Delivery
          </span>
        </div>
      </div>
    </div>
  );
}
