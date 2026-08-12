import { NextRequest, NextResponse } from "next/server";
import { getCachedFileContent } from "@/services/fileContentCache";
import {
  classifyGithubError,
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
    const code = await getCachedFileContent(ref, filePath);
    if (code === null) {
      return NextResponse.json(
        { error: "Could not fetch this file's content." },
        { status: 404 }
      );
    }

    return NextResponse.json({ code });
  } catch (err) {
    const { message, status } = classifyGithubError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
