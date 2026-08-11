import type { FileTreeNode, RepoFile } from "@/types/repo";

function compareNodes(a: FileTreeNode, b: FileTreeNode): number {
  const aFolder = a.type === "folder" ? 0 : 1;
  const bFolder = b.type === "folder" ? 0 : 1;
  if (aFolder !== bFolder) return aFolder - bFolder;
  return a.name.localeCompare(b.name);
}

/**
 * Builds a nested tree from a flat list of repo file entries.
 * Folders are sorted before files, both alphabetically.
 */
export function buildFileTree(files: RepoFile[]): FileTreeNode[] {
  const root: FileTreeNode = {
    name: "",
    path: "",
    type: "folder",
    children: [],
  };

  for (const file of files) {
    const parts = file.path.split("/").filter(Boolean);
    let cursor = root;
    let currentPath = "";

    parts.forEach((part, index) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isLast = index === parts.length - 1;
      const type: "file" | "folder" = isLast ? file.type : "folder";

      let child = cursor.children?.find(
        (c) => c.name === part && c.path === currentPath
      );
      if (!child) {
        child = { name: part, path: currentPath, type, children: [] };
        cursor.children?.push(child);
      }
      cursor = child;
    });
  }

  return sortTree(root.children ?? []);
}

function sortTree(nodes: FileTreeNode[]): FileTreeNode[] {
  const sorted = [...nodes].sort(compareNodes);
  return sorted.map((node) =>
    node.children ? { ...node, children: sortTree(node.children) } : node
  );
}