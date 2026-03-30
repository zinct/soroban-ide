import React, { memo, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { loadState, saveStateSection } from '../../utils/storage';
import { executeTerminalCommand } from './terminalCommands';

const MIN_HEIGHT = 30;
const MAX_HEIGHT = 9999;
const COLLAPSE_THRESHOLD = 50;
const DEFAULT_HEIGHT = 150;

/**
 * Terminal panel with simulated shell.
 */
const Terminal = memo(({ activeFileName, currentDirectory = '~/project', onMaximizeChange }) => {
  const persistedState = useMemo(() => loadState()?.terminal, []);

  const [height, setHeight] = useState(() => persistedState?.height || DEFAULT_HEIGHT);
  const [isCollapsed, setIsCollapsed] = useState(() => persistedState?.isCollapsed ?? true);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [history, setHistory] = useState(
    () => persistedState?.history || [
      { type: 'output', content: 'Welcome to Soroban Studio Terminal' },
      { type: 'output', content: "Type 'help' for available commands" },
    ]
  );
  const [input, setInput] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [commandHistory, setCommandHistory] = useState(() => persistedState?.commandHistory || []);
  const [cwd, setCwd] = useState(() => persistedState?.cwd || currentDirectory);

  const terminalRef = useRef(null);
  const inputRef = useRef(null);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);
  const windowEndRef = useRef(null);
  const previousHeight = useRef(DEFAULT_HEIGHT);

  // Persist terminal state
  useEffect(() => {
    saveStateSection('terminal', { height, isCollapsed, history, commandHistory, cwd });
  }, [height, isCollapsed, history, commandHistory, cwd]);

  const scrollToBottom = useCallback(() => {
    windowEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => scrollToBottom(), [history, scrollToBottom]);

  const getShortPath = useCallback((path) => {
    return path.startsWith('~/') ? '~' + path.slice(1) : path;
  }, []);

  /* ─── Command execution ─── */

  const handleExecute = useCallback(
    (cmd) => {
      const trimmedCmd = cmd.trim();
      if (!trimmedCmd) return;

      setHistory((prev) => [...prev, { type: 'command', content: trimmedCmd, cwd: getShortPath(cwd) }]);
      setCommandHistory((prev) => [...prev, trimmedCmd]);
      setHistoryIndex(-1);

      const output = executeTerminalCommand(trimmedCmd, cwd, setCwd);

      if (output === null) {
        setHistory([]);
      } else if (output) {
        setHistory((prev) => [...prev, { type: 'output', content: output }]);
      }
    },
    [cwd, getShortPath]
  );

  /* ─── Resize handlers ─── */

  const handleMouseDown = useCallback(
    (e) => {
      e.preventDefault();
      setIsDragging(true);
      dragStartY.current = e.clientY;
      dragStartHeight.current = height;
    },
    [height]
  );

  const handleMouseMove = useCallback(
    (e) => {
      if (!isDragging) return;
      const delta = dragStartY.current - e.clientY;
      const newHeight = dragStartHeight.current + delta;

      if (newHeight < COLLAPSE_THRESHOLD) {
        setIsCollapsed(true);
        setIsMaximized(false);
        setHeight(MIN_HEIGHT);
        previousHeight.current = DEFAULT_HEIGHT;
      } else {
        setIsCollapsed(false);
        setIsMaximized(false);
        setHeight(Math.max(MIN_HEIGHT + 10, Math.min(MAX_HEIGHT, newHeight)));
      }
    },
    [isDragging]
  );

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const toggleCollapse = useCallback(() => {
    if (isCollapsed) {
      setIsCollapsed(false);
      setHeight(previousHeight.current || DEFAULT_HEIGHT);
      setIsMaximized(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      previousHeight.current = height > MIN_HEIGHT ? height : DEFAULT_HEIGHT;
      setIsCollapsed(true);
      setIsMaximized(false);
      setHeight(MIN_HEIGHT);
    }
  }, [isCollapsed, height]);

  const toggleMaximize = useCallback(() => {
    const newMaximized = !isMaximized;
    setIsMaximized(newMaximized);
    onMaximizeChange?.(newMaximized);
    if (newMaximized) {
      setIsCollapsed(false);
      requestAnimationFrame(() => setHeight(MAX_HEIGHT));
    } else {
      setHeight(previousHeight.current || DEFAULT_HEIGHT);
    }
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [isMaximized, onMaximizeChange]);

  /* ─── Keyboard handling ─── */

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleExecute(input);
        setInput('');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (commandHistory.length > 0) {
          const newIndex = historyIndex + 1;
          if (newIndex < commandHistory.length) {
            setHistoryIndex(newIndex);
            setInput(commandHistory[commandHistory.length - 1 - newIndex]);
          }
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          setInput(commandHistory[commandHistory.length - 1 - newIndex]);
        } else if (historyIndex === 0) {
          setHistoryIndex(-1);
          setInput('');
        }
      } else if (e.key === 'Tab') {
        e.preventDefault();
        const commands = ['clear', 'pwd', 'cd', 'ls', 'echo', 'whoami', 'date', 'npm', 'help'];
        const matches = commands.filter((c) => c.startsWith(input.toLowerCase()));
        if (matches.length === 1) setInput(matches[0]);
      } else if (e.key === 'l' && e.ctrlKey) {
        e.preventDefault();
        setHistory([]);
      }
    },
    [input, historyIndex, commandHistory, handleExecute]
  );

  const handleTerminalClick = useCallback(() => {
    if (!isCollapsed) inputRef.current?.focus();
  }, [isCollapsed]);

  /* ─── Render ─── */

  return (
    <div
      ref={terminalRef}
      className={`terminal ${isCollapsed ? 'collapsed' : ''} ${isMaximized ? 'maximized' : ''} ${isDragging ? '' : 'animate'}`}
      style={{ height: isCollapsed ? MIN_HEIGHT : height }}
      onClick={handleTerminalClick}
    >
      <div className={`terminal-resize-handle ${isDragging ? 'dragging' : ''}`} onMouseDown={handleMouseDown} />

      <div className="terminal-header">
        <div className="terminal-status">
          <span className="terminal-title">Terminal</span>
        </div>
        <div className="terminal-actions">
          <button className="terminal-btn" onClick={toggleCollapse} title={isCollapsed ? 'Expand' : 'Minimize'}>
            {isCollapsed ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 15 12 9 18 15" /></svg>
            )}
          </button>
          <button className="terminal-btn" onClick={toggleMaximize} title={isMaximized ? 'Restore' : 'Maximize'}>
            {isMaximized ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="8" width="16" height="12" rx="1" /><line x1="4" y1="11" x2="20" y2="11" /></svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="1" /><line x1="4" y1="8" x2="20" y2="8" /></svg>
            )}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="terminal-window">
          <div className="terminal-content">
            {history.map((entry, index) => (
              <div key={index} className={`terminal-line ${entry.type}`}>
                {entry.type === 'command' && (
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
                {entry.type === 'output' && <pre className="terminal-output">{entry.content}</pre>}
              </div>
            ))}
            <div className="terminal-input-line">
              <span className="terminal-prompt-line">
                <span className="terminal-prompt-user">user</span>
                <span className="terminal-prompt-at">@</span>
                <span className="terminal-prompt-host">soroban</span>
                <span className="terminal-prompt-separator">:</span>
                <span className="terminal-prompt-path">{getShortPath(cwd)}</span>
                <span className="terminal-prompt-symbol">$</span>
              </span>
              <input
                ref={inputRef}
                type="text"
                className="terminal-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                spellCheck="false"
                autoComplete="off"
                autoFocus
              />
            </div>
            <div ref={windowEndRef} />
          </div>
        </div>
      )}
    </div>
  );
});

export default Terminal;
