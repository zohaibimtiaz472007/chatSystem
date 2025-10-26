import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";
import { Send, Bot, User, Trash2, RefreshCw, Loader2 } from "lucide-react";

const API_BASE = "https://ai-chat-system-omega.vercel.app/api";

export default function App() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState(null);
  const bottomRef = useRef(null);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch chat history + health check
  useEffect(() => {
    const init = async () => {
      try {
        const [msgRes, healthRes] = await Promise.all([
          axios.get(`${API_BASE}/messages`),
          axios.get(`${API_BASE}/health`),
        ]);

        if (msgRes.data.success) setMessages(msgRes.data.messages);
        if (healthRes.data.success) setHealth(healthRes.data.status);
      } catch (err) {
        console.error(err);
        toast.error("Backend not reachable");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // Send message
  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = {
      id: Date.now(),
      sender: "You",
      message: input.trim(),
      timestamp: new Date().toISOString(),
      type: "user",
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      const resp = await axios.post(`${API_BASE}/chat`, {
        message: userMsg.message,
      });

      if (resp.data?.success && Array.isArray(resp.data.messages)) {
        const aiMessages = resp.data.messages.filter((m) => m.type === "ai");
        setMessages((prev) => [...prev, ...aiMessages]);
      } else {
        toast.error(resp.data?.error || "Invalid response from backend");
      }
    } catch (err) {
      console.error("Error:", err);
      toast.error("Failed to connect to backend");
    } finally {
      setSending(false);
    }
  };

  // Handle Enter
  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Clear chat
  const clearChat = async () => {
    if (!window.confirm("Are you sure you want to clear the chat?")) return;
    try {
      await axios.delete(`${API_BASE}/messages`);
      setMessages([]);
      toast.success("Chat history cleared");
    } catch (err) {
      toast.error("Failed to clear chat");
    }
  };

  // Refresh health
  const checkHealth = async () => {
    try {
      const res = await axios.get(`${API_BASE}/health`);
      setHealth(res.data.status);
      toast.success("Backend is healthy!");
    } catch (err) {
      setHealth("Offline");
      toast.error("Backend not responding");
    }
  };

  // ===== Helper: Get style based on sender/model =====
  const getStyle = (msg) => {
    if (msg.sender === "You") {
      return "bg-blue-600 text-white rounded-br-none";
    }
    if (msg.model === "gemini") return "bg-green-800/70 border border-green-700 text-green-100";
    if (msg.model === "groq") return "bg-purple-800/70 border border-purple-700 text-purple-100";
    if (msg.model === "gpt4") return "bg-blue-800/70 border border-blue-700 text-blue-100";
    return "bg-gray-800 text-gray-100";
  };

  const getBadge = (msg) => {
    if (msg.model === "gemini")
      return <span className="text-green-400 font-semibold">Gemini</span>;
    if (msg.model === "groq")
      return <span className="text-purple-400 font-semibold">Groq-Llama</span>;
    if (msg.model === "gpt4")
      return <span className="text-blue-400 font-semibold">GPT-4</span>;
    return <span className="text-gray-400 font-semibold">{msg.sender}</span>;
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-gray-900 via-black to-gray-950 text-white">
      <Toaster position="top-right" />

      {/* Header */}
      <header className="p-4 flex justify-between items-center border-b border-gray-800 bg-gray-900/70 backdrop-blur-md">
        <h1 className="font-bold text-xl flex items-center gap-2">
          🤖 AI Group Chat <span className="text-xs text-gray-400">[Gemini + Groq + GPT-4]</span>
        </h1>
        <div className="flex gap-2">
          <button
            onClick={checkHealth}
            className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition"
            title="Check server health"
          >
            <RefreshCw size={18} />
          </button>
          <button
            onClick={clearChat}
            className="p-2 bg-red-600 rounded-lg hover:bg-red-700 transition"
            title="Clear chat"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </header>

      {/* Health bar */}
      <div className="text-xs px-4 py-1 text-gray-400 border-b border-gray-800 bg-gray-950/80">
        Status:{" "}
        <span
          className={`${
            health?.includes("running") ? "text-green-400" : "text-red-400"
          }`}
        >
          {health || "Checking..."}
        </span>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 animate-pulse">
            <Bot size={40} className="mb-3 opacity-60" />
            <p>Loading messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Bot size={40} className="mb-3 opacity-60" />
            <p className="text-lg">Start chatting with AI models...</p>
          </div>
        ) : (
          messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex items-start gap-3 ${
                msg.sender === "You" ? "justify-end" : "justify-start"
              }`}
            >
              {msg.sender !== "You" && (
                <Bot
                  className={`w-6 h-6 mt-1 ${
                    msg.model === "gemini"
                      ? "text-green-400"
                      : msg.model === "groq"
                      ? "text-purple-400"
                      : msg.model === "gpt4"
                      ? "text-blue-400"
                      : "text-gray-400"
                  }`}
                />
              )}
              <div
                className={`px-4 py-2 rounded-2xl max-w-[75%] border ${getStyle(
                  msg
                )}`}
              >
                <div className="text-[11px] mb-1">{getBadge(msg)}</div>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {msg.message}
                </p>
              </div>
              {msg.sender === "You" && (
                <User className="w-6 h-6 text-blue-400 mt-1" />
              )}
            </motion.div>
          ))
        )}

        {/* Typing indicator */}
        {sending && (
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Loader2 className="animate-spin w-4 h-4" />
            <p>AI models are replying...</p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-800 flex gap-2 bg-gray-900/70 backdrop-blur-lg">
        <textarea
          className="flex-1 bg-gray-950 border border-gray-700 rounded-lg p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows="1"
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyPress}
          disabled={sending}
        />
        <button
          onClick={sendMessage}
          disabled={sending}
          className={`px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition flex items-center gap-2 ${
            sending ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          {sending ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Sending...
            </>
          ) : (
            <>
              <Send size={18} />
              Send
            </>
          )}
        
        </button>
          
      </div>
      
    </div>
  );
}
