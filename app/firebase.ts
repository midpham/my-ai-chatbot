// 1. Lấy khung sườn của Firebase
import { initializeApp } from "firebase/app";

// 2. TỰ MÌNH GỌI THÊM TÍNH NĂNG FIRESTORE (Database)
import { getFirestore } from "firebase/firestore";

// 3. Dán đúng phần Config mà Firebase cấp cho bạn vào đây
const firebaseConfig = {
  apiKey: "AIzaSyABTrxEjKXMUFvl3xH5t9T-41NTH9C3alI",
  authDomain: "llm-gateway-chatbot.firebaseapp.com",
  projectId: "llm-gateway-chatbot",
  storageBucket: "llm-gateway-chatbot.firebasestorage.app",
  messagingSenderId: "186076332243",
  appId: "1:186076332243:web:4cae27e72809b03ddf9426",
  measurementId: "G-F26WTSLNXZ" // Giữ hay xóa dòng này đều không sao cả
};

// 4. Khởi động app và Database
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);