import React, { memo, useState, useCallback, useRef, useEffect } from "react";

const Terminal = memo(({ activeFileName }) => {
  const [height, setHeight] = useState(120);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const terminalRef = useRef(null);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);

  const MIN_HEIGHT = 40;
  const MAX_HEIGHT = 600;
  const COLLAPSE_THRESHOLD = 60;
  const DEFAULT_HEIGHT = 120;

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
        setHeight(MIN_HEIGHT);
      } else {
        setIsCollapsed(false);
        setIsMaximized(false);
        setHeight(Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, newHeight)));
      }
    },
    [isDragging, height]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

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
      setHeight(DEFAULT_HEIGHT);
    } else {
      setIsCollapsed(true);
      setHeight(MIN_HEIGHT);
    }
  }, [isCollapsed]);

  const toggleMaximize = useCallback(() => {
    if (isMaximized) {
      setIsMaximized(false);
      setHeight(DEFAULT_HEIGHT);
    } else {
      setIsMaximized(true);
      setIsCollapsed(false);
      setHeight(MAX_HEIGHT);
    }
  }, [isMaximized]);

  return (
    <div ref={terminalRef} className={`terminal ${isCollapsed ? "collapsed" : ""} ${isMaximized ? "maximized" : ""}`} style={{ height: isCollapsed ? MIN_HEIGHT : height }}>
      {/* Resize handle */}
      <div className={`terminal-resize-handle ${isDragging ? "dragging" : ""}`} onMouseDown={handleMouseDown} />

      {/* Header */}
      <div className="terminal-header">
        <div className="terminal-status">
          <span className="terminal-title">Terminal</span>
          <span className="terminal-active">{activeFileName || "No file selected"}</span>
        </div>
        <div className="terminal-actions">
          <button className="terminal-btn" onClick={toggleCollapse} title={isCollapsed ? "Expand" : "Minimize"}>
            {isCollapsed ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 15 12 9 18 15"></polyline>
              </svg>
            )}
          </button>
          <button className="terminal-btn" onClick={toggleMaximize} title={isMaximized ? "Restore" : "Maximize"}>
            {isMaximized ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="4" y="8" width="16" height="12" rx="1"></rect>
                <line x1="4" y1="11" x2="20" y2="11"></line>
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="4" y="4" width="16" height="16" rx="1"></rect>
                <line x1="4" y1="8" x2="20" y2="8"></line>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Terminal window - hidden when collapsed */}
      {!isCollapsed && (
        <div className="terminal-window">
          <div className="terminal-prompt">~  {activeFileName ? `Editing ${activeFileName}` : "Ready"}</div>
        </div>
      )}
    </div>
  );
});

export default Terminal;
