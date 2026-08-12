"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RepoAnalysis } from "@/types/repo";
import { ApiError, postJson, REQUEST_TIMEOUT_MS } from "@/utils/api";
import { SESSION_KEY } from "@/utils/validation";

export type AnalysisStatus = "idle" | "loading" | "success" | "error";

export interface RepoAnalysisState {
  status: AnalysisStatus;
  repo: RepoAnalysis | null;
  error: string | null;
  errorStatus: number | null;
}

export interface AnalysisStep {
  id: "metadata" | "tree" | "estimate";
  label: string;
}

export const ANALYSIS_STEPS: AnalysisStep[] = [
  { id: "metadata", label: "Fetching repo metadata" },
  { id: "tree", label: "Fetching file tree" },
  { id: "estimate", label: "Estimating codebase size" },
];

export function useRepoAnalysis() {
  const [state, setState] = useState<RepoAnalysisState>({
    status: "idle",
    repo: null,
    error: null,
    errorStatus: null,
  });
  const [lastUrl, setLastUrl] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const stepTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearStepTimers = useCallback(() => {
    stepTimersRef.current.forEach((timer) => clearTimeout(timer));
    stepTimersRef.current = [];
  }, []);

  const analyze = useCallback(
    async (targetUrl: string) => {
      setLastUrl(targetUrl);
      setState({
        status: "loading",
        repo: null,
        error: null,
        errorStatus: null,
      });
      setActiveStep(0);
      clearStepTimers();
      stepTimersRef.current = [
        setTimeout(() => setActiveStep(1), 1800),
        setTimeout(() => setActiveStep(2), 5000),
      ];
    try {
      const repo = await postJson<RepoAnalysis>(
        "/api/analyze",
        { repoUrl: targetUrl },
        REQUEST_TIMEOUT_MS
      );
      clearStepTimers();
      setActiveStep(ANALYSIS_STEPS.length);
      setState({ status: "success", repo, error: null, errorStatus: null });
    } catch (err) {
      clearStepTimers();
      setActiveStep(null);
      setState({
        status: "error",
        repo: null,
        error: err instanceof Error ? err.message : "Analysis failed",
        errorStatus: err instanceof ApiError ? (err.status ?? null) : null,
      });
    }
    },
    [clearStepTimers]
  );

  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) void analyze(stored);
  }, [analyze]);

  useEffect(() => clearStepTimers, [clearStepTimers]);

  const retry = useCallback(() => {
    if (lastUrl) void analyze(lastUrl);
  }, [lastUrl, analyze]);

  return { ...state, activeStep, analyze, retry };
}
