import { NextRequest, NextResponse } from "next/server";
import type { RepoAnalysis } from "@/types/repo";
import {
  classifyGithubError,
  detectPrimaryLanguage,
  detectTechStack,
  estimateLineCount,
  fetchFileContent,
  getRepoHeadSha,
  getRepoMetadata,
  listRepoFiles,
  logGithubRateLimitOnce,
  parseRepoUrl,
} from "@/services/githubService";
import {
  getCachedAnalysis,
  setCachedAnalysis,
} from "@/services/analysisCache";

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
    const cached = getCachedAnalysis(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
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

    setCachedAnalysis(cacheKey, analysis.id, analysis);

    return NextResponse.json(analysis);
  } catch (err) {
    const { message, status } = classifyGithubError(err);
    return NextResponse.json({ error: message }, { status });
  }
}