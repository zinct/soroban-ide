import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import Sidebar from "./Sidebar";
import Tabs from "./Tabs";
import Editor from "./Editor";
import Terminal from "./Terminal";

const baseWorkspace = [
  {
    id: "root",
    name: "soroban-studio",
    type: "folder",
    children: [
      {
        id: "src",
        name: "src",
        type: "folder",
        children: [
          {
            id: "main_rs",
            name: "main.rs",
            type: "file",
            children: [],
          },
          {
            id: "lib_rs",
            name: "lib.rs",
            type: "file",
            children: [],
          },
        ],
      },
      {
        id: "tests",
        name: "tests",
        type: "folder",
        children: [
          {
            id: "test_main",
            name: "main_test.rs",
            type: "file",
            children: [],
          },
        ],
      },
      {
        id: "cargo",
        name: "Cargo.toml",
        type: "file",
        children: [],
      },
      {
        id: "readme",
        name: "README.md",
        type: "file",
        children: [],
      },
    ],
  },
];

const defaultFileTemplates = {
  "main.rs": `fn main() {
    println!("Hello, Soroban Studio!");
}
`,
  "lib.rs": `pub fn greet() -> &'static str {
    "Soroban Studio"
}
`,
  "main_test.rs": `#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_works() {
        assert_eq!(greet(), "Soroban Studio");
    }
}
`,
  "Cargo.toml": `[package]
name = "soroban-studio"
version = "0.1.0"
edition = "2021"

[dependencies]
`,
  "README.md": `# Soroban Studio

VS Code inspired editor powered by Monaco.
`,
};

const cloneTree = (input) => JSON.parse(JSON.stringify(input));

const createWorkspace = () => {
  const tree = cloneTree(baseWorkspace);
  const contents = {};

  const createContents = (nodes) => {
    nodes.forEach((node) => {
      if (node.type === "file") {
        contents[node.id] = defaultFileTemplates[node.name] ?? `// ${node.name}\n`;
      }
      if (node.children?.length) {
        createContents(node.children);
      }
    });
  };

  createContents(tree);
  return { tree, contents };
};

const addNodeToTree = (nodes, parentId, newNode) => {
  return nodes.map((node) => {
    if (node.id === parentId && node.type === "folder") {
      // Insert and sort: folders first alphabetically, then files alphabetically
      const newChildren = [...node.children, newNode].sort((a, b) => {
        const aIsFolder = a.type === "folder";
        const bIsFolder = b.type === "folder";
        if (aIsFolder && !bIsFolder) return -1;
        if (!aIsFolder && bIsFolder) return 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      });
      return {
        ...node,
        children: newChildren,
      };
    }
    if (node.children?.length) {
      return {
        ...node,
        children: addNodeToTree(node.children, parentId, newNode),
      };
    }
    return node;
  });
};

const removeNodeFromTree = (nodes, nodeId) => {
  return nodes
    .map((node) => {
      if (node.id === nodeId) {
        return null;
      }
      if (node.children?.length) {
        return {
          ...node,
          children: removeNodeFromTree(node.children, nodeId),
        };
      }
      return node;
    })
    .filter(Boolean);
};

const renameNodeInTree = (nodes, nodeId, newName) => {
  return nodes.map((node) => {
    if (node.id === nodeId) {
      return {
        ...node,
        name: newName,
      };
    }
    if (node.children?.length) {
      return {
        ...node,
        children: renameNodeInTree(node.children, nodeId, newName),
      };
    }
    return node;
  });
};

const findParentId = (nodes, targetId, parentId = null) => {
  for (const node of nodes) {
    if (node.id === targetId) {
      return parentId;
    }
    if (node.children?.length) {
      const found = findParentId(node.children, targetId, node.id);
      if (found !== null) {
        return found;
      }
    }
  }
  return null;
};

// Helper to collect all file IDs from a subtree
const collectFileIds = (node) => {
  const fileIds = [];
  if (node.type === "file") {
    fileIds.push(node.id);
  }
  if (node.children?.length) {
    for (const child of node.children) {
      fileIds.push(...collectFileIds(child));
    }
  }
  return fileIds;
};

// Helper to collect all node IDs from a subtree
const collectAllIds = (node) => {
  const ids = [node.id];
  if (node.children?.length) {
    for (const child of node.children) {
      ids.push(...collectAllIds(child));
    }
  }
  return ids;
};

const getNodeFromTree = (nodes, nodeId) => {
  for (const node of nodes) {
    if (node.id === nodeId) {
      return node;
    }
    if (node.children?.length) {
      const found = getNodeFromTree(node.children, nodeId);
      if (found) return found;
    }
  }
  return null;
};

const moveNodeInTree = (nodes, nodeId, targetParentId) => {
  // First, find and clone the node to move
  const nodeToMove = getNodeFromTree(nodes, nodeId);
  if (!nodeToMove) return nodes;

  // Prevent moving a folder into its own descendant
  const isDescendant = (parentId, childId, treeNodes) => {
    const parent = getNodeFromTree(treeNodes, parentId);
    if (!parent || !parent.children) return false;
    for (const child of parent.children) {
      if (child.id === childId) return true;
      if (isDescendant(child.id, childId, treeNodes)) return true;
    }
    return false;
  };

  if (isDescendant(nodeId, targetParentId, nodes)) {
    return nodes; // Cannot move parent into its own child
  }

  // Remove node from its current location
  const removeNode = (treeNodes) => {
    return treeNodes
      .map((node) => {
        if (node.id === nodeId) {
          return null;
        }
        if (node.children?.length) {
          return {
            ...node,
            children: removeNode(node.children),
          };
        }
        return node;
      })
      .filter(Boolean);
  };

  // Add node to target parent
  const addNode = (treeNodes) => {
    return treeNodes.map((node) => {
      if (node.id === targetParentId && node.type === "folder") {
        // Insert and sort: folders first alphabetically, then files alphabetically
        const newChildren = [...node.children, nodeToMove].sort((a, b) => {
          const aIsFolder = a.type === "folder";
          const bIsFolder = b.type === "folder";
          if (aIsFolder && !bIsFolder) return -1;
          if (!aIsFolder && bIsFolder) return 1;
          return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
        });
        return {
          ...node,
          children: newChildren,
        };
      }
      if (node.children?.length) {
        return {
          ...node,
          children: addNode(node.children),
        };
      }
      return node;
    });
  };

  const treeWithoutNode = removeNode(nodes);
  return addNode(treeWithoutNode);
};

const uniqueId = () => {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `node-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const getLanguageFromName = (name) => {
  if (!name) return "rust";
  const ext = name.split(".").at(-1)?.toLowerCase();
  const map = {
    rs: "rust",
    toml: "toml",
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    md: "markdown",
  };
  return map[ext] ?? "rust";
};

const Layout = () => {
  const workspaceSeed = useMemo(() => createWorkspace(), []);
  const rootId = workspaceSeed.tree[0]?.id ?? "root";

  const [treeData, setTreeData] = useState(workspaceSeed.tree);
  const [fileContents, setFileContents] = useState(workspaceSeed.contents);
  const [expandedFolders, setExpandedFolders] = useState(() => new Set([rootId]));
  const [tabs, setTabs] = useState([]);
  const [activeFileId, setActiveFileId] = useState(null);
  const [previewTabId, setPreviewTabId] = useState(null);
  const [clipboard, setClipboard] = useState(null);
  const lastClickRef = useRef({ id: null, time: 0 });

  const flattenedNodes = useMemo(() => {
    const map = new Map();
    const traverse = (nodes, currentPath = "") => {
      nodes.forEach((node) => {
        const path = currentPath ? `${currentPath}/${node.name}` : node.name;
        map.set(node.id, { ...node, path });
        if (node.children?.length) {
          traverse(node.children, path);
        }
      });
    };
    traverse(treeData);
    return map;
  }, [treeData]);

  const activeFile = activeFileId ? flattenedNodes.get(activeFileId) : null;
  const activeContent = activeFileId ? fileContents[activeFileId] : "";
  const language = activeFile ? getLanguageFromName(activeFile.name) : "rust";

  const handleSelectFile = useCallback(
    (nodeId) => {
      const node = flattenedNodes.get(nodeId);
      if (!node || node.type !== "file") return;

      const now = Date.now();
      const isDoubleClick = lastClickRef.current.id === nodeId && now - lastClickRef.current.time < 300;
      lastClickRef.current = { id: nodeId, time: now };

      setActiveFileId(nodeId);

      if (isDoubleClick) {
        // Double-click: make tab permanent
        setPreviewTabId(null);
        setTabs((prev) => (prev.includes(nodeId) ? prev : [...prev, nodeId]));
      } else {
        // Single-click: open in preview mode
        setTabs((prev) => {
          // Remove existing preview tab if any
          const withoutPreview = prev.filter((id) => id !== previewTabId);
          // Add new preview tab if not already permanent
          if (!withoutPreview.includes(nodeId)) {
            return [...withoutPreview, nodeId];
          }
          return withoutPreview;
        });
        setPreviewTabId(nodeId);
      }
    },
    [flattenedNodes, previewTabId]
  );

  const handleCloseTab = useCallback(
    (nodeId) => {
      setTabs((prev) => {
        const filtered = prev.filter((id) => id !== nodeId);
        if (activeFileId === nodeId) {
          const nextActive = filtered[filtered.length - 1] ?? null;
          setActiveFileId(nextActive);
        }
        return filtered;
      });
      if (previewTabId === nodeId) {
        setPreviewTabId(null);
      }
    },
    [activeFileId, previewTabId]
  );

  const handleToggleFolder = useCallback((folderId) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

  const handleCollapseAll = useCallback(() => {
    // Collapse all except root folder (soroban-studio)
    setExpandedFolders(new Set([rootId]));
  }, [rootId]);

  const handleRefresh = useCallback(() => {
    const fresh = createWorkspace();
    setTreeData(fresh.tree);
    setFileContents(fresh.contents);
    setTabs([]);
    setActiveFileId(null);
    setExpandedFolders(new Set([fresh.tree[0]?.id ?? "root"]));
  }, []);

  const handleNewItem = useCallback(
    (type, name, parentId) => {
      if (!name) return;
      const targetParentId = parentId || rootId;
      const newId = uniqueId();
      const newNode = {
        id: newId,
        name,
        type,
        children: [],
      };

      setTreeData((prev) => addNodeToTree(prev, targetParentId, newNode));
      setExpandedFolders((prev) => {
        const next = new Set(prev);
        next.add(targetParentId);
        if (type === "folder") {
          next.add(newId);
        }
        return next;
      });

      if (type === "file") {
        setFileContents((prev) => ({
          ...prev,
          [newId]: defaultFileTemplates[name] ?? `// ${name}\n`,
        }));
        setTabs((prev) => (prev.includes(newId) ? prev : [...prev, newId]));
        setActiveFileId(newId);
      }
    },
    [rootId]
  );

  const handleDeleteItem = useCallback(
    (nodeId) => {
      const node = flattenedNodes.get(nodeId);
      if (!node) return;

      // Collect all file IDs to clean up
      const fileIdsToDelete = collectFileIds(node);
      const allIdsToDelete = collectAllIds(node);

      // Remove from tree
      setTreeData((prev) => removeNodeFromTree(prev, nodeId));

      // Remove file contents for all files in the deleted folder
      if (fileIdsToDelete.length > 0) {
        setFileContents((prev) => {
          const next = { ...prev };
          for (const fileId of fileIdsToDelete) {
            delete next[fileId];
          }
          return next;
        });

        // Close tabs for all deleted files
        for (const fileId of fileIdsToDelete) {
          if (tabs.includes(fileId)) {
            handleCloseTab(fileId);
          }
        }
      }

      // Remove from expanded folders (all descendants)
      setExpandedFolders((prev) => {
        const next = new Set(prev);
        for (const id of allIdsToDelete) {
          next.delete(id);
        }
        return next;
      });
    },
    [flattenedNodes, tabs, handleCloseTab]
  );

  const handleRenameItem = useCallback(
    (nodeId, newName) => {
      if (!newName) return;

      const node = flattenedNodes.get(nodeId);
      if (!node) return;

      // Rename in tree
      setTreeData((prev) => renameNodeInTree(prev, nodeId, newName));

      // No need to update file contents - the content stays the same, only the name changes
      // The fileId remains the same, so the content key remains valid
    },
    [flattenedNodes]
  );

  const handleMoveItem = useCallback(
    (nodeId, targetParentId) => {
      if (!nodeId || !targetParentId) return;
      if (nodeId === targetParentId) return; // Can't move into itself

      const node = flattenedNodes.get(nodeId);
      const targetParent = flattenedNodes.get(targetParentId);

      if (!node || !targetParent) return;
      if (targetParent.type !== "folder") return; // Can only drop into folders

      // Check if target is a descendant of the node being moved
      const isDescendant = (parentId, childId) => {
        const parent = flattenedNodes.get(parentId);
        if (!parent || !parent.children) return false;
        for (const child of parent.children) {
          if (child.id === childId) return true;
          if (isDescendant(child.id, childId)) return true;
        }
        return false;
      };

      if (isDescendant(nodeId, targetParentId)) {
        return; // Cannot move parent into its own child
      }

      // Move node in tree
      setTreeData((prev) => moveNodeInTree(prev, nodeId, targetParentId));

      // Expand target folder
      setExpandedFolders((prev) => {
        const next = new Set(prev);
        next.add(targetParentId);
        return next;
      });
    },
    [flattenedNodes]
  );

  const handleUploadFiles = useCallback(
    async (files, parentId) => {
      const targetParentId = parentId || rootId;

      for (const file of files) {
        const newId = uniqueId();
        const newNode = {
          id: newId,
          name: file.name,
          type: "file",
          children: [],
        };

        // Read file content - use appropriate method based on file type
        const ext = file.name.split(".").pop()?.toLowerCase();
        const isBinary = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "ico", "pdf"].includes(ext);

        let content;
        if (isBinary) {
          // For binary files, read as array buffer and convert to base64
          const buffer = await file.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          let binary = "";
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          content = btoa(binary);
        } else {
          // For text files, read as text
          content = await file.text();
        }

        // Add to tree
        setTreeData((prev) => addNodeToTree(prev, targetParentId, newNode));

        // Add content
        setFileContents((prev) => ({
          ...prev,
          [newId]: content,
        }));
      }

      // Expand target folder
      setExpandedFolders((prev) => {
        const next = new Set(prev);
        next.add(targetParentId);
        return next;
      });
    },
    [rootId]
  );

  const handleEditorChange = useCallback(
    (value) => {
      if (!activeFileId) return;
      setFileContents((prev) => ({
        ...prev,
        [activeFileId]: value,
      }));
    },
    [activeFileId]
  );

  // Helper to deep clone a node with new IDs and return ID mapping
  const cloneNodeWithNewIds = useCallback((node, idMapping = {}) => {
    const newId = uniqueId();
    idMapping[node.id] = newId;

    const cloned = {
      id: newId,
      name: node.name,
      type: node.type,
      children: [],
    };

    // For folders, recursively clone children
    if (node.children?.length) {
      for (const child of node.children) {
        const childClone = cloneNodeWithNewIds(child, idMapping);
        cloned.children.push(childClone.node);
      }
    }

    return { node: cloned, idMapping };
  }, []);

  // Helper to collect all file contents recursively
  const collectContentsMap = useCallback((node, contents, result = {}) => {
    if (node.type === "file" && contents[node.id] !== undefined) {
      result[node.id] = contents[node.id];
    }
    if (node.children?.length) {
      for (const child of node.children) {
        collectContentsMap(child, contents, result);
      }
    }
    return result;
  }, []);

  const handleCopyItem = useCallback(
    (nodeId) => {
      setClipboard({ nodeId, operation: "copy" });
    },
    [setClipboard]
  );

  const handleCutItem = useCallback(
    (nodeId) => {
      setClipboard({ nodeId, operation: "cut" });
    },
    [setClipboard]
  );

  const handlePasteItem = useCallback(
    (targetParentId) => {
      if (!clipboard?.nodeId || !clipboard?.operation) return;

      const sourceNode = flattenedNodes.get(clipboard.nodeId);
      if (!sourceNode) {
        setClipboard(null);
        return;
      }

      // Prevent pasting into itself or its own descendants
      const isDescendant = (parentId, childId) => {
        const parent = flattenedNodes.get(parentId);
        if (!parent || !parent.children) return false;
        for (const child of parent.children) {
          if (child.id === childId) return true;
          if (isDescendant(child.id, childId)) return true;
        }
        return false;
      };

      if (clipboard.nodeId === targetParentId || isDescendant(clipboard.nodeId, targetParentId)) {
        return; // Cannot paste into itself or its own descendant
      }

      if (clipboard.operation === "copy") {
        // Clone the node with new IDs and get ID mapping
        const idMapping = {};
        const cloned = cloneNodeWithNewIds(sourceNode, idMapping);

        // Add cloned node to tree
        setTreeData((prev) => addNodeToTree(prev, targetParentId, cloned.node));

        // Copy file contents using ID mapping
        const sourceContents = collectContentsMap(sourceNode, fileContents);
        if (Object.keys(sourceContents).length > 0) {
          setFileContents((prev) => {
            const next = { ...prev };
            for (const [oldId, content] of Object.entries(sourceContents)) {
              const newId = idMapping[oldId];
              if (newId) {
                next[newId] = content;
              }
            }
            return next;
          });
        }
      } else if (clipboard.operation === "cut") {
        // Move the node
        setTreeData((prev) => moveNodeInTree(prev, clipboard.nodeId, targetParentId));
        // Clear clipboard after cut
        setClipboard(null);
      }

      // Expand target folder
      setExpandedFolders((prev) => {
        const next = new Set(prev);
        next.add(targetParentId);
        return next;
      });
    },
    [clipboard, flattenedNodes, fileContents, cloneNodeWithNewIds, collectContentsMap]
  );

  useEffect(() => {
    const handler = (event) => {
      // Skip if user is typing in an input, textarea, or contenteditable element
      const target = event.target;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.contentEditable === "true";
      if (isInput) return;

      const key = event.key.toLowerCase();
      if (key === "s" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        // Save makes preview tab permanent
        if (previewTabId && previewTabId === activeFileId) {
          setPreviewTabId(null);
          console.log("Saved:", activeFile?.path);
        }
      }
      if (key === "w" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        event.stopPropagation();
        if (activeFileId) {
          handleCloseTab(activeFileId);
        }
        return false;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeFile, activeFileId, handleCloseTab]);

  return (
    <div className="app-shell">
      <Sidebar tree={treeData} expandedFolders={expandedFolders} onToggleFolder={handleToggleFolder} onFileSelect={handleSelectFile} onNewFile={(name, parentId) => handleNewItem("file", name, parentId)} onNewFolder={(name, parentId) => handleNewItem("folder", name, parentId)} onDeleteItem={handleDeleteItem} onRenameItem={handleRenameItem} onMoveItem={handleMoveItem} onUploadFiles={handleUploadFiles} onCopyItem={handleCopyItem} onCutItem={handleCutItem} onPasteItem={handlePasteItem} clipboard={clipboard} onCollapseAll={handleCollapseAll} activeFileId={activeFileId} />
      <div className="workspace">
        <Tabs tabs={tabs} activeFileId={activeFileId} previewTabId={previewTabId} files={flattenedNodes} onTabSelect={setActiveFileId} onTabClose={handleCloseTab} />
        <div className="editor-area">
          <Editor fileId={activeFileId} filePath={activeFile?.path} content={activeContent} language={language} onChange={handleEditorChange} />
        </div>
        <Terminal activeFileName={activeFile?.path} />
      </div>
    </div>
  );
};

export default Layout;
