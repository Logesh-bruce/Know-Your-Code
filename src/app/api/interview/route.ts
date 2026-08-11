import { NextRequest, NextResponse } from "next/server";
import {
  interviewReply,
  type InterviewContext,
  type InterviewTurn,
} from "@/services/llmService";
import {
  getRepoMetadata,
  GitHubRateLimitError,
  listRepoFiles,
  parseRepoUrl,
} from "@/services/githubService";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as {
      repoId?: unknown;
      message?: unknown;
      history?: unknown;
    } | null;

    const repoId = typeof body?.repoId === "string" ? body.repoId.trim() : "";
    const message =
      typeof body?.message === "string" ? body.message.trim() : "";

    if (!repoId) {
      return NextResponse.json(
        { error: "repoId is required" },
        { status: 400 }
      );
    }

    const history: InterviewTurn[] = Array.isArray(body?.history)
      ? body.history
          .filter(
            (turn): turn is InterviewTurn =>
              Boolean(turn) &&
              (turn.role === "ai" || turn.role === "user") &&
              typeof turn.text === "string"
          )
          .slice(-20)
      : [];

    const ref = parseRepoUrl(repoId);
    const meta = await getRepoMetadata(ref);
    const files = await listRepoFiles(ref).catch(() => []);

    const context: InterviewContext = {
      name: meta.name,
      description: meta.description,
      files: files.map((f) => f.path),
    };

    const reply = await interviewReply(context, message, history);
    return NextResponse.json(reply);
  } catch (err) {
    if (err instanceof GitHubRateLimitError) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Something went wrong" },
      { status: 500 }
    );
  }
}