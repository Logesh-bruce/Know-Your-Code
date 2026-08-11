export interface InterviewMessage {
  role: "ai" | "user";
  text: string;
  timestamp?: string;
}

export interface InterviewReply {
  reply: string;
  confidenceScore: number;
  feedback: string;
}

export interface InterviewSummary {
  finalScore: number;
  durationMinutes: number;
  questionsAnswered: number;
  strengths: string[];
  areasToImprove: string[];
}