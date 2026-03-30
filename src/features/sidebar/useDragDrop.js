/**
 * Custom hook for drag-and-drop operations in the sidebar.
 */

import { useState, useCallback } from 'react';
import { findParentId } from '../workspace/workspaceUtils';

export const useDragDrop = ({ tree, onMoveItem, onUploadFiles }) => {
  const [dragState, setDragState] = useState({ draggingId: null, dragOverId: null });

  const handleDragStart = useCallback(
    (e, nodeId) => {
      e.dataTransfer.setData('text/plain', nodeId);
      e.dataTransfer.effectAllowed = 'move';
      setDragState({ draggingId: nodeId, dragOverId: null });
    },
    []
  );

  const handleDragEnd = useCallback(() => {
    setDragState({ draggingId: null, dragOverId: null });
  }, []);

  const handleDragOver = useCallback(
    (e, nodeId, isFolder) => {
      e.preventDefault();
      e.stopPropagation();

      const isExternal = e.dataTransfer.types.includes('Files');
      e.dataTransfer.dropEffect = isExternal ? 'copy' : 'move';

      const targetId = isFolder ? nodeId : findParentId(tree, nodeId);
      if (targetId && dragState?.dragOverId !== targetId) {
        setDragState((prev) => ({ ...prev, dragOverId: targetId }));
      }
    },
    [tree, dragState?.dragOverId]
  );

  const handleDragLeave = useCallback(
    (e, nodeId) => {
      e.preventDefault();
      if (!e.currentTarget.contains(e.relatedTarget)) {
        const targetId = findParentId(tree, nodeId);
        if (dragState?.dragOverId === nodeId || dragState?.dragOverId === targetId) {
          setDragState((prev) => ({ ...prev, dragOverId: null }));
        }
      }
    },
    [tree, dragState?.dragOverId]
  );

  const handleDrop = useCallback(
    async (e, nodeId, isFolder, setFolderUploadProgress) => {
      e.preventDefault();
      e.stopPropagation();

      const isExternal = e.dataTransfer.types.includes('Files');
      const targetFolderId = isFolder ? nodeId : findParentId(tree, nodeId);

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
        if (draggedId && draggedId !== nodeId && targetFolderId) {
          onMoveItem?.(draggedId, targetFolderId);
        }
      }

      setDragState({ draggingId: null, dragOverId: null });
    },
    [tree, onMoveItem, onUploadFiles]
  );

  return {
    dragState,
    setDragState,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
};
