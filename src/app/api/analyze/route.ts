import { NextRequest, NextResponse } from "next/server";
import type { RepoAnalysis } from "@/types/repo";
import {
  detectPrimaryLanguage,
  detectTechStack,
  estimateLineCount,
  fetchFileContent,
  getRepoHeadSha,
  getRepoMetadata,
  GitHubRateLimitError,
  listRepoFiles,
  logGithubRateLimitOnce,
  parseRepoUrl,
} from "@/services/githubService";

const CACHE_SIZE_LIMIT = 50;
const analysisCache = new Map<string, { sha: string; result: RepoAnalysis }>();

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
    const metadata = await getRepoMetadata(ref);
    const headSha = await getRepoHeadSha(ref, metadata.defaultBranch);

    const cacheKey = `${ref.owner}/${ref.repo}#${headSha}`;
    const cached = analysisCache.get(cacheKey);
    if (cached) {
      return NextResponse.json(cached.result);
    }

    const files = await listRepoFiles(ref, metadata.defaultBranch);

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

    if (analysisCache.size >= CACHE_SIZE_LIMIT) {
      const oldestKey = analysisCache.keys().next().value;
      if (oldestKey !== undefined) analysisCache.delete(oldestKey);
    }
    analysisCache.set(cacheKey, { sha: headSha, result: analysis });

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