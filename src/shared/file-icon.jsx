import React from "react";

// Base path for icons
const ICONS_BASE = "/src/assets/icons";

// Map file extensions and special filenames to icon names
const getFileIconName = (filename) => {
  if (!filename) return "default_file";

  const ext = filename.split(".").pop()?.toLowerCase();
  const name = filename.toLowerCase();
  const fullName = filename.split("/").pop()?.toLowerCase();

  // Special file name mappings
  const specialFiles = {
    "cargo.toml": "file_type_cargo",
    "cargo.lock": "file_type_cargo",
    "package.json": "file_type_node",
    "package-lock.json": "file_type_npm",
    ".gitignore": "file_type_git",
    ".gitattributes": "file_type_git",
    dockerfile: "file_type_docker",
    "docker-compose.yml": "file_type_docker",
    "docker-compose.yaml": "file_type_docker",
    "readme.md": "file_type_markdown",
    readme: "file_type_markdown",
    license: "file_type_license",
    "license.md": "file_type_license",
    ".env": "file_type_dotenv",
    ".env.local": "file_type_dotenv",
    ".env.development": "file_type_dotenv",
    ".env.production": "file_type_dotenv",
    makefile: "file_type_makefile",
    gemfile: "file_type_ruby",
    "gemfile.lock": "file_type_ruby",
    rakefile: "file_type_ruby",
    "composer.json": "file_type_composer",
    "composer.lock": "file_type_composer",
    "tsconfig.json": "file_type_tsconfig",
    "jsconfig.json": "file_type_jsconfig",
    ".eslintrc": "file_type_eslint",
    ".eslintrc.json": "file_type_eslint",
    ".eslintrc.js": "file_type_eslint",
    ".prettierrc": "file_type_prettier",
    ".prettierrc.json": "file_type_prettier",
    ".babelrc": "file_type_babel",
    "babel.config.js": "file_type_babel",
    "webpack.config.js": "file_type_webpack",
    "vite.config.js": "file_type_vite",
    "vite.config.ts": "file_type_vite",
    "tailwind.config.js": "file_type_tailwind",
    "jest.config.js": "file_type_jest",
    "cypress.json": "file_type_cypress",
    "renovate.json": "file_type_renovate",
    "vercel.json": "file_type_vercel",
    "netlify.toml": "file_type_netlify",
    "firebase.json": "file_type_firebase",
    "pubspec.yaml": "file_type_flutter",
    "go.mod": "file_type_go",
    "go.sum": "file_type_go",
    "mix.exs": "file_type_elixir",
    "Cargo.toml": "file_type_cargo",
    "Cargo.lock": "file_type_cargo",
    "rust-toolchain": "file_type_rust_toolchain",
    "pyproject.toml": "file_type_python",
    "requirements.txt": "file_type_python",
    Pipfile: "file_type_python",
    "setup.py": "file_type_python",
    "build.gradle": "file_type_gradle",
    "pom.xml": "file_type_maven",
    "AndroidManifest.xml": "file_type_android",
    "Info.plist": "file_type_apple",
    "Chart.yaml": "file_type_helm",
    "skaffold.yaml": "file_type_kubernetes",
    ".travis.yml": "file_type_travis",
    ".circleci/config.yml": "file_type_circleci",
    ".github/workflows": "file_type_github",
    ".vscode/settings.json": "file_type_vscode",
    ".editorconfig": "file_type_editorconfig",
    ".nvmrc": "file_type_node",
    ".ruby-version": "file_type_ruby",
    ".python-version": "file_type_python",
    Procfile: "file_type_procfile",
    "nginx.conf": "file_type_nginx",
  };

  if (specialFiles[fullName]) return specialFiles[fullName];
  if (specialFiles[name]) return specialFiles[name];

  const extMap = {
    rs: "file_type_rust",
    js: "file_type_js",
    jsx: "file_type_reactjs",
    ts: "file_type_typescript",
    tsx: "file_type_reactts",
    mjs: "file_type_js",
    cjs: "file_type_js",
    html: "file_type_html",
    htm: "file_type_html",
    css: "file_type_css",
    scss: "file_type_scss",
    sass: "file_type_sass",
    less: "file_type_less",
    styl: "file_type_stylus",
    json: "file_type_json",
    jsonc: "file_type_json",
    yaml: "file_type_yaml",
    yml: "file_type_yaml",
    toml: "file_type_toml",
    xml: "file_type_xml",
    xsd: "file_type_xml",
    ini: "file_type_ini",
    conf: "file_type_config",
    cfg: "file_type_config",
    md: "file_type_markdown",
    markdown: "file_type_markdown",
    mdx: "file_type_mdx",
    txt: "file_type_text",
    rtf: "file_type_text",
    rst: "file_type_rest",
    py: "file_type_python",
    pyw: "file_type_python",
    pyi: "file_type_python",
    pyc: "file_type_python",
    ipynb: "file_type_jupyter",
    java: "file_type_java",
    jar: "file_type_java",
    class: "file_type_class",
    jsp: "file_type_jsp",
    c: "file_type_c",
    h: "file_type_cheader",
    cpp: "file_type_cpp",
    hpp: "file_type_cppheader",
    cc: "file_type_cpp",
    cxx: "file_type_cpp",
    cs: "file_type_csharp",
    csproj: "file_type_csproj",
    sln: "file_type_sln",
    go: "file_type_go",
    mod: "file_type_go",
    rb: "file_type_ruby",
    erb: "file_type_erb",
    gemspec: "file_type_ruby",
    php: "file_type_php",
    phtml: "file_type_php",
    sh: "file_type_shell",
    bash: "file_type_shell",
    zsh: "file_type_shell",
    ps1: "file_type_powershell",
    psm1: "file_type_powershell",
    bat: "file_type_bat",
    cmd: "file_type_bat",
    sql: "file_type_sql",
    sqlite: "file_type_sqlite",
    db: "file_type_db",
    pgsql: "file_type_pgsql",
    mysql: "file_type_mysql",
    prisma: "file_type_prisma",
    png: "file_type_image",
    jpg: "file_type_image",
    jpeg: "file_type_image",
    gif: "file_type_image",
    webp: "file_type_image",
    bmp: "file_type_image",
    ico: "file_type_favicon",
    svg: "file_type_svg",
    avif: "file_type_avif",
    ttf: "file_type_font",
    otf: "file_type_font",
    woff: "file_type_font",
    woff2: "file_type_font",
    eot: "file_type_font",
    mp4: "file_type_video",
    avi: "file_type_video",
    mov: "file_type_video",
    mkv: "file_type_video",
    flv: "file_type_video",
    webm: "file_type_video",
    mp3: "file_type_audio",
    wav: "file_type_audio",
    flac: "file_type_audio",
    aac: "file_type_audio",
    ogg: "file_type_audio",
    zip: "file_type_zip",
    rar: "file_type_zip",
    "7z": "file_type_zip",
    tar: "file_type_zip",
    gz: "file_type_zip",
    pdf: "file_type_pdf",
    doc: "file_type_word",
    docx: "file_type_word",
    xls: "file_type_excel",
    xlsx: "file_type_excel",
    ppt: "file_type_powerpoint",
    pptx: "file_type_powerpoint",
    vue: "file_type_vue",
    svelte: "file_type_svelte",
    astro: "file_type_astro",
    elm: "file_type_elm",
    fs: "file_type_fsharp",
    fsx: "file_type_fsharp",
    clj: "file_type_clojure",
    cljs: "file_type_clojurescript",
    lock: "file_type_lock",
    map: "file_type_map",
    log: "file_type_log",
    todo: "file_type_todo",
    env: "file_type_dotenv",
    htaccess: "file_type_apache",
  };

  if (filename.startsWith(".")) {
    const dotFile = filename.substring(1);
    if (specialFiles[dotFile] || specialFiles[`.${dotFile}`]) {
      return specialFiles[dotFile] || specialFiles[`.${dotFile}`];
    }
    return "file_type_config";
  }

  return extMap[ext] || "default_file";
};

const getFolderIconName = (folderName, isOpen = false) => {
  if (!folderName) return isOpen ? "default_folder_opened" : "default_folder";

  const name = folderName.toLowerCase();
  const suffix = isOpen ? "_opened" : "";

  const folderMap = {
    src: `folder_type_src${suffix}`,
    source: `folder_type_src${suffix}`,
    test: `folder_type_test${suffix}`,
    tests: `folder_type_test${suffix}`,
    spec: `folder_type_test${suffix}`,
    __tests__: `folder_type_test${suffix}`,
    e2e: `folder_type_e2e${suffix}`,
    node_modules: `folder_type_node${suffix}`,
    ".git": `folder_type_git${suffix}`,
    ".github": `folder_type_github${suffix}`,
    ".vscode": `folder_type_vscode${suffix}`,
    public: `folder_type_public${suffix}`,
    www: `folder_type_www${suffix}`,
    assets: `folder_type_asset${suffix}`,
    static: `folder_type_asset${suffix}`,
    images: `folder_type_images${suffix}`,
    img: `folder_type_images${suffix}`,
    fonts: `folder_type_fonts${suffix}`,
    video: `folder_type_video${suffix}`,
    docs: `folder_type_docs${suffix}`,
    documentation: `folder_type_docs${suffix}`,
    dist: `folder_type_dist${suffix}`,
    build: `folder_type_dist${suffix}`,
    out: `folder_type_dist${suffix}`,
    lib: `folder_type_library${suffix}`,
    libs: `folder_type_library${suffix}`,
    vendor: `folder_type_library${suffix}`,
    config: `folder_type_config${suffix}`,
    configs: `folder_type_config${suffix}`,
    components: `folder_type_component${suffix}`,
    utils: `folder_type_tools${suffix}`,
    helpers: `folder_type_helper${suffix}`,
    hooks: `folder_type_hook${suffix}`,
    styles: `folder_type_style${suffix}`,
    css: `folder_type_css${suffix}`,
    scss: `folder_type_sass${suffix}`,
    sass: `folder_type_sass${suffix}`,
    routes: `folder_type_route${suffix}`,
    pages: `folder_type_src${suffix}`,
    views: `folder_type_view${suffix}`,
    api: `folder_type_api${suffix}`,
    services: `folder_type_services${suffix}`,
    server: `folder_type_server${suffix}`,
    models: `folder_type_model${suffix}`,
    types: `folder_type_typings${suffix}`,
    typings: `folder_type_typings${suffix}`,
    interfaces: `folder_type_interfaces${suffix}`,
    scripts: `folder_type_script${suffix}`,
    tools: `folder_type_tools${suffix}`,
    temp: `folder_type_temp${suffix}`,
    tmp: `folder_type_temp${suffix}`,
    cache: `folder_type_temp${suffix}`,
    logs: `folder_type_log${suffix}`,
    templates: `folder_type_template${suffix}`,
    themes: `folder_type_theme${suffix}`,
    plugins: `folder_type_plugin${suffix}`,
    i18n: `folder_type_locale${suffix}`,
    locales: `folder_type_locale${suffix}`,
    workflows: `folder_type_github${suffix}`,
    ci: `folder_type_circleci${suffix}`,
    coverage: `folder_type_coverage${suffix}`,
    examples: `folder_type_src${suffix}`,
    demo: `folder_type_src${suffix}`,
    shared: `folder_type_shared${suffix}`,
    common: `folder_type_common${suffix}`,
    middleware: `folder_type_middleware${suffix}`,
    mock: `folder_type_mock${suffix}`,
    mocks: `folder_type_mock${suffix}`,
    db: `folder_type_db${suffix}`,
    database: `folder_type_db${suffix}`,
    docker: `folder_type_docker${suffix}`,
    ios: `folder_type_ios${suffix}`,
    android: `folder_type_android${suffix}`,
    aws: `folder_type_aws${suffix}`,
    azure: `folder_type_azure${suffix}`,
    gcp: `folder_type_gcp${suffix}`,
    firebase: `folder_type_firebase${suffix}`,
    supabase: `folder_type_supabase${suffix}`,
    next: `folder_type_next${suffix}`,
    nuxt: `folder_type_nuxt${suffix}`,
    svelte: `folder_type_svelte${suffix}`,
    angular: `folder_type_angular${suffix}`,
    cypress: `folder_type_cypress${suffix}`,
    prisma: `folder_type_prisma${suffix}`,
    gradle: `folder_type_gradle${suffix}`,
    maven: `folder_type_maven${suffix}`,
    fastlane: `folder_type_fastlane${suffix}`,
    storybook: `folder_type_story${suffix}`,
    turbo: `folder_type_turbo${suffix}`,
    tauri: `folder_type_tauri${suffix}`,
    vitepress: `folder_type_vitepress${suffix}`,
    k8s: `folder_type_kubernetes${suffix}`,
    kubernetes: `folder_type_kubernetes${suffix}`,
    pnpm: `folder_type_package${suffix}`,
    yarn: `folder_type_yarn${suffix}`,
  };

  return folderMap[name] || (isOpen ? "default_folder_opened" : "default_folder");
};

export const FileIconSVG = ({ filename, size = 16 }) => {
  const iconName = getFileIconName(filename);
  const iconPath = `${ICONS_BASE}/${iconName}.svg`;

  return (
    <img
      src={iconPath}
      width={size}
      height={size}
      alt=""
      style={{ display: "inline-block", verticalAlign: "middle" }}
      onError={(e) => {
        e.target.src = `${ICONS_BASE}/default_file.svg`;
      }}
    />
  );
};

export const FolderIcon = ({ folderName, isOpen = false, size = 16 }) => {
  const iconName = getFolderIconName(folderName, isOpen);
  const iconPath = `${ICONS_BASE}/${iconName}.svg`;

  return (
    <img
      src={iconPath}
      width={size}
      height={size}
      alt=""
      style={{ display: "inline-block", verticalAlign: "middle" }}
      onError={(e) => {
        e.target.src = isOpen ? `${ICONS_BASE}/default_folder_opened.svg` : `${ICONS_BASE}/default_folder.svg`;
      }}
    />
  );
};

export { getFileIconName as getFileIcon, getFolderIconName as getFolderIcon, FileIconSVG as getFileIconSVG };
export default FileIconSVG;
