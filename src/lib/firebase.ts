import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAccoLkU3TijEW_KNFMLre1Op7YCf-FsbU",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "miyoroo.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "miyoroo",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "miyoroo.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "93046189695",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:93046189695:web:077f1de8f553aaf7b5194a"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
