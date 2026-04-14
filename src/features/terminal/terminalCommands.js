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
const BACKEND_PREFIXES = ['stellar'];

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
  if (!treeData?.length) return '';

  // The root of the tree is the project folder
  const root = treeData[0];
  if (!root) return '';

  // Parse cwd to find the target node
  // cwd is like "~/project" or "~/project/src"
  const cwdParts = cwd.replace(/^~\/project\/?/, '').split('/').filter(Boolean);

  let current = root;
  for (const part of cwdParts) {
    if (!current.children?.length) return `ls: cannot access '${part}': No such file or directory`;
    const found = current.children.find((c) => c.name === part);
    if (!found) return `ls: cannot access '${part}': No such file or directory`;
    if (found.type !== 'folder') return `ls: '${part}' is not a directory`;
    current = found;
  }

  if (!current.children?.length) return '';

  // Format output: folders with trailing /, files without
  const entries = current.children
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    })
    .map((node) => (node.type === 'folder' ? `${node.name}/` : node.name));

  return entries.join('\n');
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
  const parts = cmd.split(' ');
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);

  switch (command) {
    case 'help':
      return `Available commands:
  ls      - List files in current directory
  clear   - Clear terminal
  whoami  - Show current user

  stellar - Run Stellar CLI commands (e.g., stellar contract build)`;

    case 'clear':
      return null; // Signal to clear history

    case 'ls':
      if (treeData) {
        return listFiles(treeData, cwd);
      }
      return '';

    case 'whoami':
      return 'developer';

    default:
      return `Command not found: ${command}\nType 'help' for available commands.`;
  }
};
