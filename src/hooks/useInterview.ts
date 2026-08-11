"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { postJson } from "@/utils/api";
import type {
  InterviewMessage,
  InterviewReply,
} from "@/types/interview";

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

interface UseInterviewResult {
  messages: InterviewMessage[];
  confidence: number;
  confidenceHistory: number[];
  status: "idle" | "sending" | "error";
  error: string | null;
  startedAt: number;
  send: (text: string) => Promise<void>;
  reset: () => void;
}

export function useInterview(repoId: string): UseInterviewResult {
  const [messages, setMessages] = useState<InterviewMessage[]>([]);
  const [confidence, setConfidence] = useState(0);
  const [confidenceHistory, setConfidenceHistory] = useState<number[]>([]);
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const startedAtRef = useRef<number>(Date.now());
  const initializedRef = useRef(false);

  const postTurn = useCallback(
    async (text: string, history: InterviewMessage[]) => {
      setStatus("sending");
      setError(null);
      try {
        const reply = await postJson<InterviewReply>("/api/interview", {
          repoId,
          message: text,
          history: history.map((m) => ({ role: m.role, text: m.text })),
        });
        setStatus("idle");
        return reply;
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Failed to send");
        throw err;
      }
    },
    [repoId]
  );

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || status === "sending") return;
      const userMessage: InterviewMessage = {
        role: "user",
        text: trimmed,
        timestamp: timeAgo(Date.now()),
      };
      setMessages((prev) => [...prev, userMessage]);
      try {
        const reply = await postTurn(trimmed, messages);
        setMessages((prev) => [
          ...prev,
          {
            role: "ai",
            text: reply.reply,
            timestamp: timeAgo(Date.now()),
          },
        ]);
        setConfidence(reply.confidenceScore);
        setConfidenceHistory((prev) => [...prev, reply.confidenceScore]);
      } catch {
        /* error surfaced via status */
      }
    },
    [messages, status, postTurn]
  );

  const reset = useCallback(() => {
    startedAtRef.current = Date.now();
    initializedRef.current = true;
    setMessages([]);
    setConfidence(0);
    setConfidenceHistory([]);
    setStatus("idle");
    setError(null);
    void (async () => {
      try {
        const reply = await postTurn("", []);
        setMessages([
          {
            role: "ai",
            text: reply.reply,
            timestamp: timeAgo(Date.now()),
          },
        ]);
        setConfidence(0);
      } catch {
        /* opening question failed — user can retry via input */
      }
    })();
  }, [postTurn]);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    void (async () => {
      try {
        const reply = await postTurn("", []);
        setMessages([
          {
            role: "ai",
            text: reply.reply,
            timestamp: timeAgo(Date.now()),
          },
        ]);
        setConfidence(0);
      } catch {
        /* opening question failed — user can retry via input */
      }
    })();
  }, [postTurn]);

  return {
    messages,
    confidence,
    confidenceHistory,
    status,
    error,
    startedAt: startedAtRef.current,
    send,
    reset,
  };
}