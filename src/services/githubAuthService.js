/**
 * GitHub OAuth Device Flow & Repository Operations Service.
 *
 * Uses the GitHub Device Flow for client-side OAuth without a callback URL.
 * All GitHub API requests are proxied through the Go backend at /api/github/*
 * to bypass CORS restrictions.
 */

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

// ─── Configuration ───────────────────────────────────────────────
// Replace with your GitHub OAuth App Client ID
const GITHUB_CLIENT_ID = "Ov23li7uPMtNXMbRAUEK";
const GITHUB_SCOPES = "repo";

// ─── Token Persistence ──────────────────────────────────────────
const TOKEN_KEY = "soroban_github_token";
const USER_KEY = "soroban_github_user";

export const getStoredToken = () => localStorage.getItem(TOKEN_KEY);
export const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
};

export const storeAuth = (token, user) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearAuth = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

// ─── Device Flow ─────────────────────────────────────────────────

/**
 * Step 1: Request a device code from GitHub.
 * Returns { device_code, user_code, verification_uri, expires_in, interval }
 */
export const initiateDeviceFlow = async () => {
  const res = await fetch(`${API_BASE}/github/device-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      scope: GITHUB_SCOPES,
    }),
  });

  if (!res.ok) {
    throw new Error("Failed to initiate GitHub Device Flow");
  }

  return res.json();
};

/**
 * Step 2: Poll GitHub until the user authorizes the device.
 * @param {string} deviceCode - from initiateDeviceFlow()
 * @param {number} interval - poll interval in seconds
 * @param {AbortSignal} signal - for cancellation
 * @returns {Promise<string>} access_token
 */
export const pollForToken = async (deviceCode, interval = 5, signal) => {
  const pollInterval = Math.max(interval, 5) * 1000;

  while (true) {
    if (signal?.aborted) throw new Error("Authorization cancelled");

    await new Promise((resolve) => setTimeout(resolve, pollInterval));

    const res = await fetch(`${API_BASE}/github/access-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        device_code: deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }),
      signal,
    });

    if (!res.ok) continue;

    const data = await res.json();

    if (data.access_token) {
      return data.access_token;
    }

    if (data.error === "authorization_pending") {
      continue; // User hasn't authorized yet
    }

    if (data.error === "slow_down") {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      continue;
    }

    if (data.error === "expired_token") {
      throw new Error("Device code expired. Please try again.");
    }

    if (data.error === "access_denied") {
      throw new Error("Authorization denied by user.");
    }
  }
};

// ─── User Info ───────────────────────────────────────────────────

/**
 * Fetch the authenticated user's profile.
 */
export const getUserInfo = async (token) => {
  const res = await fetch(`${API_BASE}/github/api/user`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    if (res.status === 401) {
      clearAuth();
      throw new Error("Token expired. Please reconnect.");
    }
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to fetch user info (Status: ${res.status})`);
  }

  return res.json();
};

// ─── Repository Operations ───────────────────────────────────────

/**
 * List the authenticated user's repositories (sorted by most recently updated).
 */
export const listUserRepos = async (token, page = 1) => {
  const res = await fetch(`${API_BASE}/github/repos?page=${page}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to list repositories (Status: ${res.status})`);
  }
  return res.json();
};

/**
 * Create a new repository for the authenticated user.
 */
export const createRepository = async (token, name, isPrivate = false, description = "") => {
  const res = await fetch(`${API_BASE}/github/api/user/repos`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      private: isPrivate,
      description,
      auto_init: true,
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Failed to create repository");
  }

  return res.json();
};

// ─── Push Files ──────────────────────────────────────────────────

/**
 * Push all workspace files to a GitHub repo using the Git Trees API.
 * Creates a single commit with all files (atomic).
 *
 * @param {string} token - GitHub access token
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {Object} files - { "path/to/file": "content" }
 * @param {string} message - Commit message
 * @param {Function} onProgress - Optional progress callback (step, total, detail)
 */
export const pushFilesToRepo = async (token, owner, repo, files, message = "Push from Soroban Studio", onProgress, branch = "main") => {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const apiBase = `${API_BASE}/github/api/repos/${owner}/${repo}`;

  // Step 1: Get the latest commit SHA on default branch
  onProgress?.(1, 5, "Getting latest commit...");

  let latestCommitSha = null;
  let baseTreeSha = null;

  try {
    const refRes = await fetch(`${apiBase}/git/ref/heads/${branch}`, { headers });
    if (refRes.ok) {
      const refData = await refRes.json();
      latestCommitSha = refData.object.sha;

      // Get the tree of the latest commit
      const commitRes = await fetch(`${apiBase}/git/commits/${latestCommitSha}`, { headers });
      if (commitRes.ok) {
        const commitData = await commitRes.json();
        baseTreeSha = commitData.tree.sha;
      }
    } else if (refRes.status === 409 || refRes.status === 404) {
      // 409 = Git Repository is empty (no commits yet)
      // 404 = Branch doesn't exist
      console.log(`[GitHub Service] Repository is empty or branch '${branch}' not found. Starting fresh.`);
    }
  } catch (err) {
    console.warn("[GitHub Service] Step 1 failed, assuming empty repo:", err);
  }

  // Step 2: Create blobs for each file
  onProgress?.(2, 5, "Uploading files...");

  const treeItems = [];
  const filePaths = Object.keys(files);

  for (let i = 0; i < filePaths.length; i++) {
    const path = filePaths[i];
    const content = files[path];

    const blobRes = await fetch(`${apiBase}/git/blobs`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        content,
        encoding: "utf-8",
      }),
    });

    if (!blobRes.ok) {
      const errorData = await blobRes.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to create blob for ${path} (Status: ${blobRes.status})`);
    }

    const blobData = await blobRes.json();
    treeItems.push({
      path,
      mode: "100644",
      type: "blob",
      sha: blobData.sha,
    });
  }

  // Step 3: Create a new tree
  onProgress?.(3, 5, "Creating file tree...");

  const treeBody = { tree: treeItems };
  if (baseTreeSha) {
    treeBody.base_tree = baseTreeSha;
  }

  const treeRes = await fetch(`${apiBase}/git/trees`, {
    method: "POST",
    headers,
    body: JSON.stringify(treeBody),
  });

  if (!treeRes.ok) {
    const errorData = await treeRes.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to create Git tree (Status: ${treeRes.status})`);
  }
  const treeData = await treeRes.json();

  // Step 4: Create commit
  onProgress?.(4, 5, "Creating commit...");

  const commitBody = {
    message,
    tree: treeData.sha,
  };
  if (latestCommitSha) {
    commitBody.parents = [latestCommitSha];
  }

  const commitRes = await fetch(`${apiBase}/git/commits`, {
    method: "POST",
    headers,
    body: JSON.stringify(commitBody),
  });

  if (!commitRes.ok) {
    const errorData = await commitRes.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to create commit (Status: ${commitRes.status})`);
  }
  const commitData = await commitRes.json();

  // Step 5: Update branch reference
  onProgress?.(5, 5, "Updating branch...");

  if (latestCommitSha) {
    // Update existing ref
    const updateRes = await fetch(`${apiBase}/git/refs/heads/${branch}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ sha: commitData.sha }),
    });
    if (!updateRes.ok) {
      const errorData = await updateRes.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to update branch reference (Status: ${updateRes.status})`);
    }
  } else {
    // Create new ref (first commit to the repo)
    const createRes = await fetch(`${apiBase}/git/refs`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        ref: `refs/heads/${branch}`,
        sha: commitData.sha,
      }),
    });
    if (!createRes.ok) {
      const errorData = await createRes.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to create branch reference (Status: ${createRes.status})`);
    }
  }

  return {
    commitSha: commitData.sha,
    commitUrl: commitData.html_url || `https://github.com/${owner}/${repo}/commit/${commitData.sha}`,
    repoUrl: `https://github.com/${owner}/${repo}`,
  };
};
