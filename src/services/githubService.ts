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

export class GitHubRateLimitError extends Error {
  resetAt: number;

  constructor(message: string, resetAt: number = 0) {
    super(message);
    this.name = "GitHubRateLimitError";
    this.resetAt = resetAt;
  }
}

export class GitHubHttpError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "GitHubHttpError";
    this.status = status;
  }
}

/**
 * Maps an unknown error from a GitHub API call into a stable message + HTTP
 * status so callers can surface distinct, actionable errors.
 */
export function classifyGithubError(
  err: unknown
): { message: string; status: number } {
  if (err instanceof GitHubRateLimitError) {
    return { message: err.message, status: 429 };
  }
  if (err instanceof GitHubHttpError) {
    return { message: err.message, status: err.status };
  }
  const e = toErrorLike(err);
  if (isRateLimitError(err) || e.status === 429) {
    const resetAt = parseResetHeader(e.response?.headers);
    return { message: buildRateLimitMessage(resetAt), status: 429 };
  }
  if (e.status === 404) {
    return {
      message:
        "Repository not found. Double-check the owner and repo name, and confirm the repository is public.",
      status: 404,
    };
  }
  if (e.status === 403) {
    return {
      message:
        "Access to this repository is denied. It may be private — make sure GITHUB_TOKEN has read access to it.",
      status: 403,
    };
  }
  return {
    message: err instanceof Error ? err.message : "Something went wrong",
    status: 500,
  };
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
        throw new GitHubHttpError(
          "GitHub URL must point to a repository, like https://github.com/owner/repo",
          400
        );
      }
      return {
        owner: segments[0],
        repo: segments[1].replace(/\.git$/, ""),
      };
    } catch {
      throw new GitHubHttpError(
        "Invalid GitHub repository URL. Use a full URL like https://github.com/owner/repo, or an owner/repo name.",
        400
      );
    }
  }

  const parts = candidate.replace(/\.git$/, "").split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new GitHubHttpError(
      "Expected an \"owner/repo\" name or a GitHub URL, like https://github.com/owner/repo",
      400
    );
  }
  return { owner: parts[0], repo: parts[parts.length - 1] };
}

export function getGithubToken(): string | undefined {
  return process.env.GITHUB_TOKEN || undefined;
}

let warnedNoToken = false;

function warnMissingToken(): void {
  if (warnedNoToken) return;
  warnedNoToken = true;
  console.warn(
    "[KnowYourCode] WARNING: GITHUB_TOKEN is not set. GitHub API calls are rate-limited to 60/hour from this IP. Add a token to your .env file to raise this limit."
  );
}

function createOctokit(): Octokit {
  const token = getGithubToken();
  if (!token) warnMissingToken();
  return token ? new Octokit({ auth: token }) : new Octokit();
}

/* --- Startup diagnostics (logged once when this module is first loaded) --- */

console.log(
  getGithubToken()
    ? "[KnowYourCode] GITHUB_TOKEN: set"
    : "[KnowYourCode] GITHUB_TOKEN: MISSING"
);

/** Times a GitHub API call and logs elapsed ms (diagnostic). */
async function timed<T>(
  label: string,
  operation: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  try {
    const result = await operation();
    console.log(`[analyze] ${label} took ${Date.now() - start}ms`);
    return result;
  } catch (err) {
    console.log(`[analyze] ${label} failed after ${Date.now() - start}ms`);
    throw err;
  }
}

/* --- Rate-limit detection, backoff and typed failures --- */

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const RATE_LIMIT_MESSAGE = /rate limit|quota|abuse/i;

type GithubErrorLike = {
  status?: number;
  message?: string;
  response?: {
    headers?: Record<string, string | number | undefined>;
  };
};

function toErrorLike(err: unknown): GithubErrorLike {
  return (err ?? {}) as GithubErrorLike;
}

function parseResetHeader(
  headers?: Record<string, string | number | undefined>
): number {
  const value = headers?.["x-ratelimit-reset"];
  if (value === undefined) return 0;
  const seconds = typeof value === "number" ? value : parseInt(String(value), 10);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 0;
}

function isRateLimitError(err: unknown): boolean {
  const e = toErrorLike(err);
  return (
    e.status === 403 &&
    typeof e.message === "string" &&
    RATE_LIMIT_MESSAGE.test(e.message)
  );
}

function buildRateLimitMessage(resetAt: number): string {
  if (!resetAt) {
    return "GitHub API rate limit exceeded. Wait about an hour and retry, or add a GITHUB_TOKEN to your .env file to raise the limit.";
  }
  const minutes = Math.max(1, Math.ceil((resetAt - Date.now()) / 60000));
  const when =
    minutes > 60
      ? `in ~${Math.round(minutes / 60)}h`
      : `in ~${minutes} min`;
  return `GitHub API rate limit exceeded. Rate limit resets ${when}, or add a GITHUB_TOKEN to your .env file to raise the limit.`;
}

function asRateLimitError(err: unknown, resetAt: number): GitHubRateLimitError {
  if (err instanceof GitHubRateLimitError) return err;
  const e = toErrorLike(err);
  const detail = e.message ? ` (${e.message})` : "";
  return new GitHubRateLimitError(buildRateLimitMessage(resetAt) + detail, resetAt);
}

/**
 * Runs a GitHub API call with a single retry on rate-limit and transient
 * (5xx/network) failures.
 * - Rate limit: waits only when the reset is imminent (<20s); otherwise it
 *   throws a typed `GitHubRateLimitError` immediately so callers fail loudly.
 * - Transient errors: one quick retry, then rethrow the original error.
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T> {
  try {
    return await operation();
  } catch (err) {
    if (isRateLimitError(err)) {
      const resetAt = parseResetHeader(toErrorLike(err).response?.headers);
      const waitMs = resetAt ? resetAt - Date.now() : 0;
      if (waitMs > 0 && waitMs <= 20_000) {
        console.warn(
          `[KnowYourCode] GitHub rate limit near reset; retrying ${context} in ${Math.ceil((waitMs + 500) / 1000)}s`
        );
        await sleep(waitMs + 500);
        try {
          return await operation();
        } catch (second) {
          throw asRateLimitError(second, resetAt);
        }
      }
      throw asRateLimitError(err, resetAt);
    }

    const e = toErrorLike(err);
    if (!e.status || e.status >= 500) {
      await sleep(800);
      try {
        return await operation();
      } catch {
        throw err;
      }
    }
    throw err;
  }
}

/** Log GitHub API quota once per process in development (uses the free rate-limit endpoint). */
let didLogRateLimit = false;

export async function logGithubRateLimitOnce(): Promise<void> {
  if (process.env.NODE_ENV !== "development" || didLogRateLimit) return;
  didLogRateLimit = true;
  try {
    const octokit = createOctokit();
    const { data } = await octokit.rest.rateLimit.get();
    const remaining = data.rate.remaining;
    const resetInMin = Math.max(
      1,
      Math.round((data.rate.reset * 1000 - Date.now()) / 60000)
    );
    console.log(
      `[KnowYourCode] GitHub API: ${data.rate.limit}/hr limit, ${remaining} remaining (resets in ~${resetInMin} min)`
    );
  } catch {
    /* Non-fatal — the quota log is informational only. */
  }
}

export async function getRepoMetadata(
  ref: GithubRepoRef
): Promise<RepoMetadata> {
  const octokit = createOctokit();
  const { data } = await withRetry(
    () =>
      timed(
        `repos.get for ${ref.owner}/${ref.repo}`,
        () =>
          octokit.rest.repos.get({
            owner: ref.owner,
            repo: ref.repo,
          })
      ),
    `metadata for ${ref.owner}/${ref.repo}`
  );
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
  const response = await withRetry(
    () =>
      timed(
        `getContent for ${ref.owner}/${ref.repo}/${path}`,
        () =>
          octokit.rest.repos.getContent({
            owner: ref.owner,
            repo: ref.repo,
            path,
            mediaType: { format: "raw" },
          })
      ),
    `content of ${path}`
  );
  return typeof response.data === "string" ? response.data : "";
}

export async function getRepoHeadSha(
  ref: GithubRepoRef,
  defaultBranch: string
): Promise<string> {
  const octokit = createOctokit();
  const { data } = await withRetry(
    () =>
      timed(
        `git.getRef for ${ref.owner}/${ref.repo}@heads/${defaultBranch}`,
        () =>
          octokit.rest.git.getRef({
            owner: ref.owner,
            repo: ref.repo,
            ref: `heads/${defaultBranch}`,
          })
      ),
    `head ref for ${ref.owner}/${ref.repo}`
  );
  return data.object.sha;
}

export async function listRepoFiles(
  ref: GithubRepoRef,
  defaultBranch?: string
): Promise<RepoFile[]> {
  const octokit = createOctokit();
  const meta = defaultBranch
    ? { defaultBranch }
    : await getRepoMetadata(ref);
  const tree = await withRetry(
    () =>
      timed(
        `git.getTree for ${ref.owner}/${ref.repo}@${meta.defaultBranch}`,
        () =>
          octokit.rest.git.getTree({
            owner: ref.owner,
            repo: ref.repo,
            tree_sha: meta.defaultBranch,
            recursive: "1",
          })
      ),
    `file tree for ${ref.owner}/${ref.repo}`
  );

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

/**
 * Estimates total lines by sampling a small number of text files
 * (default 10, fetched 3-at-a-time) — a bounded, eager reading window so
 * analysis never downloads the whole repository in one burst.
 * Rate-limit errors abort immediately so the caller can surface a clear 429.
 */
export async function estimateLineCount(
  ref: GithubRepoRef,
  files: RepoFile[],
  limit = 10
): Promise<number> {
  const textFiles = files
    .filter((f) => f.type === "file")
    .filter((f) => TEXT_EXTENSIONS.has(fileExtension(f.path)))
    .slice(0, limit);

  let total = 0;
  let counted = 0;
  const CONCURRENCY = 3;

  for (let i = 0; i < textFiles.length; i += CONCURRENCY) {
    const batch = textFiles.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (file) => {
        try {
          const code = await fetchFileContent(ref, file.path);
          return { code };
        } catch (err) {
          if (err instanceof GitHubRateLimitError) throw err;
          return { code: null };
        }
      })
    );
    for (const result of results) {
      if (result.code && result.code !== "") {
        total += result.code.split("\n").length;
        counted += 1;
      }
    }
  }

  if (counted === 0) return 0;
  const totalFiles = files.filter((f) => f.type === "file").length;
  const average = total / counted;
  return Math.round(average * totalFiles);
}