import React from "react";

const ICONS_BASE = "/assets/icons";

/* ─── File icon name resolution ─── */

const SPECIAL_FILES = {
  "cargo.toml": "cargo",
  "cargo.lock": "cargo-lock",
  "package.json": "package-json",
  "package-lock.json": "npm-lock",
  ".gitignore": "git",
  ".gitattributes": "git",
  dockerfile: "docker",
  "docker-compose.yml": "docker-compose",
  "docker-compose.yaml": "docker-compose",
  "readme.md": "readme",
  readme: "readme",
  license: "license",
  "license.md": "license",
  ".env": "env",
  ".env.local": "env",
  ".env.development": "env",
  ".env.production": "env",
  makefile: "makefile",
  "tsconfig.json": "typescript-config",
  "jsconfig.json": "javascript-config",
  ".eslintrc": "eslint",
  ".eslintrc.json": "eslint",
  ".eslintrc.js": "eslint",
  ".prettierrc": "prettier",
  ".prettierrc.json": "prettier",
  ".babelrc": "babel",
  "babel.config.js": "babel",
  "webpack.config.js": "webpack",
  "vite.config.js": "vite",
  "vite.config.ts": "vite",
  "tailwind.config.js": "tailwind",
  "jest.config.js": "jest",
  "go.mod": "go-mod",
  "go.sum": "go-mod",
  "pyproject.toml": "python-config",
  "requirements.txt": "python-config",
  "setup.py": "python-config",
  Pipfile: "python-config",
  Procfile: "heroku",
  "rust-toolchain": "rust-config",
};

const EXT_MAP = {
  rs: "rust",
  js: "javascript",
  jsx: "javascript-react",
  ts: "typescript",
  tsx: "typescript-react",
  mjs: "javascript",
  cjs: "javascript",
  html: "html",
  htm: "html",
  css: "css",
  scss: "sass",
  sass: "sass",
  less: "less",
  json: "json",
  jsonc: "json",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  xml: "xml",
  ini: "config",
  conf: "config",
  cfg: "config",
  md: "markdown",
  markdown: "markdown",
  mdx: "markdown-mdx",
  txt: "text",
  py: "python",
  pyw: "python",
  java: "java",
  c: "c",
  h: "cpp-header",
  cpp: "cpp",
  hpp: "cpp-header",
  cs: "csharp",
  go: "go",
  rb: "ruby",
  php: "php",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  sql: "database",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  svg: "svg",
  ico: "favicon",
  pdf: "pdf",
  zip: "zip",
  rar: "zip",
  tar: "zip",
  gz: "zip",
  vue: "vue",
  svelte: "svelte",
  lock: "lock",
  map: "map",
  log: "log",
  env: "env",
};

const getFileIconName = (filename) => {
  if (!filename) return "_file";

  const ext = filename.split(".").pop()?.toLowerCase();
  const fullName = filename.split("/").pop()?.toLowerCase();

  if (SPECIAL_FILES[fullName]) return SPECIAL_FILES[fullName];

  if (filename.startsWith(".")) {
    return SPECIAL_FILES[`.${filename.substring(1)}`] || "config";
  }

  return EXT_MAP[ext] || "_file";
};

/* ─── Folder icon name resolution ─── */

const FOLDER_MAP = {
  src: "folder_src",
  source: "folder_src",
  test: "folder_test",
  tests: "folder_test",
  node_modules: "folder_node",
  ".git": "folder_git",
  ".github": "folder_github",
  ".vscode": "folder_vscode",
  public: "folder_public",
  assets: "folder_assets",
  static: "folder_assets",
  images: "folder_images",
  img: "folder_images",
  docs: "folder_docs",
  dist: "folder_dist",
  build: "folder_dist",
  out: "folder_dist",
  lib: "folder_lib",
  vendor: "folder_lib",
  config: "folder_config",
  components: "folder_components",
  utils: "folder_utils",
  helpers: "folder_helper",
  hooks: "folder_hooks",
  styles: "folder_styles",
  routes: "folder_routes",
  pages: "folder_src",
  api: "folder_api",
  services: "folder_services",
  models: "folder_model",
  types: "folder_types",
  scripts: "folder_scripts",
  tools: "folder_utils",
  temp: "folder_temp",
  tmp: "folder_temp",
  templates: "folder_templates",
  themes: "folder_themes",
  plugins: "folder_plugins",
  i18n: "folder_locales",
  locales: "folder_locales",
  shared: "folder_shared",
  common: "folder_shared",
  features: "folder_src",
};

const getFolderIconName = (folderName, isOpen = false) => {
  if (!folderName) return isOpen ? "_folder_open" : "_folder";

  const name = folderName.toLowerCase();
  const suffix = isOpen ? "_open" : "";
  const base = FOLDER_MAP[name];

  return base ? `${base}${suffix}` : isOpen ? "_folder_open" : "_folder";
};

/* ─── Components ─── */

export const FileIconImg = ({ filename, size = 17 }) => {
  const iconName = getFileIconName(filename);
  return (
    <img
      src={`${ICONS_BASE}/${iconName}.svg`}
      width={size}
      height={size}
      alt=""
      style={{ display: "inline-block", verticalAlign: "middle" }}
      onError={(e) => {
        e.target.src = `${ICONS_BASE}/_file.svg`;
      }}
    />
  );
};

export const FolderIconImg = ({ folderName, isOpen = false, size = 22 }) => {
  const iconName = getFolderIconName(folderName, isOpen);
  const fallback = isOpen ? "_folder_open" : "_folder";
  return (
    <img
      src={`${ICONS_BASE}/${iconName}.svg`}
      width={size}
      height={size}
      alt=""
      style={{ display: "inline-block", verticalAlign: "middle" }}
      onError={(e) => {
        e.target.src = `${ICONS_BASE}/${fallback}.svg`;
      }}
    />
  );
};

export { getFileIconName, getFolderIconName };
