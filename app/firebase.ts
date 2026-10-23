// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyABTrxEjKXMUFvl3xH5t9T-41NTH9C3alI",
  authDomain: "llm-gateway-chatbot.firebaseapp.com",
  projectId: "llm-gateway-chatbot",
  storageBucket: "llm-gateway-chatbot.firebasestorage.app",
  messagingSenderId: "186076332243",
  appId: "1:186076332243:web:4cae27e72809b03ddf9426",
  measurementId: "G-F26WTSLNXZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);