/**
 * Dynamically load workspace templates from the filesystem using Vite glob.
 */
const helloWorldFiles = import.meta.glob('../../templates/hello-world/**/*', { query: '?raw', import: 'default', eager: true });

const allTemplateFiles = {
  ...import.meta.glob('../../templates/*/**/*', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob('../../templates/*/**/.*', { query: '?raw', import: 'default', eager: true }),
};

/** Fullstack example project ids (bundled under src/templates/). */
export const FULLSTACK_TEMPLATE_IDS = [
  'fullstack-workshop',
  'pay-escrow',
  'tip-jar',
  'donation-vault',
  'invoice-split',
  'savings-circle',
];

const buildFromTemplate = (rootName, templates, pathPrefix = '') => {
  const tree = [{ id: rootName, name: rootName, type: 'folder', children: [] }];
  const contents = {};

  Object.entries(templates).forEach(([fullKey, content]) => {
    let relativePath = fullKey;
    if (pathPrefix) {
      const index = fullKey.indexOf(pathPrefix);
      if (index !== -1) {
        relativePath = fullKey.substring(index + pathPrefix.length).replace(/^\/+/, '');
      }
    }

    if (relativePath.includes('.git/') || relativePath.endsWith('.git')) return;

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

const filesForTemplate = (templateId) => {
  const needle = `/templates/${templateId}/`;
  return Object.fromEntries(
    Object.entries(allTemplateFiles).filter(([key]) => key.includes(needle)),
  );
};

export const createHelloWorldWorkspace = () =>
  buildFromTemplate('hello-world', helloWorldFiles, '../../templates/hello-world');

export const createFullstackTemplateWorkspace = (templateId) => {
  if (!FULLSTACK_TEMPLATE_IDS.includes(templateId)) {
    throw new Error(`Unknown fullstack template: ${templateId}`);
  }
  return buildFromTemplate(
    templateId,
    filesForTemplate(templateId),
    `../../templates/${templateId}`,
  );
};

export const createFullstackWorkshopWorkspace = () =>
  createFullstackTemplateWorkspace('fullstack-workshop');

export const createBlankWorkspace = () =>
  buildFromTemplate('blank-project', {
    'README.md': '# Blank Project\n\nStart building your project here.\n',
  });

export const createDefaultWorkspace = () => createHelloWorldWorkspace();
