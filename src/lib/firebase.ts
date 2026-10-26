import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Your web app's Firebase configuration
const metaEnv = (import.meta as any).env || {};
const firebaseConfig = {
  apiKey: metaEnv.VITE_FIREBASE_API_KEY || "AIzaSyAccoLkU3TijEW_KNFMLre1Op7YCf-FsbU",
  authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || "miyoroo.firebaseapp.com",
  projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || "miyoroo",
  storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || "miyoroo.firebasestorage.app",
  messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || "93046189695",
  appId: metaEnv.VITE_FIREBASE_APP_ID || "1:93046189695:web:077f1de8f553aaf7b5194a"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
