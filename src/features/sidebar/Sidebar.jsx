import React, { memo, useState, useCallback, useRef, useEffect, useMemo } from "react";
import { loadState, saveStateSection } from "../../utils/storage";
import { findParentId, getNodeFromTree, sortNodes } from "../workspace/workspaceUtils";
import ExplorerNode from "./ExplorerNode";
import InlineInput from "./InlineInput";
import ContextMenu from "./ContextMenu";
import GitHubPanel from "../github/GitHubPanel";

const MIN_WIDTH = 260;
const MAX_WIDTH = 1200;
const COLLAPSE_THRESHOLD = 120;
const PANEL_WIDTHS = {
  explorer: 400,
  github: 450,
  tutorial: 560,
  deploy: 500,
  validation: 500,
};
import { Settings, BookOpen, Rocket, CheckCircle2 } from "lucide-react";
import TutorialPanel from "../tutorial/TutorialPanel";
import DeployPanel from "../deploy/DeployPanel";
import ValidationPanel from "../validation/ValidationPanel";

const ActionButton = memo(({ icon, onClick, title }) => (
  <button className="sidebar-action" type="button" onClick={onClick} data-tooltip={title}>
    {icon}
  </button>
));

/**
 * Sidebar component — contains file explorer, resize, collapse.
 */
const Sidebar = memo(({ tree, expandedFolders, onToggleFolder, onFileSelect, onNodeSelect, selectedNodeId, onNewFile, onNewFolder, onDeleteItem, onRenameItem, onMoveItem, onUploadFiles, onCopyItem, onCutItem, onPasteItem, clipboard, onCollapseAll, activeFileId, lastSessionId, setTreeData, treeData, fileContents, isSettingsOpen, onToggleSettings, onConfirm }) => {
  const root = tree?.[0];
  const persistedSidebarState = useMemo(() => loadState()?.sidebar, []);

  const [width, setWidth] = useState(() => {
    const savedWidth = persistedSidebarState?.width || 340;
    // Upgrade if the saved width is still the old "cramped" default
    if (savedWidth < 300) return 340;
    return savedWidth < MIN_WIDTH ? MIN_WIDTH : savedWidth;
  });
  const [isCollapsed, setIsCollapsed] = useState(() => persistedSidebarState?.isCollapsed ?? false);
  const lastWidth = useRef(width >= MIN_WIDTH ? width : 340);

  // Update lastWidth whenever width changes and it's not collapsed
  useEffect(() => {
    if (!isCollapsed && width >= MIN_WIDTH) {
      lastWidth.current = width;
    }
  }, [width, isCollapsed]);
  const [isDragging, setIsDragging] = useState(false);
  const [inlineInput, setInlineInput] = useState(null);
  const [activePanel, setActivePanel] = useState(() => persistedSidebarState?.activePanel || "explorer"); // "explorer" | "github" | "tutorial"
  const [contextMenu, setContextMenu] = useState(null);
  const [renameNode, setRenameNode] = useState(null);
  const [dragState, setDragState] = useState({ draggingId: null, dragOverId: null });
  const [pasteTargetFolder, setPasteTargetFolder] = useState(null);
  const [dragOverBody, setDragOverBody] = useState(false);
  const [folderUploadProgress, setFolderUploadProgress] = useState({});

  const sidebarRef = useRef(null);
  const rafRef = useRef(null);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);
  const fileInputRef = useRef(null);

  // Persist sidebar state
  useEffect(() => {
    // If collapsed, we save the lastWidth ref value so it's remembered upon refresh
    const widthToSave = isCollapsed ? lastWidth.current : width;
    saveStateSection("sidebar", { width: widthToSave, isCollapsed, activePanel });
  }, [width, isCollapsed, activePanel]);

  /* ─── Resize handlers ─── */

  const handleMouseDown = useCallback(
    (e) => {
      e.preventDefault();
      setIsDragging(true);
      dragStartX.current = e.clientX;
      dragStartWidth.current = width;
    },
    [width],
  );

  const handleMouseMove = useCallback(
    (e) => {
      if (!isDragging) return;
      const delta = e.clientX - dragStartX.current;
      const rawWidth = dragStartWidth.current + delta;

      if (rawWidth < COLLAPSE_THRESHOLD) {
        setIsCollapsed(true);
        setWidth(48);
        setIsDragging(false);
        return;
      }
      setWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, rawWidth)));
    },
    [isDragging],
  );

  const handleMouseUp = useCallback(() => {
    if (width < COLLAPSE_THRESHOLD) {
      setIsCollapsed(true);
      setWidth(48);
    } else {
      setIsCollapsed(false);
    }
    setIsDragging(false);
  }, [width]);

  useEffect(() => {
    if (isDragging) {
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
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const toggleCollapse = useCallback(() => {
    if (isCollapsed) {
      setIsCollapsed(false);
      // Ensure we open to at least 340px to avoid the 'cramped' feeling
      setWidth(Math.max(340, lastWidth.current));
    } else {
      setIsCollapsed(true);
      setWidth(48);
    }
  }, [isCollapsed]);

  // Global toggle shortcut: Ctrl+B (or Cmd+B)
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Support both Ctrl and Cmd for cross-platform convenience
      if (e.key.toLowerCase() === "b" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        toggleCollapse();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [toggleCollapse]);

  /* ─── Inline input handlers ─── */

  const handleStartNewFile = useCallback(
    (forcedTargetId) => {
      // 1. Resolve target: forced Id (if string) > current selection > project root
      const actualTargetId = forcedTargetId && typeof forcedTargetId === "string" ? forcedTargetId : null;
      let targetFolder = actualTargetId || selectedNodeId || root?.id;

      // 2. Clear context menu immediately
      setContextMenu(null);

      // 3. Resolve parent folder if a file was targeted
      if (targetFolder && tree) {
        const node = getNodeFromTree(tree, targetFolder);
        if (node && node.type === "file") {
          const parentId = findParentId(tree, targetFolder);
          if (parentId) targetFolder = parentId;
        }
      }

      // 4. Fallback to root (essential for flattened view)
      if (!targetFolder && root) targetFolder = root.id;

      if (targetFolder) {
        if (!expandedFolders.has(targetFolder)) onToggleFolder(targetFolder, true);
        // Use setTimeout to ensure the render has happened before focus
        setTimeout(() => {
          setInlineInput({ type: "file", parentId: targetFolder });
        }, 0);
      }
    },
    [selectedNodeId, root, tree, expandedFolders, onToggleFolder],
  );

  const handleStartNewFolder = useCallback(
    (forcedTargetId) => {
      // 1. Resolve target: forced Id (if string) > current selection > project root
      const actualTargetId = forcedTargetId && typeof forcedTargetId === "string" ? forcedTargetId : null;
      let targetFolder = actualTargetId || selectedNodeId || root?.id;

      // 2. Clear context menu immediately
      setContextMenu(null);

      // 3. Resolve parent folder if a file was targeted
      if (targetFolder && tree) {
        const node = getNodeFromTree(tree, targetFolder);
        if (node && node.type === "file") {
          const parentId = findParentId(tree, targetFolder);
          if (parentId) targetFolder = parentId;
        }
      }

      // 4. Fallback to root
      if (!targetFolder && root) targetFolder = root.id;

      if (targetFolder) {
        if (!expandedFolders.has(targetFolder)) onToggleFolder(targetFolder, true);
        // Use setTimeout to ensure the render has happened before focus
        setTimeout(() => {
          setInlineInput({ type: "folder", parentId: targetFolder });
        }, 0);
      }
    },
    [selectedNodeId, root, tree, expandedFolders, onToggleFolder],
  );

  const handleInlineSubmit = useCallback(
    (name) => {
      if (inlineInput?.type === "file") onNewFile(name, inlineInput.parentId);
      else onNewFolder(name, inlineInput.parentId);
      setInlineInput(null);
    },
    [inlineInput, onNewFile, onNewFolder],
  );

  const handleInlineCancel = useCallback(() => setInlineInput(null), []);

  // External command bus — lets the Command Palette drive the sidebar.
  useEffect(() => {
    const ensureExplorerVisible = () => {
      if (isCollapsed) {
        setIsCollapsed(false);
        setWidth(Math.max(340, lastWidth.current));
      }
      setActivePanel("explorer");
    };

    const handleToggle = () => toggleCollapse();
    const handleSetPanel = (e) => {
      const panel = e.detail?.panel;
      if (!panel || !PANEL_WIDTHS[panel]) return;
      if (isCollapsed || activePanel !== panel) {
        setIsCollapsed(false);
        setWidth(PANEL_WIDTHS[panel]);
      }
      setActivePanel(panel);
    };
    const handleStartNewFileEvt = () => {
      ensureExplorerVisible();
      setTimeout(() => handleStartNewFile(), 0);
    };
    const handleStartNewFolderEvt = () => {
      ensureExplorerVisible();
      setTimeout(() => handleStartNewFolder(), 0);
    };
    const handleUploadEvt = () => {
      ensureExplorerVisible();
      setTimeout(() => fileInputRef.current?.click(), 0);
    };

    window.addEventListener("soroban:toggleSidebar", handleToggle);
    window.addEventListener("soroban:setSidebarPanel", handleSetPanel);
    window.addEventListener("soroban:startNewFile", handleStartNewFileEvt);
    window.addEventListener("soroban:startNewFolder", handleStartNewFolderEvt);
    window.addEventListener("soroban:uploadFiles", handleUploadEvt);
    return () => {
      window.removeEventListener("soroban:toggleSidebar", handleToggle);
      window.removeEventListener("soroban:setSidebarPanel", handleSetPanel);
      window.removeEventListener("soroban:startNewFile", handleStartNewFileEvt);
      window.removeEventListener("soroban:startNewFolder", handleStartNewFolderEvt);
      window.removeEventListener("soroban:uploadFiles", handleUploadEvt);
    };
  }, [toggleCollapse, isCollapsed, handleStartNewFile, handleStartNewFolder]);

  /* ─── Context menu handlers ─── */

  // Helper function to get node path
  const getNodePath = useCallback(
    (targetNode) => {
      const parts = [];
      const walk = (nodes, target) => {
        for (const n of nodes) {
          if (n.id === target.id) {
            parts.push(n.name);
            return true;
          }
          if (n.children?.length) {
            if (walk(n.children, target)) {
              parts.unshift(n.name);
              return true;
            }
          }
        }
        return false;
      };
      walk(root?.children || [], targetNode);
      // Remove the root folder name (it's the workspace name, not part of the path)
      if (parts.length > 1) parts.shift();
      return parts.join("/");
    },
    [root],
  );

  const handleContextMenu = useCallback(
    (e, node) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        nodeId: node.id,
        nodeType: node.type,
        nodeName: node.name,
        nodePath: getNodePath(node),
      });
      // If right clicking on a file, the paste target should be its parent
      setPasteTargetFolder(node.type === "folder" ? node.id : findParentId(tree, node.id));
    },
    [getNodePath, tree],
  );

  const handleBodyContextMenu = useCallback(
    (e) => {
      // Only show global menu if clicking on the body itself, not bubble-up from nodes
      if (e.target.classList.contains("sidebar-body")) {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({
          x: e.clientX,
          y: e.clientY,
          nodeId: root?.id,
          nodeType: "folder",
          nodeName: root?.name,
          nodePath: "",
        });
        setPasteTargetFolder(root?.id);
      }
    },
    [root],
  );

  const handleCloseContextMenu = useCallback(() => setContextMenu(null), []);

  const [renameError, setRenameError] = useState(null);

  const handleRenameClick = useCallback(() => {
    let targetNode = null;
    if (contextMenu) {
      targetNode = { id: contextMenu.nodeId, name: contextMenu.nodeName, type: contextMenu.nodeType };
      setContextMenu(null);
    } else if (selectedNodeId) {
      const node = getNodeFromTree(tree, selectedNodeId);
      if (node) {
        targetNode = { id: node.id, name: node.name, type: node.type };
      }
    }

    if (targetNode) {
      setRenameNode(targetNode);
    }
  }, [contextMenu, selectedNodeId, tree]);

  const handleRenameSubmit = useCallback(
    (newName) => {
      if (!renameNode || !newName) {
        setRenameNode(null);
        return;
      }

      if (newName === renameNode.name) {
        setRenameNode(null);
        return;
      }

      // Check for duplicate name in the same parent
      const parentId = findParentId(tree, renameNode.id);
      const parentNode = parentId ? tree.flatMap((n) => [n, ...(n.children || [])]).find((n) => n.id === parentId) : tree[0];

      if (parentNode && parentNode.children) {
        const isDuplicate = parentNode.children.some((child) => child.id !== renameNode.id && child.name === newName && child.type === renameNode.type);

        if (isDuplicate) {
          setRenameError(`A ${renameNode.type} named "${newName}" already exists in this folder.`);
          return;
        }
      }

      onRenameItem(renameNode.id, newName);
      setRenameNode(null);
    },
    [renameNode, tree, onRenameItem],
  );

  const handleRenameCancel = useCallback(() => {
    setRenameNode(null);
    setRenameError(null);
  }, []);

  const closeRenameError = useCallback(() => {
    setRenameError(null);
    setRenameNode(null);
  }, []);

  const handleDeleteClick = useCallback(() => {
    if (contextMenu) {
      onDeleteItem(contextMenu.nodeId);
      setContextMenu(null);
    }
  }, [contextMenu, onDeleteItem]);

  const handleCopyClick = useCallback(() => {
    if (contextMenu && onCopyItem) {
      onCopyItem(contextMenu.nodeId);
      setContextMenu(null);
    }
  }, [contextMenu, onCopyItem]);

  const handleCutClick = useCallback(() => {
    if (contextMenu && onCutItem) {
      onCutItem(contextMenu.nodeId);
      setContextMenu(null);
    }
  }, [contextMenu, onCutItem]);

  const handlePasteClick = useCallback(() => {
    const targetId = pasteTargetFolder || selectedNodeId || root?.id;
    if (targetId && onPasteItem) {
      const result = onPasteItem(targetId);
      if (result?.error === "COLLISION") {
        setRenameError(result.message);
      }
      setPasteTargetFolder(null);
    }
    setContextMenu(null);
  }, [pasteTargetFolder, selectedNodeId, root, onPasteItem]);

  const handleMoveItem = useCallback(
    (draggedId, targetFolderId) => {
      if (onMoveItem) {
        const result = onMoveItem(draggedId, targetFolderId);
        if (result?.error === "COLLISION") {
          setRenameError(result.message);
        }
      }
    },
    [onMoveItem],
  );

  const canPaste = clipboard?.nodeId && clipboard?.operation;

  /* ─── Upload handlers ─── */

  const handleUploadClick = useCallback(() => fileInputRef.current?.click(), []);

  const handleFileSelect = useCallback(
    (e) => {
      const files = e.target.files;
      if (files?.length && onUploadFiles) {
        onUploadFiles(Array.from(files), selectedNodeId || root?.id);
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [onUploadFiles, selectedNodeId, root],
  );

  /* ─── Keyboard shortcuts ─── */

  useEffect(() => {
    const handler = (e) => {
      const isInput = e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.contentEditable === "true";
      if (isInput) return;

      const targetId = activeFileId || selectedNodeId;
      if (!targetId) return;

      if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        e.preventDefault();
        onCopyItem?.(targetId);
      } else if ((e.ctrlKey || e.metaKey) && e.key === "x") {
        e.preventDefault();
        onCutItem?.(targetId);
      } else if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        e.preventDefault();
        const pasteTarget = pasteTargetFolder || selectedNodeId || root?.id;
        if (onPasteItem && pasteTarget && clipboard?.nodeId) {
          const result = onPasteItem(pasteTarget);
          if (result?.error === "COLLISION") {
            setRenameError(result.message);
          }
        }
      }

      // Delete shortcut
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      if (isMac ? e.metaKey && e.key === "Backspace" : e.key === "Delete") {
        if (selectedNodeId) {
          e.preventDefault();
          onDeleteItem(selectedNodeId);
        }
      }

      // Rename shortcut
      if (e.key === "F2") {
        e.preventDefault();
        handleRenameClick();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedNodeId, activeFileId, onCopyItem, onCutItem, onPasteItem, pasteTargetFolder, root, clipboard]);

  /* ─── External drop on sidebar body ─── */

  const handleBodyDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    const isExternal = e.dataTransfer.types.includes("Files");
    e.dataTransfer.dropEffect = isExternal ? "copy" : "move";

    setDragOverBody(true);
  }, []);

  const handleBodyDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) setDragOverBody(false);
  }, []);

  const handleBodyDrop = useCallback(
    async (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOverBody(false);

      const targetFolder = root?.id;
      if (!targetFolder) return;

      const isExternal = e.dataTransfer.types.includes("Files");

      if (isExternal) {
        const items = e.dataTransfer.items || e.dataTransfer.files;
        if (!items?.length || !onUploadFiles) return;

        const files = [];
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const file = item instanceof File ? item : item.getAsFile?.();
          if (file) files.push(file);
        }

        setFolderUploadProgress((prev) => ({ ...prev, [targetFolder]: { current: 0, total: files.length } }));
        for (let i = 0; i < files.length; i++) {
          try {
            await onUploadFiles([files[i]], targetFolder);
          } catch (err) {
            console.error("Upload failed:", files[i].name, err);
          }
          setFolderUploadProgress((prev) => ({ ...prev, [targetFolder]: { current: i + 1, total: files.length } }));
        }
        setTimeout(() => {
          setFolderUploadProgress((prev) => {
            const next = { ...prev };
            delete next[targetFolder];
            return next;
          });
        }, 500);
      } else {
        // Handle internal move to root
        const draggedId = e.dataTransfer.getData("application/soroban-studio-node-id") || dragState?.draggingId;
        if (draggedId && draggedId !== targetFolder) {
          handleMoveItem(draggedId, targetFolder);
        }
      }
      setDragState?.({ draggingId: null, dragOverId: null });
    },
    [onUploadFiles, root, onMoveItem, dragState?.draggingId, setDragState],
  );

  const handleBodyClick = useCallback((e) => {
    if (e.target === e.currentTarget || e.target.classList.contains("sidebar-body")) {
      onNodeSelect?.(null);
    }
    setContextMenu(null);
  }, []);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handleGlobalClick = (e) => {
      const menuEl = document.querySelector(".context-menu");
      if (menuEl && !menuEl.contains(e.target)) setContextMenu(null);
    };
    const timeoutId = setTimeout(() => document.addEventListener("click", handleGlobalClick), 0);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("click", handleGlobalClick);
    };
  }, [contextMenu]);

  /* ─── Render ─── */

  return (
    <div className="sidebar-wrapper" ref={sidebarRef}>
      <aside className={`sidebar ${isCollapsed ? "collapsed" : ""} ${isDragging ? "resizing" : ""}`} style={{ width: isCollapsed ? 48 : width }}>
        {/* Persistent Activity Bar (Leftmost) */}
        <div className="sidebar-activity-bar">
          <button
            className={`activity-btn ${activePanel === "explorer" && !isCollapsed ? "active" : ""}`}
            onClick={() => {
              if (isCollapsed || activePanel !== "explorer") {
                setIsCollapsed(false);
                setWidth(PANEL_WIDTHS.explorer);
                setActivePanel("explorer");
              } else {
                toggleCollapse();
              }
            }}
            title="Explorer">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </button>
          <button
            className={`activity-btn ${activePanel === "github" && !isCollapsed ? "active" : ""}`}
            onClick={() => {
              if (isCollapsed || activePanel !== "github") {
                setIsCollapsed(false);
                setWidth(PANEL_WIDTHS.github);
                setActivePanel("github");
              } else {
                toggleCollapse();
              }
            }}
            title="GitHub">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
          </button>

          <button
            className={`activity-btn ${activePanel === "tutorial" && !isCollapsed ? "active" : ""}`}
            onClick={() => {
              if (isCollapsed || activePanel !== "tutorial") {
                setIsCollapsed(false);
                setWidth(PANEL_WIDTHS.tutorial);
                setActivePanel("tutorial");
              } else {
                toggleCollapse();
              }
            }}
            title="Tutorials">
            <BookOpen size={24} />
          </button>

          <button
            className={`activity-btn ${activePanel === "deploy" && !isCollapsed ? "active" : ""}`}
            onClick={() => {
              if (isCollapsed || activePanel !== "deploy") {
                setIsCollapsed(false);
                setWidth(PANEL_WIDTHS.deploy);
                setActivePanel("deploy");
              } else {
                toggleCollapse();
              }
            }}
            title="Deploy">
            <Rocket size={24} />
          </button>

          <button
            className={`activity-btn ${activePanel === "validation" && !isCollapsed ? "active" : ""}`}
            onClick={() => {
              if (isCollapsed || activePanel !== "validation") {
                setIsCollapsed(false);
                setWidth(PANEL_WIDTHS.validation);
                setActivePanel("validation");
              } else {
                toggleCollapse();
              }
            }}
            title="Validate Project">
            <CheckCircle2 size={24} />
          </button>

          <div style={{ marginTop: "auto", width: "100%" }}>
            <button className={`activity-btn ${isSettingsOpen ? "active" : ""}`} onClick={onToggleSettings} title="Settings">
              <Settings size={24} />
            </button>
          </div>
        </div>

        {/* Collapsible Panel Section (Right of Activity Bar) */}
        <div className={`sidebar-panel ${isCollapsed ? "hidden" : ""}`}>
          {activePanel === "tutorial" ? (
            <TutorialPanel />
          ) : activePanel === "github" ? (
            <GitHubPanel treeData={treeData || tree} fileContents={fileContents || {}} onConfirm={onConfirm} />
          ) : activePanel === "deploy" ? (
            <>
              <div className="sidebar-header">
                <div className="sidebar-title">Deploy</div>
              </div>
              <div className="sidebar-body" style={{ overflowY: "auto" }}>
                <DeployPanel treeData={treeData || tree} fileContents={fileContents || {}} />
              </div>
            </>
          ) : activePanel === "validation" ? (
            <>
              <div className="sidebar-header">
                <div className="sidebar-title">Validate Project</div>
              </div>
              <div className="sidebar-body" style={{ overflowY: "auto" }}>
                <ValidationPanel treeData={treeData || tree} fileContents={fileContents || {}} />
              </div>
            </>
          ) : root ? (
            <>
              <div className="sidebar-header">
                <div className="sidebar-title">Explorer</div>
                <div className="sidebar-actions">
                  <ActionButton
                    icon={
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    }
                    onClick={handleStartNewFile}
                    title="New File"
                  />
                  <ActionButton
                    icon={
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                        <line x1="12" y1="11" x2="12" y2="17" />
                        <line x1="9" y1="14" x2="15" y2="14" />
                      </svg>
                    }
                    onClick={handleStartNewFolder}
                    title="New Folder"
                  />
                  <ActionButton
                    icon={
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                    }
                    onClick={handleUploadClick}
                    title="Upload Files"
                  />
                  <input ref={fileInputRef} type="file" multiple style={{ display: "none" }} onChange={handleFileSelect} />
                  <ActionButton
                    icon={
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 14h6v6H4zM4 4h6v6H4zM14 4h6v6h-6zM14 14h6v6h-6z" />
                      </svg>
                    }
                    onClick={onCollapseAll}
                    title="Collapse All"
                  />
                </div>
              </div>

              <div className={`sidebar-body ${dragOverBody ? "drag-over-external" : ""}`} onClick={handleBodyClick} onDragOver={handleBodyDragOver} onDragLeave={handleBodyDragLeave} onDrop={handleBodyDrop} onContextMenu={handleBodyContextMenu}>
                {(() => {
                  if (!root) return null;
                  const sortedChildren = sortNodes(root.children) || [];
                  const folders = sortedChildren.filter((n) => n && n.type === "folder");
                  const files = sortedChildren.filter((n) => n && n.type === "file");

                  const renderExplorerNode = (child) => <ExplorerNode key={child.id} node={child} depth={0} tree={tree} expandedFolders={expandedFolders} onToggleFolder={onToggleFolder} onFileSelect={onFileSelect} activeFileId={activeFileId} onNodeSelect={onNodeSelect} selectedNodeId={selectedNodeId} inlineInput={inlineInput} onInlineSubmit={handleInlineSubmit} onInlineCancel={handleInlineCancel} onContextMenu={handleContextMenu} renameNode={renameNode} onRenameSubmit={handleRenameSubmit} onRenameCancel={handleRenameCancel} onMoveItem={handleMoveItem} onUploadFiles={onUploadFiles} dragState={dragState} setDragState={setDragState} clipboard={clipboard} folderUploadProgress={folderUploadProgress} setFolderUploadProgress={setFolderUploadProgress} lastSessionId={lastSessionId} setTreeData={setTreeData} />;

                  return (
                    <>
                      {inlineInput && inlineInput.parentId === root.id && inlineInput.type === "folder" && <InlineInput type="folder" depth={0} onSubmit={handleInlineSubmit} onCancel={handleInlineCancel} defaultValue="newfolder" />}
                      {folders.map(renderExplorerNode)}
                      {inlineInput && inlineInput.parentId === root.id && inlineInput.type === "file" && <InlineInput type="file" depth={0} onSubmit={handleInlineSubmit} onCancel={handleInlineCancel} defaultValue="newfile" />}
                      {files.map(renderExplorerNode)}
                    </>
                  );
                })()}
                <ContextMenu contextMenu={contextMenu} canPaste={!!clipboard} onCopy={handleCopyClick} onCut={handleCutClick} onPaste={handlePasteClick} onRename={handleRenameClick} onDelete={handleDeleteClick} onNewFile={() => handleStartNewFile(contextMenu.nodeId)} onNewFolder={() => handleStartNewFolder(contextMenu.nodeId)} onClose={handleCloseContextMenu} />
              </div>
            </>
          ) : (
            <div className="sidebar-empty">No workspace loaded</div>
          )}
        </div>
      </aside>

      {!isCollapsed && <div className={`sidebar-resize-handle ${isDragging ? "dragging" : ""}`} onMouseDown={handleMouseDown} />}

      {dragState?.draggingId && (
        <div className="drag-status-indicator">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span>
            Dragging:{" "}
            {(() => {
              const findNode = (nodes, id) => {
                for (const n of nodes) {
                  if (n.id === id) return n;
                  if (n.children?.length) {
                    const found = findNode(n.children, id);
                    if (found) return found;
                  }
                }
                return null;
              };
              return findNode(tree, dragState.draggingId)?.name || "Unknown";
            })()}
          </span>
        </div>
      )}

      {renameError && (
        <div className="rename-error-overlay">
          <div className="rename-error-dialog">
            <p className="rename-error-message">{renameError}</p>
            <div className="rename-error-actions">
              <button className="rename-error-btn" onClick={closeRenameError}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      <button className="sidebar-minimize-btn" onClick={toggleCollapse} title={isCollapsed ? "Expand" : "Collapse"}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ transform: isCollapsed ? "rotate(180deg)" : "none" }}>
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
    </div>
  );
});

export default Sidebar;
