"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { processGoogleRedirectHash } from "@/lib/googleAuth";
import { RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

export default function AuthCallbackPage() {
  const router = useRouter();
  const { loginWithGoogle } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    let isMounted = true;

    async function handleCallback() {
      try {
        const profile = await processGoogleRedirectHash();
        if (!profile) {
          // Check if there was an error in hash or search query
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const queryParams = new URLSearchParams(window.location.search);
          const err =
            hashParams.get("error_description") ||
            hashParams.get("error") ||
            queryParams.get("error_description") ||
            queryParams.get("error");

          if (err) {
            throw new Error(`Google Authentication Error: ${err}`);
          }

          // If no tokens found, user might have refreshed or landed directly
          router.replace("/login");
          return;
        }

        // Authenticate with Ingrivo backend
        await loginWithGoogle({
          email: profile.email,
          name: profile.name,
          photoURL: profile.photoURL,
        });

        if (!isMounted) return;
        setStatus("success");

        // Determine destination
        let target = "/";
        try {
          const savedTarget = localStorage.getItem("ingrivo_google_auth_redirect");
          if (savedTarget && savedTarget.startsWith("/") && !savedTarget.startsWith("//")) {
            target = savedTarget;
            localStorage.removeItem("ingrivo_google_auth_redirect");
          }
        } catch {
          // Ignore storage errors
        }

        setTimeout(() => {
          router.replace(target);
        }, 300);
      } catch (err: any) {
        if (!isMounted) return;
        console.error("Auth callback error:", err);
        setStatus("error");
        setErrorMessage(err.message || "Failed to complete Google Sign-In.");
      }
    }

    handleCallback();

    return () => {
      isMounted = false;
    };
  }, [loginWithGoogle, router]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 bg-[#FBF8F2]">
      <ScrollReveal blur={14} yOffset={20} duration={650} className="w-full max-w-md">
        <div className="w-full bg-white border border-[#E4DEC3] rounded-3xl p-8 shadow-xl text-center space-y-6">
          
          {/* Brand Icon */}
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#1E5B45] text-white font-black text-2xl flex items-center justify-center shadow-md">
            I
          </div>

          {status === "loading" && (
            <div className="space-y-3">
              <RefreshCw className="w-8 h-8 mx-auto text-[#1E5B45] animate-spin" />
              <h2 className="text-lg font-extrabold text-[#1B2A22]">
                Verifying Google Account...
              </h2>
              <p className="text-xs text-[#5E6B63] max-w-xs mx-auto">
                Securely syncing your credentials across your device. One moment please.
              </p>
            </div>
          )}

          {status === "success" && (
            <div className="space-y-3">
              <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-600 animate-in zoom-in-50" />
              <h2 className="text-lg font-extrabold text-[#1B2A22]">
                Authentication Successful!
              </h2>
              <p className="text-xs text-[#5E6B63]">
                Redirecting you to Ingrivo...
              </p>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-4">
              <AlertCircle className="w-8 h-8 mx-auto text-red-500" />
              <h2 className="text-lg font-extrabold text-[#1B2A22]">
                Sign-In Incomplete
              </h2>
              <p className="text-xs text-red-700 bg-red-50 p-3 rounded-xl border border-red-200">
                {errorMessage}
              </p>
              <div className="pt-2">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center w-full py-2.5 px-4 bg-[#1E5B45] hover:bg-[#164634] text-white text-xs font-bold rounded-xl transition-all"
                >
                  Back to Sign In
                </Link>
              </div>
            </div>
          )}

        </div>
      </ScrollReveal>
    </div>
  );
}
