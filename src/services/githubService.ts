import { Octokit } from "octokit";
import type { RepoFile } from "@/types/repo";

export interface GithubRepoRef {
  owner: string;
  repo: string;
}

export interface RepoMetadata {
  name: string;
  description: string;
  defaultBranch: string;
  language?: string;
}

/**
 * Accepts either a full GitHub URL or an "owner/repo" shorthand.
 */
export function parseRepoUrl(input: string): GithubRepoRef {
  const candidate = input.trim();

  if (candidate.includes("://") || candidate.startsWith("github.com/")) {
    try {
      const url = new URL(
        candidate.includes("://") ? candidate : `https://${candidate}`
      );
      if (
        url.hostname !== "github.com" &&
        url.hostname !== "www.github.com"
      ) {
        throw new Error("Not a GitHub URL");
      }
      const segments = url.pathname.split("/").filter(Boolean);
      if (segments.length < 2) {
        throw new Error("GitHub URL must point to a repository");
      }
      return {
        owner: segments[0],
        repo: segments[1].replace(/\.git$/, ""),
      };
    } catch {
      throw new Error("Invalid GitHub repository URL");
    }
  }

  const parts = candidate.replace(/\.git$/, "").split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new Error("Expected an \"owner/repo\" or a GitHub URL");
  }
  return { owner: parts[0], repo: parts[parts.length - 1] };
}

export function getGithubToken(): string | undefined {
  return process.env.GITHUB_TOKEN || undefined;
}

function createOctokit(): Octokit {
  const token = getGithubToken();
  return token ? new Octokit({ auth: token }) : new Octokit();
}

export async function getRepoMetadata(
  ref: GithubRepoRef
): Promise<RepoMetadata> {
  const octokit = createOctokit();
  const { data } = await octokit.rest.repos.get({
    owner: ref.owner,
    repo: ref.repo,
  });
  return {
    name: data.name,
    description: data.description ?? "",
    defaultBranch: data.default_branch ?? "main",
    language: data.language ?? undefined,
  };
}

export async function fetchFileContent(
  ref: GithubRepoRef,
  path: string
): Promise<string> {
  const octokit = createOctokit();
  const response = await octokit.rest.repos.getContent({
    owner: ref.owner,
    repo: ref.repo,
    path,
    mediaType: { format: "raw" },
  });
  return typeof response.data === "string" ? response.data : "";
}

export async function listRepoFiles(
  ref: GithubRepoRef
): Promise<RepoFile[]> {
  const octokit = createOctokit();
  const meta = await getRepoMetadata(ref);
  const tree = await octokit.rest.git.getTree({
    owner: ref.owner,
    repo: ref.repo,
    tree_sha: meta.defaultBranch,
    recursive: "1",
  });

  return (tree.data.tree ?? [])
    .filter((item) => item.path)
    .map((item) => ({
      path: item.path as string,
      type: (item.type === "tree" ? "folder" : "file") as RepoFile["type"],
    }))
    .filter((item) => !item.path.includes("/.git/"));
}

const SOURCE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".go", ".rs",
  ".java", ".rb", ".php", ".cs", ".swift", ".kt", ".vue", ".svelte", ".html",
]);

function scoreFile(path: string): number {
  if (
    path.includes("node_modules") ||
    path.includes(".github") ||
    path.includes(".git") ||
    path.endsWith("package-lock.json") ||
    path.endsWith("yarn.lock") ||
    path.endsWith("pnpm-lock.yaml")
  ) {
    return -1;
  }
  const lower = path.toLowerCase();
  let score = 0;
  if (
    /(^|\/)(src|lib|app|pages|components|server|api|core|handlers?)\//.test(
      lower
    )
  ) {
    score += 2;
  }
  const base = path.split("/").pop()?.toLowerCase() ?? "";
  if (["index", "main", "server", "app", "config", "routes"].includes(base)) {
    score += 1;
  }
  const dot = base.lastIndexOf(".");
  const ext = dot >= 0 ? base.slice(dot) : "";
  if (SOURCE_EXTENSIONS.has(ext)) score += 1;
  return score;
}

export function selectRepresentativeFiles(
  files: RepoFile[],
  limit = 8
): string[] {
  return files
    .filter((f) => f.type === "file")
    .filter((f) => scoreFile(f.path) >= 0)
    .sort((a, b) => scoreFile(b.path) - scoreFile(a.path))
    .slice(0, limit)
    .map((f) => f.path);
}