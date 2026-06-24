/**
 * In-browser bundler for the workshop frontend.
 *
 * This is the secret sauce that lets users hit "Run in IDE" and see their
 * site without ever opening a terminal. We:
 *
 *   1. Read every file in the detected frontend folder out of the IDE's
 *      in-memory `fileContents` map.
 *   2. Hand them to a sandboxed esbuild-wasm instance with two custom
 *      resolver plugins:
 *        - `workspace-files`  → relative / absolute paths come from RAM
 *        - `cdn-imports`      → bare npm specifiers redirect to esm.sh
 *   3. Splice esbuild's bundled JS (and any CSS it produced) into the
 *      project's existing `index.html`.
 *   4. Wrap the result in a `Blob`, hand back a `blob:` URL the iframe
 *      can frame directly.
 *
 * The whole pipeline runs in the browser — no Node, no terminal, no
 * pre-installed dependencies. esm.sh handles npm package resolution,
 * including subpath imports like `react-dom/client`.
 */

import { detectFrontendRoot, collectPreviewFiles } from "../features/fullstack/fullstackBundler";
import { FULLSTACK_TEMPLATE_IDS } from "../features/workspace/workspaceTemplates";
import {
  buildPreviewFreighterShimContents,
  PREVIEW_FLAG_SCRIPT,
  buildPreviewContractScript,
} from "./previewWalletBridge";
import { PREVIEW_CONSOLE_SCRIPT } from "./previewConsoleBridge";

/**
 * Latest bundled template frontend sources from disk. Open workspaces keep
 * stale copies in React state — overlay at bundle time so preview fixes
 * (u32 args, wallet bridge, action logging) apply without re-creating projects.
 */
const TEMPLATE_FRONTEND_SRC = import.meta.glob(
  "../templates/*/frontend/src/*.{ts,tsx,css}",
  { query: "?raw", import: "default", eager: true },
);

import { FULLSTACK_APP_MARKERS } from "../features/workspace/fullstackTemplateCatalog";

/** Strip legacy lines that crash Stellar SDK v13 at module load time. */
const sanitizeLegacyWorkshopSources = (filesMap) => {
  for (const [path, raw] of filesMap.entries()) {
    if (!/\.tsx?$/.test(path) || typeof raw !== "string") continue;
    if (!raw.includes("READ_SOURCE") && !raw.includes("READ_SOURCE_ADDRESS")) continue;
    let next = raw
      .replace(
        /export const READ_SOURCE_ADDRESS = Address\.fromString\(READ_SOURCE\)\.toString\(\);\s*\n?/g,
        "",
      )
      .replace(
        /export const READ_SOURCE = "[^"]*";\s*(?:\/\/[^\n]*)?\n?/g,
        "",
      )
      .replace(/\bREAD_SOURCE,\s*\n/g, "")
      .replace(/import\s*\{\s*Address,\s*\n(\s*Contract,)/, "import {\n$1");
    if (next !== raw) filesMap.set(path, next);
  }
};

const detectTemplateId = (treeData, filesMap) => {
  const rootName = treeData?.[0]?.name;
  if (rootName && FULLSTACK_TEMPLATE_IDS.includes(rootName)) return rootName;

  const clientSrc = filesMap.get("src/sorobanClient.ts") || "";
  const CLIENT_HINTS = [
    { id: "savings-circle", needle: "contracts/savings_circle" },
    { id: "invoice-split", needle: "contracts/invoice_split" },
    { id: "donation-vault", needle: "contracts/donation_vault" },
    { id: "tip-jar", needle: "contracts/tip_jar" },
    { id: "pay-escrow", needle: "contracts/escrow" },
    { id: "fullstack-workshop", needle: "contracts/counter" },
  ];
  for (const { id, needle } of CLIENT_HINTS) {
    if (clientSrc.includes(needle)) return id;
  }

  const appSrc = filesMap.get("src/App.tsx") || filesMap.get("src/App.jsx") || "";
  for (const { id, needle } of FULLSTACK_APP_MARKERS) {
    if (appSrc.includes(needle)) return id;
  }
  // Split Bill uses JSX split across elements — match class or tagline too
  if (appSrc.includes("Split") && appSrc.includes("Bill")) return "invoice-split";
  return null;
};

/** Replace template `frontend/src/*` from disk so preview always uses latest fixes. */
const overlayTemplateFrontendSources = (filesMap, treeData) => {
  if (!filesMap.has("src/sorobanClient.ts")) return;
  const templateId = detectTemplateId(treeData, filesMap);
  if (!templateId) return;

  const marker = `/templates/${templateId}/frontend/src/`;
  for (const [key, content] of Object.entries(TEMPLATE_FRONTEND_SRC)) {
    if (!key.includes(marker)) continue;
    // glob keys end with …/frontend/src/File.ts — map to workspace src/File.ts
    const rel = `src/${key.slice(key.indexOf(marker) + marker.length)}`;
    filesMap.set(rel, content);
  }
};

/** Patch stale in-memory sorobanClient that still maps args with bare nativeToScVal. */
const patchLegacySorobanClient = (filesMap) => {
  const path = "src/sorobanClient.ts";
  const src = filesMap.get(path);
  if (!src || typeof src !== "string") return;
  if (src.includes('type: "u32"') || src.includes("argsToScVals")) return;
  if (!src.includes("nativeToScVal")) return;

  let next = src;
  if (next.includes("args.map((a) => nativeToScVal(a))")) {
    next = next.replace(
      /args\.map\(\(a\) => nativeToScVal\(a\)\)/g,
      `args.map((a) => (typeof a === "number" && Number.isInteger(a) && a >= 0 ? nativeToScVal(a, { type: "u32" }) : nativeToScVal(a)))`,
    );
  }
  if (next !== src) filesMap.set(path, next);
};

// ── Import classification ────────────────────────────────────────────────
/**
 * Distinguish bare npm specifiers (`react`, `@stellar/stellar-sdk`) from
 * workspace file paths (`src/main.tsx`, `./App.tsx`).
 *
 * The old CDN filter `/^[@a-zA-Z0-9_-]/` incorrectly matched `src/main.tsx`
 * because it starts with `s`, which caused "entry point cannot be marked
 * as external".
 */
const isBareNpmImport = (path) => {
  if (!path || path.startsWith(".") || path.startsWith("/")) return false;
  if (/^https?:\/\//.test(path)) return false;
  const base = path.split("/").pop() || "";
  if (/\.(tsx?|jsx?|mjs|cjs|css|json|html|svg|png|jpe?g|gif|webp|ico|wasm|txt|md)$/i.test(base)) {
    return false;
  }
  return true;
};

// ── esbuild-wasm lazy initializer ────────────────────────────────────────
// Memoize across rebuilds. Also tolerate Vite HMR reloading this module
// while the wasm runtime stays initialized in memory — without that guard
// "Try again" throws "Cannot call initialize more than once".
const ESBUILD_GLOBAL_KEY = "__sorobanEsbuildModule__";
let esbuildInitPromise = null;

async function ensureEsbuild() {
  if (typeof window !== "undefined" && window[ESBUILD_GLOBAL_KEY]) {
    return window[ESBUILD_GLOBAL_KEY];
  }
  if (esbuildInitPromise) return esbuildInitPromise;

  esbuildInitPromise = (async () => {
    const esbuild = await import("esbuild-wasm");
    const wasmUrl = (await import("esbuild-wasm/esbuild.wasm?url")).default;
    try {
      await esbuild.initialize({ wasmURL: wasmUrl, worker: true });
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      if (!/initialize.*more than once/i.test(msg)) throw err;
    }
    if (typeof window !== "undefined") {
      window[ESBUILD_GLOBAL_KEY] = esbuild;
    }
    return esbuild;
  })().catch((err) => {
    esbuildInitPromise = null;
    throw err;
  });
  return esbuildInitPromise;
}

// ── Path helpers ─────────────────────────────────────────────────────────
const EXT_LOADERS = {
  ts: "ts", tsx: "tsx", js: "js", jsx: "jsx",
  mjs: "js", cjs: "js", json: "json", css: "css",
  svg: "text", txt: "text", md: "text",
  png: "dataurl", jpg: "dataurl", jpeg: "dataurl",
  gif: "dataurl", webp: "dataurl", ico: "dataurl",
};

const dirname = (p) => {
  const i = p.lastIndexOf("/");
  return i === -1 ? "" : p.slice(0, i);
};

/** Normalize "a/b/../c/./d" → "a/c/d". */
const normalizePath = (p) => {
  const parts = p.split("/").filter(Boolean);
  const out = [];
  for (const part of parts) {
    if (part === ".") continue;
    if (part === "..") { out.pop(); continue; }
    out.push(part);
  }
  return out.join("/");
};

const joinPath = (dir, rel) => normalizePath(`${dir}/${rel}`);

/** Files to try when an import has no extension: `./foo` → `./foo.tsx`, etc. */
const candidatesFor = (base) => [
  base,
  `${base}.ts`,
  `${base}.tsx`,
  `${base}.js`,
  `${base}.jsx`,
  `${base}.mjs`,
  `${base}.cjs`,
  `${base}.json`,
  `${base}.css`,
  `${base}/index.ts`,
  `${base}/index.tsx`,
  `${base}/index.js`,
  `${base}/index.jsx`,
];

// ── Env parsing (for `import.meta.env.VITE_*`) ───────────────────────────
const parseEnv = (text) => {
  const env = {};
  if (!text) return env;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) env[key] = value;
  }
  return env;
};

/**
 * Construct the `define` map esbuild applies as a literal string-replace
 * pass. Vite exposes a set of well-known booleans plus every VITE_*
 * variable — we replicate that surface so the user's code doesn't need to
 * know it's running through a different bundler.
 */
const envDefines = (env) => {
  // The catch-all `import.meta.env: "{}"` (and `process.env: "{}"`) is a
  // critical fallback: it ensures that any unknown key access (e.g.
  // `import.meta.env.SOME_TYPO`) compiles to `({}).SOME_TYPO = undefined`
  // instead of a runtime TypeError when `import.meta.env` is undefined.
  // esbuild prefers longer-matching defines, so the specific VITE_* keys
  // below still win when they're set.
  const out = {
    global: "globalThis",
    "import.meta.env": "{}",
    "import.meta.env.MODE": JSON.stringify("development"),
    "import.meta.env.DEV": "true",
    "import.meta.env.PROD": "false",
    "import.meta.env.SSR": "false",
    "import.meta.env.BASE_URL": JSON.stringify("/"),
    // process.env shim so packages built for Node don't blow up.
    "process.env": "{}",
    "process.env.NODE_ENV": JSON.stringify("development"),
  };
  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith("VITE_")) continue;
    out[`import.meta.env.${key}`] = JSON.stringify(value);
  }
  return out;
};

/** Merge workspace .env files with IDE-injected preview values. */
const parsedEnvFromOptions = (options, parsedEnv) => {
  const env = { ...parsedEnv };
  if (options.walletAddress) {
    env.VITE_WALLET_ADDRESS = options.walletAddress;
  }
  // Never bake stale workspace .env contract ids into fullstack template previews.
  if (options.templateId) {
    delete env.VITE_CONTRACT_ID;
  }
  // Preview resolver owns VITE_CONTRACT_ID — drop stale workspace .env values.
  if (options.contractId !== undefined) {
    if (options.contractId) {
      env.VITE_CONTRACT_ID = options.contractId;
    } else {
      delete env.VITE_CONTRACT_ID;
    }
  }
  if (options.network && !env.VITE_NETWORK) {
    env.VITE_NETWORK = options.network;
  }
  return env;
};

const needsBufferPolyfill = (filesMap) => {
  const pkgRaw = filesMap.get("package.json");
  if (!pkgRaw) return true;
  try {
    const pkg = JSON.parse(pkgRaw);
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    return Boolean(
      deps["@stellar/stellar-sdk"]
      || deps["@stellar/stellar-base"]
      || deps.buffer,
    );
  } catch {
    return true;
  }
};

// ── HTML splicing ────────────────────────────────────────────────────────
/**
 * Replace the Vite entry script with a module `<script src="...">` pointing
 * at a blob URL, inject bundled CSS into `<head>`, and add preview bootstrap
 * scripts (console bridge + wallet flag).
 */
const composeFinalHtml = (indexHtml, jsModuleUrl, cssContent, previewContractId = "") => {
  let html = indexHtml;

  const scriptRe = /<script\s+type="module"\s+src="[^"]+"\s*><\/script>/i;
  const moduleScript = `<script type="module" src="${jsModuleUrl}"></script>`;
  if (scriptRe.test(html)) {
    html = html.replace(scriptRe, moduleScript);
  } else if (html.includes("</body>")) {
    html = html.replace("</body>", `${moduleScript}\n</body>`);
  } else {
    html += moduleScript;
  }

  if (cssContent) {
    const styleTag = `<style id="__soroban_preview_css__">\n${cssContent}\n</style>`;
    if (html.includes("</head>")) {
      html = html.replace("</head>", `${styleTag}\n</head>`);
    } else {
      html = styleTag + "\n" + html;
    }
  }

  const previewBootstrap = `${PREVIEW_FLAG_SCRIPT}\n${buildPreviewContractScript(previewContractId)}\n${PREVIEW_CONSOLE_SCRIPT}`;
  if (html.includes("</head>")) {
    html = html.replace("</head>", `${previewBootstrap}\n</head>`);
  } else {
    html = previewBootstrap + "\n" + html;
  }

  return html;
};

/** Strip orphaned CSS imports the bundler may still emit after extraction. */
const stripCssImports = (js) =>
  js.replace(/^\s*import\s+["'][^"']*\.css(?:\?[^"']*)?["'];?\s*$/gm, "");

// ── Main entry point ─────────────────────────────────────────────────────
/**
 * Bundle the user's frontend folder into a single HTML blob URL the
 * Preview iframe can frame directly.
 *
 * Returns `{ blobUrl, html, durationMs, bytes, warnings }` on success.
 * Throws an `Error` with a `.details` array on failure so the UI can
 * render per-file diagnostics.
 */
export async function bundleFrontendInBrowser(treeData, fileContents, options = {}) {
  const onProgress = options.onProgress || (() => {});
  const startedAt = performance.now();

  // 1) Detect frontend folder + collect files
  const detection = detectFrontendRoot(treeData);
  if (!detection.folder) {
    throw new Error("No frontend folder detected — open a project with frontend/ or web/.");
  }
  onProgress({ stage: "collect", message: "Reading workspace files..." });

  const files = collectPreviewFiles(detection.folder, fileContents || {});
  if (files.length === 0) {
    throw new Error("No frontend files found to bundle.");
  }

  const filesMap = new Map();
  let indexHtml = null;
  const parsedEnv = {};
  for (const { path, content } of files) {
    filesMap.set(path, content);
    if (path === "index.html") indexHtml = content;
    if (/^\.env(\.|$)/.test(path)) {
      Object.assign(parsedEnv, parseEnv(content));
    }
  }

  overlayTemplateFrontendSources(filesMap, treeData);
  patchLegacySorobanClient(filesMap);
  sanitizeLegacyWorkshopSources(filesMap);

  const templateId = detectTemplateId(treeData, filesMap);

  if (!indexHtml) {
    throw new Error(
      "index.html not found at the frontend root — the bundler needs one to know where to start.",
    );
  }

  // 2) Find the entry script declared in index.html (Vite convention).
  const scriptMatch = indexHtml.match(/<script\s+type="module"\s+src="([^"]+)"\s*><\/script>/i);
  if (!scriptMatch) {
    throw new Error(
      'index.html must contain a <script type="module" src="..."></script> tag pointing at your entry file.',
    );
  }
  const entryRaw = scriptMatch[1];
  const entrySrc = entryRaw.startsWith("/") ? entryRaw.slice(1) : entryRaw;
  if (!filesMap.has(entrySrc)) {
    // Try resolving with extensions in case the tag points at a folder.
    const found = candidatesFor(entrySrc).find((c) => filesMap.has(c));
    if (!found) {
      throw new Error(`Entry script "${entryRaw}" was referenced by index.html but isn't in the workspace.`);
    }
  }
  const entry = filesMap.has(entrySrc)
    ? entrySrc
    : candidatesFor(entrySrc).find((c) => filesMap.has(c));

  onProgress({ stage: "init", message: "Booting bundler (esbuild-wasm)..." });
  const esbuild = await ensureEsbuild();

  onProgress({ stage: "bundle", message: "Compiling sources & resolving npm imports..." });

  const env = parsedEnvFromOptions({ ...options, templateId }, parsedEnv);
  const useBufferPolyfill = needsBufferPolyfill(filesMap);
  if (env.VITE_CONTRACT_ID && env.VITE_CONTRACT_ID.startsWith("G")) {
    throw new Error(
      "VITE_CONTRACT_ID looks like a wallet address (starts with G). "
      + "Use the contract ID from the Deploy panel (starts with C). "
      + "Wallet addresses belong in Freighter / VITE_WALLET_ADDRESS, not VITE_CONTRACT_ID.",
    );
  }

  let result;
  try {
    result = await esbuild.build({
      entryPoints: [entry],
      bundle: true,
      write: false,
      format: "esm",
      target: "es2020",
      sourcemap: "inline",
      jsx: "automatic",
      define: envDefines(env),
      inject: useBufferPolyfill ? ["soroban-buffer-polyfill"] : undefined,
      loader: {
        ".svg": "text",
        ".png": "dataurl",
        ".jpg": "dataurl",
        ".jpeg": "dataurl",
        ".gif": "dataurl",
        ".webp": "dataurl",
        ".ico": "dataurl",
      },
      plugins: [
        bufferPolyfillPlugin(),
        workspacePlugin(filesMap),
        previewFreighterShimPlugin(filesMap),
        stellarSdkCompatPlugin(filesMap),
        cdnShimPlugin(filesMap),
        cdnPlugin(filesMap),
      ],
    });
  } catch (err) {
    // esbuild surfaces parse / resolution errors as thrown Errors with
    // `errors[]`. Capture them on `.details` so the UI can list each.
    const wrapped = new Error(
      err && err.message ? err.message : "Bundle failed",
    );
    wrapped.details = err && err.errors ? err.errors : [];
    throw wrapped;
  }

  if (result.errors && result.errors.length > 0) {
    const wrapped = new Error(result.errors[0].text || "Bundle failed");
    wrapped.details = result.errors;
    throw wrapped;
  }

  let jsContent = "";
  let cssContent = "";
  for (const file of result.outputFiles || []) {
    if (file.path.endsWith(".css")) cssContent += file.text + "\n";
    else jsContent += file.text + "\n";
  }
  jsContent = stripCssImports(jsContent);

  onProgress({ stage: "compose", message: "Assembling preview..." });

  const jsBlobUrl = URL.createObjectURL(
    new Blob([jsContent], { type: "text/javascript" }),
  );
  const finalHtml = composeFinalHtml(indexHtml, jsBlobUrl, cssContent, options.contractId ?? "");

  const blob = new Blob([finalHtml], { type: "text/html" });
  const blobUrl = URL.createObjectURL(blob);

  const durationMs = performance.now() - startedAt;
  return {
    blobUrl,
    /** Extra blob URLs that must be revoked alongside blobUrl on rebuild. */
    auxBlobUrls: [jsBlobUrl],
    html: finalHtml,
    durationMs,
    bytes: finalHtml.length,
    warnings: result.warnings || [],
    entry,
  };
}

// ── Plugins ──────────────────────────────────────────────────────────────

/**
 * Resolves `./foo`, `../foo`, `/foo` against the in-memory file map.
 * Bare specifiers fall through to the CDN plugin.
 */
function workspacePlugin(filesMap) {
  return {
    name: "workspace-files",
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        if (/^https?:\/\//.test(args.path)) return null;
        if (isBareNpmImport(args.path)) return null;

        let baseCandidate;
        if (args.path.startsWith("/")) {
          baseCandidate = args.path.slice(1);
        } else if (args.importer && (args.path.startsWith("./") || args.path.startsWith("../"))) {
          baseCandidate = joinPath(dirname(args.importer), args.path);
        } else if (args.importer) {
          // Bare-looking path from an importer, e.g. import App from "App"
          baseCandidate = joinPath(dirname(args.importer), args.path);
        } else {
          // Entry point from index.html, e.g. src/main.tsx
          baseCandidate = args.path;
        }

        for (const c of candidatesFor(baseCandidate)) {
          if (filesMap.has(c)) {
            return { path: c, namespace: "workspace" };
          }
        }
        return {
          errors: [{
            text: `Cannot resolve "${args.path}"${args.importer ? ` from ${args.importer}` : ""}`,
          }],
        };
      });

      build.onLoad({ filter: /.*/, namespace: "workspace" }, (args) => {
        const content = filesMap.get(args.path);
        if (content == null) {
          return { errors: [{ text: `File disappeared while loading: ${args.path}` }] };
        }
        const ext = (args.path.match(/\.([^./]+)$/) || ["", ""])[1].toLowerCase();

        // Turn CSS imports into JS that injects a <style> tag. Extracting
        // CSS to a separate file leaves `import "./foo.css"` in the JS
        // output, which 404s inside a blob preview and kills the whole
        // module graph silently (black iframe).
        if (ext === "css") {
          return {
            contents: [
              "(function(){",
              "  var s = document.createElement('style');",
              `  s.setAttribute('data-file', ${JSON.stringify(args.path)});`,
              `  s.textContent = ${JSON.stringify(content)};`,
              "  document.head.appendChild(s);",
              "})();",
            ].join("\n"),
            loader: "js",
          };
        }

        const loader = EXT_LOADERS[ext] || "text";
        return { contents: content, loader };
      });
    },
  };
}

/**
 * Parse an npm import specifier into { pkgName, subpath }.
 *   react-dom/client  → { pkgName: "react-dom", subpath: "/client" }
 *   @stellar/freighter-api → { pkgName: "@stellar/freighter-api", subpath: "" }
 *
 * IMPORTANT: scoped packages use TWO path segments for pkgName. The old
 * `indexOf("/", 1)` approach returned "@stellar" for "@stellar/freighter-api",
 * which broke version pinning and the exports= lookup entirely.
 */
const parseNpmSpec = (spec) => {
  if (spec.startsWith("@")) {
    const parts = spec.split("/");
    if (parts.length < 2) return { pkgName: spec, subpath: "" };
    return {
      pkgName: `${parts[0]}/${parts[1]}`,
      subpath: parts.length > 2 ? `/${parts.slice(2).join("/")}` : "",
    };
  }
  const slash = spec.indexOf("/");
  if (slash === -1) return { pkgName: spec, subpath: "" };
  return { pkgName: spec.slice(0, slash), subpath: spec.slice(slash) };
};

const readPkgVersions = (filesMap) => {
  const rawPkg = filesMap.get("package.json");
  if (!rawPkg) return {};
  try {
    const pkg = JSON.parse(rawPkg);
    return { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  } catch {
    return {};
  }
};

/** Minimum Stellar package versions for in-IDE preview (testnet Protocol 22+ XDR). */
const PREVIEW_MIN_VERSIONS = {
  "@stellar/stellar-sdk": "15.1.0",
  "@stellar/freighter-api": "4.0.0",
};

const parseSemverParts = (version) =>
  String(version || "0")
    .replace(/^[^\d]*/, "")
    .split(".")
    .map((n) => parseInt(n, 10) || 0);

const semverLt = (a, b) => {
  const pa = parseSemverParts(a);
  const pb = parseSemverParts(b);
  for (let i = 0; i < 3; i += 1) {
    if ((pa[i] || 0) < (pb[i] || 0)) return true;
    if ((pa[i] || 0) > (pb[i] || 0)) return false;
  }
  return false;
};

const extractVersionFromRange = (range) =>
  String(range || "").replace(/^[\^~>=<]+/, "").split(" ")[0];

const pinNpmSpec = (spec, pkgVersions) => {
  const { pkgName, subpath } = parseNpmSpec(spec);
  const range = pkgVersions[pkgName];
  const minVer = PREVIEW_MIN_VERSIONS[pkgName];

  let ver = range ? extractVersionFromRange(range) : null;

  if (minVer) {
    if (!ver || semverLt(ver, minVer)) ver = minVer;
    return `${pkgName}@${ver}${subpath}`;
  }

  if (ver) return `${pkgName}@${ver}${subpath}`;
  return spec;
};

const buildEsmShUrl = (spec, pkgVersions, { exports } = {}) => {
  const pinned = pinNpmSpec(spec, pkgVersions);
  const params = new URLSearchParams({ target: "es2020" });
  params.set("dev", "");
  if (exports) params.set("exports", exports);
  return `https://esm.sh/${pinned}?${params.toString()}`;
};

/**
 * Packages that esm.sh only exposes as a default export (CJS interop).
 * We bundle a tiny shim that default-imports from esm.sh and re-exports
 * named bindings so `{ getAddress }` imports work in the final output.
 */
const CDN_SHIM_EXPORTS = {};

const FREIGHTER_API_PKG = "@stellar/freighter-api";
const STELLAR_SDK_PKG = "@stellar/stellar-sdk";

/** Freighter shim with parent-window bridge for blob preview iframes. */
function previewFreighterShimPlugin(filesMap) {
  const pkgVersions = readPkgVersions(filesMap);

  return {
    name: "preview-freighter-shim",
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        if (!isBareNpmImport(args.path)) return null;
        const { pkgName } = parseNpmSpec(args.path);
        if (pkgName !== FREIGHTER_API_PKG) return null;
        return { path: args.path, namespace: "preview-freighter" };
      });

      build.onLoad({ filter: /.*/, namespace: "preview-freighter" }, (args) => {
        const url = buildEsmShUrl(args.path, pkgVersions);
        return {
          contents: buildPreviewFreighterShimContents(url),
          loader: "js",
        };
      });
    },
  };
}

/** Named bindings re-exported from the stellar-sdk default export object. */
const STELLAR_SDK_EXPORTS = [
  "Address", "Asset", "Account", "Keypair", "MuxedAccount", "Claimant",
  "Contract", "Networks", "TransactionBuilder", "Transaction", "FeeBumpTransaction",
  "Operation", "Memo", "StrKey", "BASE_FEE", "xdr",
  "scValToNative", "nativeToScVal", "scValToBigInt",
  "LiquidityPoolAsset", "LiquidityPoolId", "FastSigning", "SigningKey",
  "LiquidityPoolFeeV18", "TimeoutInfinite", "AuthRequiredFlag", "AuthRevocableFlag",
  "AuthImmutableFlag", "AuthClawbackEnabledFlag",
  "Config", "Utils", "Horizon", "Federation", "WebAuth", "Friendbot", "StellarToml",
  "rpc", "contract",
  "hash", "sign", "verify", "encodeMuxedAccount", "decodeMuxedAccount",
  "getLiquidityPoolId", "MemoNone", "MemoID", "MemoText", "MemoHash", "MemoReturn",
];

function bufferPolyfillPlugin() {
  const bufferUrl = "https://esm.sh/buffer@6.0.3?target=es2020&dev";
  return {
    name: "buffer-polyfill",
    setup(build) {
      build.onResolve({ filter: /^soroban-buffer-polyfill$/ }, () => ({
        path: "soroban-buffer-polyfill",
        namespace: "soroban-inject",
      }));
      build.onLoad({ filter: /.*/, namespace: "soroban-inject" }, () => ({
        contents: [
          `import { Buffer } from ${JSON.stringify(bufferUrl)};`,
          "if (typeof globalThis.Buffer === \"undefined\") globalThis.Buffer = Buffer;",
        ].join("\n"),
        loader: "js",
      }));
    },
  };
}

/**
 * Default-import shim for @stellar/stellar-sdk. esm.sh exposes the package as a
 * default export object; named `import { rpc } from "https://esm.sh/…"` fails at
 * runtime. Re-export properties from the default object instead, and map legacy
 * SorobanRpc → rpc for SDK v13+.
 */
function stellarSdkCompatPlugin(filesMap) {
  const pkgVersions = readPkgVersions(filesMap);

  return {
    name: "stellar-sdk-compat",
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        if (!isBareNpmImport(args.path)) return null;
        const { pkgName } = parseNpmSpec(args.path);
        if (pkgName !== STELLAR_SDK_PKG) return null;
        return { path: args.path, namespace: "stellar-sdk-compat" };
      });

      build.onLoad({ filter: /.*/, namespace: "stellar-sdk-compat" }, (args) => {
        const url = buildEsmShUrl(args.path, pkgVersions);
        const lines = [
          `import __pkg from ${JSON.stringify(url)};`,
          "const __sdk = __pkg.default ?? __pkg;",
          "",
          "// Coerce numeric contract args to ScVal U32 (nativeToScVal(100) → U64 traps u32 params).",
          "function __coerceSorobanArg(arg) {",
          "  if (arg != null && typeof arg === \"object\" && typeof arg.switch === \"function\") {",
          "    if (arg.switch().name === \"scvU64\") {",
          "      const n = Number(__sdk.scValToNative(arg));",
          "      if (Number.isInteger(n) && n >= 0 && n <= 0xffffffff) {",
          "        return __sdk.xdr.ScVal.scvU32(n >>> 0);",
          "      }",
          "    }",
          "    return arg;",
          "  }",
          "  if (typeof arg === \"number\" && Number.isInteger(arg) && arg >= 0 && arg <= 0xffffffff) {",
          "    return __sdk.xdr.ScVal.scvU32(arg >>> 0);",
          "  }",
          "  if (typeof arg === \"bigint\" && arg >= 0n && arg <= 0xffffffffn) {",
          "    return __sdk.xdr.ScVal.scvU32(Number(arg));",
          "  }",
          "  return arg;",
          "}",
          "",
          "const __NativeToScVal = __sdk.nativeToScVal;",
          "function __nativeToScVal(val, opts) {",
          "  if (opts && opts.type === \"u32\") {",
          "    return __sdk.xdr.ScVal.scvU32(Number(val) >>> 0);",
          "  }",
          "  return __NativeToScVal(val, opts);",
          "}",
          "",
          "const __BaseContract = __sdk.Contract;",
          "class __PreviewContract extends __BaseContract {",
          "  call(fn, ...args) {",
          "    return super.call(fn, ...args.map(__coerceSorobanArg));",
          "  }",
          "}",
          "",
          ...STELLAR_SDK_EXPORTS.filter((name) => name !== "Contract" && name !== "nativeToScVal").map(
            (name) => `export const ${name} = __sdk[${JSON.stringify(name)}];`,
          ),
          "export const nativeToScVal = __nativeToScVal;",
          "export const Contract = __PreviewContract;",
          "export const SorobanRpc = __sdk.SorobanRpc ?? __sdk.rpc;",
          "export default __sdk;",
        ];
        return { contents: lines.join("\n"), loader: "js" };
      });
    },
  };
}

/**
 * Virtual modules for default-only CDN packages. esbuild inlines these into
 * the bundle so runtime code never does `import { x } from "https://esm.sh/…"`.
 */
function cdnShimPlugin(filesMap) {
  const pkgVersions = readPkgVersions(filesMap);

  return {
    name: "cdn-shim",
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        if (!isBareNpmImport(args.path)) return null;
        const { pkgName } = parseNpmSpec(args.path);
        if (!CDN_SHIM_EXPORTS[pkgName]) return null;
        return { path: args.path, namespace: "cdn-shim" };
      });

      build.onLoad({ filter: /.*/, namespace: "cdn-shim" }, (args) => {
        const { pkgName } = parseNpmSpec(args.path);
        const exportNames = CDN_SHIM_EXPORTS[pkgName] || [];
        const url = buildEsmShUrl(args.path, pkgVersions);
        const lines = [
          `import __pkg from ${JSON.stringify(url)};`,
          ...exportNames.map((name) => `export const ${name} = __pkg[${JSON.stringify(name)}];`),
          "export default __pkg;",
        ];
        return { contents: lines.join("\n"), loader: "js" };
      });
    },
  };
}

/**
 * External CDN imports for packages with native ESM named exports (react, etc.).
 * Shimmed packages are skipped — cdnShimPlugin handles those.
 */
function cdnPlugin(filesMap) {
  const pkgVersions = readPkgVersions(filesMap);

  return {
    name: "cdn-imports",
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        if (!isBareNpmImport(args.path)) return null;
        const { pkgName } = parseNpmSpec(args.path);
        if (
          CDN_SHIM_EXPORTS[pkgName]
          || pkgName === STELLAR_SDK_PKG
          || pkgName === FREIGHTER_API_PKG
        ) return null;
        return {
          path: buildEsmShUrl(args.path, pkgVersions),
          external: true,
        };
      });
    },
  };
}
