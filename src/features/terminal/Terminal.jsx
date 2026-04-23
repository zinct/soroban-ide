import React, { memo, useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Plus, X, Terminal as TerminalIcon } from "lucide-react";
import { loadState, saveStateSection } from "../../utils/storage";
import { executeTerminalCommand, isBackendCommand } from "./terminalCommands";
import { collectProjectFiles, submitCommand, connectBuildStream, killCommand, getPreviewUrl } from "../../services/backendService";

const MIN_HEIGHT = 56;
const COLLAPSE_THRESHOLD = 60;
const DEFAULT_HEIGHT = 350;
const MAX_HEIGHT = 600;

/**
 * Helper to create a new terminal instance
 */
const createTerminalInstance = (id, name = "bash", cwd = "~/project") => ({
  id,
  name,
  cwd,
  history: [
    { type: "output", content: "Welcome to Soroban Studio Terminal" },
    { type: "output", content: "Type 'help' for available commands" },
  ],
  isRunning: false,
  input: "",
  commandHistory: [],
  historyIndex: -1,
  activeJobId: null,
  lastSessionId: null
});

/**
 * Terminal panel with simulated shell + backend integration.
 */
const Terminal = memo(({ activeFileName, currentDirectory = "~/project", treeData, fileContents, onFileTreeUpdate }) => {
  const persistedState = useMemo(() => loadState()?.terminal, []);

  const [height, setHeight] = useState(() => persistedState?.height || DEFAULT_HEIGHT);
  const [isCollapsed, setIsCollapsed] = useState(() => persistedState?.isCollapsed ?? true);
  const [isDragging, setIsDragging] = useState(false);
  
  // Sidebar resizing state
  const [sidebarWidth, setSidebarWidth] = useState(() => persistedState?.sidebarWidth || 240);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  
  // Multi-terminal state
  const [terminals, setTerminals] = useState(() => {
    if (persistedState?.terminals?.length > 0) {
      return persistedState.terminals.map(t => ({
        ...t,
        isRunning: false, // Don't persist running state
        wsCleanup: null
      }));
    }
    return [createTerminalInstance("default", "Terminal 1", currentDirectory)];
  });
  const [activeTerminalId, setActiveTerminalId] = useState(() => persistedState?.activeTerminalId || "default");

  const terminalRef = useRef(null);
  const inputRef = useRef(null);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);
  const windowEndRef = useRef(null);
  const previousHeight = useRef(DEFAULT_HEIGHT);
  
  const wsCleanupsRef = useRef({});

  const activeTerminal = terminals.find(t => t.id === activeTerminalId) || terminals[0];
  const showSidebar = !isCollapsed && terminals.length > 1;

  // Persistence
  useEffect(() => {
    saveStateSection("terminal", { 
      height, 
      isCollapsed, 
      sidebarWidth,
      terminals: terminals.map(({ wsCleanup, ...rest }) => rest),
      activeTerminalId 
    });
  }, [height, isCollapsed, sidebarWidth, terminals, activeTerminalId]);

  // Cleanup all WebSockets on unmount
  useEffect(() => {
    return () => {
      Object.values(wsCleanupsRef.current).forEach(cleanup => cleanup && cleanup());
    };
  }, []);

  const terminalWindowRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const scrollToBottom = useCallback(() => {
    if (autoScroll && windowEndRef.current) {
      windowEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [autoScroll]);

  useEffect(() => scrollToBottom(), [activeTerminal.history, scrollToBottom]);

  const handleScroll = useCallback(() => {
    if (terminalWindowRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = terminalWindowRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 50;
      setAutoScroll(isNearBottom);
    }
  }, []);

  const getShortPath = useCallback((path) => {
    return path.startsWith("~/") ? "~" + path.slice(1) : path;
  }, []);

  const updateTerminal = useCallback((id, updates) => {
    setTerminals(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const addTerminal = useCallback((e) => {
    if (e) e.stopPropagation();
    const id = `term-${Date.now()}`;
    const newTerm = createTerminalInstance(id, `Terminal ${terminals.length + 1}`, currentDirectory);
    setTerminals(prev => [...prev, newTerm]);
    setActiveTerminalId(id);
    if (isCollapsed) {
      setIsCollapsed(false);
      setHeight(previousHeight.current || DEFAULT_HEIGHT);
    }
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [terminals.length, currentDirectory, isCollapsed]);

  const closeTerminal = useCallback((e, id) => {
    e.stopPropagation();
    if (terminals.length === 1) return;

    const term = terminals.find(t => t.id === id);
    if (term.isRunning && term.activeJobId && term.lastSessionId) {
      killCommand(term.lastSessionId, term.activeJobId);
    }
    if (wsCleanupsRef.current[id]) {
      wsCleanupsRef.current[id]();
      delete wsCleanupsRef.current[id];
    }

    const newTerminals = terminals.filter(t => t.id !== id);
    setTerminals(newTerminals);
    if (activeTerminalId === id) {
      setActiveTerminalId(newTerminals[newTerminals.length - 1].id);
    }
  }, [terminals, activeTerminalId]);

  /* ─── Backend command execution ─── */

  const executeBackendCommand = useCallback(
    async (cmd, termId) => {
      updateTerminal(termId, { isRunning: true });

      try {
        const files = collectProjectFiles(treeData || [], fileContents || {});
        const targetTerm = terminals.find(t => t.id === termId);
        const { sessionId, jobId } = await submitCommand(files, cmd, targetTerm.cwd);
        updateTerminal(termId, { activeJobId: jobId, lastSessionId: sessionId });

        wsCleanupsRef.current[termId] = connectBuildStream(sessionId, jobId, {
          onMessage: (msg) => {
            if (msg.type === "fileTreeUpdate") {
              if (onFileTreeUpdate) {
                try {
                  const tree = JSON.parse(msg.content);
                  onFileTreeUpdate(tree);
                } catch (e) {
                  console.error("Failed to parse file tree update:", e);
                }
              }
              return;
            }

            const decorativePatterns = [/Executing:/i, /Command completed successfully/i, /Connected to build server/i, /Session:/i, /Sending to build server/i];
            if (decorativePatterns.some((pattern) => pattern.test(msg.content))) return;

            let content = msg.content;
            if (content.includes("Local:") && (content.includes("localhost:") || content.includes("0.0.0.0:"))) {
              content = content.replace(/http:\/\/(localhost|0\.0\.0\.0):\d+\/?/g, getPreviewUrl());
            }

            const className = msg.type === "error" ? "error" : msg.type === "info" ? "info" : "output";
            setTerminals(prev => prev.map(t => t.id === termId ? { ...t, history: [...t.history, { type: className, content }] } : t));
          },
          onError: (errorMsg) => {
            setTerminals(prev => prev.map(t => t.id === termId ? { ...t, isRunning: false, history: [...t.history, { type: "error", content: `❌ ${errorMsg}` }] } : t));
            wsCleanupsRef.current[termId] = null;
          },
          onDone: () => {
            updateTerminal(termId, { isRunning: false });
            wsCleanupsRef.current[termId] = null;
          },
        });
      } catch (err) {
        setTerminals(prev => prev.map(t => t.id === termId ? { ...t, isRunning: false, history: [...t.history, { type: "error", content: `❌ ${err.message || "Failed to connect to build server"}` }] } : t));
      }
    },
    [treeData, fileContents, terminals, updateTerminal, onFileTreeUpdate]
  );

  /* ─── Command execution ─── */

  const handleExecute = useCallback(
    (cmd) => {
      const trimmedCmd = cmd.trim();
      if (!trimmedCmd) return;
      if (activeTerminal.isRunning) return;

      const updatedHistory = [...activeTerminal.history, { type: "command", content: trimmedCmd, cwd: getShortPath(activeTerminal.cwd) }];
      const updatedCommandHistory = [...activeTerminal.commandHistory, trimmedCmd];
      
      updateTerminal(activeTerminalId, { 
        history: updatedHistory, 
        commandHistory: updatedCommandHistory,
        historyIndex: -1,
        input: ""
      });

      if (isBackendCommand(trimmedCmd)) {
        executeBackendCommand(trimmedCmd, activeTerminalId);
      } else {
        const output = executeTerminalCommand(trimmedCmd, activeTerminal.cwd, (newCwd) => updateTerminal(activeTerminalId, { cwd: newCwd }), treeData);
        if (output === null) {
          updateTerminal(activeTerminalId, { history: [] });
        } else if (output) {
          setTerminals(prev => prev.map(t => t.id === activeTerminalId ? { ...t, history: [...t.history, { type: "output", content: output }] } : t));
        }
      }
    },
    [activeTerminal, activeTerminalId, getShortPath, executeBackendCommand, treeData, updateTerminal]
  );

  /* ─── Keyboard handling ─── */

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleExecute(activeTerminal.input);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (activeTerminal.commandHistory.length > 0) {
          const newIndex = activeTerminal.historyIndex + 1;
          if (newIndex < activeTerminal.commandHistory.length) {
            updateTerminal(activeTerminalId, { 
              historyIndex: newIndex, 
              input: activeTerminal.commandHistory[activeTerminal.commandHistory.length - 1 - newIndex] 
            });
          }
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (activeTerminal.historyIndex > 0) {
          const newIndex = activeTerminal.historyIndex - 1;
          updateTerminal(activeTerminalId, { 
            historyIndex: newIndex, 
            input: activeTerminal.commandHistory[activeTerminal.commandHistory.length - 1 - newIndex] 
          });
        } else if (activeTerminal.historyIndex === 0) {
          updateTerminal(activeTerminalId, { historyIndex: -1, input: "" });
        }
      } else if (e.key === "l" && e.ctrlKey) {
        e.preventDefault();
        updateTerminal(activeTerminalId, { history: [] });
      } else if (e.key.toLowerCase() === "c" && (e.ctrlKey || e.metaKey)) {
        if (window.getSelection()?.toString()) return;
        if (e.ctrlKey && e.key.toLowerCase() === "c") {
          e.preventDefault();
          if (activeTerminal.isRunning) {
            if (activeTerminal.activeJobId && activeTerminal.lastSessionId) {
              killCommand(activeTerminal.lastSessionId, activeTerminal.activeJobId);
            }
            if (wsCleanupsRef.current[activeTerminalId]) {
              wsCleanupsRef.current[activeTerminalId]();
              wsCleanupsRef.current[activeTerminalId] = null;
            }
            updateTerminal(activeTerminalId, { 
              isRunning: false, 
              history: [...activeTerminal.history, { type: "error", content: "^C — cancelled" }] 
            });
          } else {
            updateTerminal(activeTerminalId, { 
              input: "",
              history: [...activeTerminal.history, { type: "command", content: activeTerminal.input + "^C", cwd: getShortPath(activeTerminal.cwd) }]
            });
          }
        }
      }
    },
    [activeTerminal, activeTerminalId, handleExecute, getShortPath, updateTerminal]
  );

  /* ─── Resize handlers ─── */

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragStartHeight.current = height;
  }, [height]);

  const handleSidebarResizeStart = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizingSidebar(true);
    dragStartX.current = e.clientX;
    dragStartWidth.current = sidebarWidth;
  }, [sidebarWidth]);

  const handleMouseMove = useCallback((e) => {
    if (isDragging) {
      const delta = dragStartY.current - e.clientY;
      const newHeight = dragStartHeight.current + delta;
      if (newHeight < COLLAPSE_THRESHOLD) {
        setIsCollapsed(true);
        setHeight(MIN_HEIGHT);
      } else {
        setIsCollapsed(false);
        setHeight(Math.max(MIN_HEIGHT + 10, Math.min(MAX_HEIGHT, newHeight)));
      }
    } else if (isResizingSidebar) {
      const delta = dragStartX.current - e.clientX;
      const newWidth = dragStartWidth.current + delta;
      setSidebarWidth(Math.max(160, Math.min(500, newWidth)));
    }
  }, [isDragging, isResizingSidebar]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizingSidebar(false);
  }, []);

  useEffect(() => {
    if (isDragging || isResizingSidebar) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = isDragging ? "row-resize" : "col-resize";
    } else {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, isResizingSidebar, handleMouseMove, handleMouseUp]);

  const toggleCollapse = useCallback(() => {
    if (isCollapsed) {
      setIsCollapsed(false);
      setHeight(previousHeight.current || DEFAULT_HEIGHT);
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      previousHeight.current = height > MIN_HEIGHT ? height : DEFAULT_HEIGHT;
      setIsCollapsed(true);
      setHeight(MIN_HEIGHT);
    }
  }, [isCollapsed, height]);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key.toLowerCase() === "j" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        toggleCollapse();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [toggleCollapse]);

  // External command bus — allows the Command Palette to toggle / clear the terminal.
  // Also handles soroban:runCommand from Deploy panel.
  useEffect(() => {
    const handleToggle = () => toggleCollapse();
    const handleClear = () => updateTerminal(activeTerminalId, { history: [] });
    const handleRunCommand = (e) => {
      const { cmd } = e.detail || {};
      if (!cmd) return;
      // Expand terminal if collapsed
      if (isCollapsed) {
        setIsCollapsed(false);
        setHeight(previousHeight.current || DEFAULT_HEIGHT);
      }
      handleExecute(cmd);
    };
    const handleAppend = (e) => {
      const { type, content, cwd: entryCwd } = e.detail || {};
      if (!content) return;
      if (isCollapsed) {
        setIsCollapsed(false);
        setHeight(previousHeight.current || DEFAULT_HEIGHT);
      }
      const className = type === "error" ? "error" : type === "command" ? "command" : "output";
      setTerminals(prev => prev.map(t => t.id === activeTerminalId ? { ...t, history: [...t.history, { type: className, content, cwd: entryCwd || "~/project" }] } : t));
    };
    window.addEventListener("soroban:toggleTerminal", handleToggle);
    window.addEventListener("soroban:clearTerminal", handleClear);
    window.addEventListener("soroban:runCommand", handleRunCommand);
    window.addEventListener("soroban:terminalAppend", handleAppend);
    return () => {
      window.removeEventListener("soroban:toggleTerminal", handleToggle);
      window.removeEventListener("soroban:clearTerminal", handleClear);
      window.removeEventListener("soroban:runCommand", handleRunCommand);
      window.removeEventListener("soroban:terminalAppend", handleAppend);
    };
  }, [toggleCollapse, isCollapsed, handleExecute, activeTerminalId, updateTerminal]);

  const handleTerminalClick = useCallback(() => {
    if (window.getSelection()?.toString()) return;
    if (!isCollapsed && inputRef.current) inputRef.current.focus({ preventScroll: true });
  }, [isCollapsed]);

  const renderContentWithLinks = (content) => {
    if (typeof content !== "string") return content;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = content.split(urlRegex);
    return parts.map((part, i) => part.match(urlRegex) ? (
      <a key={i} href={part} className="terminal-link" target="_blank" rel="noopener noreferrer">{part}</a>
    ) : part);
  };

  const getLineClassName = (entry) => {
    if (entry.type === "command") return "terminal-line command";
    if (entry.type === "error") return "terminal-line output terminal-error";
    if (entry.type === "info") return "terminal-line output terminal-info";
    return "terminal-line output";
  };

  return (
    <div ref={terminalRef} 
         className={`terminal ${isCollapsed ? "collapsed" : ""} ${isDragging ? "" : "animate"}`} 
         style={{ height: isCollapsed ? MIN_HEIGHT : height }} 
         onClick={handleTerminalClick}>
      
      <div className={`terminal-resize-handle ${isDragging ? "dragging" : ""}`} onMouseDown={handleMouseDown} />

      <div className="terminal-header">
        <button className="terminal-title-btn" onClick={toggleCollapse}>
          <span className="terminal-title">Terminal</span>
          {activeTerminal.isRunning && <span className="terminal-running-badge">Running</span>}
        </button>
        {!isCollapsed && (
          <div className="terminal-header-actions">
            <button className="terminal-header-add-btn" onClick={addTerminal} title="New Terminal">
              <Plus size={16} />
            </button>
          </div>
        )}
      </div>

      <div className={`terminal-layout ${isCollapsed ? "collapsed-window" : ""}`}>
        <div className="terminal-window" ref={terminalWindowRef} onScroll={handleScroll}>
          <div className="terminal-content">
            {activeTerminal.history.map((entry, index) => (
              <div key={index} className={getLineClassName(entry)}>
                {entry.type === "command" && (
                  <span className="terminal-prompt-line">
                    <span className="terminal-prompt-user">soroban</span>
                    <span className="terminal-prompt-at">@</span>
                    <span className="terminal-prompt-host">studio</span>
                    <span className="terminal-prompt-separator">:</span>
                    <span className="terminal-prompt-path">{entry.cwd || getShortPath(activeTerminal.cwd)}</span>
                    <span className="terminal-prompt-symbol">$</span>
                    <span className="terminal-prompt-command">{entry.content}</span>
                  </span>
                )}
                {entry.type !== "command" && <pre className="terminal-output">{renderContentWithLinks(entry.content)}</pre>}
              </div>
            ))}
            <div className={`terminal-input-line ${activeTerminal.isRunning ? "compiling" : ""}`}>
              {!activeTerminal.isRunning ? (
                <span className="terminal-prompt-line">
                  <span className="terminal-prompt-user">soroban</span>
                  <span className="terminal-prompt-at">@</span>
                  <span className="terminal-prompt-host">studio</span>
                  <span className="terminal-prompt-separator">:</span>
                  <span className="terminal-prompt-path">{getShortPath(activeTerminal.cwd)}</span>
                  <span className="terminal-prompt-symbol">$</span>
                </span>
              ) : (
                <div className="terminal-compiling-line">
                  <span>Compiling</span>
                  <span className="terminal-dots"></span>
                </div>
              )}
              <input 
                ref={inputRef} 
                type="text" 
                className="terminal-input" 
                value={activeTerminal.isRunning ? "" : activeTerminal.input} 
                onChange={(e) => updateTerminal(activeTerminalId, { input: e.target.value })} 
                onKeyDown={handleKeyDown} 
                spellCheck="false" 
                autoComplete="off" 
                autoFocus 
                readOnly={activeTerminal.isRunning} 
                placeholder={activeTerminal.isRunning ? "Press Ctrl+C to cancel..." : ""} 
              />
            </div>
            <div ref={windowEndRef} />
          </div>
        </div>

        {showSidebar && (
          <div className="terminal-sidebar" style={{ width: sidebarWidth }}>
            <div className="terminal-sidebar-resize-handle" onMouseDown={handleSidebarResizeStart} />
            <div className="terminal-sidebar-header">
              <span className="terminal-sidebar-title">Sessions</span>
            </div>
            <div className="terminal-tabs-list">
              {terminals.map(term => (
                <div key={term.id} 
                     className={`terminal-tab ${term.id === activeTerminalId ? "active" : ""}`}
                     onClick={() => setActiveTerminalId(term.id)}>
                  <div className={`terminal-tab-status ${term.isRunning ? "running" : ""}`} />
                  <span className="terminal-tab-name">{term.name}</span>
                  {terminals.length > 1 && (
                    <button className="terminal-tab-close" onClick={(e) => closeTerminal(e, term.id)}>
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default Terminal;
