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

/* --- Tech stack detection --- */

const TEXT_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".go", ".rs",
  ".java", ".rb", ".php", ".cs", ".swift", ".kt", ".vue", ".svelte",
  ".html", ".css", ".scss", ".less", ".sql", ".yml", ".yaml", ".json",
  ".md", ".mdx", ".txt", ".toml", ".ini", ".sh", ".bash", ".env",
  ".prisma", ".graphql", ".svg",
]);

const EXT_LANGUAGES: Record<string, string> = {
  ".ts": "TypeScript",
  ".tsx": "TypeScript",
  ".js": "JavaScript",
  ".jsx": "JavaScript",
  ".py": "Python",
  ".go": "Go",
  ".rs": "Rust",
  ".java": "Java",
  ".rb": "Ruby",
  ".php": "PHP",
  ".cs": "C#",
  ".swift": "Swift",
  ".kt": "Kotlin",
  ".vue": "Vue",
  ".svelte": "Svelte",
  ".html": "HTML",
  ".css": "CSS",
  ".scss": "SCSS",
};

function fileExtension(path: string): string {
  const base = path.split("/").pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot).toLowerCase() : "";
}

export function detectPrimaryLanguage(
  files: RepoFile[],
  githubLanguage?: string
): string {
  if (githubLanguage && githubLanguage.toLowerCase() !== "unknown") {
    return githubLanguage;
  }
  const counts = new Map<string, number>();
  for (const file of files) {
    if (file.type !== "file") continue;
    const ext = fileExtension(file.path);
    const language = EXT_LANGUAGES[ext];
    if (language) counts.set(language, (counts.get(language) ?? 0) + 1);
  }
  let best = "";
  let bestCount = 0;
  for (const [language, count] of counts) {
    if (count > bestCount) {
      best = language;
      bestCount = count;
    }
  }
  return best;
}

export function detectTechStack(
  files: RepoFile[],
  packageJson?: string
): string[] {
  const stack: string[] = [];
  const push = (item: string) => {
    if (!stack.includes(item)) stack.push(item);
  };
  const has = (path: string) =>
    files.some((f) => f.path.toLowerCase() === path.toLowerCase());
  const extCount = new Map<string, number>();
  for (const file of files) {
    if (file.type !== "file") continue;
    const ext = fileExtension(file.path);
    extCount.set(ext, (extCount.get(ext) ?? 0) + 1);
  }
  const countOf = (ext: string) => extCount.get(ext) ?? 0;

  if (packageJson) {
    try {
      const manifest = JSON.parse(packageJson) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const deps = {
        ...(manifest.dependencies ?? {}),
        ...(manifest.devDependencies ?? {}),
      };
      if (deps.next) push("Next.js");
      if (deps.react) push("React");
      if (deps.express) push("Express");
      if (deps["@nestjs/core"]) push("NestJS");
      if (deps.vue || deps["nuxt"]) push("Vue");
      if (deps.svelte || deps["@sveltejs/kit"]) push("Svelte");
      if (deps["@prisma/client"]) push("Prisma");
      if (deps.mongoose) push("MongoDB");
      if (deps.pg || deps.mysql || deps.sequelize || deps["pg-promise"]) {
        push("PostgreSQL");
      }
      if (Object.keys(deps).length > 0) push("Node.js");
    } catch {
      /* malformed package.json — ignore */
    }
  }

  if (countOf(".tsx") > 0 || countOf(".jsx") > 0) push("React");
  if (countOf(".vue") > 0) push("Vue");
  if (countOf(".svelte") > 0) push("Svelte");
  if (countOf(".py") > 0) push("Python");
  if (countOf(".go") > 0) push("Go");
  if (countOf(".rs") > 0) push("Rust");
  if (countOf(".java") > 0) push("Java");
  if (countOf(".rb") > 0) push("Ruby");
  if (countOf(".php") > 0) push("PHP");
  if (countOf(".ts") > 0 || countOf(".tsx") > 0) push("TypeScript");
  if (!has("package.json") && countOf(".js") > 0 && countOf(".jsx") === 0) {
    push("JavaScript");
  }
  if (countOf(".sql") > 0) push("SQL");
  if (has("dockerfile") || countOf(".dockerfile") > 0) push("Docker");
  if (has("tailwind.config.ts") || has("tailwind.config.js")) push("Tailwind CSS");

  return stack.slice(0, 6);
}

export async function estimateLineCount(
  ref: GithubRepoRef,
  files: RepoFile[],
  limit = 40
): Promise<number> {
  const textFiles = files
    .filter((f) => f.type === "file")
    .filter((f) => TEXT_EXTENSIONS.has(fileExtension(f.path)))
    .slice(0, limit);

  let total = 0;
  let counted = 0;
  await Promise.all(
    textFiles.map(async (file) => {
      const code = await fetchFileContent(ref, file.path).catch(() => null);
      if (code !== null && code !== "") {
        total += code.split("\n").length;
        counted += 1;
      }
    })
  );

  if (counted === 0) return 0;
  const totalFiles = files.filter((f) => f.type === "file").length;
  const average = total / counted;
  return Math.round(average * totalFiles);
}