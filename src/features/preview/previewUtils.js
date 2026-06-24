import { collectPreviewFiles, detectFrontendRoot } from "../fullstack/fullstackBundler";
import {
  FULLSTACK_APP_MARKERS,
  getFullstackPreviewSpec,
} from "../workspace/fullstackTemplateCatalog";
import { FULLSTACK_TEMPLATE_IDS } from "../workspace/workspaceTemplates";

const parseEnvLine = (text) => {
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
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) env[key] = value;
  }
  return env;
};

/** Detect which bundled fullstack template the open workspace uses (if any). */
export const detectWorkspaceTemplate = (treeData, fileContents) => {
  const rootName = treeData?.[0]?.name;
  if (rootName && FULLSTACK_TEMPLATE_IDS.includes(rootName)) {
    return rootName;
  }
  const normalizedRoot = (rootName || "").toLowerCase().replace(/_/g, "-");
  if (normalizedRoot && FULLSTACK_TEMPLATE_IDS.includes(normalizedRoot)) {
    return normalizedRoot;
  }

  const detection = detectFrontendRoot(treeData);
  if (!detection?.folder || detection.kind === "empty") return null;

  const files = collectPreviewFiles(detection.folder, fileContents || {});
  const appFile = files.find(({ path }) => /(?:^|\/)App\.tsx$/.test(path));
  const appSrc = appFile?.content || "";
  if (!appSrc) return null;

  for (const { id, needle } of FULLSTACK_APP_MARKERS) {
    if (appSrc.includes(needle)) return id;
  }
  if (appSrc.includes("Split") && appSrc.includes("Bill")) return "invoice-split";
  return null;
};

/** Preview contract spec for the detected workspace template. */
export const getWorkspacePreviewSpec = (treeData, fileContents) => {
  const templateId = detectWorkspaceTemplate(treeData, fileContents);
  return templateId ? getFullstackPreviewSpec(templateId) : null;
};

/** Read merged VITE_* values from frontend .env files in the workspace. */
export const parsePreviewEnv = (detection, fileContents) => {
  if (!detection?.folder || detection.kind === "empty") return {};
  const files = collectPreviewFiles(detection.folder, fileContents || {});
  let env = {};
  for (const { path, content } of files) {
    if (/^\.env(\.|$)/.test(path)) {
      env = { ...env, ...parseEnvLine(content) };
    }
  }
  return env;
};

/** Fingerprint frontend workspace files to detect edits for live rebuild. */
export const fingerprintFrontend = (detection, fileContents) => {
  if (!detection?.folder || detection.kind === "empty") return "";
  const files = collectPreviewFiles(detection.folder, fileContents || {});
  if (files.length === 0) return "";
  let hash = 0;
  const blob = files
    .map(({ path, content }) => `${path}\0${content ?? ""}`)
    .join("\n");
  for (let i = 0; i < blob.length; i += 1) {
    hash = ((hash << 5) - hash + blob.charCodeAt(i)) | 0;
  }
  return `${files.length}:${hash}`;
};

export const BUILD_STAGE_ORDER = ["collect", "init", "bundle", "compose"];

export const BUILD_STAGE_LABELS = {
  collect: "Reading files",
  init: "Booting bundler",
  bundle: "Compiling",
  compose: "Composing preview",
};

export const BUILD_STAGE_PROGRESS = {
  collect: 12,
  init: 32,
  bundle: 72,
  compose: 92,
};

export const shortContractId = (id) => (
  id && id.length > 10 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id || ""
);
