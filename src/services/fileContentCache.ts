import {
  fetchFileContent,
  type GithubRepoRef,
} from "@/services/githubService";

/* Same globalThis rationale as analysisCache: in Next.js dev mode each route
 * handler gets its own module registry, so a module-scoped Map here would not
 * be shared between /api/flow and /api/flow/content. */
const contentCache: Map<string, string> =
  (globalThis as unknown as { __kycFileContentCache?: Map<string, string> })
    .__kycFileContentCache ??= new Map<string, string>();

function cacheKey(ref: GithubRepoRef, path: string): string {
  return `${ref.owner}/${ref.repo}::${path}`;
}

/** Returns the raw content for a repo file, fetching once per session and
 *  reusing the cached copy (including anything the Flow view already read)
 *  so repeated visits make no further GitHub calls. */
export async function getCachedFileContent(
  ref: GithubRepoRef,
  path: string
): Promise<string | null> {
  const key = cacheKey(ref, path);
  const hit = contentCache.get(key);
  if (hit !== undefined) return hit;
  try {
    const content = await fetchFileContent(ref, path);
    contentCache.set(key, content);
    return content;
  } catch {
    contentCache.set(key, "");
    return null;
  }
}
