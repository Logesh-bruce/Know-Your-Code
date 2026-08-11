"use client";

import { useCallback, useEffect, useState } from "react";
import type { RepoAnalysis } from "@/types/repo";
import { SESSION_KEY } from "@/utils/validation";

export type AnalysisStatus = "idle" | "loading" | "success" | "error";

export interface RepoAnalysisState {
  status: AnalysisStatus;
  repo: RepoAnalysis | null;
  error: string | null;
}

export function useRepoAnalysis() {
  const [state, setState] = useState<RepoAnalysisState>({
    status: "idle",
    repo: null,
    error: null,
  });
  const [lastUrl, setLastUrl] = useState<string | null>(null);

  const analyze = useCallback(async (targetUrl: string) => {
    setLastUrl(targetUrl);
    setState({ status: "loading", repo: null, error: null });
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl: targetUrl }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? `Analysis failed (${response.status})`);
      }
      const repo = (await response.json()) as RepoAnalysis;
      setState({ status: "success", repo, error: null });
    } catch (err) {
      setState({
        status: "error",
        repo: null,
        error: err instanceof Error ? err.message : "Analysis failed",
      });
    }
  }, []);

  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) void analyze(stored);
  }, [analyze]);

  const retry = useCallback(() => {
    if (lastUrl) void analyze(lastUrl);
  }, [lastUrl, analyze]);

  return { ...state, analyze, retry };
}