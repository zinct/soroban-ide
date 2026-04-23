import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, ChevronRight } from "lucide-react";
import { FileIconImg } from "../../components/icons/FileIcon";
import { fuzzyScore, highlightMatches } from "./fuzzyMatch";

const MAX_RESULTS = 50;

/**
 * Combined Command Palette + Quick Open.
 *
 * Props:
 *   isOpen       — whether the overlay is visible
 *   mode         — "command" | "file" (initial mode; user can switch with ">")
 *   commands     — array of { id, title, subtitle?, category?, shortcut?, run }
 *   files        — array of { id, name, path } (from flattenedNodes, files only)
 *   onClose      — close handler
 *   onOpenFile   — (fileId) => void, invoked for file-mode selection
 */
const CommandPalette = memo(({ isOpen, mode: initialMode, commands, files, onClose, onOpenFile }) => {
  const [mode, setMode] = useState(initialMode || "command");
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const [shouldRender, setShouldRender] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
    } else {
      const timer = setTimeout(() => setShouldRender(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setMode(initialMode || "command");
    setQuery(initialMode === "command" ? ">" : "");
    setSelectedIndex(0);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(query.length, query.length);
    });
  }, [isOpen, initialMode]);

  const effectiveQuery = useMemo(() => {
    if (query.startsWith(">")) return query.slice(1).trimStart();
    return query.trim();
  }, [query]);

  const effectiveMode = query.startsWith(">") ? "command" : mode;

  const results = useMemo(() => {
    if (!isOpen) return [];
    const pool =
      effectiveMode === "command"
        ? commands.map((cmd) => ({
            key: cmd.id,
            primary: cmd.title,
            secondary: cmd.subtitle || cmd.category || "",
            shortcut: cmd.shortcut,
            kind: "command",
            payload: cmd,
          }))
        : files.map((f) => ({
            key: f.id,
            primary: f.name,
            secondary: f.path || "",
            kind: "file",
            payload: f,
          }));

    if (!effectiveQuery) {
      return pool.slice(0, MAX_RESULTS);
    }

    const scored = [];
    for (const item of pool) {
      const a = fuzzyScore(effectiveQuery, item.primary);
      const b = fuzzyScore(effectiveQuery, item.secondary);
      const bestField = a.score >= b.score ? "primary" : "secondary";
      const best = a.score >= b.score ? a : b;
      if (best.score < 0) continue;
      scored.push({ ...item, score: best.score, matchField: bestField, positions: best.positions });
    }
    scored.sort((x, y) => y.score - x.score);
    return scored.slice(0, MAX_RESULTS);
  }, [isOpen, effectiveMode, effectiveQuery, commands, files]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [effectiveQuery, effectiveMode]);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, results]);

  const runResult = useCallback(
    (item) => {
      if (!item) return;
      if (item.kind === "command") {
        onClose?.();
        try {
          item.payload.run?.();
        } catch (err) {
          console.error("[CommandPalette] command failed:", err);
        }
      } else if (item.kind === "file") {
        onClose?.();
        onOpenFile?.(item.payload.id);
      }
    },
    [onClose, onOpenFile],
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose?.();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Home") {
        e.preventDefault();
        setSelectedIndex(0);
        return;
      }
      if (e.key === "End") {
        e.preventDefault();
        setSelectedIndex(Math.max(results.length - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        runResult(results[selectedIndex]);
      }
    },
    [results, selectedIndex, runResult, onClose],
  );

  if (!shouldRender) return null;

  const placeholder =
    effectiveMode === "command"
      ? "Type a command… (use > prefix to filter commands)"
      : "Search files by name or path… (prefix with > to run a command)";

  return (
    <div className={`command-palette-backdrop ${isOpen ? "visible" : ""}`} onMouseDown={onClose}>
      <div
        className={`command-palette ${isOpen ? "visible" : ""}`}
        role="dialog"
        aria-label={effectiveMode === "command" ? "Command Palette" : "Quick Open"}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="command-palette-input-row">
          <Search size={16} className="command-palette-icon" />
          <input
            ref={inputRef}
            className="command-palette-input"
            type="text"
            spellCheck="false"
            autoComplete="off"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <span className="command-palette-mode-hint">
            {effectiveMode === "command" ? "Commands" : "Files"}
          </span>
        </div>

        <div className="command-palette-results" ref={listRef}>
          {results.length === 0 ? (
            <div className="command-palette-empty">
              {effectiveMode === "command"
                ? "No matching commands"
                : files.length === 0
                  ? "No files in workspace"
                  : "No matching files"}
            </div>
          ) : (
            results.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const primarySegments =
                item.matchField === "primary" && item.positions?.length
                  ? highlightMatches(item.primary, item.positions)
                  : [{ text: item.primary, matched: false }];
              const secondarySegments =
                item.matchField === "secondary" && item.positions?.length
                  ? highlightMatches(item.secondary, item.positions)
                  : [{ text: item.secondary, matched: false }];

              return (
                <button
                  key={item.key}
                  type="button"
                  data-index={idx}
                  className={`command-palette-item ${isSelected ? "selected" : ""}`}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => runResult(item)}
                >
                  <span className="command-palette-item-icon">
                    {item.kind === "file" ? (
                      <FileIconImg filename={item.payload.name} />
                    ) : (
                      <ChevronRight size={14} />
                    )}
                  </span>
                  <span className="command-palette-item-body">
                    <span className="command-palette-item-primary">
                      {primarySegments.map((seg, i) =>
                        seg.matched ? (
                          <mark key={i}>{seg.text}</mark>
                        ) : (
                          <span key={i}>{seg.text}</span>
                        ),
                      )}
                    </span>
                    {item.secondary && (
                      <span className="command-palette-item-secondary">
                        {secondarySegments.map((seg, i) =>
                          seg.matched ? (
                            <mark key={i}>{seg.text}</mark>
                          ) : (
                            <span key={i}>{seg.text}</span>
                          ),
                        )}
                      </span>
                    )}
                  </span>
                  {item.shortcut && (
                    <span className="command-palette-item-shortcut">{item.shortcut}</span>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="command-palette-footer">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> navigate
          </span>
          <span>
            <kbd>Enter</kbd> select
          </span>
          <span>
            <kbd>Esc</kbd> close
          </span>
          <span>
            <kbd>&gt;</kbd> commands
          </span>
        </div>
      </div>
    </div>
  );
});

CommandPalette.displayName = "CommandPalette";

export default CommandPalette;
