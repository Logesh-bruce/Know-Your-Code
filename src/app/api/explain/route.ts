import { NextRequest, NextResponse } from "next/server";
import { explainCode } from "@/services/llmService";
import {
  fetchFileContent,
  GitHubRateLimitError,
  parseRepoUrl,
} from "@/services/githubService";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as {
      repoId?: unknown;
      filePath?: unknown;
    } | null;

    const repoId = typeof body?.repoId === "string" ? body.repoId.trim() : "";
    const filePath =
      typeof body?.filePath === "string" ? body.filePath.trim() : "";

    if (!repoId || !filePath) {
      return NextResponse.json(
        { error: "repoId and filePath are required" },
        { status: 400 }
      );
    }

    const ref = parseRepoUrl(repoId);

    const code = await fetchFileContent(ref, filePath).catch(() => null);
    if (code === null || code === "") {
      return NextResponse.json(
        { error: `Could not fetch ${filePath} from ${ref.owner}/${ref.repo}` },
        { status: 404 }
      );
    }

    const explanation = await explainCode(code, filePath, ref.repo);

    return NextResponse.json({ ...explanation, code });
  } catch (err) {
    if (err instanceof GitHubRateLimitError) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Something went wrong",
      },
      { status: 500 }
    );
  }
}