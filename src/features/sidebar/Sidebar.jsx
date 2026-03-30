import React, { memo, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { loadState, saveStateSection } from '../../utils/storage';
import ExplorerNode from './ExplorerNode';
import ContextMenu from './ContextMenu';

const MIN_WIDTH = 180;
const MAX_WIDTH = 600;
const COLLAPSE_THRESHOLD = 100;

const ActionButton = memo(({ icon, onClick, title }) => (
  <button className="sidebar-action" type="button" onClick={onClick} title={title}>
    {icon}
  </button>
));

/**
 * Sidebar component — contains file explorer, resize, collapse.
 */
const Sidebar = memo(({
  tree,
  expandedFolders,
  onToggleFolder,
  onFileSelect,
  onNewFile,
  onNewFolder,
  onDeleteItem,
  onRenameItem,
  onMoveItem,
  onUploadFiles,
  onCopyItem,
  onCutItem,
  onPasteItem,
  clipboard,
  onCollapseAll,
  activeFileId,
}) => {
  const root = tree?.[0];
  const persistedSidebarState = useMemo(() => loadState()?.sidebar, []);

  const [width, setWidth] = useState(() => persistedSidebarState?.width || 280);
  const [isCollapsed, setIsCollapsed] = useState(() => persistedSidebarState?.isCollapsed ?? false);
  const [isDragging, setIsDragging] = useState(false);
  const [inlineInput, setInlineInput] = useState(null);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
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
    saveStateSection('sidebar', { width, isCollapsed });
  }, [width, isCollapsed]);

  /* ─── Resize handlers ─── */

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

      if (rawWidth < COLLAPSE_THRESHOLD) {
        setIsCollapsed(true);
        setWidth(48);
        setIsDragging(false);
        return;
      }
      setWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, rawWidth)));
    },
    [isDragging]
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
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
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
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
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

  /* ─── Inline input handlers ─── */

  const handleStartNewFile = useCallback(() => {
    const targetFolder = selectedFolderId || root?.id;
    if (targetFolder && !expandedFolders.has(targetFolder)) onToggleFolder(targetFolder);
    setInlineInput({ type: 'file', parentId: targetFolder });
  }, [selectedFolderId, root, expandedFolders, onToggleFolder]);

  const handleStartNewFolder = useCallback(() => {
    const targetFolder = selectedFolderId || root?.id;
    if (targetFolder && !expandedFolders.has(targetFolder)) onToggleFolder(targetFolder);
    setInlineInput({ type: 'folder', parentId: targetFolder });
  }, [selectedFolderId, root, expandedFolders, onToggleFolder]);

  const handleInlineSubmit = useCallback(
    (name) => {
      if (inlineInput?.type === 'file') onNewFile(name, inlineInput.parentId);
      else onNewFolder(name, inlineInput.parentId);
      setInlineInput(null);
    },
    [inlineInput, onNewFile, onNewFolder]
  );

  const handleInlineCancel = useCallback(() => setInlineInput(null), []);

  /* ─── Context menu handlers ─── */

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
    setPasteTargetFolder(node.type === 'folder' ? node.id : null);
  }, []);

  const handleCloseContextMenu = useCallback(() => setContextMenu(null), []);

  const handleRenameClick = useCallback(() => {
    if (contextMenu) {
      setRenameNode({ id: contextMenu.nodeId, name: contextMenu.nodeName, type: contextMenu.nodeType });
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

  const handleRenameCancel = useCallback(() => setRenameNode(null), []);

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

  /* ─── Upload handlers ─── */

  const handleUploadClick = useCallback(() => fileInputRef.current?.click(), []);

  const handleFileSelect = useCallback(
    (e) => {
      const files = e.target.files;
      if (files?.length && onUploadFiles) {
        onUploadFiles(Array.from(files), selectedFolderId || root?.id);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [onUploadFiles, selectedFolderId, root]
  );

  /* ─── Keyboard shortcuts ─── */

  useEffect(() => {
    const handler = (e) => {
      const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true';
      if (isInput) return;

      const targetId = activeFileId || selectedFolderId;
      if (!targetId) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        onCopyItem?.(targetId);
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
        e.preventDefault();
        onCutItem?.(targetId);
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        const pasteTarget = pasteTargetFolder || selectedFolderId || root?.id;
        if (onPasteItem && pasteTarget && clipboard?.nodeId) {
          onPasteItem(pasteTarget);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedFolderId, activeFileId, onCopyItem, onCutItem, onPasteItem, pasteTargetFolder, root, clipboard]);

  /* ─── External drop on sidebar body ─── */

  const handleBodyDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      e.dataTransfer.dropEffect = 'copy';
      setDragOverBody(true);
    }
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

      const items = e.dataTransfer.items || e.dataTransfer.files;
      if (!items?.length || !onUploadFiles) return;

      const targetFolder = selectedFolderId || root?.id;
      if (!targetFolder) return;

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
          console.error('Upload failed:', files[i].name, err);
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
    },
    [onUploadFiles, selectedFolderId, root]
  );

  const handleBodyClick = useCallback((e) => {
    if (e.target === e.currentTarget || e.target.classList.contains('sidebar-body')) {
      setSelectedFolderId(null);
    }
    setContextMenu(null);
  }, []);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handleGlobalClick = (e) => {
      const menuEl = document.querySelector('.context-menu');
      if (menuEl && !menuEl.contains(e.target)) setContextMenu(null);
    };
    const timeoutId = setTimeout(() => document.addEventListener('click', handleGlobalClick), 0);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('click', handleGlobalClick);
    };
  }, [contextMenu]);

  /* ─── Render ─── */

  return (
    <div className="sidebar-wrapper" ref={sidebarRef}>
      <aside
        className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isDragging ? 'resizing' : ''}`}
        style={{ width: isCollapsed ? 48 : width }}
      >
        {/* Collapsed view */}
        <div className="sidebar-collapsed-view">
          <button className="sidebar-collapsed-btn" onClick={toggleCollapse} title="Expand Explorer">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </button>
        </div>

        {/* Normal view */}
        <div className="sidebar-header">
          <div className="sidebar-title">Explorer</div>
          <div className="sidebar-actions">
            <ActionButton
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>}
              onClick={handleStartNewFile}
              title="New File"
            />
            <ActionButton
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /><line x1="12" y1="11" x2="12" y2="17" /><line x1="9" y1="14" x2="15" y2="14" /></svg>}
              onClick={handleStartNewFolder}
              title="New Folder"
            />
            <ActionButton
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>}
              onClick={handleUploadClick}
              title="Upload Files"
            />
            <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleFileSelect} />
            <ActionButton
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 14h6v6H4zM4 4h6v6H4zM14 4h6v6h-6zM14 14h6v6h-6z" /></svg>}
              onClick={onCollapseAll}
              title="Collapse All"
            />
          </div>
        </div>

        <div
          className={`sidebar-body ${dragOverBody ? 'drag-over-external' : ''}`}
          onClick={handleBodyClick}
          onDragOver={handleBodyDragOver}
          onDragLeave={handleBodyDragLeave}
          onDrop={handleBodyDrop}
        >
          {root ? (
            <>
              <ExplorerNode
                node={root}
                depth={0}
                tree={tree}
                expandedFolders={expandedFolders}
                onToggleFolder={onToggleFolder}
                onFileSelect={onFileSelect}
                activeFileId={activeFileId}
                onSelectFolder={setSelectedFolderId}
                selectedFolderId={selectedFolderId}
                inlineInput={inlineInput}
                onInlineSubmit={handleInlineSubmit}
                onInlineCancel={handleInlineCancel}
                onContextMenu={handleContextMenu}
                renameNode={renameNode}
                onRenameSubmit={handleRenameSubmit}
                onRenameCancel={handleRenameCancel}
                onMoveItem={onMoveItem}
                onUploadFiles={onUploadFiles}
                dragState={dragState}
                setDragState={setDragState}
                clipboard={clipboard}
                folderUploadProgress={folderUploadProgress}
                setFolderUploadProgress={setFolderUploadProgress}
              />
              <ContextMenu
                contextMenu={contextMenu}
                canPaste={canPaste}
                onCopy={handleCopyClick}
                onCut={handleCutClick}
                onPaste={handlePasteClick}
                onRename={handleRenameClick}
                onDelete={handleDeleteClick}
                onClose={handleCloseContextMenu}
              />
            </>
          ) : (
            <div className="sidebar-empty">No workspace loaded</div>
          )}

          {Object.keys(folderUploadProgress).length > 0 && (
            <div className="upload-progress-bar global-progress">
              <div
                className="upload-progress-fill"
                style={{
                  width: `${(Object.values(folderUploadProgress).reduce((a, c) => a + c.current, 0) /
                    Object.values(folderUploadProgress).reduce((a, c) => a + c.total, 0)) * 100}%`,
                }}
              />
              <span className="upload-progress-text">
                Uploading {Object.values(folderUploadProgress).reduce((a, c) => a + c.current, 0)}/
                {Object.values(folderUploadProgress).reduce((a, c) => a + c.total, 0)} files...
              </span>
            </div>
          )}
        </div>
      </aside>

      {!isCollapsed && (
        <div className={`sidebar-resize-handle ${isDragging ? 'dragging' : ''}`} onMouseDown={handleMouseDown} />
      )}

      {dragState?.draggingId && (
        <div className="drag-status-indicator">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span>Dragging: {(() => {
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
            return findNode(tree, dragState.draggingId)?.name || 'Unknown';
          })()}</span>
        </div>
      )}

      <button
        className="sidebar-minimize-btn"
        onClick={toggleCollapse}
        title={isCollapsed ? 'Expand' : 'Collapse'}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ transform: isCollapsed ? 'rotate(180deg)' : 'none' }}>
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
    </div>
  );
});

export default Sidebar;
