/**
 * Terminal command execution logic.
 * Returns output string for each command.
 *
 * Local commands are handled here.
 * Stellar commands are detected but executed by Terminal.jsx via the backend.
 */

/**
 * Check if a command should be routed to the backend.
 * Must match backend allowedPrefixes in run.go
 */
const BACKEND_PREFIXES = ["stellar", "soroban", "npm", "pnpm", "yarn", "node", "cargo", "git"];

export const isBackendCommand = (cmd) => {
  const first = cmd.trim().split(/\s+/)[0]?.toLowerCase();
  return BACKEND_PREFIXES.includes(first);
};

// Keep old name as alias
export const isStellarCommand = isBackendCommand;

/**
 * List files/folders at the given cwd relative to the workspace tree.
 * Returns a formatted string like a real `ls` output.
 */
const listFiles = (treeData, cwd) => {
  if (!treeData?.length) return "";

  // The root of the tree is the project folder
  const root = treeData[0];
  if (!root) return "";

  // Parse cwd to find the target node
  // cwd is like "~/project" or "~/project/src"
  const cwdParts = cwd
    .replace(/^~\/project\/?/, "")
    .split("/")
    .filter(Boolean);

  let current = root;
  for (const part of cwdParts) {
    if (!current.children?.length) return `ls: cannot access '${part}': No such file or directory`;
    const found = current.children.find((c) => c.name === part);
    if (!found) return `ls: cannot access '${part}': No such file or directory`;
    if (found.type !== "folder") return `ls: '${part}' is not a directory`;
    current = found;
  }

  if (!current.children?.length) return "";

  // Format output: folders with trailing /, files without
  const entries = current.children
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    })
    .map((node) => (node.type === "folder" ? `${node.name}/` : node.name));

  return entries.join("\n");
};

/**
 * Handle 'cd' command, updating the CWD state.
 */
const changeDirectory = (target, currentCwd, setCwd, treeData) => {
  if (target === "~" || target === "~/project") {
    setCwd("~/project");
    return "";
  }

  // Handle '..'
  if (target === "..") {
    if (currentCwd === "~/project") return "";
    const parts = currentCwd.split("/");
    parts.pop();
    setCwd(parts.join("/"));
    return "";
  }

  // Handle relative paths
  const root = treeData?.[0];
  if (!root) return "cd: no project initialized";

  const cwdRel = currentCwd.replace(/^~\/project\/?/, "");
  const cwdParts = cwdRel.split("/").filter(Boolean);

  // Find current node
  let current = root;
  for (const part of cwdParts) {
    current = current.children?.find((c) => c.name === part);
    if (!current) break;
  }

  if (!current) return `cd: cannot access directory`;

  // Find target node in current
  const targetNode = current.children?.find((c) => c.name === target && c.type === "folder");
  if (!targetNode) return `cd: no such directory: ${target}`;

  const newCwd = currentCwd === "~/project" ? `~/project/${target}` : `${currentCwd}/${target}`;
  setCwd(newCwd);
  return "";
};

/**
 * Execute a local terminal command.
 * @param {string} cmd - Full command string
 * @param {string} cwd - Current working directory
 * @param {function} setCwd - State setter for cwd
 * @param {Array} treeData - Workspace tree (optional, for ls)
 * @returns {string|null} Output string, or null to clear terminal
 */
export const executeTerminalCommand = (cmd, cwd, setCwd, treeData) => {
  const parts = cmd.split(" ");
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);

  switch (command) {
    case "help":
      return `Available commands:
  ls      - List files in current directory
  clear   - Clear terminal
  whoami  - Show current user

  stellar - Run Stellar CLI commands (e.g., stellar contract build)`;

    case "clear":
      return null; // Signal to clear history

    case "ls":
      if (treeData) {
        return listFiles(treeData, cwd);
      }
      return "";

    case "cd":
      const targetDir = args[0] || "~/project";
      return changeDirectory(targetDir, cwd, setCwd, treeData);

    case "whoami":
      return "developer";

    default:
      return `Command not found: ${command}\nType 'help' for available commands.`;
  }
};
