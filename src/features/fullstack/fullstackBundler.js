/**
 * Workspace → Vercel deploy bundle.
 *
 * `treeData` mirrors the file explorer:
 *   [{ id, name, type: "folder", children: [{ id, name, type: "file" | "folder", children?, ... }] }]
 * `fileContents` is keyed by node id.
 *
 * We detect the most likely frontend root (frontend/, web/, app/, ui/, client/, site/),
 * walk the tree from there, skip noise (node_modules, target, dist, .git, .next, build
 * caches, binary blobs), and SHA1-hash each file's bytes so Vercel can dedupe
 * via `POST /v2/files`.
 */

const FRONTEND_CANDIDATES = ["frontend", "web", "app", "ui", "client", "site"];

// Directories we never want to upload. Even if a user accidentally has them
// committed, Vercel will rebuild them on its own infrastructure.
const SKIP_DIR_NAMES = new Set([
  "node_modules",
  ".git",
  "target",        // Rust build output
  "dist",
  "build",
  ".next",
  ".turbo",
  ".vercel",
  ".cache",
  "out",
  ".svelte-kit",
  ".nuxt",
  "coverage",
]);

// Extensions skipped for Vercel upload bundles (binaries rebuilt on CI).
const SKIP_EXTS = new Set([
  ".wasm", ".mp4", ".mov", ".webm", ".mp3", ".ogg", ".pdf", ".zip", ".tgz", ".gz",
]);

// Image/icon assets needed by the in-browser preview bundler.
const PREVIEW_ASSET_EXTS = new Set([
  ".svg", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico",
]);

// Files commonly used to anchor a "frontend" root. Presence boosts confidence.
const FRONTEND_ANCHOR_FILES = [
  "package.json", "next.config.js", "next.config.mjs", "vite.config.js",
  "vite.config.ts", "svelte.config.js", "nuxt.config.js", "nuxt.config.ts",
  "remix.config.js", "astro.config.mjs",
];

/**
 * Locate the root folder node (single top-level folder in `treeData`).
 */
const getRoot = (treeData) => {
  if (!Array.isArray(treeData) || treeData.length === 0) return null;
  return treeData[0]?.type === "folder" ? treeData[0] : null;
};

/**
 * Detect the most likely frontend root.
 *
 * Returns one of:
 *   { kind: "subfolder", folder: <node>, name: "frontend", path: "frontend" }
 *   { kind: "workspace", folder: <root>, name: <root.name>, path: "" }
 *   { kind: "empty" }
 */
export const detectFrontendRoot = (treeData) => {
  const root = getRoot(treeData);
  if (!root) return { kind: "empty" };

  const children = root.children || [];

  // 1) Conventional folder name match
  for (const candidate of FRONTEND_CANDIDATES) {
    const match = children.find(
      (c) => c.type === "folder" && c.name.toLowerCase() === candidate,
    );
    if (match) {
      return { kind: "subfolder", folder: match, name: match.name, path: match.name };
    }
  }

  // 2) Anchor-file heuristic at root — if package.json sits next to a Rust contract,
  //    we still treat the root as the frontend (workspace deploys).
  const hasAnchor = children.some(
    (c) => c.type === "file" && FRONTEND_ANCHOR_FILES.includes(c.name.toLowerCase()),
  );
  if (hasAnchor) {
    return { kind: "workspace", folder: root, name: root.name, path: "" };
  }

  // 3) Fallback: workspace, but the modal warns the user.
  return { kind: "workspace", folder: root, name: root.name, path: "" };
};

/**
 * List all top-level subfolders so the UI can offer an override. Excludes
 * directories we'd never deploy (`node_modules`, etc).
 */
export const listDeployableSubfolders = (treeData) => {
  const root = getRoot(treeData);
  if (!root) return [];
  return (root.children || [])
    .filter((c) => c.type === "folder" && !SKIP_DIR_NAMES.has(c.name.toLowerCase()))
    .map((c) => ({ id: c.id, name: c.name }));
};

const extOf = (name) => {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
};

/**
 * Walk a folder node and collect every file (relative to the folder).
 *
 * Returns an array of `{ path, content }` where `content` is whatever
 * `fileContents[id]` holds (typically a string).
 */
export const collectFrontendFiles = (folderNode, fileContents, options = {}) => {
  const includePreviewAssets = options.includePreviewAssets === true;
  const out = [];
  const walk = (nodes, prefix) => {
    for (const node of nodes || []) {
      if (node.type === "folder") {
        if (SKIP_DIR_NAMES.has(node.name.toLowerCase())) continue;
        walk(node.children, prefix ? `${prefix}/${node.name}` : node.name);
        continue;
      }
      if (node.type !== "file") continue;
      const ext = extOf(node.name);
      if (SKIP_EXTS.has(ext)) continue;
      if (!includePreviewAssets && PREVIEW_ASSET_EXTS.has(ext)) continue;

      const content = fileContents?.[node.id];
      if (content === undefined || content === null) continue;
      // Skip data-URL-ish blobs (uploaded binaries usually land here).
      if (typeof content === "string" && content.startsWith("data:")) continue;

      out.push({
        path: prefix ? `${prefix}/${node.name}` : node.name,
        content,
      });
    }
  };
  walk(folderNode.children, "");
  return out;
};

/** Collect frontend files for the in-IDE preview (includes images/icons). */
export const collectPreviewFiles = (folderNode, fileContents) =>
  collectFrontendFiles(folderNode, fileContents, { includePreviewAssets: true });

/**
 * SHA1 hex digest of a string or ArrayBuffer using SubtleCrypto.
 * Browsers expose this on `window.crypto.subtle`.
 */
const sha1Hex = async (data) => {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  const digest = await crypto.subtle.digest("SHA-1", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

/**
 * Convert collected files into Vercel upload entries.
 *
 * Each entry is `{ file, sha, size, data }`:
 *  - `file` is the relative path Vercel will mount the file at
 *  - `sha` is the lowercase hex SHA1 of the bytes
 *  - `size` is the byte length
 *  - `data` is a Uint8Array used as the upload body (omitted when
 *    passing to `createDeployment`).
 */
export const prepareUploadEntries = async (files) => {
  const entries = [];
  for (const f of files) {
    const text = typeof f.content === "string" ? f.content : "";
    const bytes = new TextEncoder().encode(text);
    const sha = await sha1Hex(bytes);
    entries.push({
      file: f.path,
      sha,
      size: bytes.byteLength,
      data: bytes,
    });
  }
  return entries;
};

/**
 * Cheap framework guess based on the files in the bundle. Vercel's own
 * detection is more thorough, but pre-selecting helps the create-project flow.
 *
 * Returns a string Vercel recognizes (`nextjs`, `vite`, `astro`, `nuxtjs`,
 * `sveltekit`, `remix`) or `null` for "let Vercel decide".
 */
export const guessFramework = (entries) => {
  const has = (name) => entries.some((e) => e.file === name || e.file.endsWith(`/${name}`));
  if (has("next.config.js") || has("next.config.mjs") || has("next.config.ts")) return "nextjs";
  if (has("nuxt.config.js") || has("nuxt.config.ts")) return "nuxtjs";
  if (has("astro.config.mjs") || has("astro.config.js") || has("astro.config.ts")) return "astro";
  if (has("svelte.config.js")) return "sveltekit";
  if (has("remix.config.js") || has("remix.config.ts")) return "remix";
  if (has("vite.config.js") || has("vite.config.ts")) return "vite";
  return null;
};

/**
 * Slugify a folder name to a Vercel-acceptable project name (lowercase, dashes,
 * 1–100 chars, leading letter/number). Used when the user deploys without
 * an existing Vercel project.
 */
export const slugifyProjectName = (name) => {
  const cleaned = (name || "soroban-app")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 100);
  return cleaned || "soroban-app";
};
