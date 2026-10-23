/**
 * Universal Cross-Platform Google Authentication Helper for Ingrivo
 * Works seamlessly across Windows, macOS, Android, and iOS browsers (Safari, Chrome, Edge, Firefox).
 */

export const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
  "812544756607-rmvt2fd0evqh5qeh99rkaji6d9t5rurh.apps.googleusercontent.com";

export interface GoogleUserProfile {
  email: string;
  name: string;
  photoURL?: string;
  idToken?: string;
}

/**
 * Detect mobile devices and WebKit/Safari where popups are frequently blocked.
 */
export function isMobileOrSafari(): boolean {
  if (typeof window === "undefined" || !navigator) return false;
  const ua = navigator.userAgent || "";
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  return isMobile || isSafari;
}

/**
 * Decode standard Google JWT credential (ID Token) safely without external dependencies.
 */
export function decodeGoogleJwt(token: string): {
  email?: string;
  name?: string;
  picture?: string;
  sub?: string;
  email_verified?: boolean;
} | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (err) {
    console.warn("Could not decode Google JWT:", err);
    return null;
  }
}

/**
 * Dynamically load Google Identity Services client script if not already present.
 */
export function loadGoogleGsiScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if ((window as any).google?.accounts) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.getElementById("google-gsi-client");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", (e) => reject(e));
      return;
    }
    const script = document.createElement("script");
    script.id = "google-gsi-client";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });
}

/**
 * Universal Google OAuth Redirect Flow
 * Ideal for iOS Safari, Android, and mobile browsers where popup blockers prevent popup dialogs.
 */
export function startGoogleRedirectFlow(customRedirectUrl?: string): void {
  if (typeof window === "undefined") return;

  const origin = window.location.origin;
  // Always redirect to either dedicated /auth/callback or current /login
  const callbackUrl = `${origin}/auth/callback`;
  const returnTarget = customRedirectUrl || window.location.pathname + window.location.search;

  try {
    localStorage.setItem("ingrivo_google_auth_redirect", returnTarget);
  } catch {
    // Ignore storage errors in private browsing
  }

  const nonce = Math.random().toString(36).substring(2, 15);
  const state = encodeURIComponent(returnTarget);

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: callbackUrl,
    response_type: "token id_token",
    scope: "openid email profile",
    nonce: nonce,
    prompt: "select_account",
    state: state,
  });

  window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}

/**
 * Check and parse Google OAuth tokens returned via URL hash fragment (redirect flow).
 */
export async function processGoogleRedirectHash(): Promise<GoogleUserProfile | null> {
  if (typeof window === "undefined") return null;

  const hash = window.location.hash;
  if (!hash || (!hash.includes("access_token=") && !hash.includes("id_token="))) {
    return null;
  }

  try {
    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get("access_token");
    const idToken = params.get("id_token");

    let email = "";
    let name = "";
    let photoURL = "";

    // 1. Try decoding id_token first
    if (idToken) {
      const decoded = decodeGoogleJwt(idToken);
      if (decoded?.email) {
        email = decoded.email;
        name = decoded.name || email.split("@")[0];
        photoURL = decoded.picture || "";
      }
    }

    // 2. If email still missing, query Google Userinfo endpoint with access_token
    if (!email && accessToken) {
      const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const profile = await res.json();
        email = profile.email || "";
        name = profile.name || email.split("@")[0];
        photoURL = profile.picture || "";
      }
    }

    // Clear hash from address bar cleanly without page reload
    if (window.history && window.history.replaceState) {
      const cleanUrl = window.location.pathname + window.location.search;
      window.history.replaceState(null, "", cleanUrl);
    }

    if (email) {
      return {
        email,
        name,
        photoURL,
        idToken: idToken || undefined,
      };
    }
  } catch (err) {
    console.error("Failed to process Google redirect hash:", err);
  }

  return null;
}

/**
 * Universal Google Sign-In Trigger
 * Automatically chooses popup on desktop (Windows/Mac) or redirect on mobile/Safari,
 * with automatic fallback if popup is blocked by the browser.
 */
export function triggerUniversalGoogleSignIn(callbacks: {
  onSuccess: (profile: GoogleUserProfile) => void | Promise<void>;
  onError: (error: Error) => void;
  redirectUrl?: string;
  forceRedirect?: boolean;
}): void {
  if (typeof window === "undefined") return;

  const clientId = GOOGLE_CLIENT_ID;

  // On mobile or when forced, use redirect immediately for rock-solid UX
  if (callbacks.forceRedirect || isMobileOrSafari()) {
    startGoogleRedirectFlow(callbacks.redirectUrl);
    return;
  }

  // Desktop (Windows/Mac): Attempt Google Identity Services Token Client Popup
  loadGoogleGsiScript()
    .then(() => {
      const google = (window as any).google;
      if (!google?.accounts?.oauth2) {
        // Fallback to redirect if GIS script did not initialize
        startGoogleRedirectFlow(callbacks.redirectUrl);
        return;
      }

      let hasResponded = false;

      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: "email profile openid",
        callback: async (tokenResponse: any) => {
          hasResponded = true;
          if (tokenResponse?.error) {
            if (tokenResponse.error === "popup_closed_by_user") {
              callbacks.onError(
                new Error(
                  "GOOGLE_POPUP_CLOSED:Google Sign-In popup closed. If Google showed 'no registered origin' (Error 401: invalid_client), add http://localhost:3000 to Authorized JavaScript Origins in Google Cloud Console."
                )
              );
              return;
            }
            if (tokenResponse.error === "popup_blocked_by_browser") {
              console.warn("Google popup blocked by browser, switching to redirect flow...");
              startGoogleRedirectFlow(callbacks.redirectUrl);
              return;
            }
            callbacks.onError(new Error(tokenResponse.error_description || tokenResponse.error));
            return;
          }

          if (tokenResponse?.access_token) {
            try {
              const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
                headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
              });
              if (!res.ok) throw new Error("Could not retrieve Google profile.");
              const data = await res.json();
              await callbacks.onSuccess({
                email: data.email,
                name: data.name || data.email?.split("@")[0],
                photoURL: data.picture,
              });
            } catch (err: any) {
              callbacks.onError(err);
            }
          }
        },
      });

      try {
        tokenClient.requestAccessToken({ prompt: "select_account" });
      } catch (reqErr: any) {
        console.warn("Popup request failed, falling back to redirect flow:", reqErr);
        startGoogleRedirectFlow(callbacks.redirectUrl);
      }
    })
    .catch((scriptErr) => {
      console.warn("GSI script loading failed, falling back to redirect:", scriptErr);
      startGoogleRedirectFlow(callbacks.redirectUrl);
    });
}
