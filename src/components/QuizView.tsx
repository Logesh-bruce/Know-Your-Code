"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/Button";
import Card from "@/components/Card";
import ProgressBar from "@/components/ProgressBar";
import { postJson } from "@/utils/api";
import type { QuizQuestion } from "@/types/quiz";

interface QuizViewProps {
  repoId: string;
  onExit?: () => void;
}

type QuizPhase = "loading" | "quiz" | "result" | "error";

function parseOption(option: string, fallbackLetter: string) {
  const match = /^([A-D])\s*\)/.exec(option);
  const letter = match ? match[1] : fallbackLetter;
  const text = option.replace(/^[A-D]\s*\)\s*/, "").trim();
  return { letter, text };
}

function resultHeading(percentage: number): string {
  if (percentage >= 80) return "Strong understanding of the codebase!";
  if (percentage >= 60) return "Good understanding — a few gaps to review.";
  return "Worth revisiting. Review the areas below and try again.";
}

export default function QuizView({ repoId, onExit }: QuizViewProps) {
  const [phase, setPhase] = useState<QuizPhase>("loading");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attemptRef = useRef(0);

  const load = useCallback(async () => {
    attemptRef.current += 1;
    setPhase("loading");
    setError(null);
    setIndex(0);
    setAnswers({});
    setRevealed(false);
    try {
      const result = await postJson<{ questions: QuizQuestion[] }>(
        "/api/quiz",
        { repoId, attempt: attemptRef.current }
      );
      if (!result.questions || result.questions.length === 0) {
        throw new Error("No questions returned");
      }
      setQuestions(result.questions);
      setPhase("quiz");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load the quiz"
      );
      setPhase("error");
    }
  }, [repoId]);

  useEffect(() => {
    void load();
  }, [load]);

  const current = questions[index];
  const total = questions.length;

  const score = useMemo(
    () =>
      questions.filter((q) => answers[q.id] === q.correctAnswer).length,
    [questions, answers]
  );

  const percentage = total
    ? Math.round((score / total) * 100)
    : 0;

  const areasToReview = useMemo(
    () =>
      questions
        .filter((q) => answers[q.id] !== q.correctAnswer)
        .map((q) => q.explanation)
        .filter(Boolean),
    [questions, answers]
  );

  const selectOption = (letter: string) => {
    if (!current || revealed) return;
    setAnswers((a) => ({ ...a, [current.id]: letter }));
    setRevealed(true);
  };

  const nextQuestion = () => {
    if (index + 1 < total) {
      setIndex((i) => i + 1);
      setRevealed(false);
    } else {
      setPhase("result");
    }
  };

  if (phase === "loading") {
    return (
      <Card className="flex h-64 items-center justify-center">
        <div className="flex w-full max-w-xs flex-col gap-3">
          <span className="text-sm text-text-secondary">
            Generating questions…
          </span>
          <div className="h-1 w-full overflow-hidden rounded-full bg-bg-tertiary">
            <div className="h-full w-1/3 rounded-full bg-accent animate-[indeterminate_1.4s_ease-in-out_infinite]" />
          </div>
        </div>
      </Card>
    );
  }

  if (phase === "error") {
    return (
      <Card className="flex h-64 items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-error">{error}</p>
          <div className="mt-3 flex justify-center gap-2">
            <Button onClick={() => void load()}>Try again</Button>
            <Button variant="secondary" onClick={onExit}>
              Back
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  if (phase === "result") {
    return (
      <Card className="mx-auto flex max-w-xl flex-col gap-4">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-text-primary">
            Quiz complete!
          </h3>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-text-primary">
            {score}/{total} ({percentage}%)
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            {resultHeading(percentage)}
          </p>
        </div>

        {areasToReview.length > 0 && (
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
              Areas to review
            </h4>
            <ul className="mt-2 space-y-1.5">
              {areasToReview.map((area, i) => (
                <li
                  key={i}
                  className="rounded-sm border border-line bg-bg-primary px-3 py-2 text-xs leading-relaxed text-text-secondary"
                >
                  {area}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-2 flex flex-wrap justify-center gap-2 border-t border-line pt-4">
          <Button onClick={() => void load()}>Retry Quiz</Button>
          <Button variant="secondary" onClick={onExit}>
            Back to Repo
          </Button>
        </div>
      </Card>
    );
  }

  if (!current) return null;

  return (
    <Card className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-text-primary">
          Question {index + 1} of {total}
        </span>
        <span className="text-xs tabular-nums text-text-secondary">
          {index + 1} / {total}
        </span>
      </div>
      <ProgressBar
        value={((index + 1) / total) * 100}
        showLabel
      />
      <p className="text-base font-medium leading-relaxed text-text-primary">
        {current.question}
      </p>

      <div className="space-y-2" role="group" aria-label="Answer options">
        {current.options.map((option, i) => {
          const { letter, text } = parseOption(option, "ABCD"[i]);
          const chosen = answers[current.id] === letter;
          const isCorrect = letter === current.correctAnswer;
          const showResult = revealed && (chosen || isCorrect);

          return (
            <button
              key={letter}
              onClick={() => selectOption(letter)}
              disabled={revealed}
              className={`flex w-full items-center justify-between rounded-sm border px-4 py-3 text-left text-sm transition-colors duration-150 ease-in-out ${
                !revealed
                  ? chosen
                    ? "border-accent bg-accent/10 text-text-primary"
                    : "border-line bg-bg-primary text-text-primary hover:border-text-secondary/50"
                  : isCorrect
                    ? "border-success bg-success/10 text-success"
                    : chosen
                      ? "border-error bg-error/10 text-error"
                      : "border-line bg-bg-primary text-text-primary opacity-60"
              }`}
            >
              <span>
                <span className="mr-2 font-semibold">{letter})</span>
                {text}
              </span>
              {showResult && (
                <span aria-hidden="true">
                  {isCorrect ? (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8.5l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {revealed && current.explanation && (
        <div className="animate-[fadeInUp_150ms_ease-in-out] rounded-sm border border-line bg-bg-primary px-4 py-3">
          <p className="text-xs leading-relaxed text-text-secondary">
            <span className="font-medium text-text-primary">Why: </span>
            {current.explanation}
          </p>
        </div>
      )}

      {revealed && (
        <div className="flex justify-end">
          <Button onClick={nextQuestion}>
            {index + 1 < total ? "Next Question →" : "See Results →"}
          </Button>
        </div>
      )}
    </Card>
  );
}