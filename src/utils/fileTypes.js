/**
 * File type detection utilities.
 * Maps file extensions to language identifiers for the editor.
 */

const FILE_TYPE_MAP = {
  '.gitignore': 'ignore',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.json': 'json',
  '.html': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.less': 'less',
  '.py': 'python',
  '.java': 'java',
  '.cpp': 'cpp',
  '.c': 'c',
  '.cs': 'csharp',
  '.go': 'go',
  '.php': 'php',
  '.rb': 'ruby',
  '.swift': 'swift',
  '.kotlin': 'kotlin',
  '.dart': 'dart',
  '.xml': 'xml',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.md': 'markdown',
  '.rs': 'rust',
  '.toml': 'toml',
};

export const getFileLanguage = (fileName) => {
  if (!fileName) return 'plaintext';
  const match = Object.keys(FILE_TYPE_MAP).find((ext) =>
    fileName.endsWith(ext)
  );
  return match ? FILE_TYPE_MAP[match] : 'plaintext';
};
