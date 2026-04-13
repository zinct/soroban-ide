import React, { memo, useState, useCallback, useRef, useEffect, useMemo } from "react";
import { loadState, saveStateSection, clearState } from "../utils/storage";
import { executeTerminalCommand, isBackendCommand } from "../features/terminal/terminalCommands";
import { collectProjectFiles, submitCommand, connectBuildStream } from "../services/backendService";
import { useWorkspaceState, useTabManager } from "../features/workspace/workspaceHooks";
import { FileIconImg, FolderIconImg } from "../components/icons/FileIcon";
import { ChevronDown, ChevronRight } from "../components/icons/ChevronIcons";
import { sortNodes, uniqueId, ensureTreeIds } from "../features/workspace/workspaceUtils";
import { Plus, FolderOpen, FileText, X, Menu } from "lucide-react";
import Sidebar from "../features/sidebar/Sidebar";
import Tabs from "../features/tabs/Tabs";
import Editor from "../features/editor/Editor";
import Terminal from "../features/terminal/Terminal";
import { getLanguageFromName, getLanguageDisplayName } from "../features/editor/editorUtils";
import { cloneNodeWithNewIds, addNodeToTree, moveNodeInTree } from "../features/workspace/workspaceUtils";

/**
 * Main Layout — the slim orchestrator.
 * Composes workspace state hooks with UI feature components.
 */
const Layout = () => {
  const workspace = useWorkspaceState();
  const tabManager = useTabManager(workspace.flattenedNodes);

  const [cursorInfo, setCursorInfo] = useState({ lineNumber: 1, column: 1, selectedChars: 0 });
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showGithubClone, setShowGithubClone] = useState(false);
  const [githubUrl, setGithubUrl] = useState("");
  const [cloneStatus, setCloneStatus] = useState(null);
  const [lastSessionId, setLastSessionId] = useState(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const createMenuRef = useRef(null);
  const setFileContentsRef = useRef(workspace.setFileContents);
  const previewTabIdRef = useRef(tabManager.previewTabId);
  const activeFileIdRef = useRef(tabManager.activeFileId);

  // Keep refs up to date
  useEffect(() => {
    setFileContentsRef.current = workspace.setFileContents;
  }, [workspace.setFileContents]);

  useEffect(() => {
    previewTabIdRef.current = tabManager.previewTabId;
  }, [tabManager.previewTabId]);

  useEffect(() => {
    activeFileIdRef.current = tabManager.activeFileId;
  }, [tabManager.activeFileId]);
  

  // Derived state
  const activeFile = tabManager.activeFileId ? workspace.flattenedNodes.get(tabManager.activeFileId) : null;
  const activeContent = tabManager.activeFileId ? workspace.fileContents[tabManager.activeFileId] : "";
  const language = activeFile ? getLanguageFromName(activeFile.name) : "rust";

  // Handle new item creation and open in tab
  const handleNewItem = useCallback(
    (type, name, parentId) => {
      const newId = workspace.addItem(type, name, parentId);
      if (newId && type === "file") {
        tabManager.openFile(newId);
      }
    },
    [workspace, tabManager],
  );

  // Handle delete with tab cleanup
  const handleDeleteItem = useCallback(
    (nodeId) => {
      const deletedFileIds = workspace.deleteItem(nodeId);
      deletedFileIds.forEach((fileId) => {
        if (tabManager.tabs.includes(fileId)) {
          tabManager.closeTab(fileId);
        }
      });
    },
    [workspace, tabManager],
  );

  // Handle editor content changes - auto-save to permanent state
  const handleEditorChange = useCallback(
    (value) => {
      const fileId = activeFileIdRef.current;
      const previewId = previewTabIdRef.current;

      if (!fileId) return;

      // Update file content
      workspace.setFileContents((prev) => ({
        ...prev,
        [fileId]: value,
      }));

      // Auto-promote preview tab to permanent when editing
      if (previewId && previewId === fileId) {
        tabManager.setPreviewTabId(null);
      }
    },
    [workspace, tabManager],
  );

  // Handle cursor position changes from editor
  const handleCursorChange = useCallback((info) => {
    setCursorInfo(info);
  }, []);


  // Keyboard shortcuts
  useEffect(() => {
    const handler = (event) => {
      const target = event.target;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.contentEditable === "true";
      if (isInput) return;

      const key = event.key.toLowerCase();
      if (key === "s" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        if (tabManager.previewTabId && tabManager.previewTabId === tabManager.activeFileId) {
          tabManager.setPreviewTabId(null);
        }
      }
      if (key === "w" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        event.stopPropagation();
        if (tabManager.activeFileId) tabManager.closeTab(tabManager.activeFileId);
        return false;
      }

      // Copy/Paste/Cut shortcuts
      if ((event.ctrlKey || event.metaKey) && !isInput) {
        if (key === "c" && selectedNodeId) {
          event.preventDefault();
          workspace.clipboard.copyItem(selectedNodeId);
        } else if (key === "x" && selectedNodeId) {
          event.preventDefault();
          workspace.clipboard.cutItem(selectedNodeId);
        } else if (key === "v") {
          event.preventDefault();
          // Resolve target folder
          const selectedNode = workspace.flattenedNodes.get(selectedNodeId);
          let targetId = workspace.rootId;
          
          if (selectedNode) {
            targetId = selectedNode.type === 'folder' ? selectedNode.id : (selectedNode.parentId || workspace.rootId);
          }
          
          workspace.clipboard.pasteItem(targetId);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [tabManager]);

  // Close create menu clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (createMenuRef.current && !createMenuRef.current.contains(e.target)) {
        setShowCreateMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Create project handlers
  const handleOpenCreateProject = useCallback(() => {
    setShowCreateDialog(true);
    setShowCreateMenu(false);
    setNewProjectName("");
  }, []);

  const handleCreateProject = useCallback(async (forcedName) => {
    const name = forcedName || newProjectName.trim() || "my-soroban-project";
    try {
      setIsCreatingProject(true);
      setShowCreateDialog(false);

      // We don't create locally anymore, we let the backend 'init' and send us the tree
      // But we clear existing tabs/state for a fresh start
      tabManager.resetTabs();
      workspace.setFileContents({});

      // Run stellar contract init on backend
      const sessionId = await submitCommand({}, `stellar contract init ${name}`);
      setLastSessionId(sessionId);

      // Connect specifically to this init session to get the resulting file tree
      connectBuildStream(sessionId, {
        onMessage: (msg) => {
          if (msg.type === "fileTreeUpdate") {
            try {
              const rawTree = JSON.parse(msg.content);
              handleFileTreeUpdate(rawTree);
            } catch (e) {
              console.error("Failed to parse file tree update:", e);
            }
          }
        },
        onDone: () => setIsCreatingProject(false),
        onError: (err) => {
          console.error("Init project error:", err);
          setIsCreatingProject(false);
        },
      });
    } catch (error) {
      console.error("Failed to create project:", error);
      setIsCreatingProject(false);
    }
  }, [newProjectName, workspace, tabManager]);

  const handleFileTreeUpdate = useCallback(
    (newTree) => {
      const treeWithIds = ensureTreeIds(newTree);

      // Extract contents from the tree to update workspace cache
      const contents = {};
      const extract = (nodes) => {
        nodes.forEach((node) => {
          if (node.type === "file" && node.content !== undefined) {
            contents[node.id] = node.content;
          }
          if (node.children?.length) extract(node.children);
        });
      };
      extract(treeWithIds);

      if (Object.keys(contents).length > 0) {
        workspace.setFileContents((prev) => ({ ...prev, ...contents }));
      }

      workspace.setTreeData(treeWithIds);
      setIsCreatingProject(false);
    },
    [workspace],
  );

  // Auto-trigger Create Project on first-time initialization
  useEffect(() => {
    const state = loadState();
    if (!state?.workspace) {
      handleCreateProject("hello-world");
    }
  }, [handleCreateProject]);

  const handleOpenGithubClone = useCallback(() => {
    setShowGithubClone(true);
    setShowCreateMenu(false);
    setGithubUrl("");
    setCloneStatus(null);
  }, []);

  const handleCloneGithub = useCallback(async () => {
    if (!githubUrl.trim()) return;
    setCloneStatus({ type: "loading", message: "Fetching repository from GitHub..." });

    try {
      await workspace.cloneFromGithub(githubUrl);
      tabManager.resetTabs();
      setCloneStatus({ type: "success", message: "Repository cloned successfully!" });
      setTimeout(() => {
        setShowGithubClone(false);
        setCloneStatus(null);
        setGithubUrl("");
      }, 1500);
    } catch (err) {
      setCloneStatus({ type: "error", message: err.message || "Failed to clone repository" });
    }
  }, [githubUrl, workspace, tabManager]);

  return (
    <div className="app-shell">
      <div className="app-main">
        <Sidebar 
          tree={workspace.treeData} 
          expandedFolders={workspace.expandedFolders} 
          onToggleFolder={workspace.toggleFolder} 
          onFileSelect={(id) => {
            tabManager.selectFile(id);
            setSelectedNodeId(id);
          }} 
          onNodeSelect={setSelectedNodeId}
          onNewFile={(name, parentId) => handleNewItem("file", name, parentId)} 
          onNewFolder={(name, parentId) => handleNewItem("folder", name, parentId)} 
          onDeleteItem={handleDeleteItem} 
          onRenameItem={workspace.renameItem} 
          onMoveItem={workspace.moveItem} 
          onUploadFiles={workspace.uploadFiles} 
          onCopyItem={workspace.clipboard.copyItem} 
          onCutItem={workspace.clipboard.cutItem} 
          onPasteItem={workspace.clipboard.pasteItem} 
          clipboard={workspace.clipboard.clipboard} 
          onCollapseAll={workspace.collapseAll} 
          activeFileId={tabManager.activeFileId} 
          selectedNodeId={selectedNodeId}
          lastSessionId={lastSessionId} 
          setTreeData={workspace.setTreeData} 
          treeData={workspace.treeData}
          fileContents={workspace.fileContents}
        />

        {/* Project Creation Loading Overlay - Glass Blur */}
        <div className={`project-creation-overlay ${isCreatingProject ? 'visible' : ""}`}>
          <div className="project-creation-content">
            <div className="loading-spinner"></div>
            <div className="loading-text">Creating Soroban Project...</div>
            <div className="loading-subtext">Running: stellar contract init {newProjectName || "project"}</div>
          </div>
        </div>

        <div className="workspace">
          <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid var(--border-color)", background: "var(--tab-bg)" }}>
            <Tabs tabs={tabManager.tabs} activeFileId={tabManager.activeFileId} previewTabId={tabManager.previewTabId} files={workspace.flattenedNodes} onTabSelect={tabManager.setActiveFileId} onTabClose={tabManager.closeTab} />

            <div className="create-new-container" ref={createMenuRef}>
              <button className="create-new-btn" onClick={() => setShowCreateMenu(!showCreateMenu)} title="Create New...">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span className="create-new-label">Create Project</span>
              </button>
              {showCreateMenu && (
                <div className="create-new-dropdown">
                  <div className="create-new-item" onClick={handleOpenCreateProject}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    Create Project
                  </div>
                  <div className="create-new-item" onClick={handleOpenGithubClone}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
                    </svg>
                    Clone from GitHub
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="editor-area">
            <Editor fileId={tabManager.activeFileId} filePath={activeFile?.path} content={activeContent} language={language} onChange={handleEditorChange} onCursorChange={handleCursorChange} />
          </div>

          <Terminal activeFileName={activeFile?.path} treeData={workspace.treeData} fileContents={workspace.fileContents} onFileTreeUpdate={handleFileTreeUpdate} />
        </div>
      </div>

      {/* Status bar - full width at bottom */}
      <div className="status-bar">
        <div className="status-bar-left">{/* Empty or can add other info here */}</div>
        <div className="status-bar-right">
          <span className="status-bar-cursor">
            Ln {cursorInfo.lineNumber}, Col {cursorInfo.column}
          </span>
          {cursorInfo.selectedChars > 0 && <span className="status-bar-selection">({cursorInfo.selectedChars} Selected)</span>}
          <span className="status-bar-encoding">UTF-8</span>
          <span className="status-bar-eol">LF</span>
          <span className="status-bar-language">{getLanguageDisplayName(language)}</span>
        </div>
      </div>

      {showGithubClone && (
        <div className="github-clone-overlay">
          <div className="github-clone-dialog">
            <h3>Clone GitHub Repository</h3>
            <input
              type="text"
              placeholder="https://github.com/username/repository.git"
              value={githubUrl}
              onChange={(e) => {
                setGithubUrl(e.target.value);
                if (cloneStatus?.type === "error") setCloneStatus(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleCloneGithub()}
              autoFocus
            />
            {cloneStatus && <div className={`clone-status ${cloneStatus.type}`}>{cloneStatus.message}</div>}
            <div className="dialog-buttons">
              <button className="btn-cancel" onClick={() => setShowGithubClone(false)}>
                Cancel
              </button>
              <button className="btn-clone" onClick={handleCloneGithub} disabled={cloneStatus?.type === "loading"}>
                Clone
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateDialog && (
        <div className="github-clone-overlay">
          <div className="github-clone-dialog">
            <h3>Create New Soroban Project</h3>
            <div className="dialog-subtitle">Specify a name for your smart contract project.</div>
            <input type="text" placeholder="e.g., hello-soroban" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreateProject()} autoFocus />
            <div className="dialog-buttons">
              <button className="btn-cancel" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </button>
              <button className="btn-clone" onClick={() => handleCreateProject()}>
                Create Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
