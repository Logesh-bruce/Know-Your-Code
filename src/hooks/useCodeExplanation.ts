"use client";

import { useCallback, useEffect, useState } from "react";
import { postJson } from "@/utils/api";
import type { CodeExplanation } from "@/types/code";

export type FetchStatus = "idle" | "loading" | "success" | "error";

interface UseCodeExplanationResult {
  status: FetchStatus;
  data: CodeExplanation | null;
  error: string | null;
  reload: () => Promise<void>;
}

const explanationCache = new Map<string, CodeExplanation>();

function cacheKey(repoId: string, filePath: string): string {
  return `${repoId}::${filePath}`;
}

export function useCodeExplanation(
  repoId: string,
  filePath: string
): UseCodeExplanationResult {
  const [status, setStatus] = useState<FetchStatus>("idle");
  const [data, setData] = useState<CodeExplanation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!repoId || !filePath) {
      setStatus("idle");
      setData(null);
      setError(null);
      return;
    }
    const key = cacheKey(repoId, filePath);
    const cached = explanationCache.get(key);
    if (cached) {
      setStatus("success");
      setData(cached);
      setError(null);
      return;
    }
    setStatus("loading");
    setData(null);
    setError(null);
    try {
      const result = await postJson<CodeExplanation>("/api/explain", {
        repoId,
        filePath,
      });
      explanationCache.set(key, result);
      setData(result);
      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to explain file");
      setStatus("error");
    }
  }, [repoId, filePath]);

  useEffect(() => {
    void load();
  }, [load]);

  return { status, data, error, reload: load };
}