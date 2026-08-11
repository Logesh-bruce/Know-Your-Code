import { NextRequest, NextResponse } from "next/server";
import { generateQuiz } from "@/services/llmService";
import {
  fetchFileContent,
  GitHubRateLimitError,
  listRepoFiles,
  parseRepoUrl,
  selectRepresentativeFiles,
} from "@/services/githubService";
import type { FileSnippet } from "@/services/llmService";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as {
      repoId?: unknown;
    } | null;
    const repoId = typeof body?.repoId === "string" ? body.repoId.trim() : "";

    if (!repoId) {
      return NextResponse.json(
        { error: "repoId is required" },
        { status: 400 }
      );
    }

    const ref = parseRepoUrl(repoId);
    const files = await listRepoFiles(ref);
    const selected = selectRepresentativeFiles(files, 8);

    const snippets: FileSnippet[] = [];
    await Promise.all(
      selected.map(async (path) => {
        const code = await fetchFileContent(ref, path).catch(() => "");
        if (code) snippets.push({ file: path, code });
      })
    );

    if (snippets.length === 0) {
      return NextResponse.json(
        { error: "No source files could be fetched for this repository" },
        { status: 422 }
      );
    }

    const questions = await generateQuiz(snippets);
    if (questions.length === 0) {
      return NextResponse.json(
        { error: "Could not generate questions from this repository" },
        { status: 422 }
      );
    }

    return NextResponse.json({ questions });
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