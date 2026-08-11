export interface RepoFile {
  path: string;
  type: "file" | "folder";
}

export interface RepoSummaryData {
  name: string;
  description: string;
  techStack: string[];
  fileCount: number;
  lineCount: number;
  primaryLanguage: string;
}

export interface RepoAnalysis extends RepoSummaryData {
  id: string;
  files: RepoFile[];
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: FileTreeNode[];
}