"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Lock, Sparkles, ShieldCheck, ArrowRight, Camera, Search } from "lucide-react";

interface AuthGuardProps {
  children: React.ReactNode;
  featureName?: string;
  description?: string;
}

export function AuthGuard({
  children,
  featureName = "this feature",
  description = "Unlock complete ingredient analysis, nutrition breakdowns, camera barcode scanning, and Pinfo AI intelligence.",
}: AuthGuardProps) {
  const { user, isLoading, openAuthModal, loginWithGoogle } = useAuth();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center animate-pulse">
        <div className="w-12 h-12 rounded-2xl bg-[#1E5B45]/10 flex items-center justify-center text-[#1E5B45] mb-4">
          <Sparkles className="w-6 h-6 animate-spin" />
        </div>
        <p className="text-sm font-semibold text-[#1B2A22]">Checking authentication...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-xl mx-auto my-12 px-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-[#FBF8F2] border-2 border-[#E4DEC3] rounded-3xl p-8 shadow-xl text-center relative overflow-hidden">
          {/* Top Decorative Emerald Glow */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#1E5B45] via-[#2E8B57] to-[#1E5B45]" />

          {/* Icon Badge */}
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-[#1E5B45] text-white flex items-center justify-center shadow-lg shadow-[#1E5B45]/20">
            <Lock className="w-8 h-8" />
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1E5B45]/10 text-[#1E5B45] text-xs font-bold uppercase tracking-wider mb-3">
            <ShieldCheck className="w-3.5 h-3.5" /> Login Required
          </span>

          <h2 className="text-2xl font-extrabold text-[#1B2A22] mb-2 tracking-tight">
            Sign In to Access {featureName}
          </h2>

          <p className="text-xs sm:text-sm text-[#64748B] max-w-md mx-auto mb-8 leading-relaxed">
            {description}
          </p>

          <div className="space-y-3 max-w-sm mx-auto">
            {/* Google One-Click Login */}
            <button
              onClick={() => loginWithGoogle().catch((e) => console.warn("Google sign in cancelled:", e))}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white hover:bg-neutral-50 text-[#1B2A22] text-xs sm:text-sm font-bold rounded-xl border border-[#D5CEB8] shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
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

            {/* Email / Mobile Login Button */}
            <button
              onClick={() => openAuthModal("signin")}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#1E5B45] hover:bg-[#164634] text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-[#1E5B45]/20 transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              <span>Sign In with Email / Mobile</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <Link
              href="/login"
              className="block text-xs font-semibold text-[#1E5B45] hover:underline pt-2"
            >
              Go to Full Login & Sign Up Page &rarr;
            </Link>
          </div>

          <div className="mt-8 pt-6 border-t border-[#E4DEC3]/60 flex items-center justify-center gap-6 text-[11px] text-[#64748B]">
            <span className="flex items-center gap-1">🔒 Free Account</span>
            <span className="flex items-center gap-1">⚡ Instant Access</span>
            <span className="flex items-center gap-1">📱 Mobile OTP Ready</span>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
