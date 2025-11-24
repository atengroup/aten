// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, RecaptchaVerifier } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCceYBppUrS_9H1Sk9suyuLo8NC_B8BYgk",
  authDomain: "aten-2c512.firebaseapp.com",
  projectId: "aten-2c512",
  storageBucket: "aten-2c512.firebasestorage.app",
  messagingSenderId: "830832445422",
  appId: "1:830832445422:web:e96928b01aec30021b70ff",
  measurementId: "G-2GKVYGHR8J"
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