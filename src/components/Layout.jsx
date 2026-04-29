import React, { memo, useState, useCallback, useRef, useEffect, useMemo } from "react";
import { loadState, saveStateSection, clearState } from "../utils/storage";
import { executeTerminalCommand, isBackendCommand } from "../features/terminal/terminalCommands";
import { collectProjectFiles, submitCommand, connectBuildStream, fetchTemplate, resetSessionId } from "../services/backendService";
import { useWorkspaceState, useTabManager } from "../features/workspace/workspaceHooks";
import { createDefaultWorkspace, createBlankWorkspace } from "../features/workspace/workspaceTemplates";
import { cloneRepository } from "../services/githubService";
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
import SettingsPanel from "../features/settings/SettingsPanel";
import AIPanel from "../features/ai/AIPanel";
import CommandPalette from "../features/palette/CommandPalette";
import { Sparkles } from "lucide-react";
import "../styles/settings.css";

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
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const initializationStartedRef = useRef(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");
  const [showAIPanel, setShowAIPanel] = useState(() => localStorage.getItem("ai_panel_open") === "true");
  const [palette, setPalette] = useState({ isOpen: false, mode: "command" });
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "Confirm Action",
    message: "",
    onConfirm: null,
  });
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

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Persist AI Panel state
  useEffect(() => {
    localStorage.setItem("ai_panel_open", showAIPanel);
  }, [showAIPanel]);

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

  // Handle body scroll blocking for all modals
  useEffect(() => {
    const isAnyModalOpen = palette.isOpen || showGithubClone || confirmModal.isOpen || isSettingsOpen;
    if (isAnyModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [palette.isOpen, showGithubClone, confirmModal.isOpen, isSettingsOpen]);

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
            targetId = selectedNode.type === "folder" ? selectedNode.id : selectedNode.parentId || workspace.rootId;
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
  const handleCreateProject = useCallback(
    async (templateName = "hello-world", skipConfirm = false) => {
      const execute = async () => {
        try {
          setIsCreatingProject(true);

          // Reset session to ensure a clean workspace on the backend
          resetSessionId();

          // Reset state for a fresh start
          tabManager.resetTabs();

          // Initialize locally using the specified template from BACKEND filesystem
          console.log(`[Layout] Fetching ${templateName} template from backend filesystem...`);
          try {
            const { tree, contents } = await fetchTemplate(templateName);
            workspace.setTreeData(tree);
            workspace.setFileContents(contents);
          } catch (templateError) {
            console.error(`Failed to fetch ${templateName} template from backend, falling back to local blank project:`, templateError);
            const { tree, contents } = createBlankWorkspace();
            workspace.setTreeData(tree);
            workspace.setFileContents(contents);
          }

          setIsCreatingProject(false);
        } catch (error) {
          console.error("Failed to create project:", error);
          setIsCreatingProject(false);
        }
      };

      if (!skipConfirm) {
        setConfirmModal({
          isOpen: true,
          title: "Confirm New Project",
          message: "Are you sure you want to create a new project? This will replace your current workspace files.",
          onConfirm: execute,
        });
        return;
      }

      await execute();
    },
    [workspace, tabManager],
  );

  const handleOpenCreateProject = useCallback(() => {
    setShowCreateMenu(false);
    handleCreateProject();
  }, [handleCreateProject]);

  // Auto-trigger Create Project on first-time initialization
  useEffect(() => {
    if (initializationStartedRef.current) return;

    const state = loadState();
    if (!state?.workspace) {
      initializationStartedRef.current = true;
      handleCreateProject("hello-world", true);
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

    const execute = async () => {
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
    };

    setConfirmModal({
      isOpen: true,
      title: "Confirm Clone",
      message: "Are you sure you want to clone this repository? This will replace your current workspace files.",
      onConfirm: execute,
    });
  }, [githubUrl, workspace, tabManager]);

  /* ─── Command Palette ─── */

  const openPalette = useCallback((mode = "command") => {
    setPalette({ isOpen: true, mode });
  }, []);
  const closePalette = useCallback(() => {
    setPalette((p) => ({ ...p, isOpen: false }));
  }, []);

  const paletteFiles = useMemo(() => {
    const list = [];
    for (const node of workspace.flattenedNodes.values()) {
      if (node.type === "file") {
        list.push({ id: node.id, name: node.name, path: node.path });
      }
    }
    list.sort((a, b) => (a.path || "").localeCompare(b.path || "", undefined, { sensitivity: "base" }));
    return list;
  }, [workspace.flattenedNodes]);

  const handleCloseAllTabs = useCallback(() => {
    [...tabManager.tabs].forEach((id) => tabManager.closeTab(id));
  }, [tabManager]);

  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform || "");
  const modKey = isMac ? "⌘" : "Ctrl";

  const paletteCommands = useMemo(() => {
    const dispatch = (name, detail) => window.dispatchEvent(new CustomEvent(name, detail ? { detail } : undefined));

    return [
      {
        id: "file.quickOpen",
        title: "Go to File…",
        category: "File",
        shortcut: `${modKey}+P`,
        run: () => openPalette("file"),
      },
      {
        id: "file.newFile",
        title: "New File",
        category: "File",
        run: () => dispatch("soroban:startNewFile"),
      },
      {
        id: "file.newFolder",
        title: "New Folder",
        category: "File",
        run: () => dispatch("soroban:startNewFolder"),
      },
      {
        id: "file.uploadFiles",
        title: "Upload Files…",
        category: "File",
        run: () => dispatch("soroban:uploadFiles"),
      },
      {
        id: "project.createHelloWorld",
        title: "Create Hello World Project",
        category: "Project",
        run: () => handleCreateProject("hello-world"),
      },
      {
        id: "project.createWorkshop",
        title: "Create Workshop Template",
        category: "Project",
        run: () => handleCreateProject("stellar-workshop"),
      },
      {
        id: "project.cloneGithub",
        title: "Clone from GitHub…",
        category: "Project",
        run: handleOpenGithubClone,
      },
      {
        id: "view.toggleSidebar",
        title: "Toggle Sidebar",
        category: "View",
        shortcut: `${modKey}+B`,
        run: () => dispatch("soroban:toggleSidebar"),
      },
      {
        id: "view.toggleTerminal",
        title: "Toggle Terminal",
        category: "View",
        shortcut: `${modKey}+J`,
        run: () => dispatch("soroban:toggleTerminal"),
      },
      {
        id: "view.showExplorer",
        title: "Show Explorer",
        category: "View",
        run: () => {
          if (isSettingsOpen) setIsSettingsOpen(false);
          dispatch("soroban:setSidebarPanel", { panel: "explorer" });
        },
      },
      {
        id: "view.showGithub",
        title: "Show GitHub Panel",
        category: "View",
        run: () => {
          if (isSettingsOpen) setIsSettingsOpen(false);
          dispatch("soroban:setSidebarPanel", { panel: "github" });
        },
      },
      {
        id: "view.showTutorials",
        title: "Show Tutorials",
        category: "View",
        run: () => {
          if (isSettingsOpen) setIsSettingsOpen(false);
          dispatch("soroban:setSidebarPanel", { panel: "tutorial" });
        },
      },
      {
        id: "view.toggleSettings",
        title: isSettingsOpen ? "Close Settings" : "Open Settings",
        category: "View",
        run: () => setIsSettingsOpen((v) => !v),
      },
      {
        id: "view.toggleAI",
        title: showAIPanel ? "Close AI Panel" : "Open AI Panel",
        category: "View",
        shortcut: `${modKey}+I`,
        run: () => setShowAIPanel((v) => !v),
      },
      {
        id: "terminal.clear",
        title: "Clear Terminal",
        category: "Terminal",
        run: () => dispatch("soroban:clearTerminal"),
      },
      {
        id: "workspace.collapseAll",
        title: "Collapse All Folders",
        category: "Workspace",
        run: workspace.collapseAll,
      },
      {
        id: "tabs.closeActive",
        title: "Close Active Tab",
        category: "Tabs",
        shortcut: `${modKey}+W`,
        run: () => tabManager.activeFileId && tabManager.closeTab(tabManager.activeFileId),
      },
      {
        id: "tabs.closeAll",
        title: "Close All Tabs",
        category: "Tabs",
        run: handleCloseAllTabs,
      },
      {
        id: "theme.dark",
        title: "Color Theme: Community Dark",
        category: "Preferences",
        run: () => setTheme("dark"),
      },
      {
        id: "theme.light",
        title: "Color Theme: Modern Light",
        category: "Preferences",
        run: () => setTheme("light"),
      },
    ];
  }, [openPalette, handleCreateProject, handleOpenGithubClone, isSettingsOpen, showAIPanel, workspace.collapseAll, tabManager, handleCloseAllTabs, modKey]);

  const handlePaletteOpenFile = useCallback(
    (fileId) => {
      tabManager.openFile(fileId);
    },
    [tabManager],
  );

  // Global palette shortcuts: Ctrl/Cmd+Shift+P → commands, Ctrl/Cmd+P → files
  useEffect(() => {
    const handler = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();

      if (key === "p" && e.shiftKey) {
        e.preventDefault();
        openPalette("command");
      } else if (key === "p" && !e.shiftKey) {
        e.preventDefault();
        openPalette("file");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openPalette]);

  return (
    <div className="app-shell">
      <div className="app-main">
        {isSettingsOpen ? (
          <SettingsPanel currentTheme={theme} onThemeChange={setTheme} onClose={() => setIsSettingsOpen(false)} />
        ) : (
          <>
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
              isSettingsOpen={isSettingsOpen}
              onToggleSettings={() => setIsSettingsOpen(!isSettingsOpen)}
              onConfirm={setConfirmModal}
            />

            {/* Project Creation Loading Overlay - Glass Blur */}
            <div className={`project-creation-overlay ${isCreatingProject ? "visible" : ""}`}>
              <div className="project-creation-content">
                <div className="loading-spinner"></div>
                <div className="loading-text">Creating Soroban Project...</div>
                <div className="loading-subtext">Initializing template from backend...</div>
              </div>
            </div>

            <div className="workspace">
              <div className="workspace-header">
                <Tabs tabs={tabManager.tabs} activeFileId={tabManager.activeFileId} previewTabId={tabManager.previewTabId} files={workspace.flattenedNodes} onTabSelect={tabManager.setActiveFileId} onTabClose={tabManager.closeTab} />

                <div className="create-new-container" ref={createMenuRef}>
                  <button className="premium-create-btn" onClick={() => setShowCreateMenu(!showCreateMenu)} title="Create New...">
                    <span className="btn-label">Create Project</span>
                  </button>
                  <button 
                    className={`ai-toggle-btn ${showAIPanel ? 'hidden' : ''}`} 
                    onClick={() => setShowAIPanel(true)}
                    title="Toggle AI Chat"
                  >
                    <Sparkles size={20} />
                  </button>
                  {showCreateMenu && (
                    <div className="create-new-dropdown">
                      <div
                        className="create-new-item"
                        onClick={() => {
                          handleCreateProject("hello-world");
                          setShowCreateMenu(false);
                        }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        Create Hello World
                      </div>
                      <div
                        className="create-new-item"
                        onClick={() => {
                          handleCreateProject("stellar-workshop");
                          setShowCreateMenu(false);
                        }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        Create Workshop Template
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
                <Editor fileId={tabManager.activeFileId} filePath={activeFile?.path} content={activeContent} language={language} theme={theme} onChange={handleEditorChange} onCursorChange={handleCursorChange} />
              </div>

              <Terminal activeFileName={activeFile?.path} treeData={workspace.treeData} fileContents={workspace.fileContents} onFileTreeUpdate={workspace.setTreeData} />
            </div>

            <AIPanel isOpen={showAIPanel} onClose={() => setShowAIPanel(false)} />
          </>
        )}
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

      <div className={`github-clone-overlay ${showGithubClone ? "visible" : ""}`} onClick={(e) => e.target === e.currentTarget && setShowGithubClone(false)}>
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
            <button className="btn btn-secondary" onClick={() => setShowGithubClone(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleCloneGithub} disabled={cloneStatus?.type === "loading"}>
              Clone
            </button>
          </div>
        </div>
      </div>

      <CommandPalette isOpen={palette.isOpen} mode={palette.mode} commands={paletteCommands} files={paletteFiles} onClose={closePalette} onOpenFile={handlePaletteOpenFile} />

      <div className={`github-clone-overlay ${confirmModal.isOpen ? "visible" : ""}`} onClick={(e) => e.target === e.currentTarget && setConfirmModal({ ...confirmModal, isOpen: false })}>
        <div className="github-clone-dialog">
          <h3>{confirmModal.title}</h3>
          <p className="confirmation-message">{confirmModal.message}</p>
          <div className="dialog-buttons">
            <button className="btn btn-secondary" onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                confirmModal.onConfirm?.();
                setConfirmModal({ ...confirmModal, isOpen: false });
              }}>
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Layout;
