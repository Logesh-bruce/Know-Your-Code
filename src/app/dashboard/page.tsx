"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import Button from "@/components/Button";
import Card from "@/components/Card";
import ExplainView from "@/components/ExplainView";
import FileTree from "@/components/FileTree";
import InterviewView from "@/components/InterviewView";
import RepoSummary from "@/components/RepoSummary";
import QuizView from "@/components/QuizView";
import Tabs from "@/components/Tabs";
import { useRepoAnalysis, ANALYSIS_STEPS } from "@/hooks/useRepoAnalysis";
import { buildFileTree } from "@/utils/formatting";
import type { FileTreeNode } from "@/types/repo";

const TABS = ["Explain", "Test", "Interview"];

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span className="flex h-6 w-6 items-center justify-center rounded-sm bg-accent">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="1.5" y="1.5" width="13" height="13" rx="3" stroke="white" />
          <path d="M5.5 5.5v5M8 10V6M10.5 8v2" stroke="white" strokeLinecap="round" />
        </svg>
      </span>
      {!compact && (
        <span className="text-sm font-semibold tracking-tight text-text-primary">
          KnowYourCode
        </span>
      )}
    </span>
  );
}

function Sidebar({
  nodes,
  selectedPath,
  onSelect,
  fileCount,
}: {
  nodes: FileTreeNode[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
  fileCount: number;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Files
        </span>
        <span className="text-xs tabular-nums text-text-secondary">
          {fileCount.toLocaleString()}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        <FileTree
          nodes={nodes}
          selectedPath={selectedPath ?? undefined}
          onSelect={onSelect}
        />
      </div>
    </div>
  );
}

function LoadingState({ activeStep }: { activeStep: number | null }) {
  return (
    <div className="flex h-full min-h-[320px] items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <div className="text-sm font-medium text-text-primary">
          Analyzing repository…
        </div>
        <p className="mt-1 text-xs text-text-secondary">
          Fetching structure and tech stack from GitHub.
        </p>
        <ul className="mt-4 space-y-2">
          {ANALYSIS_STEPS.map((step, i) => {
            const done = activeStep !== null && i < activeStep;
            const active = activeStep === i;
            return (
              <li
                key={step.id}
                className={`flex items-center gap-2 text-xs ${
                  done || active ? "text-text-primary" : "text-text-secondary"
                }`}
              >
                {done ? (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                    className="text-success"
                  >
                    <path
                      d="M3 8.5l3.5 3.5L13 5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : active ? (
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                ) : (
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-bg-tertiary" />
                )}
                {step.label}…
              </li>
            );
          })}
        </ul>
        <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-bg-tertiary">
          <div className="h-full w-1/3 rounded-full bg-accent animate-[indeterminate_1.4s_ease-in-out_infinite]" />
        </div>
      </Card>
    </div>
  );
}

const ERROR_COPY: Record<
  number,
  { title: string; hint: string; homeLabel?: string }
> = {
  400: {
    title: "That doesn't look like a GitHub repository",
    hint: "Paste a full URL like https://github.com/owner/repo, or an owner/repo name.",
  },
  404: {
    title: "Repository not found",
    hint: "Double-check the owner and repository name, and make sure the repository is public.",
  },
  403: {
    title: "Can't access this repository",
    hint: "It may be private. Make sure GITHUB_TOKEN has read access to this repo, then try again.",
  },
  429: {
    title: "GitHub rate limit reached",
    hint: "Wait for the rate limit to reset, then try again. A GITHUB_TOKEN raises the limit.",
  },
  408: {
    title: "The request took too long",
    hint: "The server was slow to respond. Try again, or check your network connection.",
  },
};

export default function DashboardPage() {
  const router = useRouter();
  const { status, repo, error, errorStatus, retry, activeStep } =
    useRepoAnalysis();
  const [activeTab, setActiveTab] = useState<string>(TABS[0]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const tree = useMemo(
    () => (repo ? buildFileTree(repo.files) : []),
    [repo]
  );

  const orderedFiles = useMemo(
    () =>
      repo
        ? repo.files
            .filter((f) => f.type === "file")
            .map((f) => f.path)
        : [],
    [repo]
  );

  const fileIndex = selectedFile ? orderedFiles.indexOf(selectedFile) : -1;

  const selectFileAt = (index: number) => {
    const next = orderedFiles[index];
    if (next) {
      setSelectedFile(next);
      setActiveTab("Explain");
    }
  };

  const handleFileSelect = (path: string) => {
    setSelectedFile(path);
    setActiveTab("Explain");
    setMobileSidebarOpen(false);
  };

  return (
    <div className="flex min-h-screen flex-col bg-bg-primary">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-line bg-bg-primary">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <button
            onClick={() => router.push("/")}
            aria-label="Back to home"
            className="flex h-8 w-8 items-center justify-center rounded-sm transition-colors duration-150 ease-in-out hover:bg-bg-tertiary"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <Logo />

          {repo && (
            <span className="hidden truncate font-mono text-sm text-text-secondary sm:inline">
              {repo.name}
            </span>
          )}

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setMobileSidebarOpen((o) => !o)}
              className="flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-sm text-text-secondary transition-colors duration-150 ease-in-out hover:bg-bg-tertiary hover:text-text-primary lg:hidden"
            >
              Files
            </button>
            <span className="flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-sm text-text-secondary">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="4" stroke="currentColor" />
                <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3 3l1.5 1.5M11.5 11.5L13 13M13 3l-1.5 1.5M4.5 11.5L3 13" stroke="currentColor" />
              </svg>
              Profile
            </span>
          </div>
        </div>
      </header>

      {/* Body */}
      {status === "loading" && <LoadingState activeStep={activeStep} />}

      {status === "error" && (
        <div className="flex flex-1 items-center justify-center p-6">
          <Card className="w-full max-w-md">
            <div className="text-sm font-medium text-error">
              {errorStatus !== null && ERROR_COPY[errorStatus]
                ? ERROR_COPY[errorStatus].title
                : "Could not analyze repository"}
            </div>
            <p className="mt-1 text-sm text-text-secondary">
              {errorStatus !== null && ERROR_COPY[errorStatus]
                ? ERROR_COPY[errorStatus].hint
                : error}
            </p>
            {errorStatus === 400 ? (
              <div className="mt-4 flex gap-2">
                <Button variant="secondary" onClick={() => router.push("/")}>
                  Fix the URL
                </Button>
              </div>
            ) : (
              <div className="mt-4 flex gap-2">
                <Button onClick={() => retry()}>Try again</Button>
                <Button variant="secondary" onClick={() => router.push("/")}>
                  Go home
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}

      {status === "idle" && (
        <div className="flex flex-1 items-center justify-center p-6">
          <Card className="w-full max-w-md text-center">
            <div className="text-sm font-medium text-text-primary">
              No repository yet
            </div>
            <p className="mt-1 text-sm text-text-secondary">
              Paste a GitHub repository URL on the home screen to get started.
            </p>
            <div className="mt-4 flex justify-center">
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-sm bg-accent px-6 py-3 text-base font-medium text-white transition-colors duration-150 ease-in-out hover:bg-accent-hover"
              >
                Analyze a repository →
              </Link>
            </div>
          </Card>
        </div>
      )}

      {status === "success" && repo && (
        <div className="relative mx-auto flex w-full max-w-7xl flex-1 items-start px-0 sm:px-0">
          {/* Desktop sidebar */}
          <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 border-r border-line bg-bg-secondary p-4 lg:block">
            <Sidebar
              nodes={tree}
              selectedPath={selectedFile}
              onSelect={handleFileSelect}
              fileCount={repo.fileCount}
            />
          </aside>

          {/* Mobile sidebar drawer */}
          {mobileSidebarOpen && (
            <div className="fixed inset-0 z-30 lg:hidden">
              <div
                className="absolute inset-0 bg-black/50"
                onClick={() => setMobileSidebarOpen(false)}
              />
              <aside className="absolute left-0 top-0 h-full w-64 border-r border-line bg-bg-primary p-4">
                <Sidebar
                  nodes={tree}
                  selectedPath={selectedFile}
                  onSelect={handleFileSelect}
                  fileCount={repo.fileCount}
                />
              </aside>
            </div>
          )}

          {/* Main panel */}
          <main className="min-w-0 flex-1 p-4 sm:p-6">
            <Card padded={false} className="flex flex-col gap-4 p-4">
              <RepoSummary repo={repo} />
              <div className="flex flex-wrap gap-2 border-t border-line pt-4">
                {TABS.map((tab) => (
                  <Button
                    key={tab}
                    variant={activeTab === tab ? "primary" : "secondary"}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab === "Explain"
                      ? "Explain Code"
                      : tab === "Test"
                        ? "Test"
                        : "Interview"}
                  </Button>
                ))}
              </div>
            </Card>

            <div className="mt-6">
              <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} />
              <div className="pt-4">
                {activeTab === "Explain" && (
                  selectedFile ? (
                    <ExplainView
                      repoId={repo.id}
                      filePath={selectedFile}
                      hasPrev={fileIndex > 0}
                      hasNext={fileIndex !== -1 && fileIndex < orderedFiles.length - 1}
                      onPrev={() => selectFileAt(fileIndex - 1)}
                      onNext={() => selectFileAt(fileIndex + 1)}
                    />
                  ) : (
                    <Card className="flex h-64 items-center justify-center text-sm text-text-secondary">
                      Select a file in the tree to generate an explanation.
                    </Card>
                  )
                )}
                {activeTab === "Test" && (
                  <QuizView
                    repoId={repo.id}
                    onExit={() => setActiveTab("Explain")}
                  />
                )}
                {activeTab === "Interview" && (
                  <InterviewView
                    repoId={repo.id}
                    repoName={repo.name}
                    onExit={() => setActiveTab("Explain")}
                  />
                )}
              </div>
            </div>
          </main>
        </div>
      )}
    </div>
  );
}