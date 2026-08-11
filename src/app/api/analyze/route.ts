import { NextRequest, NextResponse } from "next/server";
import type { RepoAnalysis } from "@/types/repo";
import {
  detectPrimaryLanguage,
  detectTechStack,
  estimateLineCount,
  fetchFileContent,
  getRepoMetadata,
  GitHubRateLimitError,
  listRepoFiles,
  logGithubRateLimitOnce,
  parseRepoUrl,
} from "@/services/githubService";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as {
      repoUrl?: unknown;
    } | null;
    const repoUrl =
      typeof body?.repoUrl === "string" ? body.repoUrl.trim() : "";

    if (!repoUrl) {
      return NextResponse.json(
        { error: "repoUrl is required" },
        { status: 400 }
      );
    }

    const ref = parseRepoUrl(repoUrl);
    void logGithubRateLimitOnce();
    const [metadata, files] = await Promise.all([
      getRepoMetadata(ref),
      listRepoFiles(ref),
    ]);

    const packageJson = await fetchFileContent(ref, "package.json").catch(
      () => undefined
    );

    const fileList = files.filter((f) => f.type === "file");
    const techStack = detectTechStack(files, packageJson);
    const lineCount = await estimateLineCount(ref, files);
    const primaryLanguage = detectPrimaryLanguage(files, metadata.language);

    const analysis: RepoAnalysis = {
      id: `${ref.owner}/${ref.repo}`,
      name: metadata.name || ref.repo,
      description: metadata.description,
      techStack,
      fileCount: fileList.length,
      lineCount,
      primaryLanguage,
      files,
    };

    return NextResponse.json(analysis);
  } catch (err) {
    if (err instanceof GitHubRateLimitError) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    const message =
      err instanceof Error ? err.message : "Something went wrong";
    const status = message.includes("Not Found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}