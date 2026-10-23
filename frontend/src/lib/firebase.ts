import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

// Firebase Configuration from Environment Variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
};

export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.apiKey !== "your-api-key" &&
    firebaseConfig.projectId
  );
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let googleProvider: GoogleAuthProvider | null = null;

if (typeof window !== "undefined") {
  if (isFirebaseConfigured()) {
    try {
      app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      auth = getAuth(app);
      db = getFirestore(app);
      googleProvider = new GoogleAuthProvider();
      googleProvider.setCustomParameters({ prompt: "select_account" });
    } catch (err) {
      console.warn("Failed to initialize Firebase with provided credentials:", err);
    }
  } else {
    // Development placeholder initialization so Firebase types don't crash
    try {
      if (getApps().length === 0) {
        app = initializeApp({
          apiKey: "AIzaSyFakeKeyForLocalDevelopmentOnly000",
          authDomain: "ingrivo-demo.firebaseapp.com",
          projectId: "ingrivo-demo",
          storageBucket: "ingrivo-demo.appspot.com",
          messagingSenderId: "1234567890",
          appId: "1:1234567890:web:abcdef123456",
        });
      } else {
        app = getApp();
      }
      auth = getAuth(app);
      db = getFirestore(app);
      googleProvider = new GoogleAuthProvider();
    } catch (e) {
      console.warn("Firebase dev fallback initialization skipped:", e);
    }
  }
}

export { app, auth, db, googleProvider, firebaseConfig };
