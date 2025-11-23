// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, RecaptchaVerifier } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCdgGT-4UEpUBDsNBWAf8qdN2FHPOsw2v8",
  authDomain: "a10interio-server.firebaseapp.com",
  projectId: "a10interio-server",
  storageBucket: "a10interio-server.firebasestorage.app",
  messagingSenderId: "149525149447",
  appId: "1:149525149447:web:0aa6db86ed25cbd52c37a2",
  measurementId: "G-3G3ZKTXJVW"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// ✅ Add this helper function
export function createRecaptchaVerifier() {
  if (!window.recaptchaVerifier) {
    window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
      size: "invisible",
      callback: (response) => {
        console.log("reCAPTCHA verified:", response);
      },
    });
  }
}