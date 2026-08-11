"use client";

import { useCallback, useEffect, useState } from "react";
import type { RepoAnalysis } from "@/types/repo";
import { postJson } from "@/utils/api";
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
      const repo = await postJson<RepoAnalysis>(
        "/api/analyze",
        { repoUrl: targetUrl },
        20_000
      );
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