import type { RepoAnalysis, RepoFile } from "@/types/repo";

const CACHE_SIZE_LIMIT = 50;

const cache = new Map<string, RepoAnalysis>();
const keyRepo = new Map<string, string>();
const fileIndex = new Map<string, RepoFile[]>();

export function getCachedAnalysis(key: string): RepoAnalysis | undefined {
  return cache.get(key);
}

/** File list for a repoId (owner/repo), indexed during Analyze so other
 *  views can reuse the already-fetched tree without new GitHub calls. */
export function getCachedFiles(repoId: string): RepoFile[] | null {
  return fileIndex.get(repoId) ?? null;
}

export function setCachedAnalysis(
  key: string,
  repoId: string,
  analysis: RepoAnalysis
): void {
  if (cache.has(key)) return;
  if (cache.size >= CACHE_SIZE_LIMIT) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) {
      cache.delete(oldestKey);
      keyRepo.delete(oldestKey);
    }
  }
  cache.set(key, analysis);
  keyRepo.set(key, repoId);
  fileIndex.set(repoId, analysis.files);

  if (fileIndex.size > CACHE_SIZE_LIMIT) {
    const usedRepoIds = new Set(keyRepo.values());
    for (const [repoIdKey] of fileIndex) {
      if (fileIndex.size <= CACHE_SIZE_LIMIT) break;
      if (!usedRepoIds.has(repoIdKey)) fileIndex.delete(repoIdKey);
    }
  }
}
