import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, Trash2, RefreshCw, Loader2 } from "lucide-react";

const API_BASE = "https://ai-chat-system-omega.vercel.app/api";

export default function App() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [displayedMessages, setDisplayedMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState(null);
  const [notification, setNotification] = useState("");
  const bottomRef = useRef(null);
  const messageQueueRef = useRef([]);
  const isProcessingRef = useRef(false);

  // Show notification
  const showNotification = (msg, type = "info") => {
    setNotification(msg);
    setTimeout(() => setNotification(""), 3000);
  };

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayedMessages]);

  // Fetch chat history + health check
  useEffect(() => {
    const init = async () => {
      try {
        const [msgRes, healthRes] = await Promise.all([
          fetch(`${API_BASE}/messages`).then(r => r.json()),
          fetch(`${API_BASE}/health`).then(r => r.json()),
        ]);

        if (msgRes.success) {
          setMessages(msgRes.messages);
          setDisplayedMessages(msgRes.messages);
        }
        if (healthRes.success) setHealth(healthRes.status);
      } catch (err) {
        console.error(err);
        showNotification("Backend not reachable", "error");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // Process message queue one by one
  useEffect(() => {
    const processQueue = async () => {
      if (isProcessingRef.current || messageQueueRef.current.length === 0) return;
      
      isProcessingRef.current = true;
      const nextMessage = messageQueueRef.current.shift();
      
      setDisplayedMessages(prev => [...prev, nextMessage]);
      
      // Wait before processing next message (WhatsApp-like delay)
      await new Promise(resolve => setTimeout(resolve, 800));
      
      isProcessingRef.current = false;
      
      // Process next message if any
      if (messageQueueRef.current.length > 0) {
        processQueue();
      } else {
        setSending(false);
      }
    };

    processQueue();
  }, [messages]);

  // Detect if a message is replying to another
  const detectReplyTo = (message) => {
    const replyPatterns = [
      /@(Gemini|Groq-Llama|GPT-4)/i,
      /(Gemini|Groq-Llama|GPT-4)('s| said| mentioned)/i,
      /I see what (Gemini|Groq-Llama|GPT-4)/i,
    ];

    for (const pattern of replyPatterns) {
      const match = message.match(pattern);
      if (match) {
        const referencedModel = match[1].toLowerCase();
        const referencedMsg = [...displayedMessages].reverse().find(
          m => m.model === getModelKey(referencedModel)
        );
        return referencedMsg;
      }
    }
    return null;
  };

  const getModelKey = (name) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('gemini')) return 'gemini';
    if (lowerName.includes('groq') || lowerName.includes('llama')) return 'groq';
    if (lowerName.includes('gpt')) return 'gpt4';
    return null;
  };

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
    
    setDisplayedMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      const resp = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg.message })
      });
      
      const data = await resp.json();

      if (data?.success && Array.isArray(data.messages)) {
        const aiMessages = data.messages.filter((m) => m.type === "ai");
        
        messageQueueRef.current = [...messageQueueRef.current, ...aiMessages];
        setMessages(prev => [...prev, userMsg, ...aiMessages]);
      } else {
        showNotification(data?.error || "Invalid response", "error");
        setSending(false);
      }
    } catch (err) {
      console.error("Error:", err);
      showNotification("Failed to connect", "error");
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
    if (!window.confirm("Clear all messages?")) return;
    try {
      await fetch(`${API_BASE}/messages`, { method: 'DELETE' });
      setMessages([]);
      setDisplayedMessages([]);
      messageQueueRef.current = [];
      showNotification("Chat cleared", "success");
    } catch (err) {
      showNotification("Failed to clear", "error");
    }
  };

  // Refresh health
  const checkHealth = async () => {
    try {
      const res = await fetch(`${API_BASE}/health`).then(r => r.json());
      setHealth(res.status);
      showNotification("Backend is healthy!", "success");
    } catch (err) {
      setHealth("Offline");
      showNotification("Backend offline", "error");
    }
  };

  // Get style based on sender/model
  const getStyle = (msg) => {
    if (msg.sender === "You") {
      return "bg-[#005c4b] text-white rounded-br-none ml-auto";
    }
    return "bg-[#1f2c33] text-gray-100 rounded-bl-none";
  };

  const getModelColor = (model) => {
    if (model === "gemini") return "text-green-400";
    if (model === "groq") return "text-purple-400";
    if (model === "gpt4") return "text-blue-400";
    return "text-gray-400";
  };

  const getModelName = (model) => {
    if (model === "gemini") return "Gemini";
    if (model === "groq") return "Groq-Llama";
    if (model === "gpt4") return "GPT-4";
    return "AI";
  };

  return (
    <div className="flex flex-col h-screen bg-[#0b141a] text-white">
      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-4 right-4 bg-[#1f2c33] px-4 py-2 rounded-lg shadow-lg z-50 border border-[#2a3942]">
          <p className="text-sm">{notification}</p>
        </div>
      )}

      {/* Header - WhatsApp style */}
      <header className="p-3 flex justify-between items-center bg-[#1f2c33] border-b border-[#2a3942]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center">
            🤖
          </div>
          <div>
            <h1 className="font-semibold text-base">AI Group Chat</h1>
            <p className="text-xs text-gray-400">Gemini, Groq, GPT-4</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={checkHealth}
            className="p-2 hover:bg-[#2a3942] rounded-full transition"
            title="Check server health"
          >
            <RefreshCw size={20} />
          </button>
          <button
            onClick={clearChat}
            className="p-2 hover:bg-[#2a3942] rounded-full transition"
            title="Clear chat"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </header>

      {/* Chat Messages - WhatsApp background */}
      <div 
        className="flex-1 overflow-y-auto p-4 space-y-3"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Loader2 className="animate-spin mb-3" size={40} />
            <p>Loading messages...</p>
          </div>
        ) : displayedMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Bot size={50} className="mb-4 opacity-60" />
            <p className="text-lg">Start a conversation with AI models</p>
            <p className="text-sm mt-2 opacity-70">They'll respond one by one</p>
          </div>
        ) : (
          <AnimatePresence>
            {displayedMessages.map((msg) => {
              const replyTo = msg.type === "ai" ? detectReplyTo(msg.message) : null;
              
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, scale: 0.8, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.3, type: "spring" }}
                  className={`flex ${msg.sender === "You" ? "justify-end" : "justify-start"}`}
                >
                  <div className={`max-w-[75%] ${msg.sender === "You" ? "" : "flex items-start gap-2"}`}>
                    {msg.sender !== "You" && (
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center mt-1 flex-shrink-0 ${
                        msg.model === "gemini" ? "bg-green-600" :
                        msg.model === "groq" ? "bg-purple-600" :
                        msg.model === "gpt4" ? "bg-blue-600" : "bg-gray-600"
                      }`}>
                        <Bot size={18} />
                      </div>
                    )}
                    
                    <div className={`px-3 py-2 rounded-lg shadow-lg ${getStyle(msg)}`}>
                      {msg.sender !== "You" && (
                        <div className={`text-xs font-semibold mb-1 ${getModelColor(msg.model)}`}>
                          {getModelName(msg.model)}
                        </div>
                      )}
                      
                      {/* Reply-to preview (WhatsApp style) */}
                      {replyTo && (
                        <div className="bg-black/20 border-l-4 border-green-500 pl-2 pr-3 py-1.5 mb-2 rounded">
                          <div className={`text-[10px] font-semibold mb-0.5 ${getModelColor(replyTo.model)}`}>
                            {getModelName(replyTo.model)}
                          </div>
                          <div className="text-xs opacity-70 line-clamp-2">
                            {replyTo.message}
                          </div>
                        </div>
                      )}
                      
                      {/* Message text */}
                      <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words">
                        {msg.message}
                      </p>
                      
                      {/* Timestamp */}
                      <div className={`text-[10px] mt-1 text-right ${
                        msg.sender === "You" ? "text-gray-300" : "text-gray-500"
                      }`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}

        {/* Typing indicator */}
        {sending && messageQueueRef.current.length > 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-gray-400 text-sm"
          >
            <div className="flex gap-1 ml-2">
              <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
            <p className="text-xs">AI typing...</p>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input - WhatsApp style */}
      <div className="p-3 bg-[#1f2c33] border-t border-[#2a3942]">
        <div className="flex gap-2 items-end">
          <textarea
            className="flex-1 bg-[#2a3942] border-none rounded-3xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#00a884] placeholder-gray-500"
            rows="1"
            placeholder="Type a message"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            disabled={sending}
            style={{ maxHeight: '120px' }}
          />
          <button
            onClick={sendMessage}
            disabled={sending || !input.trim()}
            className={`p-3 rounded-full transition flex items-center justify-center ${
              sending || !input.trim() 
                ? "bg-gray-700 cursor-not-allowed" 
                : "bg-[#00a884] hover:bg-[#00c997]"
            }`}
          >
            {sending ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Send size={20} />
            )}
          </button>
        </div>
        <div className="text-center text-[10px] text-gray-500 mt-2">
          💡 Idea by <span className="text-[#00a884]">Mohid Ali Abbasi</span>
        </div>
      </div>
    </div>
  );
}