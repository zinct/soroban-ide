import React, { memo, useState, useCallback, useRef, useEffect } from "react";
import { FileIconSVG, FolderIcon } from "../shared/file-icon";

const ChevronDown = () => (
  <svg viewBox="0 0 16 16" role="img" aria-hidden="true">
    <path d="M12 6l-4 4-4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

const ChevronRight = () => (
  <svg viewBox="0 0 16 16" role="img" aria-hidden="true">
    <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

const FolderIconComponent = ({ node, isExpanded }) => <FolderIcon folderName={node.name} isOpen={isExpanded} size={16} />;

const FileIconComponent = ({ filename }) => <FileIconSVG filename={filename} size={16} />;

const ActionButton = memo(({ icon, label, onClick, title }) => (
  <button className="sidebar-action" type="button" onClick={onClick} title={title || label}>
    {icon}
  </button>
));

// Inline input component for new file/folder like VSCode
const InlineInput = memo(({ type, depth, onSubmit, onCancel, defaultValue = "" }) => {
  const inputRef = useRef(null);
  const [value, setValue] = useState(defaultValue);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 10);
    inputRef.current?.focus();
    inputRef.current?.select();
    return () => clearTimeout(timer);
  }, []);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") {
        const trimmed = value.trim();
        if (trimmed) onSubmit(trimmed);
      } else if (e.key === "Escape") {
        onCancel();
      }
    },
    [value, onSubmit, onCancel]
  );

  const handleBlur = useCallback(() => {
    setTimeout(() => onCancel(), 200);
  }, [onCancel]);

  const indent = depth * 16;
  const isFolder = type === "folder";

  return (
    <div className={`sidebar-inline-input ${isVisible ? "visible" : ""}`} style={{ paddingLeft: `${indent + (isFolder ? 12 : 40)}px` }}>
      <span className="sidebar-node-icon">{isFolder ? <FolderIcon folderName="" isOpen={false} size={16} /> : <FileIconSVG filename={value || "file.txt"} size={16} />}</span>
      <input ref={inputRef} type="text" className="sidebar-inline-input-field" value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={handleKeyDown} onBlur={handleBlur} placeholder={isFolder ? "New Folder" : "New File"} />
    </div>
  );
});

// Rename input component for renaming files/folders
const RenameInput = memo(({ type, depth, onSubmit, onCancel, defaultValue = "" }) => {
  const inputRef = useRef(null);
  const [value, setValue] = useState(defaultValue);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 10);
    inputRef.current?.focus();
    inputRef.current?.select();
    return () => clearTimeout(timer);
  }, []);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") {
        const trimmed = value.trim();
        if (trimmed) onSubmit(trimmed);
        else onCancel();
      } else if (e.key === "Escape") {
        onCancel();
      }
    },
    [value, onSubmit, onCancel]
  );

  const handleBlur = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== defaultValue) {
      onSubmit(trimmed);
    } else {
      onCancel();
    }
  }, [value, defaultValue, onSubmit, onCancel]);

  const indent = depth * 18;
  const isFolder = type === "folder";

  return (
    <div className={`sidebar-inline-input rename-input ${isVisible ? "visible" : ""}`} style={{ paddingLeft: `${indent + (isFolder ? 12 : 40)}px` }}>
      <span className="sidebar-node-icon">{isFolder ? <FolderIcon folderName="" isOpen={false} size={16} /> : <FileIconSVG filename={value || "file.txt"} size={16} />}</span>
      <input ref={inputRef} type="text" className="sidebar-inline-input-field" value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={handleKeyDown} onBlur={handleBlur} />
    </div>
  );
});

// Sort function: folders first (alphabetically), then files (alphabetically)
const sortNodes = (nodes) => {
  if (!nodes || nodes.length === 0) return nodes;
  return [...nodes].sort((a, b) => {
    const aIsFolder = a.type === "folder";
    const bIsFolder = b.type === "folder";
    // Folders come first
    if (aIsFolder && !bIsFolder) return -1;
    if (!aIsFolder && bIsFolder) return 1;
    // Both same type, sort alphabetically by name
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
};

// Find parent folder ID for a given node
const findParentId = (nodes, targetId, parentId = null) => {
  for (const n of nodes) {
    if (n.id === targetId) return parentId;
    if (n.children?.length) {
      const found = findParentId(n.children, targetId, n.id);
      if (found) return found;
    }
  }
  return null;
};

const ExplorerNode = memo(({ node, depth, tree, expandedFolders, onToggleFolder, onFileSelect, activeFileId, onSelectFolder, selectedFolderId, inlineInput, onInlineSubmit, onInlineCancel, onContextMenu, renameNode, onRenameSubmit, onRenameCancel, onMoveItem, onUploadFiles, dragState, setDragState, clipboard }) => {
  const isFolder = node.type === "folder";
  const isExpanded = expandedFolders.has(node.id);
  const isSelected = selectedFolderId === node.id;
  const isRenaming = renameNode?.id === node.id;
  const isDragging = dragState?.draggingId === node.id;
  const isDragOver = dragState?.dragOverId === node.id;
  const isCut = clipboard?.nodeId === node.id && clipboard?.operation === "cut";
  const indent = depth * 18;

  const handleClick = useCallback(() => {
    if (isFolder) {
      onToggleFolder(node.id);
      onSelectFolder?.(node.id);
    } else {
      onFileSelect(node.id);
    }
  }, [isFolder, node.id, onToggleFolder, onSelectFolder, onFileSelect]);

  const handleContextMenuEvent = useCallback(
    (e) => {
      onContextMenu(e, node);
    },
    [node, onContextMenu]
  );

  // Internal drag handlers
  const handleDragStart = useCallback(
    (e) => {
      e.dataTransfer.setData("text/plain", node.id);
      e.dataTransfer.effectAllowed = "move";
      setDragState?.({ draggingId: node.id, dragOverId: null });
    },
    [node.id, setDragState]
  );

  const handleDragEnd = useCallback(() => {
    setDragState?.({ draggingId: null, dragOverId: null });
  }, [setDragState]);

  // VS Code-style drop handler - works for both internal and external drops
  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      const isExternal = e.dataTransfer.types.includes("Files");

      if (isExternal) {
        // External file drop
        const files = e.dataTransfer.files;
        if (files && files.length > 0 && onUploadFiles) {
          const targetFolderId = isFolder ? node.id : findParentId(tree, node.id);
          if (targetFolderId) {
            const filesArray = Array.from(files);
            onUploadFiles(filesArray, targetFolderId);
          }
        }
      } else {
        // Internal drag - move item
        const draggedId = e.dataTransfer.getData("text/plain");
        if (draggedId && draggedId !== node.id) {
          // If dropped on folder, move into folder
          // If dropped on file, move into file's parent folder
          const targetFolderId = isFolder ? node.id : findParentId(tree, node.id);
          if (targetFolderId) {
            onMoveItem?.(draggedId, targetFolderId);
          }
        }
      }

      setDragState?.({ draggingId: null, dragOverId: null });
    },
    [node.id, isFolder, tree, onMoveItem, onUploadFiles, setDragState]
  );

  const handleDragOver = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      const isExternal = e.dataTransfer.types.includes("Files");

      if (isExternal) {
        // External drag - show copy effect
        e.dataTransfer.dropEffect = "copy";
        // Highlight this folder or file's parent folder
        const targetId = isFolder ? node.id : findParentId(tree, node.id);
        if (targetId && dragState?.dragOverId !== targetId) {
          setDragState?.({ ...dragState, dragOverId: targetId });
        }
      } else {
        // Internal drag
        e.dataTransfer.dropEffect = "move";
        const draggedId = e.dataTransfer.getData("text/plain") || dragState?.draggingId;
        if (draggedId && draggedId !== node.id) {
          const targetId = isFolder ? node.id : findParentId(tree, node.id);
          if (targetId && dragState?.dragOverId !== targetId) {
            setDragState?.({ ...dragState, dragOverId: targetId });
          }
        }
      }
    },
    [node.id, isFolder, tree, dragState, setDragState]
  );

  const handleDragLeave = useCallback(
    (e) => {
      e.preventDefault();
      // Only clear if we're actually leaving this element, not entering a child
      if (!e.currentTarget.contains(e.relatedTarget)) {
        if (dragState?.dragOverId === node.id || dragState?.dragOverId === findParentId(tree, node.id)) {
          setDragState?.({ ...dragState, dragOverId: null });
        }
      }
    },
    [node.id, tree, dragState, setDragState]
  );

  if (isFolder) {
    if (isRenaming) {
      return (
        <div className="sidebar-node" key={node.id}>
          <RenameInput type="folder" depth={depth} onSubmit={onRenameSubmit} onCancel={onRenameCancel} defaultValue={node.name} />
        </div>
      );
    }
    return (
      <div className="sidebar-node" key={node.id}>
        <button className={`sidebar-folder ${isExpanded ? "expanded" : ""} ${isSelected ? "selected" : ""} ${isDragOver ? "drag-over" : ""} ${isDragging ? "dragging" : ""} ${isCut ? "cut" : ""}`} type="button" onClick={handleClick} onContextMenu={handleContextMenuEvent} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} style={{ paddingLeft: `${indent + 12}px` }} draggable={true} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <span className="sidebar-chevron">{isExpanded ? <ChevronDown /> : <ChevronRight />}</span>
          <span className="sidebar-node-icon">
            <FolderIconComponent node={node} isExpanded={isExpanded} />
          </span>
          <span className={`sidebar-node-label ${isCut ? "cut-label" : ""}`}>{node.name}</span>
        </button>
        {isExpanded && (
          <div className="sidebar-children">
            {inlineInput?.parentId === node.id && <InlineInput type={inlineInput.type} depth={depth + 1} onSubmit={onInlineSubmit} onCancel={onInlineCancel} defaultValue={inlineInput.type === "file" ? "newfile" : "newfolder"} />}
            {sortNodes(node.children)?.map((child) => (
              <ExplorerNode key={child.id} node={child} depth={depth + 1} tree={tree} expandedFolders={expandedFolders} onToggleFolder={onToggleFolder} onFileSelect={onFileSelect} activeFileId={activeFileId} onSelectFolder={onSelectFolder} selectedFolderId={selectedFolderId} inlineInput={inlineInput} onInlineSubmit={onInlineSubmit} onInlineCancel={onInlineCancel} onContextMenu={onContextMenu} renameNode={renameNode} onRenameSubmit={onRenameSubmit} onRenameCancel={onRenameCancel} onMoveItem={onMoveItem} onUploadFiles={onUploadFiles} dragState={dragState} setDragState={setDragState} clipboard={clipboard} />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (isRenaming) {
    return <RenameInput type="file" depth={depth} onSubmit={onRenameSubmit} onCancel={onRenameCancel} defaultValue={node.name} />;
  }

  return (
    <button className={`sidebar-file ${activeFileId === node.id ? "active" : ""} ${isDragging ? "dragging" : ""} ${isCut ? "cut" : ""}`} type="button" onClick={() => onFileSelect(node.id)} onContextMenu={handleContextMenuEvent} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} style={{ paddingLeft: `${indent + 40}px` }} draggable={true} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <span className="sidebar-node-icon">
        <FileIconComponent filename={node.name} />
      </span>
      <span className={`sidebar-node-label ${isCut ? "cut-label" : ""}`}>{node.name}</span>
    </button>
  );
});

const Sidebar = memo(({ tree, expandedFolders, onToggleFolder, onFileSelect, onNewFile, onNewFolder, onDeleteItem, onRenameItem, onMoveItem, onUploadFiles, onCopyItem, onCutItem, onPasteItem, clipboard, onCollapseAll, activeFileId }) => {
  const root = tree?.[0];
  const [width, setWidth] = useState(280);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [inlineInput, setInlineInput] = useState(null);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [renameNode, setRenameNode] = useState(null);
  const [dragState, setDragState] = useState({ draggingId: null, dragOverId: null });
  const [pasteTargetFolder, setPasteTargetFolder] = useState(null);
  const sidebarRef = useRef(null);
  const currentWidthRef = useRef(280);
  const rafRef = useRef(null);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  const MIN_WIDTH = 150;
  const MAX_WIDTH = 600;
  const COLLAPSE_THRESHOLD = 100;

  const handleMouseDown = useCallback(
    (e) => {
      e.preventDefault();
      setIsDragging(true);
      dragStartX.current = e.clientX;
      dragStartWidth.current = width;
    },
    [width]
  );

  const handleMouseMove = useCallback(
    (e) => {
      if (!isDragging) return;

      const delta = e.clientX - dragStartX.current;
      const rawWidth = dragStartWidth.current + delta;

      // Auto-collapse if dragged below threshold
      if (rawWidth < COLLAPSE_THRESHOLD) {
        setIsCollapsed(true);
        setWidth(48);
        setIsDragging(false);
        return;
      }

      // Apply min/max constraints for normal resize
      const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, rawWidth));
      setWidth(newWidth);
    },
    [isDragging]
  );

  const handleMouseUp = useCallback(() => {
    // Check if we should collapse based on final width
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
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const toggleCollapse = useCallback(() => {
    if (isCollapsed) {
      setIsCollapsed(false);
      setWidth(280);
    } else {
      setIsCollapsed(true);
      setWidth(48);
    }
  }, [isCollapsed]);

  const handleStartNewFile = useCallback(() => {
    const targetFolder = selectedFolderId || root?.id;
    if (targetFolder && !expandedFolders.has(targetFolder)) {
      onToggleFolder(targetFolder);
    }
    setInlineInput({ type: "file", parentId: targetFolder });
  }, [selectedFolderId, root, expandedFolders, onToggleFolder]);

  const handleStartNewFolder = useCallback(() => {
    const targetFolder = selectedFolderId || root?.id;
    if (targetFolder && !expandedFolders.has(targetFolder)) {
      onToggleFolder(targetFolder);
    }
    setInlineInput({ type: "folder", parentId: targetFolder });
  }, [selectedFolderId, root, expandedFolders, onToggleFolder]);

  const handleInlineSubmit = useCallback(
    (name) => {
      if (inlineInput?.type === "file") onNewFile(name, inlineInput.parentId);
      else onNewFolder(name, inlineInput.parentId);
      setInlineInput(null);
    },
    [inlineInput, onNewFile, onNewFolder]
  );

  const handleInlineCancel = useCallback(() => setInlineInput(null), []);

  const handleContextMenu = useCallback((e, node) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      nodeId: node.id,
      nodeType: node.type,
      nodeName: node.name,
    });
    // Set paste target to the folder being right-clicked on (if it's a folder)
    if (node.type === "folder") {
      setPasteTargetFolder(node.id);
    } else {
      // If right-clicking on a file, use its parent as paste target
      setPasteTargetFolder(null);
    }
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleRenameClick = useCallback(() => {
    if (contextMenu) {
      setRenameNode({
        id: contextMenu.nodeId,
        name: contextMenu.nodeName,
        type: contextMenu.nodeType,
      });
      setContextMenu(null);
    }
  }, [contextMenu]);

  const handleRenameSubmit = useCallback(
    (newName) => {
      if (renameNode && newName && newName !== renameNode.name) {
        onRenameItem(renameNode.id, newName);
      }
      setRenameNode(null);
    },
    [renameNode, onRenameItem]
  );

  const handleRenameCancel = useCallback(() => {
    setRenameNode(null);
  }, []);

  const fileInputRef = useRef(null);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelect = useCallback(
    (e) => {
      const files = e.target.files;
      if (files && files.length > 0 && onUploadFiles) {
        // Convert FileList to array
        const filesArray = Array.from(files);
        onUploadFiles(filesArray, selectedFolderId || root?.id);
      }
      // Reset input to allow uploading the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [onUploadFiles, selectedFolderId, root]
  );

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
    const targetId = pasteTargetFolder || selectedFolderId || root?.id;
    if (targetId && onPasteItem) {
      onPasteItem(targetId);
      setPasteTargetFolder(null);
    }
    setContextMenu(null);
  }, [pasteTargetFolder, selectedFolderId, root, onPasteItem]);

  const canPaste = clipboard?.nodeId && clipboard?.operation;

  // Keyboard shortcuts for copy/cut/paste
  useEffect(() => {
    const handler = (e) => {
      const isInput = e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.contentEditable === "true";
      if (isInput) return;

      const hasSelection = selectedFolderId || activeFileId;
      if (!hasSelection) return;

      const targetId = activeFileId || selectedFolderId;

      if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        e.preventDefault();
        if (onCopyItem && targetId) onCopyItem(targetId);
      } else if ((e.ctrlKey || e.metaKey) && e.key === "x") {
        e.preventDefault();
        if (onCutItem && targetId) onCutItem(targetId);
      } else if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        e.preventDefault();
        const pasteTarget = pasteTargetFolder || selectedFolderId || root?.id;
        if (onPasteItem && pasteTarget && clipboard?.nodeId) {
          onPasteItem(pasteTarget);
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedFolderId, activeFileId, onCopyItem, onCutItem, onPasteItem, pasteTargetFolder, root, clipboard]);

  const [dragOverBody, setDragOverBody] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);

  // Handle external file drop on sidebar body
  const handleBodyDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    // Check if dragging external files (not internal nodes)
    if (e.dataTransfer.types.includes("Files")) {
      e.dataTransfer.dropEffect = "copy";
      setDragOverBody(true);
    }
  }, []);

  const handleBodyDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    // Only clear if leaving the body, not entering a child
    if (e.currentTarget === e.target) {
      setDragOverBody(false);
    }
  }, []);

  const handleBodyDrop = useCallback(
    async (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOverBody(false);

      const items = e.dataTransfer.items || e.dataTransfer.files;
      if (!items || items.length === 0 || !onUploadFiles) return;

      setUploadProgress({ current: 0, total: items.length });

      // Process files with progress
      const targetFolder = selectedFolderId || root?.id;
      const files = [];

      // Collect all files from drop
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === "file" || item instanceof File) {
          const file = item instanceof File ? item : item.getAsFile();
          if (file) files.push(file);
        }
      }

      for (let i = 0; i < files.length; i++) {
        try {
          await onUploadFiles([files[i]], targetFolder);
        } catch (err) {
          console.error("Upload failed for file:", files[i].name, err);
        }
        setUploadProgress({ current: i + 1, total: files.length });
      }

      // Clear progress after a short delay
      setTimeout(() => setUploadProgress(null), 500);
    },
    [onUploadFiles, selectedFolderId, root]
  );

  const handleBodyClick = useCallback((e) => {
    // Clear folder selection when clicking on empty space in sidebar body
    // Only clear if clicking directly on the body container, not on buttons/elements
    if (e.target === e.currentTarget || e.target.classList.contains("sidebar-body")) {
      setSelectedFolderId(null);
    }
    // Always close context menu when clicking anywhere in sidebar body
    setContextMenu(null);
  }, []);

  // Global click handler to close context menu when clicking outside
  useEffect(() => {
    if (!contextMenu) return;

    const handleGlobalClick = (e) => {
      // Check if click is inside context menu
      const contextMenuEl = document.querySelector(".context-menu");
      if (contextMenuEl && !contextMenuEl.contains(e.target)) {
        setContextMenu(null);
      }
    };

    // Add listener with slight delay to avoid catching the click that opened the menu
    const timeoutId = setTimeout(() => {
      document.addEventListener("click", handleGlobalClick);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("click", handleGlobalClick);
    };
  }, [contextMenu]);

  return (
    <div className="sidebar-wrapper" ref={sidebarRef}>
      <aside className={`sidebar ${isCollapsed ? "collapsed" : ""} ${isDragging ? "resizing" : ""}`} ref={sidebarRef} style={{ width: isCollapsed ? 48 : width }}>
        {/* Collapsed view */}
        <div className="sidebar-collapsed-view">
          <button className="sidebar-collapsed-btn" onClick={toggleCollapse} title="Expand Explorer">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
          </button>
        </div>

        {/* Normal view */}
        <div className="sidebar-header">
          <div className="sidebar-title">Explorer</div>
          <div className="sidebar-actions">
            <ActionButton
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              }
              onClick={handleStartNewFile}
              title="New File"
            />
            <ActionButton
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                  <line x1="12" y1="11" x2="12" y2="17"></line>
                  <line x1="9" y1="14" x2="15" y2="14"></line>
                </svg>
              }
              onClick={handleStartNewFolder}
              title="New Folder"
            />
            <ActionButton
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
              }
              onClick={handleUploadClick}
              title="Upload Files"
            />
            <input ref={fileInputRef} type="file" multiple className="sidebar-upload-input" onChange={handleFileSelect} style={{ display: "none" }} />
            <ActionButton
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 14h6v6H4zM4 4h6v6H4zM14 4h6v6h-6zM14 14h6v6h-6z"></path>
                </svg>
              }
              onClick={onCollapseAll}
              title="Collapse All"
            />
          </div>
        </div>
        <div className={`sidebar-body ${dragOverBody ? "drag-over-external" : ""}`} onClick={handleBodyClick} onDragOver={handleBodyDragOver} onDragLeave={handleBodyDragLeave} onDrop={handleBodyDrop}>
          {uploadProgress && (
            <div className="upload-progress-bar">
              <div className="upload-progress-fill" style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }} />
              <span className="upload-progress-text">
                Uploading {uploadProgress.current}/{uploadProgress.total} files...
              </span>
            </div>
          )}
          {root ? (
            <>
              <ExplorerNode node={root} depth={0} tree={tree} expandedFolders={expandedFolders} onToggleFolder={onToggleFolder} onFileSelect={onFileSelect} activeFileId={activeFileId} onSelectFolder={setSelectedFolderId} selectedFolderId={selectedFolderId} inlineInput={inlineInput} onInlineSubmit={handleInlineSubmit} onInlineCancel={handleInlineCancel} onContextMenu={handleContextMenu} renameNode={renameNode} onRenameSubmit={handleRenameSubmit} onRenameCancel={handleRenameCancel} onMoveItem={onMoveItem} onUploadFiles={onUploadFiles} dragState={dragState} setDragState={setDragState} clipboard={clipboard} />
              {contextMenu && (
                <div className="context-menu" style={{ top: contextMenu.y, left: contextMenu.x }} onClick={handleCloseContextMenu}>
                  <div className="context-menu-item" onClick={handleCopyClick}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                    Copy
                  </div>
                  <div className="context-menu-item" onClick={handleCutClick}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="6" cy="6" r="3"></circle>
                      <circle cx="6" cy="18" r="3"></circle>
                      <line x1="20" y1="4" x2="8.12" y2="15.88"></line>
                      <line x1="14.47" y1="14.48" x2="20" y2="20"></line>
                      <line x1="8.12" y1="8.12" x2="12" y2="12"></line>
                    </svg>
                    Cut
                  </div>
                  {canPaste && (
                    <div className="context-menu-item" onClick={handlePasteClick}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                        <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                      </svg>
                      Paste
                    </div>
                  )}
                  <div className="context-menu-divider"></div>
                  <div className="context-menu-item" onClick={handleRenameClick}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                    Rename
                  </div>
                  <div className="context-menu-item delete" onClick={handleDeleteClick}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                    Delete
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="sidebar-empty">No workspace loaded</div>
          )}
        </div>
      </aside>

      {/* Resize handle */}
      {!isCollapsed && <div className={`sidebar-resize-handle ${isDragging ? "dragging" : ""}`} onMouseDown={handleMouseDown} />}

      {dragState?.draggingId && (
        <div className="drag-status-indicator">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          <span>
            Dragging:{" "}
            {(() => {
              const findNode = (nodes, id) => {
                for (const node of nodes) {
                  if (node.id === id) return node;
                  if (node.children?.length) {
                    const found = findNode(node.children, id);
                    if (found) return found;
                  }
                }
                return null;
              };
              const node = findNode(tree, dragState.draggingId);
              return node?.name || "Unknown";
            })()}
          </span>
        </div>
      )}
      <button className="sidebar-minimize-btn" onClick={toggleCollapse} title={isCollapsed ? "Expand" : "Collapse"}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ transform: isCollapsed ? "rotate(180deg)" : "none" }}>
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
    </div>
  );
});

export default Sidebar;
