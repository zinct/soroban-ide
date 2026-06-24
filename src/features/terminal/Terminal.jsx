import React, { memo, useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Plus, X } from "lucide-react";
import { loadState, saveStateSection } from "../../utils/storage";
import { executeTerminalCommand, isBackendCommand } from "./terminalCommands";
import { collectProjectFiles, submitCommand, connectBuildStream, killCommand } from "../../services/backendService";
import { formatPreviewLogEntry } from "../../services/previewConsoleBridge";

const MIN_HEIGHT = 56;
const COLLAPSE_THRESHOLD = 60;
const DEFAULT_HEIGHT = 350;
const MAX_HEIGHT = 600;
const PREVIEW_TAB_ID = "preview";

const WELCOME_LINES = [
  { type: "output", content: "Welcome to Soroban Studio Terminal" },
  { type: "output", content: "Type 'help' for available commands" },
];

const buildInitialTabs = (persisted, defaultCwd) => [
  {
    id: "shell-1",
    kind: "shell",
    title: "Terminal",
    history: persisted?.history?.length ? persisted.history : WELCOME_LINES,
    commandHistory: persisted?.commandHistory || [],
    cwd: persisted?.cwd || defaultCwd,
  },
  {
    id: PREVIEW_TAB_ID,
    kind: "preview",
    title: "Preview",
    history: [{
      type: "output",
      content: "Preview console — UI logs and errors from the in-IDE preview appear here.",
    }],
  },
];

/**
 * Terminal panel with simulated shell + backend integration.
 */
const Terminal = memo(({ activeFileName, currentDirectory = "~/project", treeData, fileContents }) => {
  const persistedState = useMemo(() => loadState()?.terminal, []);

  const [height, setHeight] = useState(() => persistedState?.height || DEFAULT_HEIGHT);
  const [isCollapsed, setIsCollapsed] = useState(() => persistedState?.isCollapsed ?? true);
  const [isDragging, setIsDragging] = useState(false);
  const [tabs, setTabs] = useState(() => buildInitialTabs(persistedState, currentDirectory));
  const [activeTabId, setActiveTabId] = useState(() => persistedState?.activeTabId || "shell-1");
  const [shellCounter, setShellCounter] = useState(() => persistedState?.shellCounter || 1);
  const [input, setInput] = useState("");
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isRunning, setIsRunning] = useState(false);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const isPreviewTab = activeTab?.kind === "preview";
  const history = activeTab?.history || [];
  const commandHistory = activeTab?.kind === "shell" ? (activeTab.commandHistory || []) : [];
  const cwd = activeTab?.kind === "shell" ? (activeTab.cwd || currentDirectory) : currentDirectory;
  const shellTab = tabs.find((t) => t.id === activeTabId && t.kind === "shell");
  const shellTabId = shellTab?.id || "shell-1";

  const terminalRef = useRef(null);
  const inputRef = useRef(null);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);
  const windowEndRef = useRef(null);
  const previousHeight = useRef(DEFAULT_HEIGHT);
  const wsCleanupRef = useRef(null);
  const activeJobIdRef = useRef(null);
  const lastSessionIdRef = useRef(null);

  const appendToTab = useCallback((tabId, entry) => {
    setTabs((prev) => prev.map((tab) => (
      tab.id === tabId ? { ...tab, history: [...tab.history, entry] } : tab
    )));
  }, []);

  const setTabHistory = useCallback((tabId, updater) => {
    setTabs((prev) => prev.map((tab) => {
      if (tab.id !== tabId) return tab;
      const nextHistory = typeof updater === "function" ? updater(tab.history) : updater;
      return { ...tab, history: nextHistory };
    }));
  }, []);

  const updateShellTab = useCallback((tabId, patch) => {
    setTabs((prev) => prev.map((tab) => (tab.id === tabId ? { ...tab, ...patch } : tab)));
  }, []);

  const expandTerminal = useCallback(() => {
    if (isCollapsed) {
      setIsCollapsed(false);
      setHeight(previousHeight.current || DEFAULT_HEIGHT);
    }
  }, [isCollapsed]);

  const executingTabRef = useRef("shell-1");
  useEffect(() => {
    if (shellTab?.id) executingTabRef.current = shellTab.id;
  }, [shellTab?.id]);

  const setShellCwd = useCallback((nextCwd) => {
    const tabId = executingTabRef.current || shellTabId;
    updateShellTab(tabId, { cwd: nextCwd });
  }, [shellTabId, updateShellTab]);

  const addShellTab = useCallback(() => {
    const next = shellCounter + 1;
    const id = `shell-${next}`;
    setShellCounter(next);
    setTabs((prev) => [
      ...prev,
      {
        id,
        kind: "shell",
        title: `Terminal ${next}`,
        history: [{ type: "output", content: "New terminal session" }],
        commandHistory: [],
        cwd: currentDirectory,
      },
    ]);
    setActiveTabId(id);
    expandTerminal();
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [shellCounter, currentDirectory, expandTerminal]);

  const closeShellTab = useCallback((tabId) => {
    if (tabId === PREVIEW_TAB_ID) return;
    setTabs((prev) => {
      const shells = prev.filter((t) => t.kind === "shell");
      if (shells.length <= 1) return prev;
      return prev.filter((t) => t.id !== tabId);
    });
    setActiveTabId((current) => (current === tabId ? "shell-1" : current));
  }, []);

  // Save state without maximized
  useEffect(() => {
    const primaryShell = tabs.find((t) => t.id === "shell-1") || tabs.find((t) => t.kind === "shell");
    saveStateSection("terminal", {
      height,
      isCollapsed,
      history: primaryShell?.history || [],
      commandHistory: primaryShell?.commandHistory || [],
      cwd: primaryShell?.cwd || currentDirectory,
      activeTabId,
      shellCounter,
    });
  }, [height, isCollapsed, tabs, activeTabId, shellCounter, currentDirectory]);

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsCleanupRef.current) {
        wsCleanupRef.current();
        wsCleanupRef.current = null;
      }
    };
  }, []);

  const terminalWindowRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const scrollToBottom = useCallback(() => {
    if (autoScroll && windowEndRef.current) {
      windowEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [autoScroll]);

  useEffect(() => scrollToBottom(), [history, scrollToBottom]);

  // Detect if user is scrolling up (disable auto-scroll)
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

  /* ─── Backend command execution ─── */

  const executeBackendCommand = useCallback(
    async (cmd) => {
      setIsRunning(true);

      try {
        // Collect all project files from the workspace tree
        const files = collectProjectFiles(treeData || [], fileContents || {});

        // Submit to backend with the exact command the user typed
        const { sessionId, jobId } = await submitCommand(files, cmd, cwd);
        activeJobIdRef.current = jobId;
        lastSessionIdRef.current = sessionId;

        // Connect WebSocket for streaming output — filtered by jobId
        // so only output from THIS specific command appears in the terminal
        wsCleanupRef.current = connectBuildStream(sessionId, jobId, {
          onMessage: (msg) => {
            console.log("[Terminal] WebSocket message received:", msg);



            // Filter out decorative backend messages
            const decorativePatterns = [/Executing:/i, /Command completed successfully/i, /Connected to build server/i, /Session:/i, /Sending to build server/i];
            const isDecorative = decorativePatterns.some((pattern) => pattern.test(msg.content));
            if (isDecorative) return;

            // Explicitly ignore file tree updates in the terminal (No-Sync Architecture)
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

            const className = msg.type === "error" ? "error" : msg.type === "info" ? "info" : "output";
            const tabId = executingTabRef.current || shellTabId;
            appendToTab(tabId, { type: className, content: msg.content });
          },
          onError: (errorMsg) => {
            appendToTab(executingTabRef.current || shellTabId, { type: "error", content: `❌ ${errorMsg}` });
            setIsRunning(false);
            wsCleanupRef.current = null;
          },
          onDone: () => {
            setIsRunning(false);
            wsCleanupRef.current = null;
          },
        });
      } catch (err) {
        appendToTab(executingTabRef.current || shellTabId, {
          type: "error",
          content: `❌ ${err.message || "Failed to connect to build server"}`,
        });
        setIsRunning(false);
      }
    },
    [treeData, fileContents, cwd, shellTabId, appendToTab],
  );

  /* ─── Command execution ─── */

  const handleExecute = useCallback(
    (cmd) => {
      const trimmedCmd = cmd.trim();
      if (!trimmedCmd) return;
      if (isRunning) return;

      executingTabRef.current = shellTabId;
      setTabHistory(shellTabId, (prev) => [...prev, { type: "command", content: trimmedCmd, cwd: getShortPath(cwd) }]);
      updateShellTab(shellTabId, { commandHistory: [...commandHistory, trimmedCmd] });
      setHistoryIndex(-1);

      // Route: stellar/cargo commands → backend, everything else → local
      if (isBackendCommand(trimmedCmd)) {
        executeBackendCommand(trimmedCmd);
      } else {
        const output = executeTerminalCommand(trimmedCmd, cwd, setShellCwd, treeData);

        if (output === null) {
          setTabHistory(shellTabId, []);
        } else if (output) {
          setTabHistory(shellTabId, (prev) => [...prev, { type: "output", content: output }]);
        }
      }
    },
    [cwd, getShortPath, isRunning, executeBackendCommand, treeData, shellTabId, commandHistory, setTabHistory, updateShellTab, setShellCwd],
  );

  /* ─── Resize handlers ─── */

  const handleMouseDown = useCallback(
    (e) => {
      e.preventDefault();
      setIsDragging(true);
      dragStartY.current = e.clientY;
      dragStartHeight.current = height;
    },
    [height],
  );

  const handleMouseMove = useCallback(
    (e) => {
      if (!isDragging) return;
      const delta = dragStartY.current - e.clientY;
      const newHeight = dragStartHeight.current + delta;

      if (newHeight < COLLAPSE_THRESHOLD) {
        setIsCollapsed(true);
        setHeight(MIN_HEIGHT);
        previousHeight.current = DEFAULT_HEIGHT;
      } else {
        setIsCollapsed(false);
        setHeight(Math.max(MIN_HEIGHT + 10, Math.min(MAX_HEIGHT, newHeight)));
      }
    },
    [isDragging],
  );

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "row-resize";
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
  }, [isDragging, handleMouseMove, handleMouseUp]);

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

  // Global toggle shortcut: Ctrl+J (or Cmd+J)
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Support both Ctrl and Cmd for cross-platform convenience
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
    const handleClear = () => setTabHistory(activeTabId, []);
    const handleRunCommand = (e) => {
      const { cmd } = e.detail || {};
      if (!cmd) return;
      expandTerminal();
      executingTabRef.current = shellTabId;
      executeBackendCommand(cmd);
      setTabHistory(shellTabId, (prev) => [...prev, { type: "command", content: cmd, cwd: "~/project" }]);
    };
    const handleAppend = (e) => {
      const { type, content, cwd: entryCwd, target } = e.detail || {};
      if (!content) return;
      expandTerminal();
      const tabId = target === "preview" ? PREVIEW_TAB_ID : activeTabId;
      const className = type === "error" ? "error" : type === "command" ? "command" : "output";
      appendToTab(tabId, { type: className, content, cwd: entryCwd || "~/project" });
    };
    const handlePreviewLog = (e) => {
      const entry = formatPreviewLogEntry(e.detail);
      appendToTab(PREVIEW_TAB_ID, entry);
      expandTerminal();
      if (entry.type === "error") setActiveTabId(PREVIEW_TAB_ID);
    };
    const handleBusy = () => setIsRunning(true);
    const handleIdle = () => setIsRunning(false);
    window.addEventListener("soroban:toggleTerminal", handleToggle);
    window.addEventListener("soroban:clearTerminal", handleClear);
    window.addEventListener("soroban:runCommand", handleRunCommand);
    window.addEventListener("soroban:terminalAppend", handleAppend);
    window.addEventListener("soroban:terminalBusy", handleBusy);
    window.addEventListener("soroban:terminalIdle", handleIdle);
    window.addEventListener("soroban:previewLog", handlePreviewLog);
    return () => {
      window.removeEventListener("soroban:toggleTerminal", handleToggle);
      window.removeEventListener("soroban:clearTerminal", handleClear);
      window.removeEventListener("soroban:runCommand", handleRunCommand);
      window.removeEventListener("soroban:terminalAppend", handleAppend);
      window.removeEventListener("soroban:previewLog", handlePreviewLog);
      window.removeEventListener("soroban:terminalBusy", handleBusy);
      window.removeEventListener("soroban:terminalIdle", handleIdle);
    };
  }, [toggleCollapse, expandTerminal, executeBackendCommand, activeTabId, shellTabId, appendToTab, setTabHistory]);

  /* ─── Keyboard handling ─── */

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleExecute(input);
        setInput("");
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (commandHistory.length > 0) {
          const newIndex = historyIndex + 1;
          if (newIndex < commandHistory.length) {
            setHistoryIndex(newIndex);
            setInput(commandHistory[commandHistory.length - 1 - newIndex]);
          }
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          setInput(commandHistory[commandHistory.length - 1 - newIndex]);
        } else if (historyIndex === 0) {
          setHistoryIndex(-1);
          setInput("");
        }
      } else if (e.key === "Tab") {
        e.preventDefault();
        const commands = ["ls", "clear", "stellar", "whoami", "help"];
        const matches = commands.filter((c) => c.startsWith(input.toLowerCase()));
        if (matches.length === 1) setInput(matches[0]);
      } else if (e.key === "l" && e.ctrlKey) {
        e.preventDefault();
        setTabHistory(activeTabId, []);
      } else if (e.key.toLowerCase() === "c" && (e.ctrlKey || e.metaKey)) {
        // Selection-aware Copy: if text is selected, allow browser to copy.
        const selection = window.getSelection()?.toString();
        if (selection) {
          // If it's Cmd+C (Mac) or Ctrl+X/C with selection, let the browser handle it
          return;
        }

        // If it's Ctrl+C without selection, perform SIGINT (Command Cancellation)
        if (e.ctrlKey && e.key.toLowerCase() === "c") {
          e.preventDefault();
          if (isRunning) {
            // SIGINT: kill the running backend process
            if (activeJobIdRef.current && lastSessionIdRef.current) {
              killCommand(lastSessionIdRef.current, activeJobIdRef.current);
            }

            if (wsCleanupRef.current) {
              wsCleanupRef.current();
              wsCleanupRef.current = null;
            }
            setIsRunning(false);
            activeJobIdRef.current = null;
            appendToTab(executingTabRef.current || shellTabId, { type: "error", content: "^C — cancelled" });
          } else {
            const currentInput = input;
            setTabHistory(shellTabId, (prev) => [
              ...prev,
              { type: "command", content: currentInput + "^C", cwd: getShortPath(cwd) },
            ]);
            setInput("");
          }
        }
      }
    },
    [input, historyIndex, commandHistory, handleExecute, isRunning, getShortPath, cwd, activeTabId, shellTabId, setTabHistory, appendToTab],
  );

  const handleTerminalClick = useCallback(
    (e) => {
      if (isPreviewTab) return;
      // Don't focus if user is selecting text
      if (window.getSelection()?.toString()) return;
      if (!isCollapsed && inputRef.current) {
        inputRef.current.focus({ preventScroll: true });
      }
    },
    [isCollapsed, isPreviewTab],
  );

  /* ─── Render helpers ─── */

  const renderContentWithLinks = (content) => {
    if (typeof content !== "string") return content;

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = content.split(urlRegex);

    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={i}
            href={part}
            className="terminal-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  const getLineClassName = (entry) => {
    if (entry.type === "command") return "terminal-line command";
    if (entry.type === "error") return "terminal-line output terminal-error";
    if (entry.type === "info") return "terminal-line output terminal-info";
    return "terminal-line output";
  };

  /* ─── Render ─── */

  return (
    <div ref={terminalRef} className={`terminal ${isCollapsed ? "collapsed" : ""} ${isDragging ? "" : "animate"}`} style={{ height: isCollapsed ? MIN_HEIGHT : height }} onClick={handleTerminalClick}>
      <div className={`terminal-resize-handle ${isDragging ? "dragging" : ""}`} onMouseDown={handleMouseDown} />

      <div className="terminal-header">
        <div className="terminal-tabs">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`terminal-tab ${activeTabId === tab.id ? "is-active" : ""}`}
            >
              <button
                type="button"
                className="terminal-tab-btn"
                onClick={() => {
                  setActiveTabId(tab.id);
                  expandTerminal();
                }}
                title={tab.title}
              >
                {tab.title}
              </button>
              {tab.kind === "shell" && tabs.filter((t) => t.kind === "shell").length > 1 && (
                <button
                  type="button"
                  className="terminal-tab-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeShellTab(tab.id);
                  }}
                  title="Close terminal"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="terminal-tab-add"
            onClick={addShellTab}
            title="New terminal"
          >
            <Plus size={14} />
          </button>
        </div>
        <button className="terminal-title-btn" onClick={toggleCollapse} title={isCollapsed ? "Expand" : "Minimize"}>
          <span className="terminal-title">{isCollapsed ? "Panel" : ""}</span>
        </button>
      </div>

      <div className={`terminal-window ${isCollapsed ? "collapsed-window" : ""}`} ref={terminalWindowRef} onScroll={handleScroll}>
        <div className="terminal-content">
          {history.map((entry, index) => (
            <div key={index} className={getLineClassName(entry)}>
              {entry.type === "command" && (
                <span className="terminal-prompt-line">
                  <span className="terminal-prompt-user">soroban</span>
                  <span className="terminal-prompt-at">@</span>
                  <span className="terminal-prompt-host">studio</span>
                  <span className="terminal-prompt-separator">:</span>
                  <span className="terminal-prompt-path">{entry.cwd || getShortPath(cwd)}</span>
                  <span className="terminal-prompt-symbol">$</span>
                  <span className="terminal-prompt-command">{entry.content}</span>
                </span>
              )}
              {entry.type !== "command" && <pre className="terminal-output">{renderContentWithLinks(entry.content)}</pre>}
            </div>
          ))}
          {!isPreviewTab && (
          <div className={`terminal-input-line ${isRunning ? "compiling" : ""}`}>
            {!isRunning ? (
              <span className="terminal-prompt-line">
                <span className="terminal-prompt-user">soroban</span>
                <span className="terminal-prompt-at">@</span>
                <span className="terminal-prompt-host">studio</span>
                <span className="terminal-prompt-separator">:</span>
                <span className="terminal-prompt-path">{getShortPath(cwd)}</span>
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
              value={isRunning ? "" : input} 
              onChange={(e) => setInput(e.target.value)} 
              onKeyDown={handleKeyDown} 
              spellCheck="false" 
              autoComplete="off" 
              autoFocus 
              readOnly={isRunning} 
              placeholder={isRunning ? "Press Ctrl+C to cancel..." : ""} 
            />
          </div>
          )}
          {isPreviewTab && (
            <div className="terminal-preview-hint">
              Read-only activity log: UI clicks, network calls, wallet signing, console output, and errors.
            </div>
          )}
          <div ref={windowEndRef} />
        </div>
      </div>
    </div>
  );
});

export default Terminal;
