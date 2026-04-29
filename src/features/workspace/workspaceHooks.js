/**
 * Custom hooks for workspace state management.
 * Extracts complex state logic from Layout into composable hooks.
 */

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { loadState, saveStateSection, clearState } from "../../utils/storage";
import { uniqueId, addNodeToTree, removeNodeFromTree, renameNodeInTree, moveNodeInTree, collectFileIds, collectAllIds, cloneNodeWithNewIds, collectContentsMap, flattenTree, getNodeFromTree } from "./workspaceUtils";
import { createDefaultWorkspace, createBlankWorkspace } from "./workspaceTemplates";
import { cloneRepository } from "../../services/githubService";

/* ─── useWorkspaceState ─── */

export const useWorkspaceState = () => {
  const workspaceSeed = useMemo(() => createDefaultWorkspace(), []);
  const persistedState = useMemo(() => loadState()?.workspace, []);

  const [treeData, setTreeData] = useState(() => persistedState?.treeData || workspaceSeed.tree);
  const [fileContents, setFileContents] = useState(() => persistedState?.fileContents || workspaceSeed.contents);
  const [expandedFolders, setExpandedFolders] = useState(() => new Set(persistedState?.expandedFolders || [treeData[0]?.id ?? "root"]));

  const rootId = treeData[0]?.id ?? "root";

  const flattenedNodes = useMemo(() => flattenTree(treeData), [treeData]);

  // Persist workspace state
  useEffect(() => {
    saveStateSection("workspace", {
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
      
      // Calculate a deterministic ID based on the parent's path (which is its ID)
      // This ensures consistency with the backend scan IDs.
      const newId = targetParentId === "root" ? name : `${targetParentId}/${name}`;
      
      const newNode = { id: newId, name, type, children: [] };

      setTreeData((prev) => addNodeToTree(prev, targetParentId, newNode));
      setExpandedFolders((prev) => {
        const next = new Set(prev);
        next.add(targetParentId);
        if (type === "folder") next.add(newId);
        return next;
      });

      if (type === "file") {
        setFileContents((prev) => ({
          ...prev,
          [newId]: `// ${name}\n`,
        }));
      }

      return newId;
    },
    [rootId],
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
    [flattenedNodes],
  );

  const renameItem = useCallback((nodeId, newName) => {
    if (!newName) return;
    setTreeData((prev) => {
      const node = getNodeFromTree(prev, nodeId);
      // When renaming a folder, update the package name in any child Cargo.toml
      if (node?.type === 'folder' && node.children?.length) {
        const cargoToml = node.children.find((c) => c.type === 'file' && c.name === 'Cargo.toml');
        if (cargoToml) {
          setFileContents((prevContents) => {
            const content = prevContents[cargoToml.id];
            if (!content) return prevContents;
            // Replace the package name field in Cargo.toml
            const updated = content.replace(
              /^(name\s*=\s*")([^"]*)(")$/m,
              `$1${newName}$3`
            );
            if (updated === content) return prevContents;
            return { ...prevContents, [cargoToml.id]: updated };
          });
        }
      }
      return renameNodeInTree(prev, nodeId, newName);
    });
  }, [setFileContents]);

  const moveItem = useCallback(
    (nodeId, targetParentId) => {
      if (!nodeId || !targetParentId || nodeId === targetParentId) return;
      const target = flattenedNodes.get(targetParentId);
      if (!target || target.type !== "folder") return;

      const sourceNode = flattenedNodes.get(nodeId);
      if (!sourceNode) return;

      // Check for name collision in target folder
      const isDuplicate = target.children?.some((child) => child.name === sourceNode.name && child.id !== nodeId);
      if (isDuplicate) {
        return {
          error: "COLLISION",
          message: `A ${sourceNode.type} named "${sourceNode.name}" already exists in the target folder.`,
        };
      }

      setTreeData((prev) => moveNodeInTree(prev, nodeId, targetParentId));
      setExpandedFolders((prev) => {
        const next = new Set(prev);
        next.add(targetParentId);
        return next;
      });
    },
    [flattenedNodes],
  );

  const uploadFiles = useCallback(
    async (files, parentId) => {
      const targetParentId = parentId || rootId;

      // Helper to get unique filename
      const getUniqueFileName = (baseTree, targetId, originalName) => {
        const parentNode = baseTree.find((n) => n.id === targetId) || baseTree.flatMap((n) => n.children || []).find((n) => n.id === targetId);

        if (!parentNode) return originalName;

        const siblings = parentNode.children || [];
        const existingFiles = siblings.filter((n) => n.type === "file").map((n) => n.name);

        if (!existingFiles.includes(originalName)) {
          return originalName;
        }

        // Split name and extension
        const lastDotIndex = originalName.lastIndexOf(".");
        const hasExtension = lastDotIndex > 0;
        const baseName = hasExtension ? originalName.slice(0, lastDotIndex) : originalName;
        const extension = hasExtension ? originalName.slice(lastDotIndex) : "";

        // Find next available copy number
        let copyNum = 1;
        let newName;
        do {
          const copySuffix = copyNum === 1 ? " (copy)" : ` (copy ${copyNum})`;
          newName = baseName + copySuffix + extension;
          copyNum++;
        } while (existingFiles.includes(newName));

        return newName;
      };

      for (const file of files) {
        const newId = uniqueId();

        // Get unique filename (check current tree state)
        let finalFileName = file.name;
        setTreeData((prevTree) => {
          finalFileName = getUniqueFileName(prevTree, targetParentId, file.name);
          return prevTree; // Don't modify yet, just check
        });

        const newNode = { id: newId, name: finalFileName, type: "file", children: [] };

        const ext = finalFileName.split(".").pop()?.toLowerCase();
        const isBinary = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "ico", "pdf"].includes(ext);

        let content;
        if (isBinary) {
          const buffer = await file.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          let binary = "";
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
    [rootId],
  );

  const refreshWorkspace = useCallback(() => {
    const fresh = createDefaultWorkspace();
    setTreeData(fresh.tree);
    setFileContents(fresh.contents);
    setExpandedFolders(new Set([fresh.tree[0]?.id ?? "root"]));
    return fresh;
  }, []);

  const createProject = useCallback((type) => {
    clearState();
    const factory = type === "hello-world" ? createHelloWorldWorkspace : createBlankWorkspace;
    const { tree, contents } = factory();
    setTreeData(tree);
    setFileContents(contents);
    setExpandedFolders(new Set([tree[0]?.id]));
    return { tree, contents };
  }, []);

  const cloneFromGithub = useCallback(async (url) => {
    const { tree, contents, repoName } = await cloneRepository(url, uniqueId);
    clearState();
    setTreeData(tree);
    setFileContents(contents);
    setExpandedFolders(new Set([tree[0]?.id]));
    return { tree, contents, repoName };
  }, []);

  const clipboard = useClipboard(treeData, flattenedNodes, fileContents, setTreeData, setFileContents, setExpandedFolders);

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
    clipboard,
    setFileContents,
    setTreeData,
    setExpandedFolders,
  };
};

/* ─── useTabManager ─── */

export const useTabManager = (flattenedNodes) => {
  const persistedState = useMemo(() => loadState()?.workspace, []);

  const [tabs, setTabs] = useState(() => persistedState?.tabs || []);
  const [activeFileId, setActiveFileId] = useState(() => persistedState?.activeFileId || null);
  const [previewTabId, setPreviewTabId] = useState(() => persistedState?.previewTabId || null);
  const lastClickRef = useRef({ id: null, time: 0 });

  // Persist tabs state
  useEffect(() => {
    saveStateSection("workspace", {
      ...(loadState()?.workspace || {}),
      tabs,
      activeFileId,
      previewTabId,
    });
  }, [tabs, activeFileId, previewTabId]);

  const selectFile = useCallback(
    (nodeId) => {
      const node = flattenedNodes.get(nodeId);
      if (!node || node.type !== "file") return;

      const now = Date.now();
      const isDoubleClick = lastClickRef.current.id === nodeId && now - lastClickRef.current.time < 300;
      lastClickRef.current = { id: nodeId, time: now };

      setActiveFileId(nodeId);

      if (isDoubleClick) {
        setPreviewTabId(null);
        setTabs((prev) => (prev.includes(nodeId) ? prev : [...prev, nodeId]));
      } else {
        setTabs((prev) => {
          // If clicking an existing tab, just switch to it without changing tabs
          if (prev.includes(nodeId)) {
            return prev;
          }
          // If clicking a new file, replace the current preview tab (if any) with the new one
          const withoutPreview = prev.filter((id) => id !== previewTabId);
          return [...withoutPreview, nodeId];
        });
        // Only change preview state when clicking NEW file
        // Clicking existing permanent/preview file should not change preview state
        if (!tabs.includes(nodeId)) {
          setPreviewTabId(nodeId);
        }
      }
    },
    [flattenedNodes, previewTabId, tabs],
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
    [activeFileId, previewTabId],
  );

  const openFile = useCallback((nodeId) => {
    setActiveFileId(nodeId);
    setTabs((prev) => (prev.includes(nodeId) ? prev : [...prev, nodeId]));
  }, []);

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

export const useClipboard = (treeData, flattenedNodes, fileContents, setTreeData, setFileContents, setExpandedFolders) => {
  const [clipboard, setClipboard] = useState(null);

  const copyItem = useCallback((nodeId) => {
    setClipboard({ nodeId, operation: "copy" });
  }, []);

  const cutItem = useCallback((nodeId) => {
    setClipboard({ nodeId, operation: "cut" });
  }, []);

  const pasteItem = useCallback(
    (targetParentId) => {
      if (!clipboard?.nodeId || !clipboard?.operation) return;

      const sourceNode = flattenedNodes.get(clipboard.nodeId);
      if (!sourceNode) {
        setClipboard(null);
        return;
      }

      // Check for name collision in target folder
      const targetParent = targetParentId ? flattenedNodes.get(targetParentId) : null;
      const targetChildren = targetParent ? targetParent.children : treeData;
      const collisionNode = targetChildren?.find((child) => child.name === sourceNode.name && child.id !== sourceNode.id);

      if (collisionNode) {
        return { 
          error: "COLLISION", 
          message: `A ${sourceNode.type} named "${sourceNode.name}" already exists in the target location.` 
        };
      }

      if (clipboard.operation === "copy") {
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
      } else if (clipboard.operation === "cut") {
        setTreeData((prev) => moveNodeInTree(prev, clipboard.nodeId, targetParentId));
      }

      if (clipboard.operation === "cut") {
        setClipboard(null);
      }

      setExpandedFolders((prev) => {
        const next = new Set(prev);
        next.add(targetParentId);
        return next;
      });
    },
    [clipboard, flattenedNodes, fileContents, setTreeData, setFileContents, setExpandedFolders],
  );

  return { clipboard, setClipboard, copyItem, cutItem, pasteItem };
};
