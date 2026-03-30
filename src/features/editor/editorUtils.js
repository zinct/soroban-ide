/**
 * Editor utility functions.
 */

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico'];

export const getFileType = (filePath) => {
  if (!filePath) return 'code';
  const ext = filePath.split('.').pop()?.toLowerCase();
  if (IMAGE_EXTS.includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  return 'code';
};

export const getLanguageFromName = (name) => {
  if (!name) return 'rust';
  const ext = name.split('.').at(-1)?.toLowerCase();
  const map = {
    rs: 'rust',
    toml: 'toml',
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    md: 'markdown',
    json: 'json',
    html: 'html',
    css: 'css',
    py: 'python',
    sh: 'shell',
    yaml: 'yaml',
    yml: 'yaml',
  };
  return map[ext] ?? 'plaintext';
};
