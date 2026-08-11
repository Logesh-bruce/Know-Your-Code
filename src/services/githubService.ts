import { Octokit } from "octokit";

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