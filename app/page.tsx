"use client";

import { useState, useEffect, useRef } from "react";
import { db } from "./firebase";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "firebase/firestore";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: any;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ĐIỀN ĐƯỜNG LINK CLOUDFLARE WORKER CỦA BẠN VÀO ĐÂY (Tuyệt đối không có dấu / ở cuối)
  const WORKER_URL = "https://https://my-ai-proxy.phamtrungt47.workers.dev/";

  // Lắng nghe dữ liệu thời gian thực từ Firebase Firestore
  useEffect(() => {
    const q = query(collection(db, "messages"), orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedMessages = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Message[];
      setMessages(loadedMessages);
    });
    return () => unsubscribe();
  }, []);

  // Tự động cuộn xuống tin nhắn mới nhất
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    setInput("");
    setIsLoading(true);

    try {
      // 1. Lưu tin nhắn của người dùng vào Firebase
      await addDoc(collection(db, "messages"), {
        role: "user",
        text: userText,
        createdAt: serverTimestamp(),
      });

      // 2. Gửi tin nhắn sang Cloudflare Worker để gọi AI
      const response = await fetch(WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userText }),
      });

      if (!response.ok) throw new Error("Lỗi kết nối đến Worker");

      const data = await response.json();

      // 3. Lưu câu trả lời của AI vào Firebase
      await addDoc(collection(db, "messages"), {
        role: "assistant",
        text: data.reply || data.response || "Lỗi xử lý câu trả lời từ AI",
        createdAt: serverTimestamp(),
      });

    } catch (error) {
      console.error("Lỗi:", error);
      await addDoc(collection(db, "messages"), {
        role: "assistant",
        text: "Xin lỗi, đã xảy ra lỗi kết nối. Vui lòng kiểm tra lại thiết lập Cloudflare Worker hoặc API Key.",
        createdAt: serverTimestamp(),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-3xl mx-auto p-4 bg-gray-50 font-sans">
      <header className="py-4 text-center border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-800">My AI Chatbot</h1>
      </header>

      <main className="flex-1 overflow-y-auto py-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[75%] p-3 rounded-xl shadow-sm ${
                msg.role === "user"
                  ? "bg-blue-600 text-white rounded-br-none"
                  : "bg-white text-gray-800 border border-gray-200 rounded-bl-none"
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[75%] p-3 rounded-xl bg-gray-200 text-gray-500 rounded-bl-none animate-pulse">
              Đang suy nghĩ...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      <footer className="pt-4 border-t border-gray-200 pb-2">
        <form onSubmit={sendMessage} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Gửi tin nhắn..."
            className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            Gửi
          </button>
        </form>
      </footer>
    </div>
  );
}