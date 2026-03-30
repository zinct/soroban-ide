/**
 * Custom hooks for workspace state management.
 * Extracts complex state logic from Layout into composable hooks.
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { loadState, saveStateSection, clearState } from '../../utils/storage';
import {
  uniqueId,
  addNodeToTree,
  removeNodeFromTree,
  renameNodeInTree,
  moveNodeInTree,
  collectFileIds,
  collectAllIds,
  cloneNodeWithNewIds,
  collectContentsMap,
  flattenTree,
} from './workspaceUtils';
import {
  createDefaultWorkspace,
  createHelloWorldWorkspace,
  createBlankWorkspace,
  DEFAULT_TEMPLATES,
} from './workspaceTemplates';

/* ─── useWorkspaceState ─── */

export const useWorkspaceState = () => {
  const workspaceSeed = useMemo(() => createDefaultWorkspace(), []);
  const persistedState = useMemo(() => loadState()?.workspace, []);

  const [treeData, setTreeData] = useState(
    () => persistedState?.treeData || workspaceSeed.tree
  );
  const [fileContents, setFileContents] = useState(
    () => persistedState?.fileContents || workspaceSeed.contents
  );
  const [expandedFolders, setExpandedFolders] = useState(
    () => new Set(persistedState?.expandedFolders || [treeData[0]?.id ?? 'root'])
  );

  const rootId = treeData[0]?.id ?? 'root';

  const flattenedNodes = useMemo(() => flattenTree(treeData), [treeData]);

  // Persist workspace state
  useEffect(() => {
    saveStateSection('workspace', {
      treeData,
      fileContents,
      expandedFolders: Array.from(expandedFolders),
    });
  }, [treeData, fileContents, expandedFolders]);

  const toggleFolder = useCallback((folderId) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      next.has(folderId) ? next.delete(folderId) : next.add(folderId);
      return next;
    });
  }, []);

  const collapseAll = useCallback(() => {
    setExpandedFolders(new Set([rootId]));
  }, [rootId]);

  const addItem = useCallback(
    (type, name, parentId) => {
      if (!name) return null;
      const targetParentId = parentId || rootId;
      const newId = uniqueId();
      const newNode = { id: newId, name, type, children: [] };

      setTreeData((prev) => addNodeToTree(prev, targetParentId, newNode));
      setExpandedFolders((prev) => {
        const next = new Set(prev);
        next.add(targetParentId);
        if (type === 'folder') next.add(newId);
        return next;
      });

      if (type === 'file') {
        setFileContents((prev) => ({
          ...prev,
          [newId]: DEFAULT_TEMPLATES[name] ?? `// ${name}\n`,
        }));
      }

      return newId;
    },
    [rootId]
  );

  const deleteItem = useCallback(
    (nodeId) => {
      const node = flattenedNodes.get(nodeId);
      if (!node) return [];

      const fileIdsToDelete = collectFileIds(node);
      const allIdsToDelete = collectAllIds(node);

      setTreeData((prev) => removeNodeFromTree(prev, nodeId));

      if (fileIdsToDelete.length > 0) {
        setFileContents((prev) => {
          const next = { ...prev };
          fileIdsToDelete.forEach((id) => delete next[id]);
          return next;
        });
      }

      setExpandedFolders((prev) => {
        const next = new Set(prev);
        allIdsToDelete.forEach((id) => next.delete(id));
        return next;
      });

      return fileIdsToDelete;
    },
    [flattenedNodes]
  );

  const renameItem = useCallback((nodeId, newName) => {
    if (!newName) return;
    setTreeData((prev) => renameNodeInTree(prev, nodeId, newName));
  }, []);

  const moveItem = useCallback(
    (nodeId, targetParentId) => {
      if (!nodeId || !targetParentId || nodeId === targetParentId) return;
      const target = flattenedNodes.get(targetParentId);
      if (!target || target.type !== 'folder') return;

      setTreeData((prev) => moveNodeInTree(prev, nodeId, targetParentId));
      setExpandedFolders((prev) => {
        const next = new Set(prev);
        next.add(targetParentId);
        return next;
      });
    },
    [flattenedNodes]
  );

  const uploadFiles = useCallback(
    async (files, parentId) => {
      const targetParentId = parentId || rootId;

      for (const file of files) {
        const newId = uniqueId();
        const newNode = { id: newId, name: file.name, type: 'file', children: [] };

        const ext = file.name.split('.').pop()?.toLowerCase();
        const isBinary = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico', 'pdf'].includes(ext);

        let content;
        if (isBinary) {
          const buffer = await file.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          content = btoa(binary);
        } else {
          content = await file.text();
        }

        setTreeData((prev) => addNodeToTree(prev, targetParentId, newNode));
        setFileContents((prev) => ({ ...prev, [newId]: content }));
      }

      setExpandedFolders((prev) => {
        const next = new Set(prev);
        next.add(targetParentId);
        return next;
      });
    },
    [rootId]
  );

  const refreshWorkspace = useCallback(() => {
    const fresh = createDefaultWorkspace();
    setTreeData(fresh.tree);
    setFileContents(fresh.contents);
    setExpandedFolders(new Set([fresh.tree[0]?.id ?? 'root']));
    return fresh;
  }, []);

  const createProject = useCallback((type) => {
    clearState();
    const factory = type === 'hello-world' ? createHelloWorldWorkspace : createBlankWorkspace;
    const { tree, contents } = factory();
    setTreeData(tree);
    setFileContents(contents);
    setExpandedFolders(new Set([tree[0]?.id]));
    return { tree, contents };
  }, []);

  const cloneFromGithub = useCallback(async (url) => {
    clearState();
    const repoName = url.split('/').pop()?.replace('.git', '') || 'cloned-repo';
    const rootNodeId = uniqueId();
    const readmeId = uniqueId();

    const tree = [
      {
        id: rootNodeId,
        name: repoName,
        type: 'folder',
        children: [{ id: readmeId, name: 'README.md', type: 'file', children: [] }],
      },
    ];
    const contents = {
      [readmeId]: `# ${repoName}\n\nCloned from ${url}\n\nThis is a cloned repository.`,
    };

    setTreeData(tree);
    setFileContents(contents);
    setExpandedFolders(new Set([rootNodeId]));
    return { tree, contents };
  }, []);

  return {
    treeData,
    fileContents,
    expandedFolders,
    flattenedNodes,
    rootId,
    toggleFolder,
    collapseAll,
    addItem,
    deleteItem,
    renameItem,
    moveItem,
    uploadFiles,
    refreshWorkspace,
    createProject,
    cloneFromGithub,
    setFileContents,
  };
};

/* ─── useTabManager ─── */

export const useTabManager = (flattenedNodes) => {
  const persistedState = useMemo(() => loadState()?.workspace, []);

  const [tabs, setTabs] = useState(() => persistedState?.tabs || []);
  const [activeFileId, setActiveFileId] = useState(() => persistedState?.activeFileId || null);
  const [previewTabId, setPreviewTabId] = useState(null);
  const lastClickRef = useRef({ id: null, time: 0 });

  // Persist tabs state
  useEffect(() => {
    saveStateSection('workspace', {
      ...(loadState()?.workspace || {}),
      tabs,
      activeFileId,
    });
  }, [tabs, activeFileId]);

  const selectFile = useCallback(
    (nodeId) => {
      const node = flattenedNodes.get(nodeId);
      if (!node || node.type !== 'file') return;

      const now = Date.now();
      const isDoubleClick =
        lastClickRef.current.id === nodeId && now - lastClickRef.current.time < 300;
      lastClickRef.current = { id: nodeId, time: now };

      setActiveFileId(nodeId);

      if (isDoubleClick) {
        setPreviewTabId(null);
        setTabs((prev) => (prev.includes(nodeId) ? prev : [...prev, nodeId]));
      } else {
        setTabs((prev) => {
          const withoutPreview = prev.filter((id) => id !== previewTabId);
          return withoutPreview.includes(nodeId)
            ? withoutPreview
            : [...withoutPreview, nodeId];
        });
        setPreviewTabId(nodeId);
      }
    },
    [flattenedNodes, previewTabId]
  );

  const closeTab = useCallback(
    (nodeId) => {
      setTabs((prev) => {
        const filtered = prev.filter((id) => id !== nodeId);
        if (activeFileId === nodeId) {
          setActiveFileId(filtered[filtered.length - 1] ?? null);
        }
        return filtered;
      });
      if (previewTabId === nodeId) setPreviewTabId(null);
    },
    [activeFileId, previewTabId]
  );

  const openFile = useCallback(
    (nodeId) => {
      setActiveFileId(nodeId);
      setTabs((prev) => (prev.includes(nodeId) ? prev : [...prev, nodeId]));
    },
    []
  );

  const resetTabs = useCallback(() => {
    setTabs([]);
    setActiveFileId(null);
    setPreviewTabId(null);
  }, []);

  return {
    tabs,
    activeFileId,
    previewTabId,
    selectFile,
    closeTab,
    openFile,
    resetTabs,
    setActiveFileId,
    setPreviewTabId,
  };
};

/* ─── useClipboard ─── */

export const useClipboard = (flattenedNodes, fileContents, setTreeData, setFileContents, setExpandedFolders) => {
  const [clipboard, setClipboard] = useState(null);

  const copyItem = useCallback((nodeId) => {
    setClipboard({ nodeId, operation: 'copy' });
  }, []);

  const cutItem = useCallback((nodeId) => {
    setClipboard({ nodeId, operation: 'cut' });
  }, []);

  const pasteItem = useCallback(
    (targetParentId) => {
      if (!clipboard?.nodeId || !clipboard?.operation) return;

      const sourceNode = flattenedNodes.get(clipboard.nodeId);
      if (!sourceNode) {
        setClipboard(null);
        return;
      }

      if (clipboard.nodeId === targetParentId) return;

      if (clipboard.operation === 'copy') {
        const idMapping = {};
        const cloned = cloneNodeWithNewIds(sourceNode, idMapping);

        setTreeData((prev) => addNodeToTree(prev, targetParentId, cloned.node));

        const sourceContents = collectContentsMap(sourceNode, fileContents);
        if (Object.keys(sourceContents).length > 0) {
          setFileContents((prev) => {
            const next = { ...prev };
            for (const [oldId, content] of Object.entries(sourceContents)) {
              const newId = idMapping[oldId];
              if (newId) next[newId] = content;
            }
            return next;
          });
        }
      } else if (clipboard.operation === 'cut') {
        setTreeData((prev) => moveNodeInTree(prev, clipboard.nodeId, targetParentId));
        setClipboard(null);
      }

      setExpandedFolders((prev) => {
        const next = new Set(prev);
        next.add(targetParentId);
        return next;
      });
    },
    [clipboard, flattenedNodes, fileContents, setTreeData, setFileContents, setExpandedFolders]
  );

  return { clipboard, setClipboard, copyItem, cutItem, pasteItem };
};
