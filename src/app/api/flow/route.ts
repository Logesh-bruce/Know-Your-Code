import { NextRequest, NextResponse } from "next/server";
import { getCachedFiles } from "@/services/analysisCache";
import { getCachedFileContent } from "@/services/fileContentCache";
import {
  classifyGithubError,
  parseRepoUrl,
} from "@/services/githubService";
import { extractFileImports } from "@/services/importParser";
import type { FlowData, FlowEdge } from "@/types/flow";

const SOURCE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
]);

const EXCLUDED_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".next", "out",
  "coverage", "vendor", ".agents", ".github", "public",
]);

const MAX_SOURCE_FILES = 80;
const CONCURRENCY = 6;

function fileExtension(path: string): string {
  const base = path.split("/").pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot).toLowerCase() : "";
}

function isExcluded(path: string): boolean {
  return path.split("/").some((part) => EXCLUDED_DIRS.has(part));
}

function isSourceFile(path: string): boolean {
  return SOURCE_EXTENSIONS.has(fileExtension(path)) && !isExcluded(path);
}

function sourcePriority(path: string): number {
  if (/(^|\/)(src|lib|app|pages|components|server|api|core|handlers?)\//.test(path)) {
    return 2;
  }
  if (path.split("/").length === 1) return 1;
  return 0;
}

async function runConcurrent<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (true) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      results[index] = await fn(items[index]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  );
  return results;
}

/** Leaves (files with no imports) first, entry points last. */
function computeExplorationOrder(nodes: string[], edges: FlowEdge[]): string[] {
  const outgoing = new Map(nodes.map((n) => [n, [] as string[]]));
  const incoming = new Map(nodes.map((n) => [n, [] as string[]]));
  for (const edge of edges) {
    if (!outgoing.has(edge.source) || !outgoing.has(edge.target)) continue;
    outgoing.get(edge.source)!.push(edge.target);
    incoming.get(edge.target)!.push(edge.source);
  }
  const remaining = new Map(nodes.map((n) => [n, outgoing.get(n)!.length]));
  const queue = nodes.filter((n) => remaining.get(n) === 0);
  const order: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    order.push(node);
    for (const importer of incoming.get(node)!) {
      const left = (remaining.get(importer) ?? 0) - 1;
      remaining.set(importer, left);
      if (left === 0) queue.push(importer);
    }
  }
  for (const node of nodes) {
    if (!order.includes(node)) order.push(node);
  }
  return order;
}

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

    const files = getCachedFiles(repoId);
    if (!files) {
      return NextResponse.json(
        {
          error:
            "Analyze this repository first, then open Code Flow to see its file relationships.",
          needsAnalysis: true,
        },
        { status: 422 }
      );
    }

    const ref = parseRepoUrl(repoId);
    const sourceFiles = files
      .filter((f) => f.type === "file")
      .map((f) => f.path)
      .filter(isSourceFile)
      .sort((a, b) => sourcePriority(b) - sourcePriority(a))
      .slice(0, MAX_SOURCE_FILES);

    const known = new Set(sourceFiles);
    const parsed = await runConcurrent(sourceFiles, CONCURRENCY, async (path) => {
      const content = await getCachedFileContent(ref, path);
      if (content === null) return null;
      return { path, imports: extractFileImports(content, path, known) };
    });

    const importsByFile = new Map<string, string[]>();
    for (const entry of parsed) {
      if (entry) importsByFile.set(entry.path, entry.imports);
    }

    const nodes = [...importsByFile.keys()];
    const edges: FlowEdge[] = [];
    for (const [source, targets] of importsByFile) {
      for (const target of targets) {
        edges.push({ source, target });
      }
    }

    const data: FlowData = {
      nodes,
      edges,
      order: computeExplorationOrder(nodes, edges),
    };
    return NextResponse.json(data);
  } catch (err) {
    const { message, status } = classifyGithubError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
