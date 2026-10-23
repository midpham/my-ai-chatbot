
"use client";

import React, { useState, useEffect } from "react";
import {
  Send,
  Paperclip,
  Plus,
  MessageSquare,
  Menu,
  X,
  Loader2,
} from "lucide-react";

import { db } from "./firebase";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";

// Địa chỉ Cloudflare Worker
const WORKER_URL =
  "https://my-ai-proxy.phamtrungt47.workers.dev";

type ChatRole = "user" | "assistant";

interface ChatMessage {
  role: ChatRole;
  content: string;
}

interface ChatItem {
  id: string;
  title?: string;
  messages?: ChatMessage[];
  createdAt?: unknown;
}

const WELCOME_MESSAGE: ChatMessage = {
  role: "assistant",
  content: "Xin chào! Tôi có thể giúp gì cho bạn hôm nay?",
};

export default function ChatUI() {
  // Trạng thái giao diện
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    WELCOME_MESSAGE,
  ]);
  const [selectedModel, setSelectedModel] =
    useState("gpt-4.1-2025-04-14");
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // Lịch sử chat
  const [chatList, setChatList] = useState<ChatItem[]>([]);
  const [currentChatId, setCurrentChatId] =
    useState<string | null>(null);

  // Tải lịch sử chat
  const loadChatHistory = async () => {
    try {
      const q = query(
        collection(db, "chats"),
        orderBy("createdAt", "desc")
      );

      const snapshot = await getDocs(q);

      const chats: ChatItem[] = snapshot.docs.map((item) => {
        const data = item.data();

        return {
          id: item.id,
          title: data.title || "Chat mới",
          messages: Array.isArray(data.messages)
            ? data.messages
            : [],
          createdAt: data.createdAt,
        };
      });

      setChatList(chats);
    } catch (error) {
      console.error("Lỗi tải lịch sử Firebase:", error);
    }
  };

  useEffect(() => {
    void loadChatHistory();
  }, []);

  // Tạo đoạn chat mới
  const handleNewChat = () => {
    if (isLoading) return;

    setCurrentChatId(null);
    setMessages([WELCOME_MESSAGE]);
    setInput("");

    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  // Mở đoạn chat cũ
  const handleSelectChat = (chat: ChatItem) => {
    if (isLoading) return;

    setCurrentChatId(chat.id);
    setMessages(
      Array.isArray(chat.messages) && chat.messages.length > 0
        ? chat.messages
        : [WELCOME_MESSAGE]
    );

    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  // Gửi tin nhắn
  const handleSend = async () => {
    const text = input.trim();

    if (!text || isLoading) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: text,
    };

    // Chụp lại lịch sử tại thời điểm gửi
    const newMessages = [...messages, userMessage];

    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    let chatIdToUpdate = currentChatId;

    try {
      // A. Lưu câu hỏi vào Firebase trước khi gọi AI
      if (!chatIdToUpdate) {
        const chatRef = await addDoc(collection(db, "chats"), {
          title:
            text.length > 30
              ? text.substring(0, 30) + "..."
              : text,
          messages: newMessages,
          createdAt: serverTimestamp(),
        });

        chatIdToUpdate = chatRef.id;
        setCurrentChatId(chatRef.id);
      } else {
        await updateDoc(doc(db, "chats", chatIdToUpdate), {
          messages: newMessages,
        });
      }

      // B. Gọi Cloudflare Worker
      // Không bật stream vì frontend xử lý JSON hoàn chỉnh.
      const response = await fetch(WORKER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: newMessages,
          stream: false,
        }),
      });

      // C. Đọc phản hồi JSON
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const apiError =
          data?.error?.message ||
          (typeof data?.error === "string" ? data.error : null) ||
          data?.message ||
          `HTTP ${response.status}`;

        throw new Error(`Lỗi API: ${apiError}`);
      }

      // D. Kiểm tra cấu trúc Chat Completions
      const botContent = data?.choices?.[0]?.message?.content;

      if (typeof botContent !== "string") {
        console.error("Phản hồi API không hợp lệ:", data);
        throw new Error(
          "API không trả về nội dung hợp lệ. Hãy kiểm tra model và định dạng phản hồi."
        );
      }

      const finalMessages: ChatMessage[] = [
        ...newMessages,
        {
          role: "assistant",
          content: botContent,
        },
      ];

      // E. Hiển thị câu trả lời
      setMessages(finalMessages);

      // F. Lưu câu trả lời vào Firebase
      await updateDoc(doc(db, "chats", chatIdToUpdate), {
        messages: finalMessages,
      });

      // Đồng bộ lại lịch sử ở sidebar
      await loadChatHistory();
    } catch (error) {
      console.error("Lỗi gửi tin nhắn:", error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : "Đã xảy ra lỗi không xác định.";

      const failedMessages: ChatMessage[] = [
        ...newMessages,
        {
          role: "assistant",
          content: `Xin lỗi, đã xảy ra lỗi: ${errorMessage}`,
        },
      ];

      setMessages(failedMessages);

      // Cố gắng lưu thông báo lỗi vào lịch sử
      if (chatIdToUpdate) {
        try {
          await updateDoc(doc(db, "chats", chatIdToUpdate), {
            messages: failedMessages,
          });

          await loadChatHistory();
        } catch (saveError) {
          console.error(
            "Không thể lưu thông báo lỗi vào Firebase:",
            saveError
          );
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-white text-gray-800 font-sans">
      {/* Sidebar lịch sử */}
      <div
        className={`${
          isSidebarOpen ? "w-64" : "w-0"
        } transition-all duration-300 bg-gray-50 border-r flex flex-col overflow-hidden shrink-0 absolute md:relative z-10 h-full shadow-lg md:shadow-none`}
      >
        <div className="p-4 flex items-center justify-between">
          <span className="font-semibold text-sm text-gray-500 uppercase tracking-wider">
            Lịch sử Chat
          </span>

          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-1 hover:bg-gray-200 rounded-md text-gray-500"
            aria-label="Đóng lịch sử chat"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-3 pb-2">
          <button
            onClick={handleNewChat}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 bg-white border border-gray-200 shadow-sm hover:bg-gray-100 disabled:opacity-50 p-2.5 rounded-xl transition text-sm font-medium text-gray-700"
          >
            <Plus size={18} />
            Đoạn chat mới
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {chatList.length === 0 ? (
            <div className="text-center text-gray-400 text-sm mt-4">
              Chưa có lịch sử
            </div>
          ) : (
            chatList.map((chat) => (
              <button
                key={chat.id}
                onClick={() => handleSelectChat(chat)}
                disabled={isLoading}
                className={`w-full flex items-center gap-3 p-3 text-left rounded-xl truncate text-sm transition disabled:opacity-50 ${
                  currentChatId === chat.id
                    ? "bg-gray-200 text-gray-900 font-medium"
                    : "hover:bg-gray-200 text-gray-600"
                }`}
              >
                <MessageSquare size={16} className="shrink-0" />
                <span className="truncate">
                  {chat.title || "Chat mới"}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Nền mờ trên mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-0 md:hidden"
          onClick={() => {
            if (!isLoading) setSidebarOpen(false);
          }}
        />
      )}

      {/* Khu vực chat */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative w-full">
        {/* Header */}
        <header className="h-14 flex items-center justify-between px-4 border-b bg-white/80 backdrop-blur-md sticky top-0 z-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!isSidebarOpen)}
              className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
              aria-label="Mở hoặc đóng lịch sử chat"
            >
              <Menu size={22} />
            </button>

            <select
              value={selectedModel}
              onChange={(event) =>
                setSelectedModel(event.target.value)
              }
              disabled={isLoading}
              className="bg-gray-100 text-gray-700 border-none rounded-lg px-4 py-2 text-sm font-semibold outline-none cursor-pointer hover:bg-gray-200 transition disabled:opacity-50"
            >
              <option value="gpt-4.1-2025-04-14">
                gpt-4.1-2025-04-14
              </option>
              <option value="gpt-6-luna">gpt-6-luna</option>
            </select>
          </div>
        </header>

        {/* Tin nhắn */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          <div className="max-w-3xl mx-auto space-y-6 pb-4">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${
                  msg.role === "user"
                    ? "justify-end"
                    : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] md:max-w-[75%] p-4 rounded-2xl text-sm md:text-base leading-relaxed whitespace-pre-wrap break-words ${
                    msg.role === "user"
                      ? "bg-gray-900 text-white rounded-br-none shadow-sm"
                      : "bg-gray-100 text-gray-800 rounded-bl-none"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 p-4 rounded-2xl rounded-bl-none text-gray-500">
                  <Loader2 className="animate-spin" size={20} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Khung nhập tin nhắn */}
        <div className="p-4 bg-white bg-opacity-90 backdrop-blur-sm border-t">
          <div className="max-w-3xl mx-auto flex items-end gap-2 bg-gray-50 p-2 rounded-2xl border border-gray-200 focus-within:ring-1 focus-within:ring-gray-400 focus-within:border-gray-400 transition-all shadow-sm">
            <button
              type="button"
              title="Đính kèm file (chưa được kích hoạt)"
              disabled
              className="p-3 text-gray-400 rounded-xl shrink-0 cursor-not-allowed"
            >
              <Paperclip size={20} />
            </button>

            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              disabled={isLoading}
              placeholder={
                isLoading
                  ? "Đang chờ phản hồi..."
                  : `Nhắn tin cho ${selectedModel}...`
              }
              className="w-full bg-transparent border-none focus:ring-0 resize-none max-h-32 min-h-[44px] py-3 text-gray-700 outline-none disabled:opacity-50"
              rows={1}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  void handleSend();
                }
              }}
            />

            <button
              onClick={() => void handleSend()}
              disabled={!input.trim() || isLoading}
              aria-label="Gửi tin nhắn"
              className={`p-3 rounded-xl transition shrink-0 mb-1 ${
                input.trim() && !isLoading
                  ? "bg-gray-900 text-white hover:bg-gray-800 shadow-md"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              <Send size={18} />
            </button>
          </div>

          <div className="text-center text-xs text-gray-400 mt-3">
            Trí tuệ nhân tạo có thể tạo ra thông tin không chính xác.
            Hãy kiểm tra các thông tin quan trọng.
          </div>
        </div>
      </div>
    </div>
  );
}
