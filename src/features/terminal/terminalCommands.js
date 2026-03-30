/**
 * Terminal command execution logic.
 * Returns output string for each command.
 */

export const executeTerminalCommand = (cmd, cwd, setCwd) => {
  const parts = cmd.split(' ');
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);

  switch (command) {
    case 'help':
      return `Available commands:
  clear          - Clear terminal
  pwd            - Print working directory
  cd <dir>       - Change directory
  ls             - List files
  echo <text>    - Print text
  whoami         - Current user
  date           - Current date
  npm <cmd>      - Run npm command (simulated)`;

    case 'clear':
      return null; // Signal to clear history

    case 'pwd':
      return cwd;

    case 'cd':
      if (args.length === 0 || args[0] === '~') {
        setCwd('~/project');
      } else if (args[0] === '..') {
        setCwd((prev) => {
          const segments = prev.split('/');
          if (segments.length > 1) segments.pop();
          return segments.join('/') || '/';
        });
      } else {
        setCwd((prev) => {
          return args[0].startsWith('/') ? args[0] : `${prev}/${args[0]}`;
        });
      }
      return '';

    case 'ls':
      return 'node_modules/\nsrc/\npublic/\npackage.json\nREADME.md\ntsconfig.json';

    case 'echo':
      return args.join(' ');

    case 'whoami':
      return 'developer';

    case 'date':
      return new Date().toString();

    case 'npm':
      if (args[0] === 'install' || args[0] === 'i') {
        return '[npm] Installing dependencies...\n[npm] Added 42 packages in 2s';
      } else if (args[0] === 'run' || args[0] === 'start') {
        return `[npm] Running ${args[1] || 'start'}...\n[npm] Starting development server at http://localhost:3000`;
      } else if (args[0] === 'build') {
        return '[npm] Building project...\n[npm] Build completed in 5.2s';
      }
      return `[npm] Unknown command: ${args[0] || ''}`;

    default:
      return `Command not found: ${command}\nType 'help' for available commands.`;
  }
};
