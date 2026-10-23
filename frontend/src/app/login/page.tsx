"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Script from "next/script";
import { useAuth } from "@/context/AuthContext";
import {
  Mail,
  Lock,
  Phone,
  User,
  KeyRound,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  Search,
  ScanBarcode,
  Heart,
  ExternalLink,
  Settings,
  X,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

const COUNTRY_CODES = [
  { code: "+91", label: "India (+91)", flag: "🇮🇳" },
  { code: "+1", label: "USA / Canada (+1)", flag: "🇺🇸" },
  { code: "+44", label: "UK (+44)", flag: "🇬🇧" },
  { code: "+971", label: "UAE (+971)", flag: "🇦🇪" },
  { code: "+61", label: "Australia (+61)", flag: "🇦🇺" },
  { code: "+49", label: "Germany (+49)", flag: "🇩🇪" },
  { code: "+65", label: "Singapore (+65)", flag: "🇸🇬" },
];

function calculatePasswordStrength(pass: string): { score: number; label: string; color: string } {
  if (!pass) return { score: 0, label: "", color: "bg-gray-200" };
  let score = 0;
  if (pass.length >= 6) score += 1;
  if (pass.length >= 8) score += 1;
  if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score += 1;
  if (/\d/.test(pass) || /[^A-Za-z0-9]/.test(pass)) score += 1;

  if (score <= 1) return { score: 1, label: "Weak", color: "bg-red-500" };
  if (score === 2) return { score: 2, label: "Fair", color: "bg-amber-500" };
  if (score === 3) return { score: 3, label: "Good", color: "bg-blue-500" };
  return { score: 4, label: "Strong", color: "bg-emerald-500" };
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "/";
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "signin";

  const {
    user,
    loginWithGoogle,
    loginWithPassword,
    signUpWithPassword,
    requestOtp,
    verifyOtpAndLogin,
    requestMobileOtp,
    verifyMobileOtpAndLogin,
    resetPassword,
    resetPasswordMobile,
  } = useAuth();

  // Primary mode: sign in vs sign up vs forgot password
  const [authMode, setAuthMode] = useState<"signin" | "signup" | "forgot">(initialMode);

  // Method: email vs mobile phone
  const [method, setMethod] = useState<"email" | "phone">("email");

  // Sign In sub-method: password vs otp
  const [signInWithOtp, setSignInWithOtp] = useState<boolean>(false);

  // Form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // OTP flow state
  const [otpSent, setOtpSent] = useState(false);
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [cooldown, setCooldown] = useState(0);

  // Real Google OAuth Setup Modal state
  const [showGoogleSetup, setShowGoogleSetup] = useState(false);
  const [customClientId, setCustomClientId] = useState("");

  // Loading & feedback
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Update mode if query param changes
  useEffect(() => {
    const qMode = searchParams.get("mode");
    if (qMode === "signup") {
      setAuthMode("signup");
    } else if (qMode === "signin") {
      setAuthMode("signin");
    }
  }, [searchParams]);

  // If already authenticated, redirect to destination
  useEffect(() => {
    if (user) {
      router.push(redirectUrl);
    }
  }, [user, router, redirectUrl]);

  // Resend OTP countdown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const resetMessages = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleModeSwitch = (mode: "signin" | "signup" | "forgot") => {
    setAuthMode(mode);
    setOtpSent(false);
    setOtpDigits(["", "", "", "", "", ""]);
    setSignInWithOtp(false);
    resetMessages();
  };

  const handleOtpChange = (index: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const newDigits = [...otpDigits];
    newDigits[index] = val.slice(-1);
    setOtpDigits(newDigits);

    if (val && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
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
    otpRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const fullPhone = `${countryCode}${phoneNumber.replace(/\D/g, "")}`;
  const passwordStrength = calculatePasswordStrength(password);

  // ---------------------------------------------------------------------------
  // Action Handlers
  // ---------------------------------------------------------------------------

  // 1. Universal Google Sign-In & Sign-Up (Desktop popup + Mobile iOS/Android redirect)
  const handleGoogleSignIn = async () => {
    resetMessages();
    setIsGoogleLoading(true);

    try {
      await loginWithGoogle();
      router.push(redirectUrl);
    } catch (err: any) {
      if (err.message && err.message.includes("GOOGLE_OAUTH_SETUP_NEEDED")) {
        setShowGoogleSetup(true);
      } else {
        setErrorMsg(err.message || "Failed to sign in with Google.");
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSaveGoogleClientId = (e: React.FormEvent) => {
    e.preventDefault();
    const id = customClientId.trim();
    if (!id) return;
    if (typeof window !== "undefined") {
      localStorage.setItem("pinfo_google_client_id", id);
    }
    setShowGoogleSetup(false);
    handleGoogleSignIn();
  };

  // 2. Password Sign In
  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    const identifier = method === "email" ? email.trim() : fullPhone;

    if (!identifier) {
      setErrorMsg(`Please enter your ${method === "email" ? "email address" : "mobile phone number"}.`);
      return;
    }
    if (!password) {
      setErrorMsg("Please enter your password.");
      return;
    }

    setIsLoading(true);
    try {
      await loginWithPassword(identifier, password);
      router.push(redirectUrl);
    } catch (err: any) {
      setErrorMsg(err.message || "Invalid credentials. Please verify your details or use OTP / Forgot Password.");
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Create Account (Sign Up)
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    const identifier = method === "email" ? email.trim() : fullPhone;

    if (!name.trim()) {
      setErrorMsg("Please enter your full name.");
      return;
    }
    if (!identifier) {
      setErrorMsg(`Please enter your ${method === "email" ? "email address" : "mobile number"}.`);
      return;
    }
    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters.");
      return;
    }
    if (confirmPassword && password !== confirmPassword) {
      setErrorMsg("Passwords do not match. Please re-enter.");
      return;
    }
    if (!agreeTerms) {
      setErrorMsg("Please agree to the Terms of Service to continue.");
      return;
    }

    setIsLoading(true);
    try {
      await signUpWithPassword(identifier, password, name.trim());
      setSuccessMsg("Account created successfully! Welcome to Pinfo.");
      router.push(redirectUrl);
    } catch (err: any) {
      setErrorMsg(err.message || "Could not register account. You may already have an account with these credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Send OTP Code
  const handleSendOtp = async (purpose: "login" | "forgot_password" = "login") => {
    resetMessages();
    setIsLoading(true);
    try {
      if (method === "email") {
        if (!email.trim() || !email.includes("@")) {
          throw new Error("Please enter a valid email address.");
        }
        const res = await requestOtp(email.trim(), purpose);
        setOtpSent(true);
        setCooldown(30);
        setSuccessMsg(res.message || `Verification code sent to ${email}!`);
      } else {
        const digitsOnly = phoneNumber.replace(/\D/g, "");
        if (digitsOnly.length < 7) {
          throw new Error("Please enter a valid mobile number.");
        }
        const res = await requestMobileOtp(fullPhone, purpose);
        setOtpSent(true);
        setCooldown(30);
        setSuccessMsg(res.message || `Verification code sent to ${fullPhone}!`);
      }
      setTimeout(() => otpRefs.current[0]?.focus(), 150);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to send verification code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // 5. Verify OTP and Sign In
  const handleVerifyOtpSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    const code = otpDigits.join("");
    if (code.length < 6) {
      setErrorMsg("Please enter all 6 digits of the verification code.");
      return;
    }

    setIsLoading(true);
    try {
      if (method === "email") {
        await verifyOtpAndLogin(email.trim(), code);
      } else {
        await verifyMobileOtpAndLogin(fullPhone, code);
      }
      router.push(redirectUrl);
    } catch (err: any) {
      setErrorMsg(err.message || "Invalid or expired verification code.");
    } finally {
      setIsLoading(false);
    }
  };

  // 6. Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    const code = otpDigits.join("");
    if (code.length < 6) {
      setErrorMsg("Please enter the 6-digit code sent to your email/mobile.");
      return;
    }
    if (password.length < 6) {
      setErrorMsg("New password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      if (method === "email") {
        await resetPassword(email.trim(), code, password);
        await loginWithPassword(email.trim(), password);
      } else {
        await resetPasswordMobile(fullPhone, code, password);
        await loginWithPassword(fullPhone, password);
      }
      setSuccessMsg("Password successfully reset! Logging you in...");
      router.push(redirectUrl);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to reset password. Please check the verification code.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Official Google Identity Services SDK for Real Google Sign-In */}
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />

      <div className="min-h-[90vh] flex items-center justify-center p-3 sm:p-6 lg:p-8 bg-[#FBF8F2] relative">
        {/* Decorative ambient background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 bg-gradient-to-tr from-emerald-500/10 via-amber-200/15 to-teal-500/10 blur-3xl -z-10 pointer-events-none rounded-full" />

        {/* Main Card Container */}
        <ScrollReveal blur={14} yOffset={24} duration={800} className="w-full max-w-4xl">
          <div className="w-full grid grid-cols-1 lg:grid-cols-12 bg-white border border-[#E4DEC3] rounded-3xl shadow-2xl overflow-hidden relative">
          
          {/* =================================================================== */}
          {/* LEFT BRAND & TRUST HERO COLUMN */}
          {/* =================================================================== */}
          <div className="lg:col-span-5 bg-gradient-to-br from-[#1E5B45] via-[#164634] to-[#12382A] p-7 sm:p-9 text-white flex flex-col justify-between relative overflow-hidden">
            <div className="absolute -top-16 -left-16 w-44 h-44 bg-white/5 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-16 -right-16 w-52 h-52 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />

            <div>
              {/* Logo */}
              <Link href="/" className="inline-block mb-7 group">
                <Logo size="lg" light />
              </Link>

              {/* Value Proposition */}
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-snug mb-3">
                Know what you eat. <br />
                Understand what you buy.
              </h1>

              <p className="text-xs sm:text-sm text-emerald-100/80 leading-relaxed mb-7">
                Sign in to unlock real-time ingredient analysis, on-device barcode & label OCR scanner, and conversational Pinfo AI.
              </p>

              {/* Feature Cards Checklist */}
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-emerald-50">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0">
                    <Search className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <strong className="block font-semibold">Search 3,000,000+ Indian & Global Foods</strong>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-emerald-50">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0">
                    <ScanBarcode className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <strong className="block font-semibold">High-Speed Camera Barcode & Label OCR</strong>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-emerald-50">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <strong className="block font-semibold">Pinfo AI Avatar Chat in Hinglish & Hindi</strong>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-emerald-50">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0">
                    <Heart className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <strong className="block font-semibold">Personalized Allergen & Diet Suitability</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Trust Badges */}
            <div className="mt-8 pt-5 border-t border-white/15 text-[11px] text-emerald-200/70 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Evidence-Based Transparency
              </span>
              <span>Zero Advertising Bias</span>
            </div>
          </div>

          {/* =================================================================== */}
          {/* RIGHT AUTH INTERACTION COLUMN */}
          {/* =================================================================== */}
          <div className="lg:col-span-7 p-6 sm:p-9 flex flex-col justify-center bg-white">
            
            {/* Top Mode Tabs: Sign In vs Create Account */}
            <div className="flex items-center p-1 bg-[#F5F2EA] rounded-2xl mb-6 shadow-xs">
              <button
                type="button"
                onClick={() => handleModeSwitch("signin")}
                className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all ${
                  authMode === "signin"
                    ? "bg-[#1E5B45] text-white shadow-xs"
                    : "text-[#64748B] hover:text-[#1B2A22]"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => handleModeSwitch("signup")}
                className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all ${
                  authMode === "signup"
                    ? "bg-[#1E5B45] text-white shadow-xs"
                    : "text-[#64748B] hover:text-[#1B2A22]"
                }`}
              >
                Create Account
              </button>
            </div>

            {/* Feedback Messages */}
            {errorMsg && (
              <div className="flex items-start gap-2.5 p-3.5 mb-4 text-xs bg-red-50 text-red-800 border border-red-200 rounded-xl animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                <div className="flex-1 font-medium">{errorMsg}</div>
              </div>
            )}

            {successMsg && (
              <div className="flex items-start gap-2.5 p-3.5 mb-4 text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                <div className="flex-1 font-medium">{successMsg}</div>
              </div>
            )}

            {/* ================================================================= */}
            {/* REAL GOOGLE SIGN IN BUTTON */}
            {/* ================================================================= */}
            {authMode !== "forgot" && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => handleGoogleSignIn()}
                  disabled={isLoading || isGoogleLoading}
                  className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white hover:bg-neutral-50 text-[#1B2A22] text-xs sm:text-sm font-bold rounded-xl border border-[#D5CEB8] shadow-xs transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 cursor-pointer"
                >
                  {isGoogleLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-[#4285F4]" />
                  ) : (
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" viewBox="0 0 24 24">
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
                  )}
                  <span>
                    {isGoogleLoading
                      ? "Opening Google Sign-In..."
                      : authMode === "signup"
                      ? "Sign up with Google"
                      : "Continue with Google"}
                  </span>
                </button>

                {/* Clean Balanced Flex Divider */}
                <div className="flex items-center gap-3 my-4">
                  <div className="h-px flex-1 bg-[#E4DEC3]" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#8F9E95] shrink-0">
                    or continue with
                  </span>
                  <div className="h-px flex-1 bg-[#E4DEC3]" />
                </div>

                {/* Sleek Segmented Switcher: Email Address vs Mobile Number */}
                <div className="flex items-center p-1 bg-[#F5F2EA] rounded-xl mb-4 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setMethod("email");
                      setOtpSent(false);
                      resetMessages();
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all ${
                      method === "email"
                        ? "bg-white text-[#1E5B45] shadow-xs font-bold"
                        : "text-[#64748B] hover:text-[#1B2A22]"
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Email Address</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMethod("phone");
                      setOtpSent(false);
                      resetMessages();
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all ${
                      method === "phone"
                        ? "bg-white text-[#1E5B45] shadow-xs font-bold"
                        : "text-[#64748B] hover:text-[#1B2A22]"
                    }`}
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Mobile Number</span>
                  </button>
                </div>
              </div>
            )}

            {/* ================================================================= */}
            {/* VIEW: SIGN IN */}
            {/* ================================================================= */}
            {authMode === "signin" && (
              <>
                {otpSent ? (
                  /* OTP Verification View */
                  <form onSubmit={handleVerifyOtpSignIn} className="space-y-4">
                    <div className="text-center space-y-1">
                      <h3 className="font-bold text-sm text-[#1B2A22]">Enter 6-Digit Verification Code</h3>
                      <p className="text-xs text-[#64748B]">
                        Code sent to <strong className="text-[#1B2A22]">{method === "email" ? email : fullPhone}</strong>
                      </p>
                    </div>

                    <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
                      {otpDigits.map((digit, i) => (
                        <input
                          key={i}
                          ref={(el) => {
                            otpRefs.current[i] = el;
                          }}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpChange(i, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(i, e)}
                          className="w-10 h-12 text-center text-lg font-mono font-bold bg-white border border-[#D5CEB8] rounded-xl focus:outline-none focus:border-[#1E5B45] focus:ring-2 focus:ring-[#1E5B45]/20 text-[#1B2A22]"
                        />
                      ))}
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading || otpDigits.join("").length < 6}
                      className="w-full py-3 px-4 bg-[#1E5B45] hover:bg-[#164634] text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
                    >
                      {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      <span>Verify & Sign In</span>
                    </button>

                    <div className="flex items-center justify-between text-xs text-[#64748B] pt-1">
                      <button
                        type="button"
                        onClick={() => setOtpSent(false)}
                        className="hover:underline text-[#1E5B45] font-semibold"
                      >
                        Change {method === "email" ? "email" : "number"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendOtp("login")}
                        disabled={cooldown > 0}
                        className="hover:underline font-semibold text-[#1E5B45] disabled:opacity-50"
                      >
                        {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
                      </button>
                    </div>
                  </form>
                ) : !signInWithOtp ? (
                  /* Standard Password Sign In Form with FOOLPROOF FLEXBOX INPUT GROUP */
                  <form onSubmit={handlePasswordSignIn} className="space-y-4">
                    {method === "email" ? (
                      <div>
                        <label className="block text-xs font-semibold text-[#1B2A22] mb-1.5">Email Address</label>
                        <div className="auth-input-container">
                          <span className="auth-input-icon"><Mail className="w-4 h-4" /></span>
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="name@example.com"
                            className="auth-input-element"
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-semibold text-[#1B2A22] mb-1.5">Mobile Phone Number</label>
                        <div className="flex gap-2">
                          <select
                            value={countryCode}
                            onChange={(e) => setCountryCode(e.target.value)}
                            className="px-2.5 py-3 text-xs sm:text-sm bg-white border border-[#D5CEB8] rounded-xl focus:outline-none focus:border-[#1E5B45] focus:ring-2 focus:ring-[#1E5B45]/20 text-[#1B2A22] font-medium shadow-xs"
                          >
                            {COUNTRY_CODES.map((c) => (
                              <option key={c.code} value={c.code}>
                                {c.flag} {c.code}
                              </option>
                            ))}
                          </select>
                          <div className="flex-1 auth-input-container">
                            <span className="auth-input-icon"><Phone className="w-4 h-4" /></span>
                            <input
                              type="tel"
                              required
                              value={phoneNumber}
                              onChange={(e) => setPhoneNumber(e.target.value)}
                              placeholder="9876543210"
                              className="auth-input-element"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold text-[#1B2A22]">Password</label>
                        <button
                          type="button"
                          onClick={() => handleModeSwitch("forgot")}
                          className="text-xs text-[#1E5B45] font-semibold hover:underline"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <div className="auth-input-container">
                        <span className="auth-input-icon"><Lock className="w-4 h-4" /></span>
                        <input
                          type={showPassword ? "text" : "password"}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter your password"
                          className="auth-input-element"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="text-[#8F9E95] hover:text-[#1B2A22] p-0.5 shrink-0 transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3 px-4 bg-[#1E5B45] hover:bg-[#164634] text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-[#1E5B45]/20 transition-all flex items-center justify-center gap-2 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
                    >
                      {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                      <span>Sign In</span>
                    </button>

                    <div className="text-center pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSignInWithOtp(true);
                          resetMessages();
                        }}
                        className="text-xs text-[#1E5B45] font-semibold hover:underline inline-flex items-center gap-1"
                      >
                        <span>Sign in without password using {method === "email" ? "Email OTP" : "SMS OTP"} &rarr;</span>
                      </button>
                    </div>
                  </form>
                ) : (
                  /* One-Time Password Sign In Request */
                  <div className="space-y-4">
                    <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-900 leading-relaxed">
                      We will send a 6-digit one-time verification code to your {method === "email" ? "email" : "mobile phone"} for instant passwordless sign-in.
                    </div>

                    {method === "email" ? (
                      <div>
                        <label className="block text-xs font-semibold text-[#1B2A22] mb-1.5">Email Address</label>
                        <div className="auth-input-container">
                          <span className="auth-input-icon"><Mail className="w-4 h-4" /></span>
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="name@example.com"
                            className="auth-input-element"
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-semibold text-[#1B2A22] mb-1.5">Mobile Phone Number</label>
                        <div className="flex gap-2">
                          <select
                            value={countryCode}
                            onChange={(e) => setCountryCode(e.target.value)}
                            className="px-2.5 py-3 text-xs sm:text-sm bg-white border border-[#D5CEB8] rounded-xl focus:outline-none focus:border-[#1E5B45] focus:ring-2 focus:ring-[#1E5B45]/20 text-[#1B2A22] font-medium shadow-xs"
                          >
                            {COUNTRY_CODES.map((c) => (
                              <option key={c.code} value={c.code}>
                                {c.flag} {c.code}
                              </option>
                            ))}
                          </select>
                          <div className="flex-1 auth-input-container">
                            <span className="auth-input-icon"><Phone className="w-4 h-4" /></span>
                            <input
                              type="tel"
                              required
                              value={phoneNumber}
                              onChange={(e) => setPhoneNumber(e.target.value)}
                              placeholder="9876543210"
                              className="auth-input-element"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => handleSendOtp("login")}
                      disabled={isLoading}
                      className="w-full py-3 px-4 bg-[#1E5B45] hover:bg-[#164634] text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
                    >
                      {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                      <span>Send 6-Digit OTP Code</span>
                    </button>

                    <div className="text-center pt-1">
                      <button
                        type="button"
                        onClick={() => setSignInWithOtp(false)}
                        className="text-xs text-[#64748B] hover:underline"
                      >
                        &larr; Back to Password Login
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ================================================================= */}
            {/* VIEW: CREATE ACCOUNT (SIGN UP) */}
            {/* ================================================================= */}
            {authMode === "signup" && (
              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#1B2A22] mb-1.5">Full Name</label>
                  <div className="auth-input-container">
                    <span className="auth-input-icon"><User className="w-4 h-4" /></span>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter your full name"
                      className="auth-input-element"
                    />
                  </div>
                </div>

                {method === "email" ? (
                  <div>
                    <label className="block text-xs font-semibold text-[#1B2A22] mb-1.5">Email Address</label>
                    <div className="auth-input-container">
                      <span className="auth-input-icon"><Mail className="w-4 h-4" /></span>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="auth-input-element"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-[#1B2A22] mb-1.5">Mobile Phone Number</label>
                    <div className="flex gap-2">
                      <select
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                        className="px-2.5 py-3 text-xs sm:text-sm bg-white border border-[#D5CEB8] rounded-xl focus:outline-none focus:border-[#1E5B45] focus:ring-2 focus:ring-[#1E5B45]/20 text-[#1B2A22] font-medium shadow-xs"
                      >
                        {COUNTRY_CODES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.flag} {c.code}
                          </option>
                        ))}
                      </select>
                      <div className="flex-1 auth-input-container">
                        <span className="auth-input-icon"><Phone className="w-4 h-4" /></span>
                        <input
                          type="tel"
                          required
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          placeholder="9876543210"
                          className="auth-input-element"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-[#1B2A22] mb-1.5">Create Password</label>
                  <div className="auth-input-container">
                    <span className="auth-input-icon"><Lock className="w-4 h-4" /></span>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="auth-input-element"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-[#8F9E95] hover:text-[#1B2A22] p-0.5 shrink-0 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Password Strength Indicator */}
                  {password && (
                    <div className="mt-1.5 space-y-1">
                      <div className="flex gap-1 h-1">
                        {[1, 2, 3, 4].map((step) => (
                          <div
                            key={step}
                            className={`flex-1 rounded-full transition-all ${
                              passwordStrength.score >= step ? passwordStrength.color : "bg-gray-200"
                            }`}
                          />
                        ))}
                      </div>
                      <div className="flex justify-between text-[10px] text-[#64748B]">
                        <span>Password strength: <strong>{passwordStrength.label}</strong></span>
                        <span>Min 6 chars</span>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1B2A22] mb-1.5">Confirm Password</label>
                  <div className="auth-input-container">
                    <span className="auth-input-icon"><Lock className="w-4 h-4" /></span>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat your password"
                      className="auth-input-element"
                    />
                  </div>
                </div>

                <div className="flex items-start gap-2 pt-1 text-xs text-[#64748B]">
                  <input
                    type="checkbox"
                    id="agree"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    className="mt-0.5 rounded text-[#1E5B45] focus:ring-[#1E5B45]"
                  />
                  <label htmlFor="agree">
                    I agree to Pinfo&apos;s <span className="underline font-medium">Terms of Service</span> and <span className="underline font-medium">Privacy Policy</span>.
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 bg-[#1E5B45] hover:bg-[#164634] text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-[#1E5B45]/20 transition-all flex items-center justify-center gap-2 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
                >
                  {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  <span>Create Free Account & Start Scanning</span>
                </button>

                <p className="text-center text-xs text-[#64748B] pt-1">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => handleModeSwitch("signin")}
                    className="text-[#1E5B45] font-bold hover:underline"
                  >
                    Sign in
                  </button>
                </p>
              </form>
            )}

            {/* ================================================================= */}
            {/* VIEW: FORGOT PASSWORD */}
            {/* ================================================================= */}
            {authMode === "forgot" && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="font-extrabold text-base text-[#1B2A22]">Reset Account Password</h3>
                  <p className="text-xs text-[#64748B]">
                    Enter your registered email address or mobile number. We will send a secure 6-digit recovery code.
                  </p>
                </div>

                {/* Recovery Channel Switcher */}
                <div className="flex items-center p-1 bg-[#F5F2EA] rounded-xl text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setMethod("email");
                      setOtpSent(false);
                      resetMessages();
                    }}
                    className={`flex-1 py-2 rounded-lg transition-all ${
                      method === "email" ? "bg-white text-[#1E5B45] shadow-xs font-bold" : "text-[#64748B]"
                    }`}
                  >
                    Reset via Email
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMethod("phone");
                      setOtpSent(false);
                      resetMessages();
                    }}
                    className={`flex-1 py-2 rounded-lg transition-all ${
                      method === "phone" ? "bg-white text-[#1E5B45] shadow-xs font-bold" : "text-[#64748B]"
                    }`}
                  >
                    Reset via Mobile SMS
                  </button>
                </div>

                {!otpSent ? (
                  <div className="space-y-4">
                    {method === "email" ? (
                      <div>
                        <label className="block text-xs font-semibold text-[#1B2A22] mb-1.5">Email Address</label>
                        <div className="auth-input-container">
                          <span className="auth-input-icon"><Mail className="w-4 h-4" /></span>
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="name@example.com"
                            className="auth-input-element"
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-semibold text-[#1B2A22] mb-1.5">Mobile Phone Number</label>
                        <div className="flex gap-2">
                          <select
                            value={countryCode}
                            onChange={(e) => setCountryCode(e.target.value)}
                            className="px-2.5 py-3 text-xs sm:text-sm bg-white border border-[#D5CEB8] rounded-xl focus:outline-none focus:border-[#1E5B45] focus:ring-2 focus:ring-[#1E5B45]/20 text-[#1B2A22] font-medium shadow-xs"
                          >
                            {COUNTRY_CODES.map((c) => (
                              <option key={c.code} value={c.code}>
                                {c.flag} {c.code}
                              </option>
                            ))}
                          </select>
                          <div className="flex-1 auth-input-container">
                            <span className="auth-input-icon"><Phone className="w-4 h-4" /></span>
                            <input
                              type="tel"
                              required
                              value={phoneNumber}
                              onChange={(e) => setPhoneNumber(e.target.value)}
                              placeholder="9876543210"
                              className="auth-input-element"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => handleSendOtp("forgot_password")}
                      disabled={isLoading}
                      className="w-full py-3 px-4 bg-[#1E5B45] hover:bg-[#164634] text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
                    >
                      {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                      <span>Send Password Recovery Code</span>
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleResetPassword} className="space-y-4">
                    <p className="text-xs text-center text-[#64748B]">
                      Enter the 6-digit recovery code sent to{" "}
                      <strong className="text-[#1B2A22]">{method === "email" ? email : fullPhone}</strong>:
                    </p>

                    <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
                      {otpDigits.map((digit, i) => (
                        <input
                          key={i}
                          ref={(el) => {
                            otpRefs.current[i] = el;
                          }}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpChange(i, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(i, e)}
                          className="w-10 h-12 text-center text-lg font-mono font-bold bg-white border border-[#D5CEB8] rounded-xl focus:outline-none focus:border-[#1E5B45] focus:ring-2 focus:ring-[#1E5B45]/20 text-[#1B2A22]"
                        />
                      ))}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#1B2A22] mb-1.5">New Password (min 6 chars)</label>
                      <div className="auth-input-container">
                        <span className="auth-input-icon"><Lock className="w-4 h-4" /></span>
                        <input
                          type="password"
                          required
                          minLength={6}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter new password"
                          className="auth-input-element"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#1B2A22] mb-1.5">Confirm New Password</label>
                      <div className="auth-input-container">
                        <span className="auth-input-icon"><Lock className="w-4 h-4" /></span>
                        <input
                          type="password"
                          required
                          minLength={6}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Repeat new password"
                          className="auth-input-element"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading || otpDigits.join("").length < 6}
                      className="w-full py-3 px-4 bg-[#1E5B45] hover:bg-[#164634] text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
                    >
                      {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      <span>Update Password & Log In</span>
                    </button>
                  </form>
                )}

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => handleModeSwitch("signin")}
                    className="text-xs font-semibold text-[#1E5B45] hover:underline"
                  >
                    &larr; Return to Sign In
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
        </ScrollReveal>

        {/* =================================================================== */}
        {/* REAL GOOGLE OAUTH CLIENT ID CONFIGURATION MODAL */}
        {/* =================================================================== */}
        {showGoogleSetup && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-neutral-200 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <h3 className="font-extrabold text-base text-[#1B2A22]">Connect Real Google Account</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGoogleSetup(false)}
                  className="w-7 h-7 rounded-full hover:bg-neutral-100 flex items-center justify-center text-neutral-400 hover:text-neutral-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-[#64748B] leading-relaxed">
                Google requires a registered <strong>OAuth 2.0 Web Client ID</strong> (or Firebase credentials) to authenticate real Google accounts on localhost.
              </p>

              <form onSubmit={handleSaveGoogleClientId} className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-[#1B2A22] mb-1">
                    Google OAuth Web Client ID:
                  </label>
                  <input
                    type="text"
                    required
                    value={customClientId}
                    onChange={(e) => setCustomClientId(e.target.value)}
                    placeholder="123456789-xxxx.apps.googleusercontent.com"
                    className="w-full px-3 py-2.5 text-xs font-mono bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-none focus:border-[#1E5B45] focus:bg-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!customClientId.trim()}
                  className="w-full py-2.5 px-4 bg-[#1E5B45] hover:bg-[#164634] text-white text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50"
                >
                  Save & Open Real Google Sign-In Window
                </button>
              </form>

              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-[11px] text-[#64748B] space-y-1.5">
                <span className="font-bold text-[#1B2A22] block">Quick 2-minute setup:</span>
                <p>1. Open <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-[#1E5B45] underline font-medium inline-flex items-center gap-0.5">Google Cloud Console <ExternalLink className="w-2.5 h-2.5" /></a></p>
                <p>2. Create OAuth Client ID &rarr; Web Application</p>
                <p>3. Add <code className="bg-neutral-200/80 px-1 py-0.5 rounded text-neutral-800">http://localhost:3000</code> to Authorized JavaScript Origins</p>
                <p>4. Paste your Client ID above or in <code className="bg-neutral-200/80 px-1 py-0.5 rounded text-neutral-800">frontend/.env.local</code></p>
              </div>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setShowGoogleSetup(false)}
                  className="text-xs text-[#1E5B45] font-semibold hover:underline"
                >
                  Continue with Email or Mobile Number instead &rarr;
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FBF8F2] flex items-center justify-center">Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}
