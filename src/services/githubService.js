/**
 * GitHub API service for fetching repository contents.
 *
 * v2 implementation:
 *   - Uses the Git Trees API with `recursive=1` → one request returns the
 *     entire repo tree instead of one request per folder.
 *   - Auto-attaches the signed-in user's OAuth token (via getStoredToken)
 *     so rate limits go from 60/hr anonymous to 5,000/hr authenticated.
 *   - Downloads the repository as one authenticated zipball whenever possible,
 *     avoiding one network request per file.
 *   - Falls back to the Git Trees + raw-file path if archive downloads are not
 *     available in the current browser/proxy environment.
 *   - Limits concurrent fallback file downloads so we don't starve the browser.
 */

import { getStoredToken } from "./githubAuthService";

const GITHUB_API_BASE = "https://api.github.com";
const RAW_BASE = "https://raw.githubusercontent.com";

// How many file blobs to fetch in parallel on the compatibility fallback. Keep
// this modest so the browser doesn't fan out hundreds of connections.
const MAX_FILE_CONCURRENCY = 8;
const BASE64_CHUNK_SIZE = 0x8000;

// ─── URL parsing ──────────────────────────────────────────────────────────

export const parseGithubUrl = (url) => {
  if (!url || typeof url !== "string") return null;

  const cleanUrl = url
    .trim()
    .replace(/\/+$/, "")
    .replace(/\.git$/, "");

  // Extract optional branch from /tree/<branch> path segment.
  // GitHub branch URLs: github.com/owner/repo/tree/branch-name
  // Branch names can contain slashes, so we capture everything after /tree/.
  const httpsMatch = cleanUrl.match(
    /^https?:\/\/(?:www\.)?github\.com\/([^\/]+)\/([^\/]+?)(?:\/tree\/(.+))?$/
  );
  if (httpsMatch) {
    return { owner: httpsMatch[1], repo: httpsMatch[2], branch: httpsMatch[3] || undefined };
  }

  const sshMatch = cleanUrl.match(/^git@github\.com:([^\/]+)\/([^\/]+)/);
  if (sshMatch) return { owner: sshMatch[1], repo: sshMatch[2] };

  const domainMatch = cleanUrl.match(
    /^github\.com\/([^\/]+)\/([^\/]+?)(?:\/tree\/(.+))?$/
  );
  if (domainMatch) {
    return { owner: domainMatch[1], repo: domainMatch[2], branch: domainMatch[3] || undefined };
  }

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
  "png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "ico",
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
  const token = getStoredToken();
  const isTrustedRawUrl = typeof downloadUrl === "string" && downloadUrl.startsWith(`${RAW_BASE}/`);
  const requestOptions = token && isTrustedRawUrl
    ? { headers: { Authorization: `Bearer ${token}` } }
    : undefined;
  const response = await fetch(downloadUrl, requestOptions);
  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.statusText}`);
  }
  if (isBinary) {
    const buffer = await response.arrayBuffer();
    return bytesToBase64(new Uint8Array(buffer));
  }
  return response.text();
};

/**
 * Convert bytes to base64 without spreading a whole file into one function
 * call. The chunking keeps large images, fonts, and PDFs from overflowing the
 * call stack and avoids repeatedly growing a string one byte at a time.
 */
const bytesToBase64 = (bytes) => {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + BASE64_CHUNK_SIZE));
  }
  return btoa(binary);
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

const reportCloneProgress = (onProgress, percent, message, details = {}) => {
  if (typeof onProgress !== "function") return;

  try {
    onProgress({
      percent: Math.max(0, Math.min(100, Math.round(percent))),
      message,
      ...details,
    });
  } catch (error) {
    // Progress reporting is a UI enhancement and must never abort a clone.
    console.warn("GitHub clone progress callback failed:", error?.message || error);
  }
};

const readResponseBytes = async (response, onDownloadProgress) => {
  const contentLength = Number(response.headers?.get?.("content-length"));
  const totalBytes = Number.isFinite(contentLength) && contentLength > 0 ? contentLength : 0;
  const reader = response.body?.getReader?.();

  if (!reader) {
    const buffer = await response.arrayBuffer();
    onDownloadProgress?.({ loadedBytes: buffer.byteLength, totalBytes });
    return buffer;
  }

  const chunks = [];
  let loadedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value?.byteLength) continue;
    chunks.push(value);
    loadedBytes += value.byteLength;
    onDownloadProgress?.({ loadedBytes, totalBytes });
  }

  const bytes = new Uint8Array(loadedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes.buffer;
};

const fetchRepoArchive = async (owner, repo, ref, onDownloadProgress) => {
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/zipball/${encodeURIComponent(ref)}`;
  const response = await githubFetch(url);
  return readResponseBytes(response, onDownloadProgress);
};

/**
 * Convert a flat Git Tree listing (paths with `/` separators) into a
 * nested {nodes, contents} structure compatible with the IDE's file tree.
 * Each blob becomes a file node; each tree becomes a folder node. Folder
 * nodes are created lazily when needed so we don't depend on `type: "tree"`
 * entries appearing before their children (though GitHub does emit them).
 */
const buildTreeFromEntries = (entries) => {
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
      const binary = entry.binary ?? isBinaryFile(name);
      const node = {
        id: entry.path,
        name,
        type: "file",
        children: [],
        path: entry.path,
        ...(entry.downloadUrl ? { download_url: entry.downloadUrl } : {}),
        isBinary: binary,
        ...(entry.size !== undefined ? { size: entry.size } : {}),
      };
      parentChildren.push(node);
      files.push({ node, binary, loadContent: entry.loadContent });
    }
    // "commit" entries (submodules) are ignored.
  }

  return { nodes: rootChildren, files };
};

const buildTreeFromFlatList = (entries, owner, repo, ref) => {
  const rawRef = ref
    .split("/")
    .map(encodeURIComponent)
    .join("/");

  const normalizedEntries = entries.map((entry) => {
    if (entry.type !== "blob") return entry;

    const binary = isBinaryFile(entry.path);
    const rawUrl = `${RAW_BASE}/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${rawRef}/${entry.path
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;

    return {
      ...entry,
      binary,
      downloadUrl: rawUrl,
      loadContent: () => fetchFileContent(rawUrl, binary),
    };
  });

  return buildTreeFromEntries(normalizedEntries);
};

const normalizeArchivePath = (archiveName, archiveRoot) => {
  let path = archiveName.replace(/\\/g, "/").replace(/^\/+/, "");
  if (archiveRoot && path === archiveRoot) return "";
  if (archiveRoot && path.startsWith(`${archiveRoot}/`)) {
    path = path.slice(archiveRoot.length + 1);
  }

  const parts = path.split("/").filter((part) => part && part !== ".");
  if (parts.some((part) => part === "..")) return null;
  return parts.join("/");
};

/**
 * Turn a GitHub zipball into the same tree/file descriptors as the raw-file
 * fallback. GitHub archives contain one generated top-level directory, which
 * is stripped so the IDE still shows paths relative to the repository root.
 */
const buildTreeFromArchive = async (archiveBuffer, owner, repo, ref) => {
  const { default: JSZip } = await import("jszip");
  const archive = await JSZip.loadAsync(archiveBuffer);
  const zipEntries = Object.values(archive.files);
  const firstPath = zipEntries.find((entry) => entry.name)?.name || "";
  const archiveRoot = firstPath.split("/").filter(Boolean)[0] || "";
  const rawRef = ref
    .split("/")
    .map(encodeURIComponent)
    .join("/");

  const entries = [];
  for (const zipEntry of zipEntries) {
    const path = normalizeArchivePath(zipEntry.name, archiveRoot);
    if (!path) continue;

    if (zipEntry.dir) {
      entries.push({ type: "tree", path });
      continue;
    }

    const binary = isBinaryFile(path);
    const rawUrl = `${RAW_BASE}/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${rawRef}/${path
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;

    entries.push({
      type: "blob",
      path,
      binary,
      downloadUrl: rawUrl,
      loadContent: async () => {
        if (binary) {
          return bytesToBase64(await zipEntry.async("uint8array"));
        }
        return zipEntry.async("string");
      },
    });
  }

  return buildTreeFromEntries(entries);
};

// ─── Public: clone a repository ───────────────────────────────────────────

export const cloneRepository = async (githubUrl, onProgress) => {
  const parsed = parseGithubUrl(githubUrl);
  if (!parsed) {
    throw new Error("Invalid GitHub URL. Please use format: https://github.com/owner/repo");
  }

  const { owner, repo, branch: urlBranch } = parsed;
  let lastReportedPercent = -1;
  const report = (percent, message, details = {}) => {
    const roundedPercent = Math.max(lastReportedPercent, Math.max(0, Math.min(100, Math.round(percent))));
    if (roundedPercent === lastReportedPercent && !details.force) return;
    lastReportedPercent = roundedPercent;
    reportCloneProgress(onProgress, roundedPercent, message, details);
  };

  report(0, "Starting clone...");
  report(5, "Loading repository metadata...");
  const repoInfo = await fetchRepoInfo(owner, repo);
  // Use branch from URL (e.g. /tree/feature-x) if present, else repo default.
  const defaultBranch = urlBranch || repoInfo.default_branch || "main";

  let workspaceSource;
  let sourceType = "archive";
  try {
    // The archive endpoint returns the whole snapshot in one request and also
    // works for private repositories when the stored OAuth token is attached.
    report(8, "Preparing repository archive...");
    workspaceSource = await buildTreeFromArchive(
      await fetchRepoArchive(owner, repo, defaultBranch, ({ loadedBytes, totalBytes }) => {
        if (totalBytes > 0) {
          const downloadRatio = Math.min(1, loadedBytes / totalBytes);
          report(10 + downloadRatio * 55, "Downloading repository archive...", {
            loadedBytes,
            totalBytes,
            indeterminate: false,
          });
        } else {
          report(10, "Downloading repository archive...", {
            loadedBytes,
            totalBytes,
            indeterminate: true,
          });
        }
      }),
      owner,
      repo,
      defaultBranch,
    );
    report(70, "Unpacking repository archive...");
  } catch (archiveError) {
    // Some browser/proxy combinations block the archive redirect. Preserve
    // the existing tree/raw implementation as a compatibility fallback.
    sourceType = "tree";
    console.warn("GitHub archive download unavailable; falling back to file downloads:", archiveError?.message || archiveError);

    report(20, "Reading repository tree...", { force: true, indeterminate: false });
    const tree = await fetchFullTree(owner, repo, defaultBranch);
    if (tree.truncated) {
      throw new Error(
        "Repository is too large to clone via the GitHub API. Please clone a subdirectory or use a smaller repo."
      );
    }

    report(38, "Building repository file tree...", { force: true, indeterminate: false });
    workspaceSource = buildTreeFromFlatList(tree.tree || [], owner, repo, defaultBranch);
  }

  const { nodes, files } = workspaceSource;
  const contentStart = sourceType === "archive" ? 72 : 42;
  const contentEnd = 96;
  report(contentStart, files.length ? `Loading files (0/${files.length})...` : "Finalizing clone...", {
    force: true,
    indeterminate: false,
  });

  // Download file contents in parallel with a concurrency cap. Failures on
  // individual files don't abort the whole clone — we substitute a placeholder
  // so the user still gets a working workspace and can retry a single file.
  const contents = {};
  let completedFiles = 0;
  await parallelMap(files, MAX_FILE_CONCURRENCY, async ({ node, binary, loadContent }) => {
    try {
      contents[node.id] = await loadContent();
    } catch (err) {
      console.warn(`Failed to fetch ${node.path}:`, err?.message || err);
      contents[node.id] = binary ? "" : `// Error loading ${node.name}\n`;
    } finally {
      completedFiles += 1;
      const fileRatio = files.length ? completedFiles / files.length : 1;
      report(contentStart + fileRatio * (contentEnd - contentStart), `Loading files (${completedFiles}/${files.length})...`);
    }
  });

  report(100, "Clone complete.", { force: true, indeterminate: false });
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
