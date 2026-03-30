/**
 * Pure utility functions for workspace tree operations.
 * All functions are stateless and return new data structures.
 */

/* ─── ID generation ─── */

export const uniqueId = () => {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `node-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

/* ─── Sorting ─── */

export const sortNodes = (nodes) => {
  if (!nodes?.length) return nodes;
  return [...nodes].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'folder' ? -1 : 1;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
};

/* ─── Tree traversal ─── */

export const getNodeFromTree = (nodes, nodeId) => {
  for (const node of nodes) {
    if (node.id === nodeId) return node;
    if (node.children?.length) {
      const found = getNodeFromTree(node.children, nodeId);
      if (found) return found;
    }
  }
  return null;
};

export const findParentId = (nodes, targetId, parentId = null) => {
  for (const node of nodes) {
    if (node.id === targetId) return parentId;
    if (node.children?.length) {
      const found = findParentId(node.children, targetId, node.id);
      if (found !== null) return found;
    }
  }
  return null;
};

export const collectFileIds = (node) => {
  const ids = [];
  if (node.type === 'file') ids.push(node.id);
  if (node.children?.length) {
    for (const child of node.children) {
      ids.push(...collectFileIds(child));
    }
  }
  return ids;
};

export const collectAllIds = (node) => {
  const ids = [node.id];
  if (node.children?.length) {
    for (const child of node.children) {
      ids.push(...collectAllIds(child));
    }
  }
  return ids;
};

/* ─── Tree mutations (immutable — returns new tree) ─── */

const insertSorted = (children, newNode) => {
  return [...children, newNode].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
};

export const addNodeToTree = (nodes, parentId, newNode) => {
  return nodes.map((node) => {
    if (node.id === parentId && node.type === 'folder') {
      return { ...node, children: insertSorted(node.children, newNode) };
    }
    if (node.children?.length) {
      return { ...node, children: addNodeToTree(node.children, parentId, newNode) };
    }
    return node;
  });
};

export const removeNodeFromTree = (nodes, nodeId) => {
  return nodes
    .map((node) => {
      if (node.id === nodeId) return null;
      if (node.children?.length) {
        return { ...node, children: removeNodeFromTree(node.children, nodeId) };
      }
      return node;
    })
    .filter(Boolean);
};

export const renameNodeInTree = (nodes, nodeId, newName) => {
  return nodes.map((node) => {
    if (node.id === nodeId) return { ...node, name: newName };
    if (node.children?.length) {
      return { ...node, children: renameNodeInTree(node.children, nodeId, newName) };
    }
    return node;
  });
};

export const moveNodeInTree = (nodes, nodeId, targetParentId) => {
  const nodeToMove = getNodeFromTree(nodes, nodeId);
  if (!nodeToMove) return nodes;

  // Prevent moving a folder into its own descendant
  const isDescendant = (parentId, childId) => {
    const parent = getNodeFromTree(nodes, parentId);
    if (!parent?.children) return false;
    for (const child of parent.children) {
      if (child.id === childId) return true;
      if (isDescendant(child.id, childId)) return true;
    }
    return false;
  };

  if (isDescendant(nodeId, targetParentId)) return nodes;

  const withoutNode = removeNodeFromTree(nodes, nodeId);
  return addNodeToTree(withoutNode, targetParentId, nodeToMove);
};

/* ─── Deep clone with new IDs ─── */

export const cloneNodeWithNewIds = (node, idMapping = {}) => {
  const newId = uniqueId();
  idMapping[node.id] = newId;

  const cloned = {
    id: newId,
    name: node.name,
    type: node.type,
    children: [],
  };

  if (node.children?.length) {
    for (const child of node.children) {
      const result = cloneNodeWithNewIds(child, idMapping);
      cloned.children.push(result.node);
    }
  }

  return { node: cloned, idMapping };
};

export const collectContentsMap = (node, contents, result = {}) => {
  if (node.type === 'file' && contents[node.id] !== undefined) {
    result[node.id] = contents[node.id];
  }
  if (node.children?.length) {
    for (const child of node.children) {
      collectContentsMap(child, contents, result);
    }
  }
  return result;
};

/* ─── Flatten tree to Map ─── */

export const flattenTree = (treeData) => {
  const map = new Map();
  const traverse = (nodes, currentPath = '') => {
    nodes.forEach((node) => {
      const path = currentPath ? `${currentPath}/${node.name}` : node.name;
      map.set(node.id, { ...node, path });
      if (node.children?.length) traverse(node.children, path);
    });
  };
  traverse(treeData);
  return map;
};
