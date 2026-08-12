"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "@/components/Button";
import Card from "@/components/Card";
import CodeBlock from "@/components/CodeBlock";
import Skeleton from "@/components/Skeleton";
import { postJson } from "@/utils/api";
import type { FlowData } from "@/types/flow";
import FlowGraph from "./FlowGraph";

interface CodeFlowExplorerProps {
  repoId: string;
  active: boolean;
}

const flowCache = new Map<string, FlowData>();
const contentCache = new Map<string, string>();

type FlowPhase = "loading" | "ready" | "empty" | "error";
type CodePhase = "idle" | "loading" | "ready" | "error";

export default function CodeFlowExplorer({
  repoId,
  active,
}: CodeFlowExplorerProps) {
  const [phase, setPhase] = useState<FlowPhase>("loading");
  const [data, setData] = useState<FlowData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [codePhase, setCodePhase] = useState<CodePhase>("idle");
  const [codeError, setCodeError] = useState<string | null>(null);

  const fetchFlow = useCallback(async () => {
    const cached = flowCache.get(repoId);
    if (cached) {
      setData(cached);
      setPhase(cached.edges.length > 0 ? "ready" : "empty");
      if (cached.order.length > 0 && !selected) {
        // Auto-select first file in exploration order
        const first = cached.order[0];
        void loadFileContent(first);
      }
      return;
    }

    setPhase("loading");
    setError(null);
    try {
      const res = await postJson<FlowData>("/api/flow", { repoId });
      flowCache.set(repoId, res);
      setData(res);
      setPhase(res.edges.length > 0 ? "ready" : "empty");
      if (res.order.length > 0) {
        void loadFileContent(res.order[0]);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load repository code flow."
      );
      setPhase("error");
    }
  }, [repoId]);

  useEffect(() => {
    if (active && phase === "loading") {
      void fetchFlow();
    }
  }, [active, phase, fetchFlow]);

  const loadFileContent = useCallback(
    async (filePath: string) => {
      setSelected(filePath);
      const cached = contentCache.get(`${repoId}::${filePath}`);
      if (cached !== undefined) {
        setCode(cached);
        setCodePhase("ready");
        setCodeError(null);
        return;
      }

      setCodePhase("loading");
      setCode(null);
      setCodeError(null);
      try {
        const res = await postJson<{ code: string }>("/api/flow/content", {
          repoId,
          filePath,
        });
        contentCache.set(`${repoId}::${filePath}`, res.code);
        setCode(res.code);
        setCodePhase("ready");
      } catch (err) {
        setCodeError(
          err instanceof Error ? err.message : "Could not load file content."
        );
        setCodePhase("error");
      }
    },
    [repoId]
  );

  const orderIndex = selected && data ? data.order.indexOf(selected) : -1;
  const hasPrev = orderIndex > 0;
  const hasNext =
    orderIndex !== -1 && Boolean(data && orderIndex < data.order.length - 1);

  const stepBy = (delta: number) => {
    if (!data) return;
    const nextIdx = orderIndex + delta;
    if (nextIdx >= 0 && nextIdx < data.order.length) {
      void loadFileContent(data.order[nextIdx]);
    }
  };

  const importsOf = useMemo(
    () =>
      selected && data
        ? data.edges.filter((e) => e.source === selected).map((e) => e.target)
        : [],
    [selected, data]
  );

  const importersOf = useMemo(
    () =>
      selected && data
        ? data.edges.filter((e) => e.target === selected).map((e) => e.source)
        : [],
    [selected, data]
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div>
        <h3 className="text-sm font-medium text-text-primary">Code Flow</h3>
        <p className="text-xs text-text-secondary">
          Derived from file structure and imports — static import relationships,
          not runtime tracing.
        </p>
      </div>

      {/* Loading state */}
      {phase === "loading" && (
        <Card className="flex flex-col gap-4 p-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-48 w-full" />
        </Card>
      )}

      {/* Empty state */}
      {phase === "empty" && (
        <Card className="mx-auto my-8 max-w-md text-center p-6">
          <div className="text-sm font-medium text-text-primary">
            No file relationships detected for this repository
          </div>
          <p className="mt-2 text-xs leading-relaxed text-text-secondary">
            No JS/TS import or require statements were found among the source
            files in this repository.
          </p>
        </Card>
      )}

      {/* Error state */}
      {phase === "error" && (
        <Card className="mx-auto my-8 max-w-md text-center p-6">
          <div className="text-sm font-medium text-error">
            Could not build code flow
          </div>
          <p className="mt-1 text-xs text-text-secondary">{error}</p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-4"
            onClick={() => void fetchFlow()}
          >
            Try again
          </Button>
        </Card>
      )}

      {/* Ready state — Graph + Details split view */}
      {phase === "ready" && data && (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          {/* Graph Card */}
          <Card padded={false} className="flex min-w-0 flex-col p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                Import Graph
              </span>
              <span className="text-xs tabular-nums text-text-secondary">
                {data.nodes.length} files · {data.edges.length} relationships
              </span>
            </div>
            <FlowGraph
              nodes={data.nodes}
              edges={data.edges}
              order={data.order}
              selected={selected}
              onSelect={(path) => void loadFileContent(path)}
            />
          </Card>

          {/* Details Panel */}
          <Card className="flex flex-col gap-4">
            {selected ? (
              <>
                {/* File Header & Nav */}
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-accent">
                    Selected File
                  </div>
                  <div className="mt-1 truncate font-mono text-xs font-semibold text-text-primary">
                    {selected}
                  </div>
                </div>

                {/* Import relationships summary */}
                <div className="space-y-3">
                  {/* Imports */}
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                      Imports ({importsOf.length})
                    </span>
                    {importsOf.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {importsOf.map((target) => (
                          <button
                            key={target}
                            onClick={() => void loadFileContent(target)}
                            className="rounded-sm border border-line bg-bg-primary px-2 py-0.5 font-mono text-[11px] text-text-primary transition-colors hover:border-accent hover:text-accent"
                          >
                            {target.split("/").pop()}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-0.5 text-xs text-text-secondary italic">
                        Imports no other repository files
                      </p>
                    )}
                  </div>

                  {/* Imported By */}
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                      Imported By ({importersOf.length})
                    </span>
                    {importersOf.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {importersOf.map((source) => (
                          <button
                            key={source}
                            onClick={() => void loadFileContent(source)}
                            className="rounded-sm border border-line bg-bg-primary px-2 py-0.5 font-mono text-[11px] text-text-primary transition-colors hover:border-accent hover:text-accent"
                          >
                            {source.split("/").pop()}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-0.5 text-xs text-text-secondary italic">
                        Not imported by any other file (potential entry point)
                      </p>
                    )}
                  </div>
                </div>

                {/* Code Panel */}
                <div className="min-h-0 flex-1">
                  {codePhase === "loading" && (
                    <div className="space-y-2 p-2">
                      <Skeleton className="h-3 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  )}

                  {codePhase === "error" && (
                    <p className="p-2 text-xs text-error">{codeError}</p>
                  )}

                  {codePhase === "ready" && code !== null && (
                    <CodeBlock
                      code={code}
                      fileName={selected}
                      className="max-h-[280px] overflow-y-auto"
                    />
                  )}
                </div>

                {/* Navigation in Exploration Order */}
                <div className="flex items-center justify-between border-t border-line pt-3">
                  <span className="text-[11px] text-text-secondary">
                    Exploration order
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => stepBy(-1)}
                      disabled={!hasPrev}
                    >
                      ← Prev
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => stepBy(1)}
                      disabled={!hasNext}
                    >
                      Next →
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-text-secondary">
                Select a file node in the graph to view details and source code.
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
