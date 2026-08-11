import type { CodeExplanation, CodeFunction } from "@/types/code";
import type { QuizQuestion } from "@/types/quiz";

const DEFAULT_MODEL = "claude-3-5-haiku-latest";

function claudeModel(): string {
  return process.env.CLAUDE_MODEL || DEFAULT_MODEL;
}

async function callClaude(
  system: string,
  userContent: string,
  maxTokens = 2000
): Promise<string> {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    throw new Error("CLAUDE_API_KEY is not set");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: claudeModel(),
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error (${response.status})`);
  }

  const data = (await response.json()) as { content?: { text?: string }[] };
  const text = data.content?.[0]?.text?.trim() ?? "";
  if (!text) throw new Error("Empty response from Claude API");
  return text;
}

export function extractJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("No JSON found in model response");
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

/* ---------------------------------------------------------------------------
 * Explain Code
 * ------------------------------------------------------------------------- */

const EXPLAIN_SYSTEM = `You are KnowYourCode, a tool that helps developers prove they
understand their own codebases. The user gives you a single source file from
their project. Explain it plainly so a junior developer can describe it in an
interview.

Respond with JSON only (no markdown) matching this exact shape:
{
  "summary": "2-3 sentences: what this file does in plain English",
  "functions": [
    {
      "name": "functionName",
      "description": "1-2 sentences describing what it does",
      "params": ["paramName: type"],
      "returns": "What it returns"
    }
  ],
  "relatedFiles": ["relative/paths/of/files/it/depends/on"],
  "deepDive": "Optional 2-3 sentences of implementation detail"
}

Rules:
- List the most important functions, up to 6.
- Keep explanations plain-English, no marketing language.
- relatedFiles should derive from imports/requires where visible.
- Use the generic parameter types you can infer (string, number, object, etc.).
- If a file is very small, return an empty functions array.`;

export async function explainCode(
  code: string,
  fileName: string,
  repoName: string
): Promise<CodeExplanation> {
  if (!process.env.CLAUDE_API_KEY) {
    return localExplainCode(code, fileName, repoName);
  }

  try {
    const text = await callClaude(
      EXPLAIN_SYSTEM,
      `Repository: ${repoName}\nFile: ${fileName}\n\n\`\`\`\n${code.slice(0, 12000)}\n\`\`\``,
      2000
    );
    const parsed = extractJson(text) as Partial<CodeExplanation>;
    return sanitizeExplanation(parsed, fileName, repoName);
  } catch {
    return localExplainCode(code, fileName, repoName);
  }
}

function sanitizeExplanation(
  parsed: Partial<CodeExplanation>,
  fileName: string,
  repoName: string
): CodeExplanation {
  return {
    file: fileName,
    summary:
      typeof parsed.summary === "string" && parsed.summary.trim()
        ? parsed.summary.trim()
        : localExplainCode(fileName, fileName, repoName).summary,
    functions: Array.isArray(parsed.functions)
      ? parsed.functions
          .filter((fn): fn is CodeFunction => Boolean(fn?.name))
          .map((fn) => ({
            name: fn.name,
            description:
              typeof fn.description === "string" ? fn.description : "",
            params: Array.isArray(fn.params) ? fn.params : [],
            returns: typeof fn.returns === "string" ? fn.returns : "",
          }))
      : [],
    relatedFiles: Array.isArray(parsed.relatedFiles)
      ? parsed.relatedFiles.filter((f): f is string => typeof f === "string")
      : [],
    deepDive: typeof parsed.deepDive === "string" ? parsed.deepDive : undefined,
  };
}

/* --- Deterministic fallback (no API key required) --- */

const FN_PATTERNS = [
  /(?:(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\))/g,
  /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/g,
  /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?function\s*\(([^)]*)\)/g,
];

function returnsType(code: string, searchFrom: number): string {
  const open = code.indexOf("{", searchFrom);
  if (open === -1) return "unknown";
  let depth = 0;
  let body = "";
  for (let i = open; i < code.length; i++) {
    const ch = code[i];
    body += ch;
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  return /await\b/.test(body) ? "Promise<unknown>" : "unknown";
}

function extractFunctions(code: string): CodeFunction[] {
  const functions: CodeFunction[] = [];
  const lines = code.split("\n");

  for (const pattern of FN_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(code)) !== null) {
      const name = match[1];
      const params = (match[2] ?? "")
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);

      const lineIndex = code.slice(0, match.index).split("\n").length - 1;
      let description = `Defines the ${name} behavior in this file.`;
      if (lineIndex > 0) {
        const prev = lines[lineIndex - 1]?.trim() ?? "";
        if (prev.startsWith("//")) {
          description = prev.replace(/^\/\/\s*/, "").trim();
        }
      }

      functions.push({
        name,
        description,
        params: params.map((p) => {
          const [pName, ...type] = p.split(":");
          return `${pName.trim()}: ${type.join(":").trim() || "unknown"}`;
        }),
        returns: returnsType(code, match.index + match[0].length),
      });
    }
  }

  return functions.slice(0, 6);
}

function extractLeadingComment(code: string): string {
  const lines = code.split("\n");
  const comments: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("//")) {
      comments.push(line.replace(/^\/\/\s*/, "").trim());
      continue;
    }
    if (line.startsWith("*")) {
      comments.push(line.replace(/^\*\s*/, "").trim());
      continue;
    }
    if (line.startsWith("/*")) {
      comments.push(line.replace(/^\/\*\s*/, "").replace(/\*\/$/, "").trim());
      continue;
    }
    if (line.startsWith("* /") || line === "*/") break;
    if (comments.length === 0 || line.startsWith("import") || line.startsWith("require")) {
      continue;
    }
    break;
  }
  return comments.filter(Boolean).join(". ");
}

function extractRelatedFiles(code: string): string[] {
  const related = new Set<string>();
  const importRe = /from\s+["']([^"']+)["']|require\(["']([^"']+)["']\)/g;
  let match: RegExpExecArray | null;
  while ((match = importRe.exec(code)) !== null) {
    const specifier = match[1] ?? match[2];
    if (!specifier) continue;
    if (
      !specifier.startsWith(".") &&
      !specifier.startsWith("/")
    ) {
      continue;
    }
    related.add(specifier.replace(/\.(js|jsx|ts|tsx)$/, ""));
  }
  return [...related];
}

function localExplainCode(
  code: string,
  fileName: string,
  repoName: string
): CodeExplanation {
  const functions = extractFunctions(code);
  const relatedFiles = extractRelatedFiles(code);
  const commentSummary = extractLeadingComment(code);
  const summary = commentSummary
    ? `${commentSummary}`
    : functions.length > 0
      ? `${fileName} in ${repoName} defines ${
          functions.length === 1
            ? `the function ${functions[0].name}()`
            : `${functions.length} functions including ${functions[0].name}()`
        }. Use the function breakdown below to describe its responsibilities.`
      : `${fileName} in ${repoName} is a small file with no top-level functions detected. Review the source to describe what it contributes to the project.`;

  return {
    file: fileName,
    summary,
    functions,
    relatedFiles,
    deepDive: undefined,
  };
}

/* ---------------------------------------------------------------------------
 * Knowledge Test
 * ------------------------------------------------------------------------- */

export interface FileSnippet {
  file: string;
  code: string;
}

const QUIZ_SYSTEM = `You are KnowYourCode, a tool that helps developers prove they
understand their own codebases. You generate multiple-choice knowledge tests
based on real source files.

The user gives you a set of files from one repository. Create 6-8 questions
that test genuine understanding of the code — what functions do, how the code
connects, data flow, error handling — not trivia.

Respond with JSON only (no markdown) matching this exact shape:
{
  "questions": [
    {
      "question": "Question text",
      "options": ["A) option", "B) option", "C) option", "D) option"],
      "correctAnswer": "A",
      "explanation": "1-2 sentences explaining why the answer is correct"
    }
  ]
}

Rules:
- Exactly 4 options per question, lettered A-D inside the option strings.
- Only one correct answer; distractors should be plausible but clearly wrong.
- Base questions on the provided code. Vary topics across files.`;

function buildQuizContext(snippets: FileSnippet[]): string {
  return snippets
    .map(
      (s) =>
        `### File: ${s.file}\n\`\`\`\n${s.code.slice(0, 8000)}\n\`\`\``
    )
    .join("\n\n");
}

function sanitizeQuestions(parsed: unknown): QuizQuestion[] {
  if (!parsed || typeof parsed !== "object") return [];
  const list = (parsed as { questions?: unknown }).questions;
  if (!Array.isArray(list)) return [];

  const questions: QuizQuestion[] = [];
  for (const raw of list) {
    const item = raw as Partial<QuizQuestion>;
    if (
      typeof item.question !== "string" ||
      !Array.isArray(item.options) ||
      item.options.length < 4
    ) {
      continue;
    }
    const options = item.options.filter(
      (o): o is string => typeof o === "string"
    );
    const correctAnswer =
      typeof item.correctAnswer === "string"
        ? item.correctAnswer.charAt(0).toUpperCase()
        : "A";
    questions.push({
      id: `q${questions.length + 1}`,
      question: item.question,
      options,
      correctAnswer,
      explanation:
        typeof item.explanation === "string" ? item.explanation : "",
    });
  }
  return questions.slice(0, 10);
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const GENERIC_DISTRACTORS = [
  "Stores data in a local database",
  "Renders the user interface",
  "Validates user input",
  "Handles user authentication",
  "Parses and transforms configuration",
  "Sends automated notifications",
  "Manages routing between pages",
  "Handles background tasks",
  "Makes HTTP requests to an external service",
];

function localGenerateQuiz(snippets: FileSnippet[]): QuizQuestion[] {
  const topics: { label: string; detail: string }[] = [];

  for (const snippet of snippets) {
    const functions = extractFunctions(snippet.code);
    if (functions.length > 0) {
      for (const fn of functions.slice(0, 3)) {
        if (fn.description.trim()) {
          topics.push({
            label: `${fn.name}() in ${snippet.file}`,
            detail: fn.description,
          });
        }
      }
    } else {
      const summary = extractLeadingComment(snippet.code);
      if (summary) {
        topics.push({ label: snippet.file, detail: summary });
      }
    }
  }

  if (topics.length === 0) return [];

  const wrongPool = topics
    .map((t) => t.detail)
    .filter((d, i, arr) => arr.indexOf(d) === i);

  const selected = topics.slice(0, 8);
  return selected.map((topic, index) => {
    const wrong = shuffle(wrongPool).filter((d) => d !== topic.detail);
    for (const generic of shuffle(GENERIC_DISTRACTORS)) {
      if (wrong.length >= 3) break;
      if (!wrong.includes(generic) && generic !== topic.detail) {
        wrong.push(generic);
      }
    }
    const options = shuffle([topic.detail, ...wrong.slice(0, 3)]);
    const letters = ["A", "B", "C", "D"];
    return {
      id: `q${index + 1}`,
      question: `What is the purpose of ${topic.label}?`,
      options: options.map(
        (opt, i) => `${letters[i]}) ${opt}`
      ),
      correctAnswer: letters[options.indexOf(topic.detail)],
      explanation: `${topic.detail} — ${topic.label}.`,
    };
  });
}

export async function generateQuiz(
  snippets: FileSnippet[]
): Promise<QuizQuestion[]> {
  if (snippets.length === 0) return [];
  if (!process.env.CLAUDE_API_KEY) return localGenerateQuiz(snippets);

  try {
    const text = await callClaude(
      QUIZ_SYSTEM,
      buildQuizContext(snippets),
      3000
    );
    const parsed = extractJson(text);
    const questions = sanitizeQuestions(parsed);
    return questions.length > 0 ? questions : localGenerateQuiz(snippets);
  } catch {
    return localGenerateQuiz(snippets);
  }
}