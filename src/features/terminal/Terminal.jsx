import React, { memo, useState, useCallback, useRef, useEffect, useMemo } from "react";
import { loadState, saveStateSection } from "../../utils/storage";
import { executeTerminalCommand, isBackendCommand } from "./terminalCommands";
import { collectProjectFiles, submitCommand, connectBuildStream } from "../../services/backendService";

const MIN_HEIGHT = 28;
const COLLAPSE_THRESHOLD = 60;
const DEFAULT_HEIGHT = 350;
const MAX_HEIGHT = 600;

/**
 * Terminal panel with simulated shell + backend integration.
 */
const Terminal = memo(({ activeFileName, currentDirectory = "~/project", treeData, fileContents, onFileTreeUpdate }) => {
  const persistedState = useMemo(() => loadState()?.terminal, []);

  const [height, setHeight] = useState(() => persistedState?.height || DEFAULT_HEIGHT);
  const [isCollapsed, setIsCollapsed] = useState(() => persistedState?.isCollapsed ?? true);
  const [isDragging, setIsDragging] = useState(false);
  const [history, setHistory] = useState(
    () =>
      persistedState?.history || [
        { type: "output", content: "Welcome to Soroban Studio Terminal" },
        { type: "output", content: "Type 'help' for available commands" },
      ],
  );
  const [input, setInput] = useState("");
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [commandHistory, setCommandHistory] = useState(() => persistedState?.commandHistory || []);
  const [cwd, setCwd] = useState(() => persistedState?.cwd || currentDirectory);
  const [isRunning, setIsRunning] = useState(false);

  const terminalRef = useRef(null);
  const inputRef = useRef(null);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);
  const windowEndRef = useRef(null);
  const previousHeight = useRef(DEFAULT_HEIGHT);
  const wsCleanupRef = useRef(null);
  const lastSessionIdRef = useRef(null);

  // Save state without maximized
  useEffect(() => {
    saveStateSection("terminal", { height, isCollapsed, history, commandHistory, cwd });
  }, [height, isCollapsed, history, commandHistory, cwd]);

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

        if (!files || Object.keys(files).length === 0) {
          setHistory((prev) => [...prev, { type: "error", content: "❌ No files in workspace to send. Create a project first." }]);
          setIsRunning(false);
          return;
        }

        // Submit to backend with the exact command the user typed
        const sessionId = await submitCommand(files, cmd);

        // Connect WebSocket for streaming output
        wsCleanupRef.current = connectBuildStream(sessionId, {
          onMessage: (msg) => {
            console.log("[Terminal] WebSocket message received:", msg);



            // Filter out decorative backend messages
            const decorativePatterns = [/Executing:/i, /Command completed successfully/i, /Connected to build server/i, /Session:/i, /Sending to build server/i];
            const isDecorative = decorativePatterns.some((pattern) => pattern.test(msg.content));
            if (isDecorative) return;

            if (msg.type === "fileTreeUpdate" && onFileTreeUpdate) {
              try {
                const tree = JSON.parse(msg.content);
                onFileTreeUpdate(tree);
              } catch (e) {
                console.error("Failed to parse file tree update:", e);
              }
              return;
            }

            const className = msg.type === "error" ? "error" : msg.type === "info" ? "info" : "output";
            setHistory((prev) => [...prev, { type: className, content: msg.content }]);
          },
          onError: (errorMsg) => {
            setHistory((prev) => [...prev, { type: "error", content: `❌ ${errorMsg}` }]);
            setIsRunning(false);
            wsCleanupRef.current = null;
          },
          onDone: () => {
            setIsRunning(false);
            wsCleanupRef.current = null;
          },
        });
      } catch (err) {
        setHistory((prev) => [...prev, { type: "error", content: `❌ ${err.message || "Failed to connect to build server"}` }]);
        setIsRunning(false);
      }
    },
    [treeData, fileContents],
  );

  /* ─── Command execution ─── */

  const handleExecute = useCallback(
    (cmd) => {
      const trimmedCmd = cmd.trim();
      if (!trimmedCmd) return;
      if (isRunning) return;

      setHistory((prev) => [...prev, { type: "command", content: trimmedCmd, cwd: getShortPath(cwd) }]);
      setCommandHistory((prev) => [...prev, trimmedCmd]);
      setHistoryIndex(-1);

      // Route: stellar/cargo commands → backend, everything else → local
      if (isBackendCommand(trimmedCmd)) {
        executeBackendCommand(trimmedCmd);
      } else {
        const output = executeTerminalCommand(trimmedCmd, cwd, setCwd, treeData);

        if (output === null) {
          setHistory([]);
        } else if (output) {
          setHistory((prev) => [...prev, { type: "output", content: output }]);
        }
      }
    },
    [cwd, getShortPath, isRunning, executeBackendCommand, treeData],
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
        setHistory([]);
      } else if (e.key === "c" && e.ctrlKey) {
        // Selection-aware Ctrl+C
        const selection = window.getSelection()?.toString();
        if (selection) {
          // Allow browser default copy behavior
          return;
        }

        if (isRunning) {
          // Ctrl+C to cancel running command only if no text is selected
          e.preventDefault();
          if (wsCleanupRef.current) {
            wsCleanupRef.current();
            wsCleanupRef.current = null;
          }
          setIsRunning(false);
          setHistory((prev) => [...prev, { type: "error", content: "^C — cancelled" }]);
        }
      }
    },
    [input, historyIndex, commandHistory, handleExecute, isRunning],
  );

  const handleTerminalClick = useCallback(
    (e) => {
      // Don't focus if user is selecting text
      if (window.getSelection()?.toString()) return;
      if (!isCollapsed && inputRef.current) {
        inputRef.current.focus({ preventScroll: true });
      }
    },
    [isCollapsed],
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
        <button className="terminal-title-btn" onClick={toggleCollapse} title={isCollapsed ? "Expand" : "Minimize"}>
          <span className="terminal-title">Terminal</span>
        </button>
      </div>

      {!isCollapsed && (
        <div className="terminal-window" ref={terminalWindowRef} onScroll={handleScroll}>
          <div className="terminal-content">
            {history.map((entry, index) => (
              <div key={index} className={getLineClassName(entry)}>
                {entry.type === "command" && (
                  <span className="terminal-prompt-line">
                    <span className="terminal-prompt-user">user</span>
                    <span className="terminal-prompt-at">@</span>
                    <span className="terminal-prompt-host">soroban</span>
                    <span className="terminal-prompt-separator">:</span>
                    <span className="terminal-prompt-path">{entry.cwd || getShortPath(cwd)}</span>
                    <span className="terminal-prompt-symbol">$</span>
                    <span className="terminal-prompt-command">{entry.content}</span>
                  </span>
                )}
                {entry.type !== "command" && <pre className="terminal-output">{renderContentWithLinks(entry.content)}</pre>}
              </div>
            ))}
            {isRunning && (
              <div className="terminal-compiling-line">
                <span>Compiling</span>
                <span className="terminal-dots"></span>
              </div>
            )}
            {!isRunning && (
              <div className="terminal-input-line">
                <span className="terminal-prompt-line">
                  <span className="terminal-prompt-user">user</span>
                  <span className="terminal-prompt-at">@</span>
                  <span className="terminal-prompt-host">soroban</span>
                  <span className="terminal-prompt-separator">:</span>
                  <span className="terminal-prompt-path">{getShortPath(cwd)}</span>
                  <span className="terminal-prompt-symbol">$</span>
                </span>
                <input ref={inputRef} type="text" className="terminal-input" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} spellCheck="false" autoComplete="off" autoFocus disabled={isRunning} placeholder={isRunning ? "Build in progress..." : ""} />
              </div>
            )}
            <div ref={windowEndRef} />
          </div>
        </div>
      )}
    </div>
  );
});

export default Terminal;
