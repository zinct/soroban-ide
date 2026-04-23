import React, { useState, useRef, useEffect, memo, useMemo, useLayoutEffect } from "react";
import { Sparkles, X, ArrowUp, User, Bot, MessageSquare, Plus, Copy, Check, ArrowDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";
import "../../styles/ai.css";
import { streamChatWithAI } from "../../services/ai";

const MIN_WIDTH = 300;
const MAX_WIDTH = 800;
const COLLAPSE_THRESHOLD = 200;

const CodeBlock = memo(({ children, className, ...props }) => {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || "");
  const code = String(children).replace(/\n$/, "");

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="ai-code-block-container">
      <div className="ai-code-block-header">
        <span className="ai-code-lang">{match ? match[1] : "code"}</span>
        <button className="ai-copy-btn" onClick={handleCopy}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <SyntaxHighlighter
        style={vscDarkPlus}
        language={match ? match[1] : "javascript"}
        PreTag="div"
        className="ai-syntax-highlighter"
        {...props}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
});

const AIMessage = memo(({ text, sender }) => {
  return (
    <div className={`ai-message ${sender}`}>
      <div className="ai-message-text">
        {sender === "assistant" ? (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code: CodeBlock,
            }}
          >
            {text}
          </ReactMarkdown>
        ) : (
          text
        )}
      </div>
    </div>
  );
});

const AIPanel = ({ isOpen, onClose }) => {
  const [width, setWidth] = useState(() => {
    const saved = localStorage.getItem("ai_panel_width_v2");
    return saved ? parseInt(saved, 10) : 400;
  });
  const [isResizing, setIsResizing] = useState(false);
  const [isMultiline, setIsMultiline] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem("ai_chat_history");
    try {
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to parse AI history:", e);
      return [];
    }
  });
  const [streamingText, setStreamingText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

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

  const scrollToBottom = (forceInstant = false) => {
    if (!chatContainerRef.current) return;
    
    const performScroll = () => {
      if (!chatContainerRef.current) return;
      if (forceInstant || isLoading) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    };

    // Immediate scroll
    performScroll();
    
    // Double-check on the next frame to catch any layout changes from Markdown rendering
    if (isLoading || forceInstant) {
      requestAnimationFrame(performScroll);
    }
  };

  useLayoutEffect(() => {
    if (shouldAutoScroll) {
      scrollToBottom();
    }
  }, [messages, streamingText, shouldAutoScroll]);

  // Optimized persistence: Save to localStorage with a debounce to avoid lag 
  // during real-time streaming updates.
  useEffect(() => {
    const delay = isLoading ? 1500 : 300; // Save less frequently during stream
    const timeoutId = setTimeout(() => {
      localStorage.setItem("ai_chat_history", JSON.stringify(messages));
    }, delay);
    
    return () => clearTimeout(timeoutId);
  }, [messages, isLoading]);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    // Lower threshold (20px) makes it easier to "break" out of auto-scroll by scrolling up,
    // while still being reliable enough to stick when at the bottom.
    const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 20;
    setShouldAutoScroll(isAtBottom);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    // Collapse 3 or more newlines into exactly two
    const processedText = input.trim().replace(/\n\n+/g, "\n\n");
    const userInput = processedText;

    const userMessage = {
      id: Date.now(),
      text: userInput,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setShouldAutoScroll(true);
    
    // Force an instant scroll immediately on send
    setTimeout(() => scrollToBottom(true), 0);

    try {
      const chatHistory = messages.map((m) => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.text,
      }));
      chatHistory.push({ role: "user", content: userInput });

      let finalAssistantText = "";
      await streamChatWithAI(chatHistory, (fullText) => {
        finalAssistantText = fullText;
        setStreamingText(fullText);
      });

      if (finalAssistantText) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now(),
            text: finalAssistantText,
            sender: "assistant",
            timestamp: new Date(),
          },
        ]);
      }
      setStreamingText("");
    } catch (error) {
      console.error("AI Error:", error);
      const errorMessage = {
        id: Date.now() + 1,
        text: "Sorry, I'm having trouble connecting right now. Please try again later.",
        sender: "assistant",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
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

        <div className="ai-chat-messages" onScroll={handleScroll} ref={chatContainerRef}>
          <div className="ai-chat-messages-inner">
            {messages.length === 0 && !streamingText ? (
              <div className="ai-welcome">
                <h3>how can i help?</h3>
                <p>Ask me anything about Soroban, Rust, or Stellar development.</p>
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <AIMessage key={msg.id} text={msg.text} sender={msg.sender} />
                ))}
                {streamingText && (
                  <AIMessage key="streaming" text={streamingText} sender="assistant" />
                )}
              </>
            )}
            {isLoading && (
              <div className="ai-message assistant">
                <div className="ai-message-text ai-loading">
                  <span className="dot">.</span>
                  <span className="dot">.</span>
                  <span className="dot">.</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {!shouldAutoScroll && messages.length > 0 && (
          <button
            className="ai-scroll-bottom-btn"
            onClick={() => {
              setShouldAutoScroll(true);
              scrollToBottom(true);
            }}
            title="Latest messages"
          >
            <ArrowDown size={18} />
          </button>
        )}

        <div className="ai-chat-input-container">
          <div className={`ai-chat-input-wrapper ${isMultiline ? "multiline" : ""}`}>
            <textarea ref={textareaRef} className="ai-chat-input" placeholder="Type a message..." value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} rows={1} disabled={isLoading} />
            <div className="ai-chat-input-actions">
              <button className="ai-send-btn" onClick={handleSend} disabled={!input.trim() || isLoading}>
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
