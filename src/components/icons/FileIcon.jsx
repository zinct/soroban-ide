import React from 'react';

const ICONS_BASE = '/assets/icons';

/* ─── File icon name resolution ─── */

const SPECIAL_FILES = {
  'cargo.toml': 'file_type_cargo',
  'cargo.lock': 'file_type_cargo',
  'package.json': 'file_type_node',
  'package-lock.json': 'file_type_npm',
  '.gitignore': 'file_type_git',
  '.gitattributes': 'file_type_git',
  dockerfile: 'file_type_docker',
  'docker-compose.yml': 'file_type_docker',
  'docker-compose.yaml': 'file_type_docker',
  'readme.md': 'file_type_markdown',
  readme: 'file_type_markdown',
  license: 'file_type_license',
  'license.md': 'file_type_license',
  '.env': 'file_type_dotenv',
  '.env.local': 'file_type_dotenv',
  '.env.development': 'file_type_dotenv',
  '.env.production': 'file_type_dotenv',
  makefile: 'file_type_makefile',
  'tsconfig.json': 'file_type_tsconfig',
  'jsconfig.json': 'file_type_jsconfig',
  '.eslintrc': 'file_type_eslint',
  '.eslintrc.json': 'file_type_eslint',
  '.eslintrc.js': 'file_type_eslint',
  '.prettierrc': 'file_type_prettier',
  '.prettierrc.json': 'file_type_prettier',
  '.babelrc': 'file_type_babel',
  'babel.config.js': 'file_type_babel',
  'webpack.config.js': 'file_type_webpack',
  'vite.config.js': 'file_type_vite',
  'vite.config.ts': 'file_type_vite',
  'tailwind.config.js': 'file_type_tailwind',
  'jest.config.js': 'file_type_jest',
  'go.mod': 'file_type_go',
  'go.sum': 'file_type_go',
  'pyproject.toml': 'file_type_python',
  'requirements.txt': 'file_type_python',
  'setup.py': 'file_type_python',
  Pipfile: 'file_type_python',
  Procfile: 'file_type_procfile',
  'rust-toolchain': 'file_type_rust_toolchain',
};

const EXT_MAP = {
  rs: 'file_type_rust',
  js: 'file_type_js',
  jsx: 'file_type_reactjs',
  ts: 'file_type_typescript',
  tsx: 'file_type_reactts',
  mjs: 'file_type_js',
  cjs: 'file_type_js',
  html: 'file_type_html',
  htm: 'file_type_html',
  css: 'file_type_css',
  scss: 'file_type_scss',
  sass: 'file_type_sass',
  less: 'file_type_less',
  json: 'file_type_json',
  jsonc: 'file_type_json',
  yaml: 'file_type_yaml',
  yml: 'file_type_yaml',
  toml: 'file_type_toml',
  xml: 'file_type_xml',
  ini: 'file_type_ini',
  conf: 'file_type_config',
  cfg: 'file_type_config',
  md: 'file_type_markdown',
  markdown: 'file_type_markdown',
  mdx: 'file_type_mdx',
  txt: 'file_type_text',
  py: 'file_type_python',
  pyw: 'file_type_python',
  java: 'file_type_java',
  c: 'file_type_c',
  h: 'file_type_cheader',
  cpp: 'file_type_cpp',
  hpp: 'file_type_cppheader',
  cs: 'file_type_csharp',
  go: 'file_type_go',
  rb: 'file_type_ruby',
  php: 'file_type_php',
  sh: 'file_type_shell',
  bash: 'file_type_shell',
  zsh: 'file_type_shell',
  sql: 'file_type_sql',
  png: 'file_type_image',
  jpg: 'file_type_image',
  jpeg: 'file_type_image',
  gif: 'file_type_image',
  webp: 'file_type_image',
  svg: 'file_type_svg',
  ico: 'file_type_favicon',
  pdf: 'file_type_pdf',
  zip: 'file_type_zip',
  rar: 'file_type_zip',
  tar: 'file_type_zip',
  gz: 'file_type_zip',
  vue: 'file_type_vue',
  svelte: 'file_type_svelte',
  lock: 'file_type_lock',
  map: 'file_type_map',
  log: 'file_type_log',
  env: 'file_type_dotenv',
};

const getFileIconName = (filename) => {
  if (!filename) return 'default_file';

  const ext = filename.split('.').pop()?.toLowerCase();
  const fullName = filename.split('/').pop()?.toLowerCase();

  if (SPECIAL_FILES[fullName]) return SPECIAL_FILES[fullName];

  if (filename.startsWith('.')) {
    return SPECIAL_FILES[`.${filename.substring(1)}`] || 'file_type_config';
  }

  return EXT_MAP[ext] || 'default_file';
};

/* ─── Folder icon name resolution ─── */

const FOLDER_MAP = {
  src: 'folder_type_src',
  source: 'folder_type_src',
  test: 'folder_type_test',
  tests: 'folder_type_test',
  node_modules: 'folder_type_node',
  '.git': 'folder_type_git',
  '.github': 'folder_type_github',
  '.vscode': 'folder_type_vscode',
  public: 'folder_type_public',
  assets: 'folder_type_asset',
  static: 'folder_type_asset',
  images: 'folder_type_images',
  img: 'folder_type_images',
  docs: 'folder_type_docs',
  dist: 'folder_type_dist',
  build: 'folder_type_dist',
  out: 'folder_type_dist',
  lib: 'folder_type_library',
  vendor: 'folder_type_library',
  config: 'folder_type_config',
  components: 'folder_type_component',
  utils: 'folder_type_tools',
  helpers: 'folder_type_helper',
  hooks: 'folder_type_hook',
  styles: 'folder_type_style',
  routes: 'folder_type_route',
  pages: 'folder_type_src',
  api: 'folder_type_api',
  services: 'folder_type_services',
  models: 'folder_type_model',
  types: 'folder_type_typings',
  scripts: 'folder_type_script',
  tools: 'folder_type_tools',
  temp: 'folder_type_temp',
  tmp: 'folder_type_temp',
  templates: 'folder_type_template',
  themes: 'folder_type_theme',
  plugins: 'folder_type_plugin',
  i18n: 'folder_type_locale',
  locales: 'folder_type_locale',
  shared: 'folder_type_shared',
  common: 'folder_type_common',
  features: 'folder_type_src',
};

const getFolderIconName = (folderName, isOpen = false) => {
  if (!folderName) return isOpen ? 'default_folder_opened' : 'default_folder';

  const name = folderName.toLowerCase();
  const suffix = isOpen ? '_opened' : '';
  const base = FOLDER_MAP[name];

  return base ? `${base}${suffix}` : isOpen ? 'default_folder_opened' : 'default_folder';
};

/* ─── Components ─── */

export const FileIconImg = ({ filename, size = 16 }) => {
  const iconName = getFileIconName(filename);
  return (
    <img
      src={`${ICONS_BASE}/${iconName}.svg`}
      width={size}
      height={size}
      alt=""
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
      onError={(e) => {
        e.target.src = `${ICONS_BASE}/default_file.svg`;
      }}
    />
  );
};

export const FolderIconImg = ({ folderName, isOpen = false, size = 16 }) => {
  const iconName = getFolderIconName(folderName, isOpen);
  const fallback = isOpen ? 'default_folder_opened' : 'default_folder';
  return (
    <img
      src={`${ICONS_BASE}/${iconName}.svg`}
      width={size}
      height={size}
      alt=""
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
      onError={(e) => {
        e.target.src = `${ICONS_BASE}/${fallback}.svg`;
      }}
    />
  );
};

export { getFileIconName, getFolderIconName };
