/**
 * Contract discovery utilities for the Deploy panel.
 *
 * The IDE renders a file tree from React state (`treeData`) and keeps a flat
 * map of file contents (`fileContents`) keyed by `node.id`, where `node.id`
 * is the full path including the workspace root folder name
 * (e.g. `hello-world/contracts/hello-world/Cargo.toml`).
 *
 * The backend (soroban-ide-runner) receives files with the root folder
 * stripped — see `collectProjectFiles` in `services/backendService.js`.
 * This module emits contract paths using the same "no root" convention so
 * they can be passed straight to `stellar contract build --manifest-path`
 * and to the Docker-mounted `/app/...` wasm path.
 */

const IGNORE_DIRS = new Set([
  "target",
  "node_modules",
  ".git",
  ".cargo",
  ".github",
  ".vscode",
  ".idea",
  "dist",
  "build",
]);

const WASM_TARGET_TRIPLE = "wasm32v1-none";
const MOUNT_PREFIX = "/app";

/**
 * Parse `name = "..."` from the `[package]` section of a `Cargo.toml` string.
 * Falls back to `fallbackFolderName` (dashes → underscores) when the file
 * is empty, malformed, or only contains a `[workspace]` section.
 */
export function parseCrateName(cargoTomlText, fallbackFolderName) {
  const fallback = (fallbackFolderName || "").replace(/-/g, "_");
  if (!cargoTomlText || typeof cargoTomlText !== "string") return fallback;

  // Capture the [package] section up to the next top-level section header
  // or end of file. Use a multiline, dotall-friendly pattern.
  const pkgSection = cargoTomlText.match(/^\[package\]([\s\S]*?)(?=^\[[^\]]+\]|\Z)/m);
  const scope = pkgSection ? pkgSection[1] : null;
  if (!scope) return fallback;

  const nameMatch = scope.match(/^\s*name\s*=\s*"([^"]+)"/m);
  if (!nameMatch) return fallback;

  return nameMatch[1].replace(/-/g, "_");
}

/**
 * Check whether the Cargo.toml text declares a `[workspace]` section.
 * Workspace-only manifests (no `[package]`) should be skipped — they are
 * virtual manifests, not contracts.
 */
function isWorkspaceManifest(cargoTomlText) {
  if (!cargoTomlText) return false;
  return /^\s*\[workspace\]/m.test(cargoTomlText);
}

function hasPackageSection(cargoTomlText) {
  if (!cargoTomlText) return false;
  return /^\s*\[package\]/m.test(cargoTomlText);
}

/**
 * Walk `treeData` and return every folder that contains a `Cargo.toml`
 * with a `[package]` section.
 *
 * Each entry has:
 *  - `name`        : folder name (e.g. "auth-and-admin")
 *  - `path`        : relative path from the workspace root, no root prefix
 *                    (e.g. "learning/auth-and-admin"). Empty string means the
 *                    root folder itself is the contract.
 *  - `group`       : first path segment when the contract is nested 2+ levels
 *                    deep (e.g. "learning"), otherwise empty string.
 *  - `crateName`   : `[package].name` with dashes converted to underscores,
 *                    or `name.replace(/-/g,"_")` when the manifest can't be
 *                    parsed.
 *  - `cargoTomlId` : the full `node.id` of the Cargo.toml file, used later
 *                    to look content up in `fileContents`.
 */
export function findContracts(treeData, fileContents = {}, options = {}) {
  const { maxDepth = 5 } = options;
  if (!Array.isArray(treeData) || treeData.length === 0) return [];

  const isSingleRoot = treeData.length === 1 && treeData[0].type === "folder";
  const rootFolder = isSingleRoot ? treeData[0] : null;

  const results = [];

  const considerFolder = (folderNode, relativeParts) => {
    if (!folderNode || folderNode.type !== "folder") return;
    const children = Array.isArray(folderNode.children) ? folderNode.children : [];
    const cargo = children.find((c) => c && c.type === "file" && c.name === "Cargo.toml");
    if (!cargo) return;

    const cargoToml = fileContents[cargo.id] || "";
    // If we can read the manifest, skip workspace-only virtual manifests.
    // If we can't read it (empty), accept optimistically so the user still
    // sees the folder in the dropdown.
    if (cargoToml && isWorkspaceManifest(cargoToml) && !hasPackageSection(cargoToml)) {
      return;
    }

    const folderName = relativeParts[relativeParts.length - 1] || (rootFolder?.name || "root");
    const relativePath = relativeParts.join("/");
    const group = relativeParts.length >= 2 ? relativeParts[0] : "";
    const crateName = parseCrateName(cargoToml, folderName);

    results.push({
      name: folderName,
      path: relativePath,
      group,
      crateName,
      cargoTomlId: cargo.id,
    });
  };

  const walk = (nodes, relativeParts, depth) => {
    if (!Array.isArray(nodes) || depth > maxDepth) return;
    for (const node of nodes) {
      if (!node || node.type !== "folder") continue;
      if (IGNORE_DIRS.has(node.name)) continue;
      if (node.name.startsWith(".") && node.name !== ".") continue;

      const nextParts = [...relativeParts, node.name];
      considerFolder(node, nextParts);
      walk(node.children, nextParts, depth + 1);
    }
  };

  if (rootFolder) {
    considerFolder(rootFolder, []);
    walk(rootFolder.children, [], 0);
  } else {
    walk(treeData, [], 0);
  }

  results.sort((a, b) => {
    const ga = (a.group || "").localeCompare(b.group || "");
    if (ga !== 0) return ga;
    return a.name.localeCompare(b.name);
  });

  return results;
}

/**
 * Group discovered contracts by their `group` field, preserving alphabetical
 * order. Ungrouped entries (top-level contracts) go into an empty-string
 * group that the UI renders without a header.
 */
export function groupContracts(contracts) {
  const groups = new Map();
  for (const c of contracts) {
    const key = c.group || "";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  return Array.from(groups.entries()).map(([group, items]) => ({ group, items }));
}

/**
 * Split `cargoTomlId` (e.g. `hello-world/learning/foo/Cargo.toml`) into a
 * root prefix (`hello-world`) given the contract's relative `path`
 * (`learning/foo`). Returns `""` when there's no root folder.
 */
function rootPrefixFor(cargoTomlId, path) {
  if (!cargoTomlId) return "";
  const suffix = path ? `${path}/Cargo.toml` : `Cargo.toml`;
  if (cargoTomlId === suffix) return "";
  const suffixWithSlash = `/${suffix}`;
  if (cargoTomlId.endsWith(suffixWithSlash)) {
    return cargoTomlId.slice(0, -suffixWithSlash.length);
  }
  return "";
}

/**
 * Resolve the on-disk wasm path the backend will produce after
 * `stellar contract build --manifest-path <path>/Cargo.toml`.
 *
 * The soroban-ide-runner container sets `CARGO_TARGET_DIR=/app/target`
 * globally in its Dockerfile, which forces cargo to write every build
 * artifact — for every contract in every workspace — into the single
 * shared `/app/target/` directory. So the resolved wasm path is always:
 *
 *   <mountPrefix>/target/<targetTriple>/release/<crateName>.wasm
 *
 * We keep `fileContents` in the signature for forward compatibility with
 * a future runner that doesn't override CARGO_TARGET_DIR, where we'd
 * need to detect workspace roots vs standalone contracts to pick the
 * right per-crate target/.
 */
export function resolveWasmPath(selectedContract, _fileContents = {}, options = {}) {
  if (!selectedContract || !selectedContract.crateName) return null;
  const mountPrefix = options.mountPrefix || MOUNT_PREFIX;
  const targetTriple = options.targetTriple || WASM_TARGET_TRIPLE;
  const { crateName } = selectedContract;
  return `${mountPrefix}/target/${targetTriple}/release/${crateName}.wasm`;
}

/**
 * Build the `--manifest-path` flag (including a leading space) for a
 * contract. Returns `""` when the contract lives at the workspace root
 * — `stellar contract build` picks it up from cwd automatically.
 */
export function manifestPathFlag(selectedContract) {
  if (!selectedContract || !selectedContract.path) return "";
  return ` --manifest-path ${selectedContract.path}/Cargo.toml`;
}
