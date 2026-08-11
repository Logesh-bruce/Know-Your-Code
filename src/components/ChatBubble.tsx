import clsx from "clsx";
import type { InterviewMessage } from "@/types/interview";

interface ChatBubbleProps {
  message: InterviewMessage;
}

export default function ChatBubble({ message }: ChatBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={clsx("flex", isUser ? "justify-end" : "justify-start")}>
      <div className="flex max-w-[80%] flex-col gap-1">
        <div
          className={clsx(
            "rounded px-4 py-3 text-sm leading-relaxed",
            isUser
              ? "bg-accent text-white"
              : "border border-line bg-bg-secondary text-text-primary"
          )}
        >
          {message.text}
        </div>
        {message.timestamp && (
          <span
            className={clsx(
              "text-xs text-text-secondary",
              isUser ? "text-right" : "text-left"
            )}
          >
            {message.timestamp}
          </span>
        )}
      </div>
    </div>
  );
}