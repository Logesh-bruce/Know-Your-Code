/* Lightweight static import extraction for JS/TS source files.
 * This is deliberately simple: it regex-extracts module specifiers and only
 * links relative imports that resolve to files actually present in the repo.
 * It does NOT attempt full AST parsing, so it may miss exotic cases — those
 * files are skipped rather than breaking the graph. */

const SPECIFIER_RE =
  /(?:^|\s)(?:import|export)\b[^\n]*?from\s*["']([^"']+)["']|^\s*import\s*["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)|\brequire\s*\(\s*["']([^"']+)["']\s*\)/gm;

function stripComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ");
}

export function extractImportSpecifiers(code: string): string[] {
  const cleaned = stripComments(code);
  const specs: string[] = [];
  SPECIFIER_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SPECIFIER_RE.exec(cleaned)) !== null) {
    const specifier = match[1] ?? match[2] ?? match[3] ?? match[4];
    if (specifier) specs.push(specifier);
  }
  return [...new Set(specs)];
}

/** Candidate base paths for a specifier. Handles:
 *  - relative specifiers ("./x", "../x") resolved against the importer
 *  - the common "@/" path alias, resolved against the repo root and against
 *    "src/" (the conventional mapping used by most Next.js/tsconfig setups)
 *  Package specifiers and anything unresolvable return no bases. */
function specifierBases(
  importerPath: string,
  specifier: string
): string[] {
  if (specifier.startsWith(".")) {
    const importerSegments = importerPath.split("/");
    importerSegments.pop();
    const segments = importerSegments.filter(Boolean);
    for (const part of specifier.split("/")) {
      if (part === "." || part === "") continue;
      if (part === "..") segments.pop();
      else segments.push(part);
    }
    return [segments.join("/")];
  }

  if (specifier.startsWith("@/")) {
    const rest = specifier.slice(2);
    return [`${rest}`, `src/${rest}`];
  }

  return [];
}

/** Resolves a module specifier to a path that exists in the repo's known file
 *  set. Returns null for package imports and anything that cannot be resolved
 *  to a known file, so only real in-repo relationships become edges. */
export function resolveRelativeImport(
  importerPath: string,
  specifier: string,
  knownFiles: Set<string>
): string | null {
  const bases = specifierBases(importerPath, specifier);
  for (const base of bases) {
    const candidates = [
      base,
      `${base}.ts`,
      `${base}.tsx`,
      `${base}.js`,
      `${base}.jsx`,
      `${base}.mjs`,
      `${base}.cjs`,
      `${base}/index.ts`,
      `${base}/index.tsx`,
      `${base}/index.js`,
      `${base}/index.jsx`,
    ];
    for (const candidate of candidates) {
      if (knownFiles.has(candidate)) return candidate;
    }
  }
  return null;
}

/** All resolved relative imports for one file, deduplicated. */
export function extractFileImports(
  code: string,
  filePath: string,
  knownFiles: Set<string>
): string[] {
  const resolved: string[] = [];
  for (const specifier of extractImportSpecifiers(code)) {
    const target = resolveRelativeImport(filePath, specifier, knownFiles);
    if (target && target !== filePath) resolved.push(target);
  }
  return [...new Set(resolved)];
}
