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
 * Get or create a persistent session ID stored in localStorage.
 * This ensures all commands share the same workspace on the backend,
 * even when frontend and backend are on different domains (cross-origin).
 */
const getSessionId = () => {
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
 * Walk the workspace tree and collect all files into a flat
 * { "relative/path": "content" } map for the backend.
 */
export const collectProjectFiles = (treeData, fileContents) => {
  const files = {};

  const walk = (nodes, parentPath = "") => {
    for (const node of nodes) {
      // Skip the root folder name itself — paths start from its children
      const isRoot = parentPath === "" && node.type === "folder" && nodes.length === 1 && nodes.indexOf(node) === 0;
      const currentPath = isRoot ? "" : parentPath ? `${parentPath}/${node.name}` : node.name;

      if (node.type === "file") {
        const filePath = parentPath ? `${parentPath}/${node.name}` : node.name;
        const content = fileContents[node.id];
        if (content !== undefined) {
          files[filePath] = content;
        }
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
 * @returns {Promise<string>} session_id
 */
export const submitCommand = async (files, command) => {
  console.log("[backendService] Sending command:", command);
  console.log("[backendService] Files:", Object.keys(files));

  const sessionId = getSessionId();
  console.log("[backendService] Session ID:", sessionId);

  const response = await fetch(`${API_BASE}/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Session-ID": sessionId,
    },
    body: JSON.stringify({ files, command }),
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
  return data.session_id;
};

// Keep old name as alias for backward compatibility
export const submitBuild = (files) => submitCommand(files, "stellar contract build");

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
export const connectBuildStream = (sessionId, { onMessage, onError, onDone, onClose }) => {
  let wsUrl;
  if (API_BASE.startsWith("http")) {
    // If API_BASE is absolute (e.g. on Vercel), convert http/https to ws/wss
    wsUrl = API_BASE.replace(/^http/, "ws") + `/ws?session_id=${sessionId}`;
  } else {
    // If API_BASE is relative (e.g. in local dev), use current window host
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    wsUrl = `${protocol}//${window.location.host}${API_BASE}/ws?session_id=${sessionId}`;
  }

  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    // Silent connect - no message
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);

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


