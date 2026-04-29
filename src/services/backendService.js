/**
 * Backend integration service for Soroban Studio.
 *
 * Handles communication with the Go backend at /api (proxied in dev).
 * - POST /api/run    → submit project files + command for execution
 * - WS   /api/ws     → stream output in real-time
 * - GET  /api/files  → lazy-load folder contents
 */

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

/**
 * Fetch a full project template (tree + contents) from the backend filesystem.
 */
export const fetchTemplate = async (name) => {
  const response = await fetch(`${API_BASE}/templates?name=${name}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch template: ${response.statusText}`);
  }
  return response.json();
};

/**
 * Get or create a persistent session ID stored in localStorage.
 * This ensures all commands share the same workspace on the backend,
 * even when frontend and backend are on different domains (cross-origin).
 */
export const getSessionId = () => {
  let sid = localStorage.getItem("workspace_session_id");
  if (!sid) {
    sid = crypto.randomUUID();
    localStorage.setItem("workspace_session_id", sid);
  }
  return sid;
};

/**
 * Reset the session ID (e.g., when creating a brand new project from scratch).
 */
export const resetSessionId = () => {
  localStorage.removeItem("workspace_session_id");
};

/**
 * Walk the workspace tree and collect all source files into a flat
 * { "relative/path": "content" } map for the backend.
 * By default skips images and other non-source binaries to keep payloads small.
 */
export const collectProjectFiles = (treeData, fileContents, options = {}) => {
  const { includeAll = false } = options;
  const files = {};
  
  // Only allow source-related extensions
  const ALLOWED_EXTENSIONS = [
    ".rs", ".toml", ".json", ".js", ".ts", ".md", ".txt", ".yaml", ".yml", ".wasm",
    "LICENSE", "Makefile", "Cargo.lock"
  ];

  const walk = (nodes, parentPath = "") => {
    for (const node of nodes) {
      // Skip the root folder name itself — paths start from its children
      const isRoot = parentPath === "" && node.type === "folder" && nodes.length === 1 && nodes.indexOf(node) === 0;
      const currentPath = isRoot ? "" : parentPath ? `${parentPath}/${node.name}` : node.name;

      if (node.type === "file") {
        const filePath = parentPath ? `${parentPath}/${node.name}` : node.name;
        const ext = node.name.includes(".") ? node.name.toLowerCase().slice(node.name.lastIndexOf(".")) : node.name;
        
        // Filter: only include files that match common source extensions
        const isAllowed = includeAll || ALLOWED_EXTENSIONS.some(allowed => 
          ext === allowed || node.name === allowed
        );

        if (isAllowed) {
          const content = fileContents[node.id];
          if (content !== undefined) {
            files[filePath] = content;
          }
        }
        // Silently skip non-source files (binaries, PDFs, lockfiles, etc.) —
        // they're expected and the noise drowns out real warnings.
      }

      if (node.children?.length) {
        walk(node.children, currentPath);
      }
    }
  };

  walk(treeData);
  return files;
};

/**
 * Submit project files + command to the backend for execution.
 * @param {Object} files - { "path/to/file": "content" }
 * @param {string} command - The exact CLI command to run (e.g. "stellar --version")
 * @param {string} cwd - The working directory for the command
 * @returns {Promise<string>} session_id
 */
export const submitCommand = async (files, command, cwd = "~/project") => {
  const sessionId = getSessionId();
  const response = await fetch(`${API_BASE}/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Session-ID": sessionId,
    },
    body: JSON.stringify({
      files,
      command,
      cwd,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    let message;
    try {
      message = JSON.parse(text).error;
    } catch {
      message = text;
    }
    throw new Error(message || `Backend error: ${response.status}`);
  }

  const data = await response.json();
  return { sessionId: data.session_id, jobId: data.job_id };
};

/**
 * Sends a kill signal to the backend to stop a running job.
 * @param {string} sessionId
 * @param {string} jobId
 */
export const killCommand = async (sessionId, jobId) => {
  if (!sessionId || !jobId) return;

  try {
    const response = await fetch(`${API_BASE}/kill`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Session-ID": sessionId,
      },
      body: JSON.stringify({
        session_id: sessionId,
        job_id: jobId,
      }),
    });

    if (!response.ok) {
      console.warn("[backendService] Kill request failed:", await response.text());
    } else {
      console.log(`[backendService] Kill signal sent for job: ${jobId}`);
    }
  } catch (err) {
    console.error("[backendService] Error sending kill signal:", err);
  }
};

// Keep old name as alias for backward compatibility
export const submitBuild = (files) => submitCommand(files, "stellar contract build");

// ─── Wallet ───────────────────────────────────────────────────────────────────

/** POST /api/wallet/default/init — create + fund default testnet account */
export const initDefaultWallet = async () => {
  const res = await fetch(`${API_BASE}/wallet/default/init`, { method: "POST" });
  if (!res.ok) throw new Error((await res.json()).error || "Wallet init failed");
  return res.json();
};

/** GET /api/wallet/default/status */
export const getDefaultWalletStatus = async () => {
  const res = await fetch(`${API_BASE}/wallet/default/status`);
  if (!res.ok) throw new Error("Failed to fetch wallet status");
  return res.json();
};

/** POST /api/wallet/freighter/register — register Freighter public key as named identity */
export const registerFreighterWallet = async (address) => {
  const res = await fetch(`${API_BASE}/wallet/freighter/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address }),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Failed to register Freighter wallet");
  return res.json();
};

// ─── Contract Interface ───────────────────────────────────────────────────────

/**
 * POST /api/contract/interface — parse pub fn signatures from files.
 * Pass `contractPath` (e.g. "learning/hello-world") to scope parsing to a
 * single crate; otherwise the backend scans every lib.rs in the workspace
 * and you get a mashup of unrelated functions.
 */
export const getContractInterface = async (files, contractPath = "") => {
  const res = await fetch(`${API_BASE}/contract/interface`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files, contract_path: contractPath }),
  });
  if (!res.ok) throw new Error("Failed to parse contract interface");
  return res.json(); // { functions: ContractFn[] }
};

// ─── Validation ───────────────────────────────────────────────────────────────

/** POST /api/validate/project */
export const validateProject = async (files, category = "ec-level", repoName = "") => {
  const res = await fetch(`${API_BASE}/validate/project`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files, category, repo_name: repoName }),
  });
  if (!res.ok) throw new Error("Validation request failed");
  return res.json(); // ValidateResponse
};

/**
 * Open a WebSocket connection to stream command output.
 *
 * @param {string} sessionId - from submitCommand()
 * @param {Object} callbacks
 * @param {function} callbacks.onMessage - called with { type, content } for each message
 * @param {function} callbacks.onError   - called with error string
 * @param {function} callbacks.onDone    - called when command is complete
 * @returns {function} cleanup — call to close the WebSocket
 */
export const connectBuildStream = (sessionId, jobId, { onMessage, onError, onDone, onClose }) => {
  let wsUrl;
  const queryParams = `?session_id=${sessionId}${jobId ? `&job_id=${jobId}` : ""}`;
  
  if (API_BASE.startsWith("http")) {
    wsUrl = API_BASE.replace(/^http/, "ws") + `/ws${queryParams}`;
  } else {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    wsUrl = `${protocol}//${window.location.host}${API_BASE}/ws${queryParams}`;
  }

  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    // Silent connect - no message
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);

      // FILTER: Only process messages belonging to THIS job.
      // This prevents init output from appearing in the terminal during build,
      // and vice versa.
      if (jobId && msg.job_id && msg.job_id !== jobId) {
        return; // Silently ignore messages from other jobs
      }

      // "done" signal means command is complete
      if (msg.type === "done") {
        onDone();
        ws.close();
        return;
      }

      onMessage(msg);
    } catch {
      // If not JSON, treat as raw text
      onMessage({ type: "stdout", content: event.data });
    }
  };

  ws.onerror = () => {
    onError("WebSocket connection error");
  };

  ws.onclose = (event) => {
    if (!event.wasClean) {
      onError("Connection to build server lost");
    } else if (onClose) {
      onClose(); // Call onClose when connection closes cleanly (command finished)
    }
  };

  // Return cleanup function
  return () => {
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
  };
};


