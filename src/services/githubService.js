/**
 * GitHub API service for fetching repository contents.
 *
 * v2 implementation:
 *   - Uses the Git Trees API with `recursive=1` → one request returns the
 *     entire repo tree instead of one request per folder.
 *   - Auto-attaches the signed-in user's OAuth token (via getStoredToken)
 *     so rate limits go from 60/hr anonymous to 5,000/hr authenticated.
 *   - Downloads file blobs from raw.githubusercontent.com, which is CDN-served
 *     and does not count against the REST API rate-limit bucket.
 *   - Limits concurrent file downloads so we don't starve the browser.
 */

import { getStoredToken } from "./githubAuthService";

const GITHUB_API_BASE = "https://api.github.com";
const RAW_BASE = "https://raw.githubusercontent.com";

// How many file blobs to fetch in parallel. Keep this modest so the browser
// doesn't fan out hundreds of connections on large repos.
const MAX_FILE_CONCURRENCY = 8;

// ─── URL parsing ──────────────────────────────────────────────────────────

export const parseGithubUrl = (url) => {
  if (!url || typeof url !== "string") return null;

  const cleanUrl = url
    .trim()
    .replace(/\/+$/, "")
    .replace(/\.git$/, "");

  const httpsMatch = cleanUrl.match(/^https?:\/\/(?:www\.)?github\.com\/([^\/]+)\/([^\/]+)/);
  if (httpsMatch) return { owner: httpsMatch[1], repo: httpsMatch[2] };

  const sshMatch = cleanUrl.match(/^git@github\.com:([^\/]+)\/([^\/]+)/);
  if (sshMatch) return { owner: sshMatch[1], repo: sshMatch[2] };

  const domainMatch = cleanUrl.match(/^github\.com\/([^\/]+)\/([^\/]+)/);
  if (domainMatch) return { owner: domainMatch[1], repo: domainMatch[2] };

  const shortMatch = cleanUrl.match(/^([^\/]+)\/([^\/]+)$/);
  if (shortMatch) return { owner: shortMatch[1], repo: shortMatch[2] };

  return null;
};

// ─── Fetch helpers ────────────────────────────────────────────────────────

const buildHeaders = () => {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = getStoredToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const formatRateLimitError = (response) => {
  // GitHub returns the reset epoch in the `x-ratelimit-reset` header when the
  // unauthenticated or authenticated bucket is exhausted. Surface a friendly
  // timestamp + sign-in hint so users understand why the clone failed.
  const resetSec = Number(response.headers.get("x-ratelimit-reset"));
  const signedIn = !!getStoredToken();
  const suffix = signedIn
    ? ""
    : " Sign in to GitHub inside the IDE to raise your limit to 5,000 requests/hour.";

  if (Number.isFinite(resetSec) && resetSec > 0) {
    const resetMs = resetSec * 1000 - Date.now();
    if (resetMs > 0) {
      const mins = Math.ceil(resetMs / 60000);
      return `GitHub API rate limit exceeded. Try again in ~${mins} min.${suffix}`;
    }
  }
  return `GitHub API rate limit exceeded.${suffix}`;
};

const githubFetch = async (url) => {
  const response = await fetch(url, { headers: buildHeaders() });
  if (response.ok) return response;

  if (response.status === 403 || response.status === 429) {
    const remaining = response.headers.get("x-ratelimit-remaining");
    if (remaining === "0" || response.status === 429) {
      throw new Error(formatRateLimitError(response));
    }
  }
  if (response.status === 404) {
    throw new Error("Repository or path not found.");
  }
  throw new Error(`GitHub API error: ${response.statusText} (${response.status})`);
};

// ─── Public: single-path contents fetch (kept for back-compat) ────────────

export const fetchRepoContents = async (owner, repo, path = "") => {
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}`;
  const response = await githubFetch(url);
  const data = await response.json();
  return Array.isArray(data) ? data : [data];
};

// ─── File content download ────────────────────────────────────────────────

const BINARY_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "bmp", "ico",
  "pdf", "zip", "tar", "gz", "bz2", "7z",
  "exe", "dll", "so", "dylib",
  "woff", "woff2", "ttf", "otf", "eot",
  "mp3", "mp4", "mov", "wav", "ogg", "webm",
  "wasm",
]);

const isBinaryFile = (filename) => {
  const ext = filename.split(".").pop()?.toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
};

export const fetchFileContent = async (downloadUrl, isBinary = false) => {
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.statusText}`);
  }
  if (isBinary) {
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }
  return response.text();
};

// ─── Concurrency-limited parallel map ─────────────────────────────────────

const parallelMap = async (items, limit, worker) => {
  const results = new Array(items.length);
  let nextIndex = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = nextIndex++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
};

// ─── Git Trees API: fetch the whole tree in one request ───────────────────

const fetchRepoInfo = async (owner, repo) => {
  const response = await githubFetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`);
  return response.json();
};

const fetchFullTree = async (owner, repo, ref) => {
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`;
  const response = await githubFetch(url);
  return response.json();
};

/**
 * Convert a flat Git Tree listing (paths with `/` separators) into a
 * nested {nodes, contents} structure compatible with the IDE's file tree.
 * Each blob becomes a file node; each tree becomes a folder node. Folder
 * nodes are created lazily when needed so we don't depend on `type: "tree"`
 * entries appearing before their children (though GitHub does emit them).
 */
const buildTreeFromFlatList = (entries, owner, repo, ref) => {
  const rootChildren = [];
  const folderMap = new Map(); // path -> children array

  const getFolder = (parts) => {
    if (parts.length === 0) return rootChildren;
    const key = parts.join("/");
    if (folderMap.has(key)) return folderMap.get(key);

    // Walk up and ensure parent folders exist.
    const parent = getFolder(parts.slice(0, -1));
    const name = parts[parts.length - 1];
    let node = parent.find((n) => n.type === "folder" && n.name === name);
    if (!node) {
      node = { id: key, name, type: "folder", children: [] };
      parent.push(node);
    }
    folderMap.set(key, node.children);
    return node.children;
  };

  // Sort: trees first, then blobs — gives us stable parent-before-child order.
  const sorted = [...entries].sort((a, b) => {
    if (a.type !== b.type) return a.type === "tree" ? -1 : 1;
    return a.path.localeCompare(b.path);
  });

  const files = [];

  for (const entry of sorted) {
    const parts = entry.path.split("/");
    const name = parts[parts.length - 1];

    if (entry.type === "tree") {
      getFolder(parts);
    } else if (entry.type === "blob") {
      const parentChildren = getFolder(parts.slice(0, -1));
      const binary = isBinaryFile(name);
      const rawUrl = `${RAW_BASE}/${owner}/${repo}/${ref}/${entry.path
        .split("/")
        .map(encodeURIComponent)
        .join("/")}`;
      const node = {
        id: entry.path,
        name,
        type: "file",
        children: [],
        path: entry.path,
        download_url: rawUrl,
        isBinary: binary,
        size: entry.size,
      };
      parentChildren.push(node);
      files.push({ node, binary, rawUrl });
    }
    // "commit" entries (submodules) are ignored.
  }

  return { nodes: rootChildren, files };
};

// ─── Public: clone a repository ───────────────────────────────────────────

export const cloneRepository = async (githubUrl) => {
  const parsed = parseGithubUrl(githubUrl);
  if (!parsed) {
    throw new Error("Invalid GitHub URL. Please use format: https://github.com/owner/repo");
  }

  const { owner, repo } = parsed;

  const repoInfo = await fetchRepoInfo(owner, repo);
  const defaultBranch = repoInfo.default_branch || "main";

  const tree = await fetchFullTree(owner, repo, defaultBranch);
  if (tree.truncated) {
    // Fallback path: the repo is larger than what the recursive trees API
    // can return (>100k entries / ~7MB). Very rare for Soroban projects;
    // surface a clear message rather than silently returning a partial tree.
    throw new Error(
      "Repository is too large to clone via the GitHub API. Please clone a subdirectory or use a smaller repo."
    );
  }

  const { nodes, files } = buildTreeFromFlatList(tree.tree || [], owner, repo, defaultBranch);

  // Download file contents in parallel with a concurrency cap. Failures on
  // individual files don't abort the whole clone — we substitute a placeholder
  // so the user still gets a working workspace and can retry a single file.
  const contents = {};
  await parallelMap(files, MAX_FILE_CONCURRENCY, async ({ node, binary, rawUrl }) => {
    try {
      contents[node.id] = await fetchFileContent(rawUrl, binary);
    } catch (err) {
      console.warn(`Failed to fetch ${node.path}:`, err?.message || err);
      contents[node.id] = binary ? "" : `// Error loading ${node.name}\n`;
    }
  });

  const rootName = repoInfo.name || repo;
  const wrappedTree = [
    {
      id: rootName,
      name: rootName,
      type: "folder",
      children: nodes,
    },
  ];

  return {
    tree: wrappedTree,
    contents,
    repoName: rootName,
  };
};
