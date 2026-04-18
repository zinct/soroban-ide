import React, { memo, useState, useCallback, useEffect, useRef } from "react";
import {
  getStoredToken,
  getStoredUser,
  storeAuth,
  clearAuth,
  initiateDeviceFlow,
  pollForToken,
  getUserInfo,
  listUserRepos,
  createRepository,
  pushFilesToRepo,
} from "../../services/githubAuthService";
import { collectProjectFiles } from "../../services/backendService";

/**
 * GitHub Panel — replaces the file explorer in the sidebar.
 * Handles OAuth Device Flow login, repo creation, and pushing files.
 */
const GitHubPanel = memo(({ treeData, fileContents }) => {
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
  const [repoSearch, setRepoSearch] = useState("");

  // Create repo state
  const [newRepoName, setNewRepoName] = useState("");
  const [newRepoDesc, setNewRepoDesc] = useState("");

  // Push state
  const [isPushing, setIsPushing] = useState(false);
  const [pushProgress, setPushProgress] = useState(null);
  const [pushResult, setPushResult] = useState(null);
  const [pushError, setPushError] = useState(null);

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
      const accessToken = await pollForToken(
        data.device_code,
        data.interval,
        abortRef.current.signal
      );

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
    try {
      const data = await listUserRepos(token);
      setRepos(data);
    } catch (err) {
      console.error("Failed to load repos:", err);
    } finally {
      setReposLoading(false);
    }
  }, [token]);

  const handleShowExisting = useCallback(() => {
    setActiveView("existing");
    setPushResult(null);
    setPushError(null);
    loadRepos();
  }, [loadRepos]);

  const handleCreateRepo = useCallback(async () => {
    if (!newRepoName.trim() || !token) return;
    setIsPushing(true);
    setPushError(null);
    setPushResult(null);
    setPushProgress({ step: 0, total: 6, detail: "Creating repository..." });

    try {
      const repo = await createRepository(token, newRepoName.trim(), false, newRepoDesc.trim());
      setPushProgress({ step: 1, total: 6, detail: "Repository created! Pushing files..." });

      const files = collectProjectFiles(treeData, fileContents, { includeAll: true });
      const result = await pushFilesToRepo(
        token,
        repo.owner.login,
        repo.name,
        files,
        "Initial commit from Soroban Studio",
        (step, total, detail) => setPushProgress({ step: step + 1, total: total + 1, detail }),
        repo.default_branch || "main"
      );

      setPushResult({ ...result, repoUrl: `https://github.com/${repo.full_name}` });
      setNewRepoName("");
      setNewRepoDesc("");
    } catch (err) {
      setPushError(err.message);
    } finally {
      setIsPushing(false);
      setPushProgress(null);
    }
  }, [token, newRepoName, newRepoDesc, treeData, fileContents]);

  const handlePushToExisting = useCallback(
    async (repo) => {
      if (!token) return;
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
          "Update from Soroban Studio",
          (step, total, detail) => setPushProgress({ step, total, detail }),
          repo.default_branch || "main"
        );

        setPushResult(result);
      } catch (err) {
        setPushError(err.message);
      } finally {
        setIsPushing(false);
        setPushProgress(null);
      }
    },
    [token, treeData, fileContents]
  );

  // ─── Filtered repos ─────────────────────────────────────────

  const filteredRepos = repos.filter((r) =>
    r.full_name.toLowerCase().includes(repoSearch.toLowerCase())
  );

  // ─── Render Helpers ─────────────────────────────────────────

  const renderGithubIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );

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
            <p className="github-login-desc">
              Sign in to push your Soroban project to GitHub
            </p>

            {!isLoggingIn ? (
              <button className="github-login-btn" onClick={handleLogin}>
                {renderGithubIcon()}
                <span>Sign in with GitHub</span>
              </button>
            ) : deviceFlowData ? (
              <div className="github-device-flow">
                <p className="github-device-instruction">
                  Enter this code on GitHub:
                </p>
                <div className="github-device-code" onClick={handleCopyCode} title="Click to copy">
                  {deviceFlowData.user_code}
                  {copied && <span className="github-code-tooltip">Copied!</span>}
                </div>
                <p className="github-device-hint">
                  A new tab has been opened. If not,{" "}
                  <a
                    href={deviceFlowData.verification_uri}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    click here
                  </a>
                </p>
                <div className="github-waiting-indicator">
                  <div className="loading-spinner small" />
                  <span>Waiting for authorization...</span>
                </div>
                <button className="github-cancel-btn" onClick={handleCancelLogin}>
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
          <button className="github-logout-btn" onClick={handleLogout} title="Disconnect">
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
          <img
            className="github-avatar"
            src={user.avatar_url}
            alt={user.login}
            width="32"
            height="32"
          />
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
              <a
                href={pushResult.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="github-success-link"
              >
                Open on GitHub →
              </a>
            </div>
          </div>
        )}

        {/* Push progress */}
        {isPushing && pushProgress && (
          <div className="github-progress-card">
            <div className="github-progress-bar">
              <div
                className="github-progress-fill"
                style={{ width: `${(pushProgress.step / pushProgress.total) * 100}%` }}
              />
            </div>
            <span className="github-progress-text">{pushProgress.detail}</span>
          </div>
        )}

        {/* Main view */}
        {activeView === "main" && !isPushing && (
          <div className="github-actions">
            {pushError && <div className="github-error">{pushError}</div>}
            <button
              className="github-action-card"
              onClick={() => {
                setActiveView("create");
                setPushResult(null);
                setPushError(null);
              }}
            >
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
                <span className="github-action-title">Push to Existing</span>
                <span className="github-action-desc">Update an existing repository</span>
              </div>
            </button>
          </div>
        )}

        {/* Create repo view */}
        {activeView === "create" && !isPushing && (
          <div className="github-create-form">
            <button
              className="github-back-btn"
              onClick={() => {
                setActiveView("main");
                setPushError(null);
                setPushResult(null);
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Back
            </button>

            {pushError && <div className="github-error">{pushError}</div>}

            <div className="github-form-group">
              <label className="github-form-label">Repository Name</label>
              <input
                className="github-form-input"
                type="text"
                value={newRepoName}
                onChange={(e) => setNewRepoName(e.target.value.replace(/\s+/g, ""))}
                placeholder="my-soroban-project"
                autoFocus
              />
            </div>

            <div className="github-form-group">
              <label className="github-form-label">Description (optional)</label>
              <input
                className="github-form-input"
                type="text"
                value={newRepoDesc}
                onChange={(e) => setNewRepoDesc(e.target.value)}
                placeholder="A Soroban smart contract"
              />
            </div>


            <button
              className="github-push-btn"
              disabled={!newRepoName.trim()}
              onClick={handleCreateRepo}
            >
              Create & Push
            </button>
          </div>
        )}

        {/* Existing repos view */}
        {activeView === "existing" && !isPushing && (
          <div className="github-existing-form">
            <button
              className="github-back-btn"
              onClick={() => {
                setActiveView("main");
                setPushError(null);
                setPushResult(null);
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Back
            </button>

            {pushError && <div className="github-error">{pushError}</div>}

            <input
              className="github-form-input github-search-input"
              type="text"
              value={repoSearch}
              onChange={(e) => setRepoSearch(e.target.value)}
              placeholder="Search repositories..."
            />

            {reposLoading ? (
              <div className="github-waiting-indicator">
                <div className="loading-spinner small" />
                <span>Loading repositories...</span>
              </div>
            ) : (
              <div className="github-repo-list">
                {filteredRepos.map((repo) => (
                  <button
                    key={repo.id}
                    className="github-repo-item"
                    onClick={() => handlePushToExisting(repo)}
                  >
                    <div className="github-repo-info">
                      <span className="github-repo-name">{repo.name}</span>
                      <span className="github-repo-owner">{repo.full_name}</span>
                    </div>
                    <div className="github-repo-meta">
                      {repo.private && (
                        <span className="github-repo-badge private">Private</span>
                      )}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  </button>
                ))}
                {filteredRepos.length === 0 && !reposLoading && (
                  <p className="github-empty-text">No repositories found</p>
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
