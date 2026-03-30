import React, { memo, useCallback } from 'react';
import { FileIconImg, FolderIconImg } from '../../components/icons/FileIcon';
import { ChevronDown, ChevronRight } from '../../components/icons/ChevronIcons';
import { sortNodes, findParentId } from '../workspace/workspaceUtils';
import InlineInput from './InlineInput';
import RenameInput from './RenameInput';

/**
 * Recursive tree node component for the file explorer.
 * Renders a single file or folder with all its interactions.
 */
const ExplorerNode = memo(({
  node,
  depth,
  tree,
  expandedFolders,
  onToggleFolder,
  onFileSelect,
  activeFileId,
  onSelectFolder,
  selectedFolderId,
  inlineInput,
  onInlineSubmit,
  onInlineCancel,
  onContextMenu,
  renameNode,
  onRenameSubmit,
  onRenameCancel,
  onMoveItem,
  onUploadFiles,
  dragState,
  setDragState,
  clipboard,
  folderUploadProgress,
  setFolderUploadProgress,
}) => {
  const isFolder = node.type === 'folder';
  const isExpanded = expandedFolders.has(node.id);
  const isSelected = selectedFolderId === node.id;
  const isRenaming = renameNode?.id === node.id;
  const isDragging = dragState?.draggingId === node.id;
  const isDragOver = dragState?.dragOverId === node.id;
  const isCut = clipboard?.nodeId === node.id && clipboard?.operation === 'cut';
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
    (e) => onContextMenu(e, node),
    [node, onContextMenu]
  );

  const handleDragStart = useCallback(
    (e) => {
      e.dataTransfer.setData('text/plain', node.id);
      e.dataTransfer.effectAllowed = 'move';
      setDragState?.({ draggingId: node.id, dragOverId: null });
    },
    [node.id, setDragState]
  );

  const handleDragEnd = useCallback(() => {
    setDragState?.({ draggingId: null, dragOverId: null });
  }, [setDragState]);

  const handleDrop = useCallback(
    async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const isExternal = e.dataTransfer.types.includes('Files');
      const targetFolderId = isFolder ? node.id : findParentId(tree, node.id);

      if (isExternal) {
        const files = e.dataTransfer.files;
        if (files?.length && onUploadFiles && targetFolderId) {
          const filesArray = Array.from(files);
          setFolderUploadProgress?.((prev) => ({
            ...prev,
            [targetFolderId]: { current: 0, total: filesArray.length },
          }));
          for (let i = 0; i < filesArray.length; i++) {
            try {
              await onUploadFiles([filesArray[i]], targetFolderId);
            } catch (err) {
              console.error('Upload failed:', filesArray[i].name, err);
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
        const draggedId = e.dataTransfer.getData('text/plain');
        if (draggedId && draggedId !== node.id && targetFolderId) {
          onMoveItem?.(draggedId, targetFolderId);
        }
      }
      setDragState?.({ draggingId: null, dragOverId: null });
    },
    [node.id, isFolder, tree, onMoveItem, onUploadFiles, setDragState, setFolderUploadProgress]
  );

  const handleDragOver = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isExternal = e.dataTransfer.types.includes('Files');
      e.dataTransfer.dropEffect = isExternal ? 'copy' : 'move';
      const targetId = isFolder ? node.id : findParentId(tree, node.id);
      if (targetId && dragState?.dragOverId !== targetId) {
        setDragState?.({ ...dragState, dragOverId: targetId });
      }
    },
    [node.id, isFolder, tree, dragState, setDragState]
  );

  const handleDragLeave = useCallback(
    (e) => {
      e.preventDefault();
      if (!e.currentTarget.contains(e.relatedTarget)) {
        if (dragState?.dragOverId === node.id || dragState?.dragOverId === findParentId(tree, node.id)) {
          setDragState?.({ ...dragState, dragOverId: null });
        }
      }
    },
    [node.id, tree, dragState, setDragState]
  );

  const sharedProps = {
    onContextMenu: handleContextMenuEvent,
    onDragOver: handleDragOver,
    onDragLeave: handleDragLeave,
    onDrop: handleDrop,
    draggable: true,
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
  };

  /* ─── Folder rendering ─── */
  if (isFolder) {
    if (isRenaming) {
      return (
        <div className="sidebar-node">
          <RenameInput type="folder" depth={depth} onSubmit={onRenameSubmit} onCancel={onRenameCancel} defaultValue={node.name} />
        </div>
      );
    }

    const className = [
      'sidebar-folder',
      isExpanded && 'expanded',
      isSelected && 'selected',
      isDragOver && 'drag-over',
      isDragging && 'dragging',
      isCut && 'cut',
    ].filter(Boolean).join(' ');

    return (
      <div className="sidebar-node">
        <button
          className={className}
          type="button"
          onClick={handleClick}
          style={{ paddingLeft: `${indent + 12}px` }}
          {...sharedProps}
        >
          <span className="sidebar-chevron">{isExpanded ? <ChevronDown /> : <ChevronRight />}</span>
          <span className="sidebar-node-icon">
            <FolderIconImg folderName={node.name} isOpen={isExpanded} size={16} />
          </span>
          <span className={`sidebar-node-label ${isCut ? 'cut-label' : ''}`}>{node.name}</span>
        </button>

        {isExpanded && (
          <div className="sidebar-children">
            {inlineInput?.parentId === node.id && (
              <InlineInput
                type={inlineInput.type}
                depth={depth + 1}
                onSubmit={onInlineSubmit}
                onCancel={onInlineCancel}
                defaultValue={inlineInput.type === 'file' ? 'newfile' : 'newfolder'}
              />
            )}
            {folderUploadProgress?.[node.id] && (
              <div className="upload-progress-bar folder-progress" style={{ marginLeft: `${(depth + 1) * 18 + 12}px` }}>
                <div className="upload-progress-fill" style={{ width: `${(folderUploadProgress[node.id].current / folderUploadProgress[node.id].total) * 100}%` }} />
                <span className="upload-progress-text">
                  {folderUploadProgress[node.id].current}/{folderUploadProgress[node.id].total}
                </span>
              </div>
            )}
            {sortNodes(node.children)?.map((child) => (
              <ExplorerNode
                key={child.id}
                node={child}
                depth={depth + 1}
                tree={tree}
                expandedFolders={expandedFolders}
                onToggleFolder={onToggleFolder}
                onFileSelect={onFileSelect}
                activeFileId={activeFileId}
                onSelectFolder={onSelectFolder}
                selectedFolderId={selectedFolderId}
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
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ─── File rendering ─── */
  if (isRenaming) {
    return <RenameInput type="file" depth={depth} onSubmit={onRenameSubmit} onCancel={onRenameCancel} defaultValue={node.name} />;
  }

  const fileClassName = [
    'sidebar-file',
    activeFileId === node.id && 'active',
    isDragging && 'dragging',
    isCut && 'cut',
  ].filter(Boolean).join(' ');

  return (
    <button
      className={fileClassName}
      type="button"
      onClick={() => onFileSelect(node.id)}
      style={{ paddingLeft: `${indent + 40}px` }}
      {...sharedProps}
    >
      <span className="sidebar-node-icon">
        <FileIconImg filename={node.name} size={16} />
      </span>
      <span className={`sidebar-node-label ${isCut ? 'cut-label' : ''}`}>{node.name}</span>
    </button>
  );
});

export default ExplorerNode;
