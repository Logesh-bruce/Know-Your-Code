import type { RepoAnalysis, RepoFile } from "@/types/repo";

const CACHE_SIZE_LIMIT = 50;

interface CacheStore {
  analysis: Map<string, RepoAnalysis>;
  keyRepo: Map<string, string>;
  fileIndex: Map<string, RepoFile[]>;
}

/* Next.js dev mode compiles each route handler with its own module registry,
 * so module-scoped Maps are not shared between /api/analyze and /api/flow.
 * Attach the caches to globalThis so every route handler sees the same data in
 * dev. Production shares a single require cache, so this is equally correct
 * there. */
const store: CacheStore =
  (globalThis as unknown as { __kycAnalysisCache?: CacheStore })
    .__kycAnalysisCache ??= {
    analysis: new Map<string, RepoAnalysis>(),
    keyRepo: new Map<string, string>(),
    fileIndex: new Map<string, RepoFile[]>(),
  };

export function getCachedAnalysis(key: string): RepoAnalysis | undefined {
  return store.analysis.get(key);
}

/** File list for a repoId (owner/repo), indexed during Analyze so other
 *  views can reuse the already-fetched tree without new GitHub calls. */
export function getCachedFiles(repoId: string): RepoFile[] | null {
  return store.fileIndex.get(repoId) ?? null;
}

export function setCachedAnalysis(
  key: string,
  repoId: string,
  analysis: RepoAnalysis
): void {
  if (store.analysis.has(key)) return;
  if (store.analysis.size >= CACHE_SIZE_LIMIT) {
    const oldestKey = store.analysis.keys().next().value;
    if (oldestKey !== undefined) {
      store.analysis.delete(oldestKey);
      store.keyRepo.delete(oldestKey);
    }
  }
  store.analysis.set(key, analysis);
  store.keyRepo.set(key, repoId);
  store.fileIndex.set(repoId, analysis.files);

  if (store.fileIndex.size > CACHE_SIZE_LIMIT) {
    const usedRepoIds = new Set(store.keyRepo.values());
    for (const [repoIdKey] of store.fileIndex) {
      if (store.fileIndex.size <= CACHE_SIZE_LIMIT) break;
      if (!usedRepoIds.has(repoIdKey)) store.fileIndex.delete(repoIdKey);
    }
  }
}
