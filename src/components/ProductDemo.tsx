import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

/* ---------------------------------------------------------------------------
 * ProductDemo
 *
 * Self-contained looping simulation of the KnowYourCode product. Renders six
 * scenes (GitHub URL → Analysis → File tree → Code explanation → Quiz →
 * Interview) inside a fixed aspect-ratio panel. The surrounding page can swap
 * this component for a real recorded product video without changing layout.
 * ------------------------------------------------------------------------- */

type SceneName = "repo" | "analyze" | "tree" | "explain" | "quiz" | "interview";

interface DemoStep {
  ms: number;
  scene: SceneName;
  cursor?: { x: number; y: number };
  cursorVisible?: boolean;
}

const DEMO_STEPS: DemoStep[] = [
  { ms: 1300, scene: "repo", cursor: { x: 50, y: 44 }, cursorVisible: true },
  { ms: 1500, scene: "repo", cursor: { x: 50, y: 60 } },
  { ms: 500, scene: "repo", cursorVisible: false },
  { ms: 800, scene: "analyze" },
  { ms: 2600, scene: "analyze" },
  { ms: 900, scene: "tree" },
  { ms: 1200, scene: "tree", cursor: { x: 12, y: 40 }, cursorVisible: true },
  { ms: 700, scene: "tree", cursorVisible: false },
  { ms: 1300, scene: "explain" },
  { ms: 2600, scene: "explain" },
  { ms: 800, scene: "quiz" },
  { ms: 900, scene: "quiz", cursor: { x: 50, y: 50 }, cursorVisible: true },
  { ms: 800, scene: "quiz", cursorVisible: false },
  { ms: 1200, scene: "interview" },
  { ms: 3600, scene: "interview" },
];

function useTypewriter(text: string, active: boolean, speed = 28) {
  const [count, setCount] = useState(0);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    setCount(0);
    if (!active) return;
    const interval = window.setInterval(() => {
      setCount((c) => {
        if (c >= text.length) {
          if (intervalRef.current !== null)
            window.clearInterval(intervalRef.current);
          return c;
        }
        return c + 1;
      });
    }, speed);
    intervalRef.current = interval;
    return () => {
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [text, active, speed]);

  return text.slice(0, count);
}

function useStagedReveal(delays: number[]) {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const timers = delays.map((ms, i) =>
      window.setTimeout(() => setStage(i + 1), ms)
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [delays]);
  return stage;
}

function DemoCursor({
  pos,
  visible,
}: {
  pos: { x: number; y: number } | null;
  visible: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute z-20 transition-[left,top,opacity] duration-500 ease-in-out"
      style={{
        left: `${pos?.x ?? 0}%`,
        top: `${pos?.y ?? 0}%`,
        opacity: visible ? 1 : 0,
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
          d="M2.5 1.5v11l3.4-3.6 2.2 5 2.2-.8-2.1-5.1H13z"
          fill="#E6EDF3"
        />
      </svg>
    </div>
  );
}

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

/* ----------------------------- Scene: repo ------------------------------- */

function RepoScene() {
  const typed = useTypewriter("https://github.com/user/my-project", true, 26);

  return (
    <div className="flex h-full items-center justify-center p-4">
      <div className="w-[80%] rounded-lg border border-line bg-bg-secondary p-4">
        <div className="mb-3 flex items-center gap-2">
          <GitHubMark className="h-4 w-4 text-text-primary" />
          <span className="text-xs font-semibold text-text-primary">
            GitHub Repository
          </span>
        </div>
        <div className="flex items-center rounded-sm border border-line bg-bg-primary px-3 py-2 font-mono text-xs text-text-primary">
          <span>{typed}</span>
          <span className="ml-px inline-block h-3.5 w-[2px] animate-pulse bg-text-primary" />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[10px] text-text-secondary">
            Public repository
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-sm bg-accent px-4 py-2 text-xs font-medium text-white">
            Analyze Repository
            <span aria-hidden="true">→</span>
          </span>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- Scene: analyze ---------------------------- */

function AnalyzeScene() {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const t = window.setTimeout(() => setPct(100), 80);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="flex h-full items-center justify-center p-4">
      <div className="w-[80%] rounded-lg border border-line bg-bg-secondary p-4">
        <h3 className="font-mono text-lg text-text-primary">my-project</h3>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {["React", "Node.js", "PostgreSQL"].map((tech) => (
            <span
              key={tech}
              className="rounded-sm border border-line bg-bg-tertiary px-2 py-0.5 text-[10px] text-text-primary"
            >
              {tech}
            </span>
          ))}
        </div>
        <div className="mt-3 flex gap-6 text-[11px] text-text-secondary">
          <span>47 Files</span>
          <span>8,342 Lines</span>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-bg-tertiary">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-[2200ms] ease-in-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs text-text-secondary">
            Analyzing repository…
          </span>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Scene: tree ------------------------------ */

function TreeRow({
  indent,
  folder,
  name,
  selected,
}: {
  indent: number;
  folder: boolean;
  name: string;
  selected?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-1 rounded-sm py-1 pr-2 text-xs ${
        selected
          ? "bg-accent/15 text-text-primary"
          : folder
            ? "text-text-secondary"
            : "text-text-secondary"
      }`}
      style={{ paddingLeft: 8 + indent * 14 }}
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 16 16"
        fill="none"
        className={selected ? "rotate-90 text-text-secondary" : "text-text-secondary"}
      >
        <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {folder ? (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="text-[#d29922]">
          <path
            d="M1.5 3.5A1.5 1.5 0 0 1 3 2h3l1.5 2H13a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 13 14H3a1.5 1.5 0 0 1-1.5-1.5v-9Z"
            fill="currentColor"
            fillOpacity="0.35"
            stroke="currentColor"
          />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="text-text-secondary">
          <path
            d="M4 2.5A1.5 1.5 0 0 1 5.5 1H11l3 3v8.5A1.5 1.5 0 0 1 12.5 14h-7A1.5 1.5 0 0 1 4 12.5v-10Z"
            stroke="currentColor"
          />
          <path d="M11 1v3.5h3.5" stroke="currentColor" strokeLinejoin="round" />
        </svg>
      )}
      <span className="truncate">{name}</span>
      {selected && (
        <span className="ml-auto rounded-sm bg-accent px-1.5 py-0.5 text-[9px] text-white">
          selected
        </span>
      )}
    </div>
  );
}

function TreeScene() {
  return (
    <div className="flex h-full p-4">
      <div className="w-[46%] rounded-lg border border-line bg-bg-secondary p-3">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
          Codebase Structure
        </div>
        <TreeRow indent={0} folder name="src" />
        <TreeRow indent={1} folder name="components" />
        <TreeRow indent={1} folder name="pages" />
        <TreeRow indent={1} folder name="api" />
        <TreeRow indent={2} folder={false} name="users.js" selected />
        <TreeRow indent={1} folder name="utils" />
        <TreeRow indent={0} folder={false} name="server.js" />
      </div>
      <div className="flex-1" />
    </div>
  );
}

/* ---------------------------- Scene: explain ---------------------------- */

function ExplainScene() {
  const stage = useStagedReveal([700, 1600, 2400]);

  return (
    <div className="flex h-full gap-3 p-4">
      <div className="w-1/2 overflow-hidden rounded-lg border border-line bg-bg-secondary">
        <div className="border-b border-line bg-bg-primary px-3 py-1.5 font-mono text-[10px] text-text-secondary">
          src/api.js
        </div>
        <pre className="px-3 py-3 font-mono text-[10.5px] leading-[1.6] text-[#D4D4D4]">
          <span className="text-[#569CD6]">const</span>{" "}
          <span className="text-[#DCDCAA]">getUserData</span>{" "}
          <span className="text-[#D4D4D4]">=</span>{" "}
          <span className="text-[#569CD6]">async</span>{" "}
          <span className="text-[#D4D4D4]">(</span>
          <span className="text-[#9CDCFE]">id</span>
          <span className="text-[#D4D4D4]">)</span>{" "}
          <span className="text-[#D4D4D4]">=&gt;</span>{" "}
          <span className="text-[#D4D4D4]">{"{"}</span>
          {"\n"}  <span className="text-[#569CD6]">const</span>{" "}
          <span className="text-[#9CDCFE]">response</span>{" "}
          <span className="text-[#D4D4D4]">=</span>{" "}
          <span className="text-[#569CD6]">await</span>{" "}
          <span className="text-[#DCDCAA]">fetch</span>
          <span className="text-[#D4D4D4]">(</span>
          <span className="text-[#CE9178]">{`\`/api/users/${"${id}"}\``}</span>
          <span className="text-[#D4D4D4]">)</span>
          <span className="text-[#D4D4D4]">;</span>
          {"\n"}  <span className="text-[#569CD6]">return</span>{" "}
          <span className="text-[#9CDCFE]">response</span>
          <span className="text-[#D4D4D4]">.</span>
          <span className="text-[#DCDCAA]">json</span>
          <span className="text-[#D4D4D4]">()</span>
          <span className="text-[#D4D4D4]">;</span>
          {"\n"}
          <span className="text-[#D4D4D4]">{"}"}</span>
        </pre>
      </div>

      <div className="w-1/2 overflow-hidden rounded-lg border border-line bg-bg-secondary p-3">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-accent">
          What this file does
        </div>
        {stage >= 1 && (
          <p className="animate-[fadeInUp_250ms_ease-in-out] text-xs leading-relaxed text-text-primary">
            This function retrieves user data from the backend API.
          </p>
        )}
        {stage >= 2 && (
          <div className="mt-3 animate-[fadeInUp_250ms_ease-in-out]">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-accent">
              Key function
            </div>
            <div className="rounded-sm border border-line bg-bg-primary p-2">
              <div className="font-mono text-xs text-[#DCDCAA]">
                getUserData()
              </div>
              <div className="mt-1 text-[11px] leading-relaxed text-text-secondary">
                Fetches user information using the supplied user ID.
              </div>
            </div>
          </div>
        )}
        {stage >= 3 && (
          <div className="mt-3 animate-[fadeInUp_250ms_ease-in-out]">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-accent">
              Related files
            </div>
            <div className="font-mono text-[11px] leading-relaxed text-text-secondary">
              server.js
              <br />
              models/User.js
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ Scene: quiz ------------------------------ */

function QuizScene() {
  const stage = useStagedReveal([900]);
  const selected = stage >= 1;
  const options = [
    { key: "A", text: "Store user data", correct: false },
    { key: "B", text: "Fetch user data", correct: true },
    { key: "C", text: "Validate input", correct: false },
    { key: "D", text: "Generate IDs", correct: false },
  ];

  return (
    <div className="flex h-full items-center justify-center p-4">
      <div className="w-[80%] rounded-lg border border-line bg-bg-secondary p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-text-primary">
            Question 3 of 8
          </span>
          <span className="text-[10px] text-text-secondary">
            37.5% complete
          </span>
        </div>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-bg-tertiary">
          <div className="h-full w-[37.5%] rounded-full bg-accent" />
        </div>
        <p className="mt-3 text-sm font-medium text-text-primary">
          What is the purpose of getUserData()?
        </p>
        <div className="mt-2 space-y-1.5">
          {options.map((opt) => {
            const highlighted = selected && opt.correct;
            return (
              <div
                key={opt.key}
                className={`flex items-center justify-between rounded-sm border px-3 py-1.5 text-xs transition-colors duration-150 ease-in-out ${
                  highlighted
                    ? "border-success bg-success/10 text-success"
                    : "border-line bg-bg-primary text-text-primary"
                }`}
              >
                <span>
                  <span className="mr-2 font-medium opacity-70">{opt.key})</span>
                  {opt.text}
                </span>
                {highlighted && (
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path
                      d="M3 8.5l3.5 3.5L13 5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- Scene: interview --------------------------- */

function InterviewScene() {
  const stage = useStagedReveal([900, 2000, 2900]);

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-accent">
        AI Interviewer
      </div>
      <div className="flex-1 space-y-3">
        {stage >= 1 && (
          <div className="animate-[fadeInUp_250ms_ease-in-out] max-w-[85%] rounded-lg border border-line bg-bg-secondary px-3 py-2 text-xs leading-relaxed text-text-primary">
            Walk me through the architecture of this project.
          </div>
        )}
        {stage >= 2 && (
          <div className="animate-[fadeInUp_250ms_ease-in-out] ml-auto max-w-[85%] rounded-lg bg-accent px-3 py-2 text-xs leading-relaxed text-white">
            The frontend uses React, while the backend uses Node.js and
            Express…
          </div>
        )}
      </div>
      {stage >= 3 && (
        <div className="animate-[fadeInUp_250ms_ease-in-out] mt-3 rounded-lg border border-line bg-bg-secondary p-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
              Confidence
            </span>
            <span className="font-mono text-xs text-success">7.2 / 10</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-bg-tertiary">
            <div
              className="h-full rounded-full bg-success transition-[width] duration-[1200ms] ease-in-out"
              style={{ width: "72%" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------- Root ------------------------------------ */

export default function ProductDemo({ className }: { className?: string }) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = DEMO_STEPS[stepIndex % DEMO_STEPS.length];

  useEffect(() => {
    const t = window.setTimeout(() => setStepIndex((i) => i + 1), step.ms);
    return () => window.clearTimeout(t);
  }, [step]);

  return (
    <div
      className={clsx(
        "relative flex w-full flex-col overflow-hidden rounded-lg border border-line bg-bg-primary shadow-elevated",
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-line bg-bg-secondary px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57] opacity-90" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E] opacity-90" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28C840] opacity-90" />
        </div>
        <span className="text-xs font-semibold tracking-wide text-text-primary">
          KnowYourCode
        </span>
        <span className="w-10" />
      </div>

      <div className="relative aspect-[16/10] w-full lg:aspect-auto lg:min-h-0 lg:flex-1">
        {step.scene === "repo" && <RepoScene />}
        {step.scene === "analyze" && <AnalyzeScene />}
        {step.scene === "tree" && <TreeScene />}
        {step.scene === "explain" && <ExplainScene />}
        {step.scene === "quiz" && <QuizScene />}
        {step.scene === "interview" && <InterviewScene />}
        <DemoCursor pos={step.cursor ?? null} visible={step.cursorVisible ?? false} />
      </div>
    </div>
  );
}