import React, { memo, useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  getStoredToken,
  getStoredUser,
  storeAuth,
  clearAuth,
  initiateDeviceFlow,
  pollForToken,
  getUserInfo,
  listAllUserRepos,
  getRepository,
  listRepositoryBranches,
  searchRepositories,
  createRepository,
  pushFilesToRepo,
} from "../../services/githubAuthService";
import { collectProjectFiles } from "../../services/backendService";

// ─── Commit message config ──────────────────────────────────────
const COMMIT_MESSAGE_KEY = "soroban:lastCommitMessage";
const EXISTING_BRANCH_KEY = "soroban:githubExistingTargetBranch";
const DEFAULT_CREATE_COMMIT = "Initial commit from soroban studio";
const DEFAULT_UPDATE_COMMIT = "Update from soroban studio";
const COMMIT_SUBJECT_SOFT_LIMIT = 72;

/**
 * Parse repo slug, owner/repo, or github.com URLs from the manual "add repo" field.
 */
const parseManualRepoInput = (raw, login) => {
  const t = raw.trim().replace(/\.git$/i, "");
  if (!t) return null;
  const urlMatch = t.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+)\/([^/?#]+)/i);
  if (urlMatch) return { owner: urlMatch[1], repo: urlMatch[2] };
  const parts = t.split("/").filter(Boolean);
  if (parts.length >= 2) return { owner: parts[0], repo: parts[parts.length - 1] };
  if (parts.length === 1 && login) return { owner: login, repo: parts[0] };
  return null;
};

/**
 * Build the final commit message sent to GitHub.
 * If the user typed something, we respect it verbatim. Otherwise we fall
 * back to the action-specific default (which already carries branding).
 */
const buildCommitMessage = (raw, fallback) => {
  const effective = raw.trim() || fallback;
  const lines = effective.split(/\r?\n/);
  const subject = (lines[0] || "").trim();
  const body = lines.slice(1).join("\n").trim();
  return body ? `${subject}\n\n${body}` : subject;
};

/**
 * GitHub Panel — replaces the file explorer in the sidebar.
 * Handles OAuth Device Flow login, repo creation, and pushing files.
 */
const GitHubPanel = memo(({ treeData, fileContents, onConfirm, onOpenGithubRepository }) => {
  // Auth state
  const [token, setToken] = useState(() => getStoredToken());
  const [user, setUser] = useState(() => getStoredUser());
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [deviceFlowData, setDeviceFlowData] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef(null);

  // Panel state
  const [activeView, setActiveView] = useState("main"); // main | create | existing
  const [repos, setRepos] = useState([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [reposLoadError, setReposLoadError] = useState(null);
  const [repoSearch, setRepoSearch] = useState("");
  const [manualRepoInput, setManualRepoInput] = useState("");
  const [manualRepoLoading, setManualRepoLoading] = useState(false);
  const [manualRepoError, setManualRepoError] = useState(null);
  const [expandedRepoBranches, setExpandedRepoBranches] = useState({});
  const [repoBranchesByRepo, setRepoBranchesByRepo] = useState({});
  const [repoBranchesLoading, setRepoBranchesLoading] = useState({});
  const [repoBranchesError, setRepoBranchesError] = useState({});

  // Create repo state
  const [newRepoName, setNewRepoName] = useState("");
  const [newRepoDesc, setNewRepoDesc] = useState("");
  const [newRepoBranch, setNewRepoBranch] = useState("");
  const [existingTargetBranch, setExistingTargetBranch] = useState(() => {
    try {
      return localStorage.getItem(EXISTING_BRANCH_KEY) || "";
    } catch {
      return "";
    }
  });

  // Push state
  const [isPushing, setIsPushing] = useState(false);
  const [pushProgress, setPushProgress] = useState(null);
  const [pushResult, setPushResult] = useState(null);
  const [pushError, setPushError] = useState(null);
  // Commit message (shared across create/existing views; prefilled from last use)
  const [commitMessage, setCommitMessage] = useState(() => {
    try {
      return localStorage.getItem(COMMIT_MESSAGE_KEY) || "";
    } catch {
      return "";
    }
  });

  const commitMessageDefault = activeView === "create" ? DEFAULT_CREATE_COMMIT : DEFAULT_UPDATE_COMMIT;
  const commitSubjectLine = (commitMessage.split(/\r?\n/)[0] || "").trim();
  const hasTypedCommit = commitMessage.length > 0;
  // Disable the push action only if the user actively typed a message whose subject is empty.
  // An empty textarea is allowed — it falls back to the action-specific default on submit.
  const commitSubjectEmpty = hasTypedCommit && commitSubjectLine.length === 0;
  const commitSubjectTooLong = commitSubjectLine.length > COMMIT_SUBJECT_SOFT_LIMIT;

  const persistCommitMessage = useCallback(() => {
    try {
      if (commitMessage.trim()) {
        localStorage.setItem(COMMIT_MESSAGE_KEY, commitMessage);
      }
    } catch {
      /* localStorage unavailable — non-fatal */
    }
  }, [commitMessage]);

  const getTargetBranch = useCallback((repo) => repo.default_branch || "main", []);

  useEffect(() => {
    try {
      if (existingTargetBranch.trim()) {
        localStorage.setItem(EXISTING_BRANCH_KEY, existingTargetBranch.trim());
      } else {
        localStorage.removeItem(EXISTING_BRANCH_KEY);
      }
    } catch {
      /* ignore persistence errors */
    }
  }, [existingTargetBranch]);

  // Verify stored token on mount
  useEffect(() => {
    if (token && !user) {
      getUserInfo(token)
        .then((userData) => {
          setUser(userData);
          storeAuth(token, userData);
        })
        .catch(() => {
          clearAuth();
          setToken(null);
          setUser(null);
        });
    }
  }, [token, user]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  // ─── Auth Handlers ───────────────────────────────────────────

  const handleLogin = useCallback(async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    setDeviceFlowData(null);

    try {
      const data = await initiateDeviceFlow();
      setDeviceFlowData(data);

      // Open GitHub verification page
      window.open(data.verification_uri, "_blank");

      // Start polling for token
      abortRef.current = new AbortController();
      const accessToken = await pollForToken(data.device_code, data.interval, abortRef.current.signal);

      // Got token! Fetch user info
      const userData = await getUserInfo(accessToken);
      storeAuth(accessToken, userData);
      setToken(accessToken);
      setUser(userData);
      setDeviceFlowData(null);
    } catch (err) {
      if (err.message !== "Authorization cancelled") {
        setAuthError(err.message);
      }
    } finally {
      setIsLoggingIn(false);
    }
  }, []);

  const handleCancelLogin = useCallback(() => {
    abortRef.current?.abort();
    setIsLoggingIn(false);
    setDeviceFlowData(null);
    setCopied(false);
  }, []);

  const handleCopyCode = useCallback(() => {
    if (deviceFlowData?.user_code) {
      navigator.clipboard.writeText(deviceFlowData.user_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [deviceFlowData]);

  const handleLogout = useCallback(() => {
    clearAuth();
    setToken(null);
    setUser(null);
    setActiveView("main");
    setRepos([]);
  }, []);

  // ─── Repo Handlers ──────────────────────────────────────────

  const loadRepos = useCallback(async () => {
    if (!token) return;
    setReposLoading(true);
    setReposLoadError(null);
    try {
      const data = await listAllUserRepos(token);
      setRepos(data);
    } catch (err) {
      const msg = err?.message || "Failed to load repositories";
      setReposLoadError(msg);
      console.error("Failed to load repos:", err);
    } finally {
      setReposLoading(false);
    }
  }, [token]);

  // When you open the GitHub panel while signed in, load your repo list for browsing.
  useEffect(() => {
    if (token && user) {
      loadRepos();
    }
  }, [token, user, loadRepos]);

  const handleAddRepoByFullName = useCallback(async () => {
    const parsed = parseManualRepoInput(manualRepoInput, user?.login);
    if (!parsed || !token) {
      setManualRepoError(`Enter a repo name, owner/repo, or GitHub URL (defaults to your login ${user?.login || "…"}).`);
      return;
    }
    const { owner, repo: repoName } = parsed;

    setManualRepoLoading(true);
    setManualRepoError(null);
    try {
      const mergeRepo = (repo) => {
        setRepos((prev) => (prev.some((r) => r.id === repo.id) ? prev : [repo, ...prev]));
        setManualRepoInput("");
      };

      try {
        const repo = await getRepository(token, owner, repoName);
        mergeRepo(repo);
        return;
      } catch (directErr) {
        // Under another owner (org) or not found under assumed login — try GitHub search.
        const login = user?.login;
        const queries = login
          ? [`${repoName} in:name user:${login}`, `${repoName} in:name`]
          : [`${repoName} in:name`];
        let chosen = null;
        for (const q of queries) {
          try {
            const data = await searchRepositories(token, q);
            const items = data.items || [];
            chosen =
              items.find((r) => (r.name || "").toLowerCase() === repoName.toLowerCase()) ||
              items.find((r) => (r.full_name || "").toLowerCase().endsWith(`/${repoName.toLowerCase()}`)) ||
              null;
            if (chosen) break;
          } catch {
            /* proxy may not expose search — try next query */
          }
        }
        if (chosen) {
          try {
            const repo = await getRepository(token, chosen.owner.login, chosen.name);
            mergeRepo(repo);
            return;
          } catch (e2) {
            const hint =
              " If the repo is under an organization, use OrgName/repo or paste the full github.com URL.";
            setManualRepoError((e2?.message || "Could not load repository") + hint);
            return;
          }
        }
        const hint =
          " If the repo is under an organization, use OrgName/repo or paste the full github.com URL.";
        setManualRepoError((directErr?.message || "Could not load repository") + hint);
      }
    } finally {
      setManualRepoLoading(false);
    }
  }, [token, manualRepoInput, user]);

  const handleShowExisting = useCallback(() => {
    setActiveView("existing");
    setPushResult(null);
    setPushError(null);
    setRepoSearch("");
    loadRepos();
  }, [loadRepos]);

  const handleOpenInWorkspace = useCallback(
    (repo) => {
      const url = repo?.html_url || `https://github.com/${repo?.full_name || ""}`;
      if (onOpenGithubRepository) {
        onOpenGithubRepository(url);
      } else {
        window.open(url, "_blank");
      }
    },
    [onOpenGithubRepository],
  );

  const toggleRepoBranches = useCallback(
    async (repo) => {
      const key = repo.full_name;
      const nextOpen = !expandedRepoBranches[key];
      setExpandedRepoBranches((prev) => ({ ...prev, [key]: nextOpen }));
      if (!nextOpen || repoBranchesByRepo[key] || repoBranchesLoading[key] || !token) return;

      setRepoBranchesLoading((prev) => ({ ...prev, [key]: true }));
      setRepoBranchesError((prev) => ({ ...prev, [key]: "" }));
      try {
        const branches = await listRepositoryBranches(token, repo.owner.login, repo.name);
        setRepoBranchesByRepo((prev) => ({ ...prev, [key]: Array.isArray(branches) ? branches : [] }));
      } catch (err) {
        setRepoBranchesError((prev) => ({ ...prev, [key]: err?.message || "Failed to load branches" }));
      } finally {
        setRepoBranchesLoading((prev) => ({ ...prev, [key]: false }));
      }
    },
    [expandedRepoBranches, repoBranchesByRepo, repoBranchesLoading, token],
  );

  const handleCreateRepo = useCallback(async () => {
    if (!newRepoName.trim() || !token) return;
    if (commitSubjectEmpty) return;

    const finalMessage = buildCommitMessage(commitMessage, DEFAULT_CREATE_COMMIT);

    const execute = async () => {
      setIsPushing(true);
      setPushError(null);
      setPushResult(null);
      setPushProgress({ step: 0, total: 6, detail: "Creating repository..." });

      try {
        const repo = await createRepository(token, newRepoName.trim(), false, newRepoDesc.trim());
        setPushProgress({ step: 1, total: 6, detail: "Repository created! Pushing files..." });

        const files = collectProjectFiles(treeData, fileContents, { includeAll: true });
        const targetBranch = (newRepoBranch || "").trim() || repo.default_branch || "main";
        const result = await pushFilesToRepo(
          token,
          repo.owner.login,
          repo.name,
          files,
          finalMessage,
          (step, total, detail) => setPushProgress({ step: step + 1, total: total + 1, detail }),
          targetBranch,
        );

        setPushResult({ ...result, repoUrl: `https://github.com/${repo.full_name}` });
        setNewRepoName("");
        setNewRepoDesc("");
        setNewRepoBranch("");
        persistCommitMessage();
      } catch (err) {
        setPushError(err.message);
      } finally {
        setIsPushing(false);
        setPushProgress(null);
      }
    };

    if (onConfirm) {
      onConfirm({
        isOpen: true,
        title: "Confirm Create & Push",
        message: `Create repository "${newRepoName}" and push project files to "${(newRepoBranch || "").trim() || "default branch"}"? This will initialize the repository and perform an initial commit.`,
        onConfirm: execute,
      });
    } else {
      await execute();
    }
  }, [token, newRepoName, newRepoDesc, treeData, fileContents, onConfirm, commitMessage, commitSubjectEmpty, persistCommitMessage]);

  const handlePushToExisting = useCallback(
    async (repo, targetBranch) => {
      if (!token) return;
      if (commitSubjectEmpty) return;

      const finalMessage = buildCommitMessage(commitMessage, DEFAULT_UPDATE_COMMIT);

      const execute = async () => {
        setIsPushing(true);
        setPushError(null);
        setPushResult(null);
        setPushProgress({ step: 0, total: 5, detail: "Collecting files..." });

        try {
          const files = collectProjectFiles(treeData, fileContents, { includeAll: true });
          const result = await pushFilesToRepo(
            token,
            repo.owner.login,
            repo.name,
            files,
            finalMessage,
            (step, total, detail) => setPushProgress({ step, total, detail }),
            targetBranch,
            true, // force push
          );

          setPushResult(result);
          persistCommitMessage();
        } catch (err) {
          setPushError(err.message);
        } finally {
          setIsPushing(false);
          setPushProgress(null);
        }
      };

      if (onConfirm) {
        onConfirm({
          isOpen: true,
          title: "Confirm Push",
          message: `Push project files to "${repo.full_name}" on branch "${targetBranch}"? This will overwrite files on that branch to match your current workspace.`,
          onConfirm: execute,
        });
      } else {
        await execute();
      }
    },
    [token, treeData, fileContents, onConfirm, commitMessage, commitSubjectEmpty, persistCommitMessage],
  );

  // ─── Filtered repos ─────────────────────────────────────────

  const q = repoSearch.toLowerCase().trim();
  const filteredRepos = repos.filter((r) => {
    if (!q) return true;
    const hay = [r?.full_name, r?.name, r?.owner?.login].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(q);
  });
  const workspaceRootName = (treeData?.[0]?.name || "").trim().toLowerCase();
  const currentWorkspaceRepo = useMemo(() => {
    if (!workspaceRootName || !repos.length) return null;
    return (
      repos.find((r) => (r?.full_name || "").toLowerCase().endsWith(`/${workspaceRootName}`)) ||
      repos.find((r) => (r?.name || "").toLowerCase() === workspaceRootName) ||
      null
    );
  }, [repos, workspaceRootName]);
  const reposForExisting = useMemo(() => {
    if (!currentWorkspaceRepo) return repos;
    return [currentWorkspaceRepo, ...repos.filter((r) => r.id !== currentWorkspaceRepo.id)];
  }, [repos, currentWorkspaceRepo]);

  // ─── Render Helpers ─────────────────────────────────────────

  const renderGithubIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );

  // Commit-message editor shared by the Create and Existing views.
  // Cmd/Ctrl+Enter fires the provided onSubmit handler (create) and is a no-op
  // in the existing view where the user still needs to pick a repo.
  const renderCommitMessageEditor = ({ onSubmit }) => {
    const placeholder = `${commitMessageDefault}\n\nOptional longer description...`;
    const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform || "");
    const shortcutHint = isMac ? "⌘⏎" : "Ctrl+Enter";

    return (
      <div className="github-form-group">
        <label className="github-form-label">
          Commit Message
          {commitSubjectEmpty && <span className="github-form-label-warn">Subject required</span>}
          {!commitSubjectEmpty && commitSubjectTooLong && <span className="github-form-label-warn">Subject over {COMMIT_SUBJECT_SOFT_LIMIT} chars</span>}
        </label>
        <textarea
          className="github-form-input github-commit-textarea"
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && typeof onSubmit === "function") {
              e.preventDefault();
              onSubmit();
            }
          }}
          placeholder={placeholder}
          rows={4}
          spellCheck={false}
        />
        <span className="github-form-hint">
          Line 1 is the subject. Leave a blank line, then the body.
          {onSubmit && <> Press <kbd>{shortcutHint}</kbd> to push.</>}
        </span>
      </div>
    );
  };

  // ─── Not Authenticated ──────────────────────────────────────

  if (!token || !user) {
    return (
      <div className="github-panel">
        <div className="sidebar-header">
          <div className="sidebar-title">GitHub</div>
        </div>
        <div className="github-panel-body">
          <div className="github-login-section">
            {renderGithubIcon()}
            <h3 className="github-login-title">Connect to GitHub</h3>
            <p className="github-login-desc">Sign in to open your GitHub repositories in the editor and push your project</p>

            {!isLoggingIn ? (
              <button className="btn btn-primary" onClick={handleLogin}>
                {renderGithubIcon()}
                <span>Sign in with GitHub</span>
              </button>
            ) : deviceFlowData ? (
              <div className="github-device-flow">
                <p className="github-device-instruction">Enter this code on GitHub:</p>
                <div className="github-device-code" onClick={handleCopyCode} title="Click to copy">
                  {deviceFlowData.user_code}
                  {copied && <span className="github-code-tooltip">Copied!</span>}
                </div>
                <p className="github-device-hint">
                  A new tab has been opened. If not,{" "}
                  <a href={deviceFlowData.verification_uri} target="_blank" rel="noopener noreferrer">
                    click here
                  </a>
                </p>
                <div className="github-waiting-indicator">
                  <div className="loading-spinner small" />
                  <span>Waiting for authorization...</span>
                </div>
                <button className="btn btn-secondary btn-block" onClick={handleCancelLogin} style={{ marginTop: "12px" }}>
                  Cancel
                </button>
              </div>
            ) : (
              <div className="github-waiting-indicator">
                <div className="loading-spinner small" />
                <span>Connecting...</span>
              </div>
            )}

            {authError && <div className="github-error">{authError}</div>}
          </div>
        </div>
      </div>
    );
  }

  // ─── Authenticated ──────────────────────────────────────────

  return (
    <div className="github-panel">
      <div className="sidebar-header">
        <div className="sidebar-title">GitHub</div>
        <div className="sidebar-actions">
          <button className="btn-text btn-sm" onClick={handleLogout} title="Disconnect">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="github-panel-body">
        {/* User info */}
        <div className="github-user-card">
          <img className="github-avatar" src={user.avatar_url} alt={user.login} width="32" height="32" />
          <div className="github-user-info">
            <span className="github-username">{user.login}</span>
            <span className="github-user-sub">Connected</span>
          </div>
        </div>

        {/* Push result */}
        {pushResult && (
          <div className="github-success-card">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <div>
              <p className="github-success-text">Pushed successfully!</p>
              <a href={pushResult.repoUrl} target="_blank" rel="noopener noreferrer" className="github-success-link">
                Open on GitHub →
              </a>
            </div>
          </div>
        )}

        {/* Push progress */}
        {isPushing && pushProgress && (
          <div className="github-progress-card">
            <div className="github-progress-bar">
              <div className="github-progress-fill" style={{ width: `${(pushProgress.step / pushProgress.total) * 100}%` }} />
            </div>
            <span className="github-progress-text">{pushProgress.detail}</span>
          </div>
        )}

        {/* Main view — browse & open repos first; push is secondary */}
        {activeView === "main" && !isPushing && (
          <div className="github-main-browse">
            {pushError && <div className="github-error">{pushError}</div>}

            <div className="github-section-header">
              <h4 className="github-section-title">Your repositories</h4>
              <button type="button" className="btn-text btn-sm github-refresh-repos" onClick={() => loadRepos()} disabled={reposLoading}>
                Refresh
              </button>
            </div>
            <p className="github-section-desc">Open a repository in the workspace, or scroll down to push your current project.</p>

            {reposLoadError && (
              <div className="github-error github-error-row">
                <span>{reposLoadError}</span>
                <button type="button" className="btn btn-text btn-sm" onClick={loadRepos}>
                  Retry
                </button>
              </div>
            )}

            <div className="github-form-group">
              <label className="github-form-label">Search</label>
              <input
                className="github-form-input github-search-input"
                type="text"
                value={repoSearch}
                onChange={(e) => setRepoSearch(e.target.value)}
                placeholder="Search repo name, owner, or owner/repo…"
              />
            </div>

            <div className="github-form-group">
              <label className="github-form-label">Not listed?</label>
              <div className="github-inline-row">
                <input
                  className="github-form-input"
                  type="text"
                  value={manualRepoInput}
                  onChange={(e) => setManualRepoInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddRepoByFullName();
                    }
                  }}
                  placeholder="Repo name or owner/repo"
                  disabled={manualRepoLoading}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={manualRepoLoading || !manualRepoInput.trim()}
                  onClick={handleAddRepoByFullName}>
                  {manualRepoLoading ? "…" : "Add"}
                </button>
              </div>
              {manualRepoError && <div className="github-form-inline-error">{manualRepoError}</div>}
            </div>

            <div className="github-repo-list-wrap">
              {reposLoading ? (
                <div className="github-waiting-indicator">
                  <div className="loading-spinner small" />
                  <span>Loading repositories…</span>
                </div>
              ) : (
                <div className="github-repo-list github-repo-list-browse">
                {filteredRepos.map((repo) => {
                  const branch = repo.default_branch || "main";
                  const repoUrl = repo.html_url || `https://github.com/${repo.full_name}`;
                  const branchKey = repo.full_name;
                  const isBranchesOpen = !!expandedRepoBranches[branchKey];
                  const branches = repoBranchesByRepo[branchKey] || [];
                  const branchesLoading = !!repoBranchesLoading[branchKey];
                  const branchesError = repoBranchesError[branchKey];
                  return (
                    <div key={repo.id} className="github-repo-entry">
                      <div className="github-repo-row">
                        <button
                          type="button"
                          className="btn btn-primary github-repo-open-btn"
                          onClick={() => handleOpenInWorkspace(repo)}
                          title={`Open ${repo.full_name} in the workspace`}>
                          Open
                        </button>
                        <div className="github-repo-row-text">
                          <span className="github-repo-name">{repo.name}</span>
                          <span className="github-repo-owner">{repo.full_name}</span>
                        </div>
                        <div className="github-repo-row-meta">
                          <button
                            type="button"
                            className={`github-branches-toggle ${isBranchesOpen ? "open" : ""}`}
                            onClick={() => toggleRepoBranches(repo)}
                            title="Show repository branches">
                            Branches
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </button>
                          <span className="github-branch-chip">{branch}</span>
                          {repo.private && <span className="github-repo-badge private">Private</span>}
                          <a
                            href={repoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="github-repo-external"
                            title="View on GitHub"
                            onClick={(e) => e.stopPropagation()}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                              <polyline points="15 3 21 3 21 9" />
                              <line x1="10" y1="14" x2="21" y2="3" />
                            </svg>
                          </a>
                        </div>
                      </div>

                      {isBranchesOpen && (
                        <div className="github-branches-list">
                          {branchesLoading && <span className="github-branches-status">Loading branches…</span>}
                          {!branchesLoading && branchesError && <span className="github-branches-status error">{branchesError}</span>}
                          {!branchesLoading && !branchesError && branches.length === 0 && <span className="github-branches-status">No branches found.</span>}
                          {!branchesLoading &&
                            !branchesError &&
                            branches.slice(0, 30).map((b) => (
                              <span key={b.name} className={`github-branch-pill ${b.name === branch ? "current" : ""}`}>
                                {b.name}
                              </span>
                            ))}
                          {!branchesLoading && !branchesError && branches.length > 30 && <span className="github-branches-status">+{branches.length - 30} more branches</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
                {filteredRepos.length === 0 && !reposLoading && !reposLoadError && (
                  <p className="github-empty-text">
                    {repos.length === 0 ? "No repositories yet. Add one above by name." : "No repositories match your search."}
                  </p>
                )}
              </div>
              )}
            </div>

            <div className="github-push-footer">
              <h4 className="github-section-title github-section-title-spaced">Push workspace to GitHub</h4>
              <p className="github-section-desc">Publish or update the project you have open in the editor.</p>
              <div className="github-actions github-actions-stack">
                <button
                  className="github-action-card"
                  onClick={() => {
                    setActiveView("create");
                    setPushResult(null);
                    setPushError(null);
                  }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <div className="github-action-content">
                    <span className="github-action-title">Create New Repository</span>
                    <span className="github-action-desc">Push your project to a new repo</span>
                  </div>
                </button>

                <button className="github-action-card" onClick={handleShowExisting}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <div className="github-action-content">
                    <span className="github-action-title">Push to Existing Repo</span>
                    <span className="github-action-desc">Commit your workspace to a repo you choose</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create repo view */}
        {activeView === "create" && !isPushing && (
          <div className="github-create-form">
            <button
              className="btn btn-text"
              onClick={() => {
                setActiveView("main");
                setPushError(null);
                setPushResult(null);
              }}
              style={{ padding: "0", marginBottom: "8px" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Back
            </button>

            {pushError && <div className="github-error">{pushError}</div>}

            <div className="github-form-group">
              <label className="github-form-label">Repository Name</label>
              <input className="github-form-input" type="text" value={newRepoName} onChange={(e) => setNewRepoName(e.target.value.replace(/\s+/g, ""))} placeholder="my-soroban-project" autoFocus />
            </div>

            <div className="github-form-group">
              <label className="github-form-label">Description (optional)</label>
              <input className="github-form-input" type="text" value={newRepoDesc} onChange={(e) => setNewRepoDesc(e.target.value)} placeholder="A Soroban smart contract" />
            </div>

            <div className="github-form-group">
              <label className="github-form-label">Branch (optional)</label>
              <input
                className="github-form-input"
                type="text"
                value={newRepoBranch}
                onChange={(e) => setNewRepoBranch(e.target.value.replace(/\s+/g, ""))}
                placeholder="default branch (e.g. main)"
              />
            </div>

            {renderCommitMessageEditor({ onSubmit: handleCreateRepo })}

            <button className="btn btn-primary btn-block btn-lg" disabled={!newRepoName.trim() || commitSubjectEmpty} onClick={handleCreateRepo} style={{ marginTop: "8px" }}>
              Create & Push
            </button>
          </div>
        )}

        {/* Existing repos view */}
        {activeView === "existing" && !isPushing && (
          <div className="github-existing-form">
            <button
              className="btn btn-text"
              onClick={() => {
                setActiveView("main");
                setPushError(null);
                setPushResult(null);
              }}
              style={{ padding: "0", marginBottom: "8px" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Back
            </button>

            {pushError && <div className="github-error">{pushError}</div>}

            {reposLoadError && (
              <div className="github-error github-error-row">
                <span>{reposLoadError}</span>
                <button type="button" className="btn btn-text btn-sm" onClick={loadRepos}>
                  Retry
                </button>
              </div>
            )}

            {renderCommitMessageEditor({ onSubmit: null })}

            <div className="github-form-group">
              <label className="github-form-label">Target branch (optional)</label>
              <input
                className="github-form-input"
                type="text"
                value={existingTargetBranch}
                onChange={(e) => setExistingTargetBranch(e.target.value.replace(/\s+/g, ""))}
                placeholder="Leave empty to use each repo’s default branch"
              />
              <span className="github-form-hint">Commit message + repo row are required. Target branch is optional override.</span>
            </div>

            {currentWorkspaceRepo && (
              <div className="github-form-hint" style={{ marginTop: "-4px", marginBottom: "6px" }}>
                Current codebase repo pinned first: <strong>{currentWorkspaceRepo.full_name}</strong>
              </div>
            )}

            {reposLoading ? (
              <div className="github-waiting-indicator">
                <div className="loading-spinner small" />
                <span>Loading repositories...</span>
              </div>
            ) : (
              <div className="github-repo-list">
                {reposForExisting.map((repo) => {
                  const targetBranch = existingTargetBranch.trim() || getTargetBranch(repo);
                  return (
                    <button
                      key={repo.id}
                      className="github-repo-item"
                      disabled={commitSubjectEmpty}
                      title={commitSubjectEmpty ? "Enter a commit subject to push" : `Push to ${repo.full_name}`}
                      onClick={() => handlePushToExisting(repo, targetBranch)}>
                      <div className="github-repo-info">
                        <span className="github-repo-name">{repo.name}</span>
                        <span className="github-repo-owner">{repo.full_name}</span>
                        <span className="github-repo-push-hint">Pushes to branch: {targetBranch}</span>
                      </div>
                      <div className="github-repo-meta">
                        <span className="github-branch-chip">{targetBranch}</span>
                        {repo.private && <span className="github-repo-badge private">Private</span>}
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </div>
                    </button>
                  );
                })}
                {reposForExisting.length === 0 && !reposLoading && !reposLoadError && (
                  <p className="github-empty-text">
                    No repositories available right now. Click Retry to reload.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export default GitHubPanel;
