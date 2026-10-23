"use client";
import React, { useState, useEffect } from "react";
import { Send, Paperclip, Plus, MessageSquare, Menu, X, Loader2 } from "lucide-react";

// Import cấu hình Firebase
import { db } from "./firebase";
import { collection, addDoc, getDocs, doc, updateDoc, query, orderBy, serverTimestamp } from "firebase/firestore";

export default function ChatUI() {
  // --- STATE QUẢN LÝ GIAO DIỆN & DỮ LIỆU ---
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<any[]>([
    { role: "assistant", content: "Xin chào! Tôi có thể giúp gì cho bạn hôm nay?" }
  ]);
  const [selectedModel, setSelectedModel] = useState("gpt-4.1-2025-04-14");
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  
  // Quản lý lịch sử chat từ Firebase
  const [chatList, setChatList] = useState<any[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);

  // --- 1. TẢI LỊCH SỬ CHAT TỪ FIREBASE KHI MỞ TRANG ---
  useEffect(() => {
    loadChatHistory();
  }, []);

  const loadChatHistory = async () => {
    try {
      const q = query(collection(db, "chats"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const chats = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setChatList(chats);
    } catch (error) {
      console.error("Lỗi tải lịch sử từ Firebase:", error);
    }
  };

  // --- 2. TẠO ĐOẠN CHAT MỚI ---
  const handleNewChat = () => {
    setCurrentChatId(null);
    setMessages([{ role: "assistant", content: "Xin chào! Tôi có thể giúp gì cho bạn hôm nay?" }]);
    if (window.innerWidth < 768) setSidebarOpen(false); // Tự đóng menu trên mobile
  };

  // --- 3. CHỌN XEM LẠI ĐOẠN CHAT CŨ ---
  const handleSelectChat = (chat: any) => {
    setCurrentChatId(chat.id);
    setMessages(chat.messages || []);
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  // --- 4. XỬ LÝ GỬI TIN NHẮN ---
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMsg = { role: "user", content: input };
    const newMessages = [...messages, userMsg];
    
    // Hiện tin nhắn của user lên màn hình ngay lập tức
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    let chatIdToUpdate = currentChatId;

    try {
      // A. LƯU VÀO FIREBASE (Tạo mới hoặc Cập nhật)
      if (!chatIdToUpdate) {
        // Tạo đoạn chat mới
        const docRef = await addDoc(collection(db, "chats"), {
          title: input.length > 30 ? input.substring(0, 30) + "..." : input,
          messages: newMessages,
          createdAt: serverTimestamp()
        });
        chatIdToUpdate = docRef.id;
        setCurrentChatId(chatIdToUpdate);
        await loadChatHistory(); // Cập nhật lại Sidebar
      } else {
        // Cập nhật đoạn chat cũ
        await updateDoc(doc(db, "chats", chatIdToUpdate), { messages: newMessages });
      }

      // B. GỌI API LÊN CLOUDFLARE WORKER
      // QUAN TRỌNG: Thay link dưới đây bằng link Cloudflare Worker thực tế của bạn
      const WORKER_URL = "https://ĐIỀN-LINK-WORKER-CỦA-BẠN.workers.dev"; 
      
      const response = await fetch(WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          model: selectedModel, 
          messages: newMessages 
        })
      });

      if (!response.ok) throw new Error(`Lỗi API: ${response.statusText}`);

      // C. XỬ LÝ KẾT QUẢ TRẢ VỀ
      const data = await response.json();
      const botContent = data.choices[0].message.content;
      const finalMessages = [...newMessages, { role: "assistant", content: botContent }];
      
      // Cập nhật giao diện
      setMessages(finalMessages);

      // Lưu câu trả lời của AI vào Firebase
      await updateDoc(doc(db, "chats", chatIdToUpdate), { messages: finalMessages });

    } catch (error) {
      console.error("Lỗi:", error);
      setMessages(prev => [...prev, { role: "assistant", content: "Xin lỗi, đã xảy ra lỗi kết nối. Vui lòng kiểm tra lại thiết lập Cloudflare Worker hoặc API Key." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-white text-gray-800 font-sans">
      
      {/* --- CỘT TRÁI: SIDEBAR LỊCH SỬ CHAT --- */}
      <div className={`${isSidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 bg-gray-50 border-r flex flex-col overflow-hidden shrink-0 absolute md:relative z-10 h-full shadow-lg md:shadow-none`}>
         <div className="p-4 flex items-center justify-between">
            <span className="font-semibold text-sm text-gray-500 uppercase tracking-wider">Lịch sử Chat</span>
            <button onClick={() => setSidebarOpen(false)} className="md:hidden p-1 hover:bg-gray-200 rounded-md text-gray-500">
              <X size={20} />
            </button>
         </div>
         <div className="px-3 pb-2">
            <button onClick={handleNewChat} className="w-full flex items-center justify-center gap-2 bg-white border border-gray-200 shadow-sm hover:bg-gray-100 p-2.5 rounded-xl transition text-sm font-medium text-gray-700">
              <Plus size={18} /> Đoạn chat mới
            </button>
         </div>
         
         <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {chatList.length === 0 ? (
               <div className="text-center text-gray-400 text-sm mt-4">Chưa có lịch sử</div>
            ) : (
               chatList.map((chat) => (
                 <button 
                   key={chat.id}
                   onClick={() => handleSelectChat(chat)}
                   className={`w-full flex items-center gap-3 p-3 text-left rounded-xl truncate text-sm transition ${
                     currentChatId === chat.id 
                     ? 'bg-gray-200 text-gray-900 font-medium' 
                     : 'hover:bg-gray-200 text-gray-600'
                   }`}
                 >
                   <MessageSquare size={16} className="shrink-0" /> 
                   <span className="truncate">{chat.title || "Chat mới"}</span>
                 </button>
               ))
            )}
         </div>
      </div>

      {/* Bóng mờ nền khi mở sidebar trên mobile */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/20 z-0 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* --- CỘT PHẢI: KHU VỰC CHAT CHÍNH --- */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative w-full">
         
         {/* Header */}
         <header className="h-14 flex items-center justify-between px-4 border-b bg-white/80 backdrop-blur-md sticky top-0 z-0">
            <div className="flex items-center gap-3">
               <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition">
                 <Menu size={22} />
               </button>
               <select 
                 value={selectedModel}
                 onChange={(e) => setSelectedModel(e.target.value)}
                 className="bg-gray-100 text-gray-700 border-none rounded-lg px-4 py-2 text-sm font-semibold outline-none cursor-pointer hover:bg-gray-200 transition"
               >
                  <option value="gpt-4.1-2025-04-14">gpt-4.1-2025-04-14</option>
                  <option value="gpt-6-luna">gpt-6-luna</option>
               </select>
            </div>
         </header>

         {/* Nội dung tin nhắn */}
         <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
            <div className="max-w-3xl mx-auto space-y-6 pb-4">
              {messages.map((msg, idx) => (
                 <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] md:max-w-[75%] p-4 rounded-2xl text-sm md:text-base leading-relaxed ${
                      msg.role === 'user' 
                      ? 'bg-gray-900 text-white rounded-br-none shadow-sm' 
                      : 'bg-gray-100 text-gray-800 rounded-bl-none'
                    }`}>
                       {msg.content}
                    </div>
                 </div>
              ))}
              
              {/* Hiệu ứng loading khi chờ AI trả lời */}
              {isLoading && (
                 <div className="flex justify-start">
                    <div className="bg-gray-100 p-4 rounded-2xl rounded-bl-none text-gray-500">
                       <Loader2 className="animate-spin" size={20} />
                    </div>
                 </div>
              )}
            </div>
         </div>

         {/* Khung nhập liệu (Input bar) */}
         <div className="p-4 bg-white bg-opacity-90 backdrop-blur-sm border-t">
            <div className="max-w-3xl mx-auto flex items-end gap-2 bg-gray-50 p-2 rounded-2xl border border-gray-200 focus-within:ring-1 focus-within:ring-gray-400 focus-within:border-gray-400 transition-all shadow-sm">
               <button title="Đính kèm file" className="p-3 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-xl transition shrink-0">
                  <Paperclip size={20} />
               </button>
               <textarea 
                 value={input}
                 onChange={(e) => setInput(e.target.value)}
                 disabled={isLoading}
                 placeholder={isLoading ? "Đang chờ phản hồi..." : `Nhắn tin cho ${selectedModel}...`}
                 className="w-full bg-transparent border-none focus:ring-0 resize-none max-h-32 min-h-[44px] py-3 text-gray-700 outline-none disabled:opacity-50"
                 rows={1}
                 onKeyDown={(e) => { 
                   if(e.key === 'Enter' && !e.shiftKey) { 
                     e.preventDefault(); 
                     handleSend(); 
                   } 
                 }}
               />
               <button 
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className={`p-3 rounded-xl transition shrink-0 mb-1 ${
                    input.trim() && !isLoading 
                    ? 'bg-gray-900 text-white hover:bg-gray-800 shadow-md' 
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
               >
                  <Send size={18} />
               </button>
            </div>
            <div className="text-center text-xs text-gray-400 mt-3">
               Trí tuệ nhân tạo có thể tạo ra thông tin không chính xác. Hãy kiểm tra các thông tin quan trọng.
            </div>
         </div>
      </div>
    </div>
  );
}