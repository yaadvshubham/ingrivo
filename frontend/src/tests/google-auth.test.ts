import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  decodeGoogleJwt,
  isMobileOrSafari,
  startGoogleRedirectFlow,
  processGoogleRedirectHash,
  triggerUniversalGoogleSignIn,
  GOOGLE_CLIENT_ID,
} from "@/lib/googleAuth";

describe("Universal Cross-Platform Google Authentication", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore window.location if altered
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
    });
  });

  describe("decodeGoogleJwt", () => {
    it("successfully decodes a valid JWT payload", () => {
      // Mock JWT: header.payload.signature
      const payloadObj = {
        email: "yaadv@example.com",
        name: "Shubham Yadav",
        picture: "https://lh3.googleusercontent.com/photo.jpg",
        sub: "google-uid-12345",
      };
      const base64Payload = btoa(JSON.stringify(payloadObj));
      const mockJwt = `eyJhbGciOiJSUzI1NiJ9.${base64Payload}.signature`;

      const decoded = decodeGoogleJwt(mockJwt);
      expect(decoded).not.toBeNull();
      expect(decoded?.email).toBe("yaadv@example.com");
      expect(decoded?.name).toBe("Shubham Yadav");
      expect(decoded?.picture).toBe("https://lh3.googleusercontent.com/photo.jpg");
    });

    it("returns null for malformed tokens", () => {
      expect(decodeGoogleJwt("invalid-token")).toBeNull();
      expect(decodeGoogleJwt("")).toBeNull();
    });
  });

  describe("isMobileOrSafari device detection", () => {
    it("detects iPhone/iPad user agent as mobile", () => {
      const originalUa = navigator.userAgent;
      Object.defineProperty(navigator, "userAgent", {
        value: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
        configurable: true,
      });

      expect(isMobileOrSafari()).toBe(true);

      Object.defineProperty(navigator, "userAgent", {
        value: originalUa,
        configurable: true,
      });
    });

    it("detects Android Chrome user agent as mobile", () => {
      const originalUa = navigator.userAgent;
      Object.defineProperty(navigator, "userAgent", {
        value: "Mozilla/5.0 (Linux; Android 13; SM-S908B) AppleWebKit/537.36 Chrome/112.0.0.0 Mobile Safari/537.36",
        configurable: true,
      });

      expect(isMobileOrSafari()).toBe(true);

      Object.defineProperty(navigator, "userAgent", {
        value: originalUa,
        configurable: true,
      });
    });

    it("detects Mac Safari as Safari", () => {
      const originalUa = navigator.userAgent;
      Object.defineProperty(navigator, "userAgent", {
        value: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/16.1 Safari/605.1.15",
        configurable: true,
      });

      expect(isMobileOrSafari()).toBe(true);

      Object.defineProperty(navigator, "userAgent", {
        value: originalUa,
        configurable: true,
      });
    });

    it("detects Windows Chrome as desktop non-Safari", () => {
      const originalUa = navigator.userAgent;
      Object.defineProperty(navigator, "userAgent", {
        value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        configurable: true,
      });

      expect(isMobileOrSafari()).toBe(false);

      Object.defineProperty(navigator, "userAgent", {
        value: originalUa,
        configurable: true,
      });
    });
  });

  describe("startGoogleRedirectFlow", () => {
    it("assigns URL with Google OAuth 2.0 endpoints and client ID", () => {
      const assignMock = vi.fn();
      Object.defineProperty(window, "location", {
        value: {
          origin: "http://localhost:3000",
          pathname: "/scan",
          search: "",
          assign: assignMock,
        },
        writable: true,
      });

      startGoogleRedirectFlow("/scan");

      expect(assignMock).toHaveBeenCalledOnce();
      const calledUrl = assignMock.mock.calls[0][0];
      expect(calledUrl).toContain("accounts.google.com/o/oauth2/v2/auth");
      expect(calledUrl).toContain(encodeURIComponent(GOOGLE_CLIENT_ID));
      expect(calledUrl).toContain("response_type=token+id_token");
      expect(calledUrl).toContain("scope=openid+email+profile");
    });
  });

  describe("processGoogleRedirectHash", () => {
    it("extracts profile from URL hash with id_token and cleans history", async () => {
      const payloadObj = {
        email: "redirect-user@gmail.com",
        name: "Redirect User",
        picture: "https://lh3.googleusercontent.com/avatar.jpg",
      };
      const base64Payload = btoa(JSON.stringify(payloadObj));
      const mockIdToken = `header.${base64Payload}.signature`;

      const replaceStateMock = vi.fn();
      Object.defineProperty(window, "history", {
        value: { replaceState: replaceStateMock },
        writable: true,
      });

      Object.defineProperty(window, "location", {
        value: {
          hash: `#access_token=mock-access-token&id_token=${mockIdToken}`,
          pathname: "/login",
          search: "",
        },
        writable: true,
      });

      const profile = await processGoogleRedirectHash();
      expect(profile).not.toBeNull();
      expect(profile?.email).toBe("redirect-user@gmail.com");
      expect(profile?.name).toBe("Redirect User");
      expect(profile?.photoURL).toBe("https://lh3.googleusercontent.com/avatar.jpg");
      expect(replaceStateMock).toHaveBeenCalledWith(null, "", "/login");
    });

    it("returns null if hash has no tokens", async () => {
      Object.defineProperty(window, "location", {
        value: {
          hash: "",
          pathname: "/login",
          search: "",
        },
        writable: true,
      });

      const profile = await processGoogleRedirectHash();
      expect(profile).toBeNull();
    });
  });

  describe("triggerUniversalGoogleSignIn", () => {
    it("triggers redirect immediately when on mobile or forced", () => {
      const assignMock = vi.fn();
      Object.defineProperty(window, "location", {
        value: {
          origin: "http://localhost:3000",
          pathname: "/login",
          search: "",
          assign: assignMock,
        },
        writable: true,
      });

      const onSuccess = vi.fn();
      const onError = vi.fn();

      triggerUniversalGoogleSignIn({
        onSuccess,
        onError,
        forceRedirect: true,
      });

      expect(assignMock).toHaveBeenCalledOnce();
      expect(assignMock.mock.calls[0][0]).toContain("accounts.google.com");
    });
  });
});
