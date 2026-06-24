import { detectFrontendRoot } from "../fullstack/fullstackBundler";
import { deploymentMatchesContractPath, toViteNetwork } from "../deploy/deploymentHistory";
import { getWorkspacePreviewSpec } from "./previewUtils";

/** Locate frontend/.env in the workspace tree. */
export const locateFrontendEnvFile = (treeData) => {
  const detection = detectFrontendRoot(treeData);
  if (!detection?.folder) return { node: null, parentFolderId: null, detection };

  const folder = detection.folder;
  const existing = (folder.children || []).find(
    (c) => c.type === "file" && c.name === ".env",
  );
  return {
    node: existing || null,
    parentFolderId: folder.id,
    detection,
  };
};

export const buildPreviewEnvContent = (contractId, network) => {
  const viteNetwork = toViteNetwork(network);
  return `# Auto-generated after contract deploy\nVITE_CONTRACT_ID=${contractId}\nVITE_NETWORK=${viteNetwork}\n`;
};

/** Only auto-write .env when the deploy matches the open fullstack example. */
export const shouldAutoWritePreviewEnv = (treeData, fileContents, deployPath) => {
  const spec = getWorkspacePreviewSpec(treeData, fileContents);
  if (!spec?.contractPath) return true;
  if (!deployPath) return false;
  return deploymentMatchesContractPath(deployPath, spec.contractPath);
};

/** Update or create frontend/.env with the deployed contract id. */
export const writeFrontendPreviewEnv = ({
  treeData,
  setFileContents,
  setTreeData,
  contractId,
  network,
  deployPath,
  fileContents,
}) => {
  if (!contractId?.startsWith("C") || typeof setFileContents !== "function") return false;
  if (!shouldAutoWritePreviewEnv(treeData, fileContents, deployPath)) return false;

  const envContent = buildPreviewEnvContent(contractId, network);
  const { node, parentFolderId } = locateFrontendEnvFile(treeData);

  if (node) {
    setFileContents((prev) => ({ ...prev, [node.id]: envContent }));
    return true;
  }

  if (!parentFolderId || typeof setTreeData !== "function") return false;

  const newId = `${parentFolderId}/.env-${Date.now()}`;
  const newNode = { id: newId, name: ".env", type: "file", children: [] };

  setTreeData((prev) => {
    const insert = (nodes) =>
      (nodes || []).map((n) => {
        if (n.id === parentFolderId) {
          return { ...n, children: [...(n.children || []), newNode] };
        }
        if (n.children?.length) {
          return { ...n, children: insert(n.children) };
        }
        return n;
      });
    return insert(prev);
  });
  setFileContents((prev) => ({ ...prev, [newId]: envContent }));
  return true;
};
