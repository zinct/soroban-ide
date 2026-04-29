/**
 * Dynamically load the Hello World template from the filesystem using Vite glob.
 * This removes the need to hardcode strings and allows for easy updates.
 * We include all files except .git metadata.
 */
const helloWorldFiles = import.meta.glob('../../templates/hello-world/**/*', { query: '?raw', import: 'default', eager: true });

/**
 * Helper to build a tree and contents from a flat template object or Vite glob.
 */
const buildFromTemplate = (rootName, templates, pathPrefix = '') => {
  const tree = [{ id: rootName, name: rootName, type: 'folder', children: [] }];
  const contents = {};

  Object.entries(templates).forEach(([fullKey, content]) => {
    // 1. Extract the relative path within the template folder
    // For Vite glob, the key will be something like "../../templates/hello-world/src/lib.rs"
    // We want just "src/lib.rs"
    let relativePath = fullKey;
    if (pathPrefix) {
      const index = fullKey.indexOf(pathPrefix);
      if (index !== -1) {
        relativePath = fullKey.substring(index + pathPrefix.length).replace(/^\/+/, '');
      }
    }

    // 2. Ignore internal files (.git, etc.)
    if (relativePath.includes('.git/') || relativePath.endsWith('.git')) {
      return;
    }

    const fullPath = `${rootName}/${relativePath}`;
    contents[fullPath] = content;

    const parts = relativePath.split('/');
    let currentLevel = tree[0].children;
    let currentPath = rootName;

    parts.forEach((part, index) => {
      currentPath += `/${part}`;
      const isFile = index === parts.length - 1;

      let node = currentLevel.find((n) => n.name === part);
      if (!node) {
        node = {
          id: currentPath,
          name: part,
          type: isFile ? 'file' : 'folder',
          children: [],
        };
        currentLevel.push(node);
      }
      currentLevel = node.children;
    });
  });

  return { tree, contents };
};

export const createHelloWorldWorkspace = () => {
  // Pass "../../templates/hello-world" as the prefix to extract clean relative paths
  return buildFromTemplate('hello-world', helloWorldFiles, '../../templates/hello-world');
};

export const createBlankWorkspace = () => {
  return buildFromTemplate('blank-project', {
    'README.md': '# Blank Project\n\nStart building your project here.\n',
  });
};

export const createDefaultWorkspace = () => {
  return createHelloWorldWorkspace();
};
// End of Templates
