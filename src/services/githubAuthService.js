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
    throw new Error(formatGithubError(errorData, `Failed to fetch user info (Status: ${res.status})`));
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
    throw new Error(formatGithubError(errorData, `Failed to list repositories (Status: ${res.status})`));
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
    throw new Error(formatGithubError(data, "Failed to create repository"));
  }

  return res.json();
};

// ─── Helpers ──────────────────────────────────────────────────────
/**
 * Check if a file is binary based on extension.
 * This ensures we use correct encoding when pushing to GitHub.
 */
const isBinaryFile = (filename) => {
  const ext = filename.split(".").pop()?.toLowerCase();
  return ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "ico", "pdf", "zip", "tar", "gz", "exe", "dll"].includes(ext);
};

/**
 * Format GitHub API error response into a human-readable message.
 * Extracts details from data.errors if present.
 */
const formatGithubError = (data, defaultMsg) => {
  if (!data) return defaultMsg;
  
  if (data.errors && Array.isArray(data.errors)) {
    const details = data.errors.map(err => {
      if (typeof err === "string") return err;
      if (err.message) return err.message;
      if (err.field) return `${err.field} ${err.code || "invalid"}`;
      return JSON.stringify(err);
    }).join(", ");
    
    if (details) return details;
  }
  
  return data.message || defaultMsg;
};

// ─── Push Files ──────────────────────────────────────────────────

/**
 * Push all workspace files to a GitHub repo using the Git Trees API.
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
    console.log(`[GitHub Service] Checking state for branch '${branch}' in ${owner}/${repo}...`);
    let refRes = await fetch(`${apiBase}/git/ref/heads/${branch}`, { headers });
    
    if (refRes.status === 409 || refRes.status === 404) {
      // 409 = Git Repository is empty (no commits yet). 
      // WE MUST SEED IT using the Contents API first because Git Data API fails on empty repos.
      console.log(`[GitHub Service] Repository is truly empty. Seeding initial commit...`);
      
      const filePaths = Object.keys(files);
      if (filePaths.length === 0) throw new Error("No files to push.");
      
      // Pick a file to seed (e.g. .gitignore or the first file found)
      const seedPath = filePaths.find(p => p.includes('.gitignore')) || filePaths[0];
      const seedContent = files[seedPath];
      const isBinary = isBinaryFile(seedPath);

      console.log(`[GitHub Service] Seeding with file: ${seedPath}`);
      const seedRes = await fetch(`${apiBase}/contents/${seedPath}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          message: "Initial seed commit",
          content: isBinary ? seedContent : btoa(seedContent),
          branch: branch
        })
      });

      if (!seedRes.ok) {
        const seedError = await seedRes.json().catch(() => ({}));
        throw new Error(`Failed to seed empty repository: ${formatGithubError(seedError, seedRes.status)}`);
      }
      
      console.log(`[GitHub Service] Repository seeded successfully. Refreshing state...`);
      // Refresh ref status after seeding
      refRes = await fetch(`${apiBase}/git/ref/heads/${branch}`, { headers });
    }

    if (refRes.ok) {
      const refData = await refRes.json();
      latestCommitSha = refData.object.sha;
      console.log(`[GitHub Service] Found latest commit: ${latestCommitSha}`);

      const commitRes = await fetch(`${apiBase}/git/commits/${latestCommitSha}`, { headers });
      if (commitRes.ok) {
        const commitData = await commitRes.json();
        baseTreeSha = commitData.tree.sha;
        console.log(`[GitHub Service] Found base tree: ${baseTreeSha}`);
      }
    } else {
      const errorData = await refRes.json().catch(() => ({}));
      throw new Error(formatGithubError(errorData, `Failed to check repository state (Status: ${refRes.status})`));
    }
  } catch (err) {
    throw err;
  }

  // Step 2: Create blobs for each file
  onProgress?.(2, 5, "Uploading files...");

  const treeItems = [];
  const filePaths = Object.keys(files);

  if (filePaths.length === 0) {
    throw new Error("No files found to push.");
  }

  for (let i = 0; i < filePaths.length; i++) {
    const path = filePaths[i];
    const content = files[path];
    const isBinary = isBinaryFile(path);

    const blobRes = await fetch(`${apiBase}/git/blobs`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        content,
        encoding: isBinary ? "base64" : "utf-8",
      }),
    });

    if (!blobRes.ok) {
      const errorData = await blobRes.json().catch(() => ({}));
      throw new Error(formatGithubError(errorData, `Failed to upload ${path} (Status: ${blobRes.status})`));
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
  // ONLY include base_tree if it actually exists. Omit it for the first commit.
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
    const detail = formatGithubError(errorData, "");
    throw new Error(`Git Tree Creation Failed: ${detail || `Status ${treeRes.status}`}`);
  }
  const treeData = await treeRes.json();

  // Step 4: Create commit
  onProgress?.(4, 5, "Creating commit...");

  const commitBody = {
    message,
    tree: treeData.sha,
  };
  // ONLY include parents if latestCommitSha exists. Omit for the root commit.
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
    throw new Error(formatGithubError(errorData, `Failed to create commit (Status: ${commitRes.status})`));
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
      throw new Error(formatGithubError(errorData, `Failed to update branch '${branch}' (Status: ${updateRes.status})`));
    }
  } else {
    // Create new ref (first commit to the repo)
    console.log(`[GitHub Service] Creating initial reference for branch '${branch}'...`);
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
      const detail = formatGithubError(errorData, "");
      // If reference already exists (rare race condition), try to PATCH it instead
      if (detail?.includes("already exists") || createRes.status === 422) {
        console.log(`[GitHub Service] Branch '${branch}' already exists. Attempting PATCH instead.`);
        const patchRes = await fetch(`${apiBase}/git/refs/heads/${branch}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ sha: commitData.sha }),
        });
        if (!patchRes.ok) {
          throw new Error(`Failed to update branch '${branch}' (Status: ${patchRes.status})`);
        }
      } else {
        throw new Error(`Failed to initialize branch '${branch}': ${detail || `Status ${createRes.status}`}`);
      }
    }
  }

  return {
    commitSha: commitData.sha,
    commitUrl: commitData.html_url || `https://github.com/${owner}/${repo}/commit/${commitData.sha}`,
    repoUrl: `https://github.com/${owner}/${repo}`,
  };
};
