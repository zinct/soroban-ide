import { collectPreviewFiles } from "../fullstack/fullstackBundler";

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
