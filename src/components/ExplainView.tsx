"use client";

import { useState } from "react";
import Button from "@/components/Button";
import Card from "@/components/Card";
import CodeBlock from "@/components/CodeBlock";
import Skeleton from "@/components/Skeleton";
import { useCodeExplanation } from "@/hooks/useCodeExplanation";

interface ExplainViewProps {
  repoId: string;
  filePath: string;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-accent">
      {children}
    </h3>
  );
}

export default function ExplainView({
  repoId,
  filePath,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: ExplainViewProps) {
  const { status, data, error, reload } = useCodeExplanation(repoId, filePath);
  const [dive, setDive] = useState(false);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Code pane */}
      <div className="flex min-w-0 flex-col gap-2">
        {status === "loading" && (
          <Card padded={false} className="flex h-64 flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-line bg-bg-primary px-3 py-2">
              <span className="truncate font-mono text-xs text-text-secondary">
                {filePath}
              </span>
            </div>
            <div className="flex-1 space-y-3 p-4">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </Card>
        )}

        {status === "error" && (
          <Card className="flex h-64 items-center justify-center">
            <div className="text-center">
              <p className="text-sm text-error">{error}</p>
              <Button
                variant="secondary"
                className="mt-3"
                onClick={() => void reload()}
              >
                Try again
              </Button>
            </div>
          </Card>
        )}

        {status === "success" && data && (
          <div className="min-w-0">
            <CodeBlock
              code={data.code ?? ""}
              fileName={filePath}
              className="max-h-[480px] overflow-y-auto"
            />
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={onPrev}
            disabled={!hasPrev || status === "loading"}
          >
            ← Prev File
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={onNext}
            disabled={!hasNext || status === "loading"}
          >
            Next File →
          </Button>
        </div>
      </div>

      {/* Explanation pane */}
      <div className="min-w-0">
        {status === "loading" && (
          <Card className="flex min-h-[240px] flex-col gap-4">
            <div>
              <Skeleton className="h-3 w-24" />
              <div className="mt-2 space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
                <Skeleton className="h-3 w-4/6" />
              </div>
            </div>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-3 w-3/5" />
          </Card>
        )}

        {status === "success" && data && (
          <Card className="flex h-full flex-col gap-5">
            <section>
              <SectionHeading>What this file does</SectionHeading>
              <p className="mt-2 text-sm leading-relaxed text-text-primary">
                {data.summary}
              </p>
            </section>

            {data.functions.length > 0 && (
              <section>
                <SectionHeading>Key Functions</SectionHeading>
                <ul className="mt-2 space-y-3">
                  {data.functions.map((fn) => (
                    <li key={fn.name}>
                      <code className="text-sm text-[#DCDCAA]">
                        {fn.name}
                        <span className="text-text-secondary">()</span>
                      </code>
                      {fn.description && (
                        <p className="mt-0.5 text-sm leading-relaxed text-text-secondary">
                          {fn.description}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {data.relatedFiles.length > 0 && (
              <section>
                <SectionHeading>Related files</SectionHeading>
                <ul className="mt-2 space-y-1 font-mono text-xs text-text-secondary">
                  {data.relatedFiles.map((file) => (
                    <li key={file}>{file}</li>
                  ))}
                </ul>
              </section>
            )}

            <section className="mt-auto border-t border-line pt-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDive((d) => !d)}
              >
                {dive ? "Show less ↑" : "Dive Deeper ↓"}
              </Button>
              {dive && (
                <div className="mt-3 space-y-4">
                  {data.deepDive && (
                    <p className="text-sm leading-relaxed text-text-primary">
                      {data.deepDive}
                    </p>
                  )}
                  {data.functions.length > 0 && (
                    <>
                      <div>
                        <SectionHeading>Signatures</SectionHeading>
                        <ul className="mt-2 space-y-2">
                          {data.functions.map((fn) => (
                            <li key={fn.name} className="text-xs">
                              <code className="text-text-primary">
                                {fn.name}(
                                {fn.params.join(", ")})
                              </code>
                              <span className="block text-text-secondary">
                                Returns {fn.returns || "unknown"}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </>
                  )}
                </div>
              )}
            </section>
          </Card>
        )}
      </div>
    </div>
  );
}