import React, { memo, useCallback, useState, useRef } from "react";
import { FileIconImg, FolderIconImg } from "../../components/icons/FileIcon";
import { ChevronDown, ChevronRight } from "../../components/icons/ChevronIcons";
import { sortNodes, findParentId, uniqueId } from "../workspace/workspaceUtils";
import InlineInput from "./InlineInput";
import RenameInput from "./RenameInput";

/**
 * Recursive tree node component for the file explorer.
 * Renders a single file or folder with all its interactions.
 * Supports lazy-loading for large folders (node_modules, target).
 */
const ExplorerNode = memo(({ node, depth, tree, expandedFolders, onToggleFolder, onFileSelect, activeFileId, onNodeSelect, selectedNodeId, inlineInput, onInlineSubmit, onInlineCancel, onContextMenu, renameNode, onRenameSubmit, onRenameCancel, onMoveItem, onUploadFiles, dragState, setDragState, clipboard, folderUploadProgress, setFolderUploadProgress, lastSessionId, setTreeData }) => {
  const isFolder = node.type === "folder";
  const isExpanded = expandedFolders.has(node.id);
  const isSelected = selectedNodeId === node.id;
  const isRenaming = renameNode?.id === node.id;
  const isDragging = dragState?.draggingId === node.id;
  const isDragOver = dragState?.dragOverId === node.id;
  const isCut = clipboard?.nodeId === node.id && clipboard?.operation === "cut";
  const indent = depth * 8;
  const dragExpandTimer = useRef(null);

  /**
   * Build the relative path for this node by walking up the tree.
   */
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
      walk(tree, targetNode);
      // Remove the root folder name (it's the workspace name, not part of the path)
      if (parts.length > 1) parts.shift();
      return parts.join("/");
    },
    [tree],
  );

  const handleClick = useCallback(() => {
    if (isFolder) {
      const hasChildren = node.children?.length > 0;
      const isTargetedByInput = inlineInput?.parentId === node.id;
      
      // Toggle folders regardless of content so chevrons rotate
      onToggleFolder(node.id);
      onNodeSelect?.(node.id);
    } else {
      onFileSelect(node.id);
      onNodeSelect?.(node.id);
    }
  }, [isFolder, node.children?.length, inlineInput?.parentId, node.id, onToggleFolder, onNodeSelect, onFileSelect]);

  // Cleanup drag expand timer on unmount
  React.useEffect(() => {
    return () => {
      if (dragExpandTimer.current) clearTimeout(dragExpandTimer.current);
    };
  }, []);

  const handleContextMenuEvent = useCallback((e) => onContextMenu(e, node), [node, onContextMenu]);

  const handleDragStart = useCallback(
    (e) => {
      // Set the data for internal move
      e.dataTransfer.setData("application/soroban-studio-node-id", node.id);
      e.dataTransfer.effectAllowed = "move";
      
      // Update global drag state
      setDragState?.({ draggingId: node.id, dragOverId: null });
      
      // Use a custom drag image if needed, or default
      e.stopPropagation();
    },
    [node.id, setDragState],
  );

  const handleDragEnd = useCallback((e) => {
    e.preventDefault();
    setDragState?.({ draggingId: null, dragOverId: null });
  }, [setDragState]);

  const handleDragOver = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const isExternal = e.dataTransfer.types.includes("Files");
      e.dataTransfer.dropEffect = isExternal ? "copy" : "move";

      // Target resolution: if folder, target itself. If file, target parent.
      const targetId = isFolder ? node.id : (findParentId(tree, node.id) || tree[0]?.id);
      
      if (targetId && targetId !== dragState?.draggingId && targetId !== dragState?.dragOverId) {
        setDragState?.((prev) => ({ ...prev, dragOverId: targetId }));
      }

      // Auto-expand folders after hovering 600ms while dragging
      if (isFolder && !isExpanded && node.children?.length > 0 && targetId !== dragState?.draggingId) {
        if (!dragExpandTimer.current) {
          dragExpandTimer.current = setTimeout(() => {
            onToggleFolder(node.id);
            dragExpandTimer.current = null;
          }, 600);
        }
      }
    },
    [node.id, isFolder, isExpanded, node.children?.length, tree, dragState?.draggingId, dragState?.dragOverId, setDragState, onToggleFolder],
  );

  const handleDragLeave = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Only clear if we're actually leaving the node's container
      if (!e.currentTarget.contains(e.relatedTarget)) {
        if (dragState?.dragOverId === node.id) {
          setDragState?.((prev) => ({ ...prev, dragOverId: null }));
        }
        // Cancel auto-expand timer
        if (dragExpandTimer.current) {
          clearTimeout(dragExpandTimer.current);
          dragExpandTimer.current = null;
        }
      }
    },
    [node.id, dragState?.dragOverId, setDragState],
  );

  const handleDrop = useCallback(
    async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const targetFolderId = isFolder ? node.id : (findParentId(tree, node.id) || tree[0]?.id);

      const isExternal = e.dataTransfer.types.includes("Files");

      if (isExternal) {
        // Handle external file upload
        const files = e.dataTransfer.files;
        if (files?.length && onUploadFiles) {
          const filesArray = Array.from(files);
          setFolderUploadProgress?.((prev) => ({
            ...prev,
            [targetFolderId]: { current: 0, total: filesArray.length },
          }));
          for (let i = 0; i < filesArray.length; i++) {
            try {
              await onUploadFiles([filesArray[i]], targetFolderId);
            } catch (err) {
              console.error("Upload failed:", filesArray[i].name, err);
            }
            setFolderUploadProgress?.((prev) => ({
              ...prev,
              [targetFolderId]: { current: i + 1, total: filesArray.length },
            }));
          }
          setTimeout(() => {
            setFolderUploadProgress?.((prev) => {
              const next = { ...prev };
              delete next[targetFolderId];
              return next;
            });
          }, 500);
        }
      } else {
        // Handle internal move
        const draggedId = e.dataTransfer.getData("application/soroban-studio-node-id") || dragState?.draggingId;
        const finalTargetId = targetFolderId;
        
        if (draggedId && draggedId !== finalTargetId) {
          // Check if dragging onto current parent (no-op)
          const currentParentId = findParentId(tree, draggedId);
          if (currentParentId !== finalTargetId) {
            onMoveItem?.(draggedId, finalTargetId);
          }
        }
      }

      setDragState?.({ draggingId: null, dragOverId: null });
    },
    [node.id, isFolder, tree, onMoveItem, onUploadFiles, dragState?.draggingId, setDragState, setFolderUploadProgress],
  );

  const isProtected = false; // Allow moving everything for now per user feedback

  const sharedProps = {
    onContextMenu: handleContextMenuEvent,
    onDragOver: handleDragOver,
    onDragLeave: handleDragLeave,
    onDrop: handleDrop,
    draggable: !isProtected,
    onDragStart: isProtected ? undefined : handleDragStart,
    onDragEnd: isProtected ? undefined : handleDragEnd,
  };

  // Drop-only props for container areas (no draggable, no dragStart)
  const dropTargetProps = {
    onDragOver: handleDragOver,
    onDragLeave: handleDragLeave,
    onDrop: handleDrop,
  };

  /* ─── Folder rendering ─── */
  if (isFolder) {
    if (isRenaming) {
      return (
        <div className="sidebar-node">
          <div className="sidebar-inline-container" style={{ position: 'relative' }}>
            <span className="sidebar-chevron" style={{ position: "absolute", left: `${indent + 12}px`, top: '50%', transform: 'translateY(-50%)' }}>
              {isExpanded ? <ChevronDown /> : <ChevronRight />}
            </span>
            <RenameInput type="folder" depth={depth} onSubmit={onRenameSubmit} onCancel={onRenameCancel} defaultValue={node.name} isOpen={isExpanded} />
          </div>
          {isExpanded && (
            <div className="sidebar-children">
              {sortNodes(node.children)?.map((child) => (
                <ExplorerNode key={child.id} node={child} depth={depth + 1} tree={tree} expandedFolders={expandedFolders} onToggleFolder={onToggleFolder} onFileSelect={onFileSelect} activeFileId={activeFileId} onNodeSelect={onNodeSelect} selectedNodeId={selectedNodeId} inlineInput={inlineInput} onInlineSubmit={onInlineSubmit} onInlineCancel={onInlineCancel} onContextMenu={onContextMenu} renameNode={renameNode} onRenameSubmit={onRenameSubmit} onRenameCancel={onRenameCancel} onMoveItem={onMoveItem} onUploadFiles={onUploadFiles} dragState={dragState} setDragState={setDragState} clipboard={clipboard} folderUploadProgress={folderUploadProgress} setFolderUploadProgress={setFolderUploadProgress} lastSessionId={lastSessionId} setTreeData={setTreeData} />
              ))}
            </div>
          )}
        </div>
      );
    }

    const className = ["sidebar-folder", isExpanded && "expanded", isSelected && "selected", isDragOver && "drag-over", isDragging && "dragging", isCut && "cut"].filter(Boolean).join(" ");

    return (
      <div className="sidebar-node">
        <button
          className={className}
          type="button"
          onClick={handleClick}
          style={{
            paddingLeft: `${indent + 32}px`,
          }}
          {...sharedProps}>
          <span className="sidebar-chevron" style={{ position: "absolute", left: `${indent + 12}px` }}>
            {isFolder && (isExpanded ? <ChevronDown /> : <ChevronRight />)}
          </span>
          <span className="sidebar-node-icon">
            <FolderIconImg folderName={node.name} isOpen={isExpanded} size={18} />
          </span>
          <span className={`sidebar-node-label ${isCut ? "cut-label" : ""}`}>{node.name}</span>
        </button>

        {isExpanded && (
          <div className="sidebar-children">
            {folderUploadProgress?.[node.id] && (
              <div className="upload-progress-bar folder-progress" style={{ marginLeft: `${(depth + 1) * 8 + 8}px` }}>
                <div className="upload-progress-fill" style={{ width: `${(folderUploadProgress[node.id].current / folderUploadProgress[node.id].total) * 100}%` }} />
                <span className="upload-progress-text">
                  {folderUploadProgress[node.id].current}/{folderUploadProgress[node.id].total}
                </span>
              </div>
            )}
            {(() => {
              const sortedChildren = sortNodes(node.children) || [];
              const folders = sortedChildren.filter((n) => n.type === "folder");
              const files = sortedChildren.filter((n) => n.type === "file");
              const hasChildren = sortedChildren.length > 0;

              const renderExplorerNode = (child) => (
                <ExplorerNode
                  key={child.id}
                  node={child}
                  depth={depth + 1}
                  tree={tree}
                  expandedFolders={expandedFolders}
                  onToggleFolder={onToggleFolder}
                  onFileSelect={onFileSelect}
                  activeFileId={activeFileId}
                  onNodeSelect={onNodeSelect}
                  selectedNodeId={selectedNodeId}
                  inlineInput={inlineInput}
                  onInlineSubmit={onInlineSubmit}
                  onInlineCancel={onInlineCancel}
                  onContextMenu={onContextMenu}
                  renameNode={renameNode}
                  onRenameSubmit={onRenameSubmit}
                  onRenameCancel={onRenameCancel}
                  onMoveItem={onMoveItem}
                  onUploadFiles={onUploadFiles}
                  dragState={dragState}
                  setDragState={setDragState}
                  clipboard={clipboard}
                  folderUploadProgress={folderUploadProgress}
                  setFolderUploadProgress={setFolderUploadProgress}
                  lastSessionId={lastSessionId}
                  setTreeData={setTreeData}
                />
              );

              return (
                <div 
                  className={`sidebar-children-content ${!hasChildren ? "empty-folder-drop-zone" : ""}`}
                  {...dropTargetProps}
                >
                  {inlineInput?.parentId === node.id && inlineInput.type === "folder" && (
                    <InlineInput type="folder" depth={depth + 1} onSubmit={onInlineSubmit} onCancel={onInlineCancel} defaultValue="newfolder" />
                  )}
                  {folders.map(renderExplorerNode)}
                  {inlineInput?.parentId === node.id && inlineInput.type === "file" && (
                    <InlineInput type="file" depth={depth + 1} onSubmit={onInlineSubmit} onCancel={onInlineCancel} defaultValue="newfile" />
                  )}
                  {files.map(renderExplorerNode)}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    );
  }

  /* ─── File rendering ─── */
  if (isRenaming) {
    return <RenameInput type="file" depth={depth} onSubmit={onRenameSubmit} onCancel={onRenameCancel} defaultValue={node.name} />;
  }

  const fileClassName = ["sidebar-file", activeFileId === node.id && "active", isSelected && "selected", isDragging && "dragging", isCut && "cut"].filter(Boolean).join(" ");

  return (
    <button
      className={fileClassName}
      type="button"
      onClick={() => {
        onFileSelect(node.id);
        onNodeSelect?.(node.id);
      }}
      style={{
        paddingLeft: `${indent + 32}px`,
      }}
      {...sharedProps}>
      <span className="sidebar-node-icon">
        <FileIconImg filename={node.name} size={18} />
      </span>
      <span className={`sidebar-node-label ${isCut ? "cut-label" : ""}`}>{node.name}</span>
    </button>
  );
});

export default ExplorerNode;
