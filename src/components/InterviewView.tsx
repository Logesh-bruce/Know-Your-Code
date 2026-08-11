"use client";

import { useEffect, useRef, useState } from "react";
import Button from "@/components/Button";
import Card from "@/components/Card";
import ChatBubble from "@/components/ChatBubble";
import ProgressBar from "@/components/ProgressBar";
import { useInterview } from "@/hooks/useInterview";

interface InterviewViewProps {
  repoId: string;
  repoName?: string;
  onExit?: () => void;
}

function buildSummary(
  confidenceHistory: number[],
  startedAt: number,
  questionsAnswered: number
) {
  const finalScore = confidenceHistory.length
    ? confidenceHistory.reduce((a, b) => a + b, 0) / confidenceHistory.length
    : 0;
  const durationMinutes = Math.max(
    0,
    Math.round(((Date.now() - startedAt) / 60000) * 10) / 10
  );

  const strengths =
    finalScore >= 7
      ? [
          "Clear, structured explanations",
          "Good command of the tech stack",
        ]
      : finalScore >= 5
        ? [
            "Solid overall explanations",
            "Engaged with follow-up questions",
          ]
        : ["Started the interview", "Attempted the technical questions"];

  const areasToImprove = [
    "Reference specific files and functions by name",
    "Discuss error handling and edge cases",
    "Explain scalability and trade-off decisions",
  ];

  return {
    finalScore: Math.round(finalScore * 10) / 10,
    durationMinutes,
    questionsAnswered,
    strengths,
    areasToImprove,
  };
}

export default function InterviewView({
  repoId,
  repoName,
  onExit,
}: InterviewViewProps) {
  const {
    messages,
    confidence,
    confidenceHistory,
    status,
    error,
    startedAt,
    send,
    reset,
  } = useInterview(repoId);

  const [input, setInput] = useState("");
  const [showSummary, setShowSummary] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, showSummary]);

  const questionsAsked = messages.filter((m) => m.role === "ai").length;
  const questionsAnswered = messages.filter((m) => m.role === "user").length;

  const summary = buildSummary(confidenceHistory, startedAt, questionsAnswered);

  const submit = () => {
    const text = input;
    setInput("");
    void send(text);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-text-primary">
            Interview: {repoName ?? repoId}
          </h3>
          <p className="text-xs text-text-secondary">
            Question {questionsAsked + 1}
            {questionsAnswered > 0 && ` · ${questionsAnswered} answered`}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowSummary(true)}
          disabled={messages.length === 0}
        >
          End Interview
        </Button>
      </div>

      {/* Summary */}
      {showSummary ? (
        <Card className="mx-auto flex max-w-xl flex-col gap-4">
          <div className="text-center">
            <h4 className="text-lg font-semibold text-text-primary">
              Interview complete!
            </h4>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-text-primary">
              {summary.finalScore.toFixed(1)}/10
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              Duration: {summary.durationMinutes} min · Questions answered:{" "}
              {summary.questionsAnswered}
            </p>
          </div>

          <div>
            <h5 className="text-[11px] font-semibold uppercase tracking-wider text-success">
              Strengths
            </h5>
            <ul className="mt-2 space-y-1.5">
              {summary.strengths.map((item) => (
                <li
                  key={item}
                  className="rounded-sm border border-success/30 bg-success/5 px-3 py-2 text-xs text-text-primary"
                >
                  ✓ {item}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h5 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
              Areas to improve
            </h5>
            <ul className="mt-2 space-y-1.5">
              {summary.areasToImprove.map((item) => (
                <li
                  key={item}
                  className="rounded-sm border border-line bg-bg-primary px-3 py-2 text-xs text-text-secondary"
                >
                  • {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-2 flex flex-wrap justify-center gap-2 border-t border-line pt-4">
            <Button
              variant="secondary"
              onClick={() => setShowSummary(false)}
            >
              Review Chat
            </Button>
            <Button
              onClick={() => {
                reset();
                setShowSummary(false);
              }}
            >
              New Interview
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
            {/* Chat */}
            <Card padded={false} className="flex min-w-0 flex-col">
              <div
                ref={scrollRef}
                className="h-[380px] overflow-y-auto px-4 py-4"
              >
                {messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-text-secondary">
                    Starting the interview…
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message, i) => (
                      <ChatBubble key={i} message={message} />
                    ))}
                    {status === "sending" && (
                      <div className="flex items-center gap-2 px-1 text-xs text-text-secondary">
                        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                        Interviewer is thinking…
                      </div>
                    )}
                  </div>
                )}
                {status === "error" && (
                  <p className="mt-2 rounded-sm border border-error/40 bg-error/10 px-3 py-2 text-xs text-error">
                    {error ?? "Failed to send. Try again."}
                  </p>
                )}
              </div>

              <div className="flex items-end gap-2 border-t border-line p-3">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submit();
                    }
                  }}
                  rows={2}
                  placeholder="Type your response…"
                  className="min-w-0 flex-1 resize-none rounded-sm border border-line bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary transition-colors duration-150 ease-in-out focus:border-accent focus:outline-none"
                />
                <Button
                  onClick={submit}
                  disabled={!input.trim() || status === "sending"}
                  aria-label="Send message"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M1.5 8L14 2l-3.5 12-2.5-5-6.5-1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                  </svg>
                  Send
                </Button>
              </div>
            </Card>

            {/* Confidence sidebar */}
            <Card className="flex h-fit flex-col gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                  Confidence
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-semibold tabular-nums text-success">
                    {confidence.toFixed(1)}
                  </span>
                  <span className="text-xs text-text-secondary">/ 10</span>
                </div>
              </div>
              <ProgressBar value={confidence * 10} />
              <p className="text-xs leading-relaxed text-text-secondary">
                Based on the depth and specificity of your answers so far.
              </p>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}