import React, { useState, useRef, useEffect } from "react";
import { Sparkles, X, ArrowUp, User, Bot, MessageSquare, Plus } from "lucide-react";
import "../../styles/ai.css";

const MIN_WIDTH = 300;
const MAX_WIDTH = 800;
const COLLAPSE_THRESHOLD = 200;

const AIPanel = ({ isOpen, onClose }) => {
  const [width, setWidth] = useState(() => {
    const saved = localStorage.getItem("ai_panel_width_v2");
    return saved ? parseInt(saved, 10) : 400;
  });
  const [isResizing, setIsResizing] = useState(false);
  const [isMultiline, setIsMultiline] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const scrollHeight = textarea.scrollHeight;
      textarea.style.height = `${Math.min(scrollHeight, 200)}px`;
      
      // If empty, it's definitely not multiline. 
      // Otherwise check if it exceeds threshold (accounting for padding)
      const hasText = input.trim().length > 0;
      setIsMultiline(hasText && (input.includes("\n") || scrollHeight > 50)); 
    }
  }, [input]);

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsResizing(true);
    dragStartX.current = e.clientX;
    dragStartWidth.current = width;
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      const delta = dragStartX.current - e.clientX;
      const rawWidth = dragStartWidth.current + delta;

      if (rawWidth < COLLAPSE_THRESHOLD) {
        setIsResizing(false);
        onClose();
        return;
      }

      const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, rawWidth));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isResizing) {
        setIsResizing(false);
        localStorage.setItem("ai_panel_width_v2", width);
      }
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    } else {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, width]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;

    // Collapse 3 or more newlines into exactly two
    const processedText = input.trim().replace(/\n\n+/g, "\n\n");

    const userMessage = {
      id: Date.now(),
      text: processedText,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    // Simulate AI response
    setTimeout(() => {
      const assistantMessage = {
        id: Date.now() + 1,
        text: "I'm your Soroban AI assistant. How can I help you today with your Stellar smart contracts?",
        sender: "assistant",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    }, 1000);
  };

  const clearChat = () => {
    setMessages([]);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={`ai-panel ${isOpen ? "open" : ""} ${isResizing ? "resizing" : ""}`} style={{ width: isOpen ? width : 0 }}>
      <div className="ai-resize-handle" onMouseDown={handleMouseDown} />

      <div className="ai-panel-content" style={{ width }}>
        <div className="ai-panel-header">
          <div className="ai-panel-title">
            <Sparkles size={18} />
            <span>Soroban AI</span>
          </div>
          <div className="ai-panel-header-actions">
            <button className="ai-header-btn new-chat-btn" onClick={clearChat} title="New Chat">
              <Plus size={18} />
            </button>
            <button className="ai-header-btn close-btn" onClick={onClose} title="Close Panel">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="ai-chat-messages">
          <div className="ai-chat-messages-inner">
            {messages.length === 0 ? (
              <div className="ai-welcome">
                <div className="ai-welcome-icon">
                  <Sparkles size={48} />
                </div>
                <h3>Hello! I'm your AI Assistant</h3>
                <p>Ask me anything about Soroban, Rust, or Stellar development.</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`ai-message ${msg.sender}`}>
                  <div className="ai-message-text">{msg.text}</div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="ai-chat-input-container">
          <div className={`ai-chat-input-wrapper ${isMultiline ? "multiline" : ""}`}>
            <textarea ref={textareaRef} className="ai-chat-input" placeholder="Type a message..." value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} rows={1} />
            <div className="ai-chat-input-actions">
              <button className="ai-send-btn" onClick={handleSend} disabled={!input.trim()}>
                <ArrowUp size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIPanel;
