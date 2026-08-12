import type { CodeExplanation, CodeFunction } from "@/types/code";
import type { QuizQuestion } from "@/types/quiz";
import type { InterviewReply } from "@/types/interview";

/* ---------------------------------------------------------------------------
 * AI provider layer
 *
 * Feature -> provider/key mapping:
 *   Explain Code  -> Groq   (GROQ_API_KEY_1)
 *   Project Flow  -> Groq   (GROQ_API_KEY_2, reserved - Code Flow is static,
 *                            it does not make an AI request)
 *   Test Code     -> Groq   (GROQ_API_KEY_3)
 *   Interview     -> Gemini (GEMINI_API_KEY)
 * ------------------------------------------------------------------------- */

const PROVIDER_TIMEOUT_MS = 40_000;

const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

function groqModel(): string {
  return process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL;
}

function geminiModel(): string {
  return process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Groq chat completions (OpenAI-compatible endpoint). */
async function callGroq(
  apiKey: string,
  system: string,
  userContent: string,
  maxTokens = 2000
): Promise<string> {
  const response = await fetchWithTimeout(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: groqModel(),
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userContent },
        ],
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Groq API error (${response.status})`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) throw new Error("Empty response from Groq API");
  return text;
}

/** Google Gemini generateContent. */
async function callGemini(
  apiKey: string,
  system: string,
  userContent: string,
  maxTokens = 2000
): Promise<string> {
  const model = geminiModel();
  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: userContent }] }],
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini API error (${response.status})`);
  }

  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();
  if (!text) throw new Error("Empty response from Gemini API");
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
their project. Your job is to make a developer who is minutes away from an
interview and has forgotten the details of their OWN code actually understand it
well enough to explain it naturally and defend it in an interview. Never invent
project details, runtime behavior, or design decisions that cannot be verified
from the code you are given. The goal is to help the developer understand their
code, not to fabricate a convincing story about it.

Respond with JSON only (no markdown) matching this exact shape:
{
  "summary": "WHAT THIS CODE DOES: one tight, clear paragraph on the PURPOSE of the file in plain English",
  "functions": [
    {
      "name": "functionName",
      "description": "What this function actually does when the application runs it: what triggers it, what it does step by step, what it returns, and what happens on failure",
      "params": ["paramName: type"],
      "returns": "What it returns"
    }
  ],
  "relatedFiles": ["relative/paths/of/files/it/depends/on"],
  "deepDive": "HOW IT WORKS, then WHY IT WAS BUILT THIS WAY, then IF THEY ASK ME TO GO DEEPER"
}

The response must cover exactly these four sections, mapped to the JSON fields:

1. WHAT THIS CODE DOES - written into "summary".
Explain the PURPOSE of the code in one tight paragraph: what problem it solves
in the application and what role it plays, using the visible project context
when available. Start with simple English, as if explaining to an interviewer
who may not know the technical details yet. Do NOT write an inventory of the
file ("This code contains 4 imports", "This line declares a variable"). Explain
what the code actually accomplishes. If the exact project-specific usage is not
visible, explain the clear technical purpose without inventing a
project-specific role.
Identify the kind of code from what is visible and name its role: for an API
route, which endpoint it serves and what it is for; for a component, what part
of the UI it renders; for a service, what task it performs for the rest of the
project.

2. HOW IT WORKS - written into the "functions" descriptions and the first part
of "deepDive".
Walk through each IMPORTANT part of the code and explain its BEHAVIOR, not its
existence: what it means, what it actually does, why it is needed here, and what
happens when the application uses or executes it. Connect each part to the
surrounding code. Group related lines that work together into one concept
instead of mechanically explaining every line.

Trace the flow of the code, never just its existence:
- First recognize what kind of code the file is (API route, component, service,
  hook, utility, config, etc.) and explain it as that kind of code actually
  runs.
- For an API route or request handler, walk the full lifecycle of a request:
  what triggers it, what validation and checks run first, what data is read or
  changed, what response is returned, and what happens when something fails.
- Explain each important call and check in behavior terms: what a client setup
  does and why it is created here, what an auth or session call returns and what
  the user/session check is protecting, what a permission or role check is
  guarding, what happens to every value that is read or updated (for example,
  plan and plan_expires_at fields), and what error is returned if validation,
  authentication, or the data update fails.
- Never describe a function as merely "defining" or "containing" behavior; say
  what actually happens when it runs.

3. WHY IT WAS BUILT THIS WAY - written into "deepDive".
Explain the likely technical reasoning behind the design: why this framework,
library, or pattern was used, what problem the structure avoids, what benefit it
gives, and what trade-off it introduces. If the actual reason is visible in the
code, state it as a fact. If it is not visible, give a reasonable technical
inference and clearly label it as an inference. Never present an inferred
project decision as something the developer definitely did or intended.

4. IF THEY ASK ME TO GO DEEPER - written into "deepDive".
Anticipate 2-3 follow-up questions an interviewer could ask about THIS exact
piece of code. For each, write the likely question and a short 1-2 sentence
answer the developer could actually say in an interview. Cover different types:
(a) one edge case or failure scenario, (b) one "why this and not X?" design
question, (c) one question about performance, scaling, or what happens if
something fails. Base the answers on the actual code and established technical
knowledge; do not invent project-specific behavior.

In "deepDive", write the three sections in order, each starting on its own line
with the heading "HOW IT WORKS", "WHY IT WAS BUILT THIS WAY", and
"IF THEY ASK ME TO GO DEEPER", so that together with the summary the full output
reads as exactly four sections and nothing more.

Explain behavior, not existence:
- Never write a description like "Defines the POST behavior in this file." or
  "POST() handles the request." That describes the existence of a function, not
  what it does.
- Instead, for each important function, explain what happens in this specific
  code when it runs. For an API route this means the real flow: why the endpoint
  exists, what happens when it is called, what each client/auth call does, what
  each check is protecting, what happens to each value read or updated, how the
  request moves through the route, what response is returned, and what happens
  if authentication or validation fails.
- Good style for an admin update route: "This handler is the entry point for the
  admin user-update endpoint. When a request arrives, it validates the incoming
  body, checks that the caller is a signed-in admin, then updates the user's
  plan fields in the database and returns a confirmation response - or an error
  if the session, the admin role, or the validation fails."
- The explanation must teach the developer what the code does, why it is written
  this way, and how the pieces work together.

Language and teaching style:
- Use simple, natural, clean English, like a senior developer sitting beside a
  junior developer and explaining the code clearly. Easy for a student to
  understand and easy to say aloud in an interview.
- Do NOT sound like documentation, an academic textbook, a static code analyzer,
  or a formal technical report.
- Use natural phrasing: "This is used here because...", "Basically, this
  allows...", "The reason for doing it this way is...", "When the application
  uses this...", "Here, the framework is doing the work automatically...".
- Keep real technical terms, but explain each one immediately in simple English.
  For example: "Spring Data JPA uses query derivation here. That simply means
  Spring reads the method name and builds the database query from it."
- Do not remove technical accuracy just to make the English simple.

Confidence rule - separate two categories of knowledge:
- GENERAL TECHNICAL KNOWLEDGE (established behavior of programming languages,
  frameworks, libraries, standard APIs, documented patterns, annotations,
  database behavior, React hooks, Spring Data JPA, async/await, Express routing,
  collections, and similar well-known concepts): explain with FULL confidence.
  For example, if the code extends JpaRepository, confidently explain that
  Spring Data JPA provides the repository implementation and standard
  persistence operations automatically; if a method name derives a query,
  explain how that derivation works. Do not hedge just because the whole project
  is not visible.
- THIS PROJECT'S SPECIFIC BEHAVIOR (exactly which class calls this code, the
  real values passed at runtime, the exact user flow, the business reason behind
  a decision, what happens in a file that is not visible, whether a feature is
  used at runtime): only be cautious here. If the visible code proves the
  connection, state it directly. If it does not prove it, do not fabricate it.
  You may note that the exact project-specific behavior is not visible, but only
  when that information is genuinely needed. Never let uncertainty about
  project-specific behavior prevent you from explaining well-known technical
  behavior.

Project context and usage:
- Always use the available project context to understand where the selected code
  fits. If another visible class, service, controller, component, or function
  uses this code, explain that real connection and what happens in the project
  flow when it is used.
- If the selected code is not used anywhere in the visible project context, say
  that simply and naturally, then still explain what the code technically does,
  why the construct is useful, what the framework or language does automatically,
  and what would happen when the code is used. Not seeing a usage does not mean
  the code cannot be explained; only the unknown project-specific part should
  remain unknown. Do not invent a caller or business purpose.
- Do not repeatedly say "cannot be determined from the provided context". Only
  say something is unknown when it is genuinely project-specific and necessary
  to mention.

Behavior over inventory:
- Always explain WHAT THE CODE MAKES HAPPEN, not WHAT THE CODE CONTAINS. Do not
  list imports, classes, or variables; explain what they accomplish. Do not say
  "The class has a constructor"; say "The constructor receives the required
  dependency so the class can use that service when it handles the request."

No generic filler:
- Keep the explanation proportional to the complexity of the code. Simple code
  gets a short explanation; complex code goes deeper. Do not repeat the same
  explanation in multiple sections, and do not explain obvious syntax just to
  add length.

Interview-ready but honest:
- Be confident when discussing established technical behavior, but NEVER
  encourage the developer to claim they personally made a decision, implemented
  a feature, or observed runtime behavior when the available project context
  does not support it. The goal is to help the developer understand and defend
  their code, not to make up a story about it.

Rules:
- List the most important functions, up to 6.
- Every function description must explain what actually happens when the
  function runs (the flow, its checks, its data changes, its response, and its
  failure paths), never just that the function exists or is "defined" in the
  file.
- Keep explanations plain-English, no marketing language.
- relatedFiles should derive from imports/requires where visible.
- Use the generic parameter types you can infer (string, number, object, etc.).
- If a file is very small, return an empty functions array.

Final quality check before responding:
1. Did I explain the PURPOSE instead of listing the code?
2. Did I explain what the important code actually DOES when the application runs
   it - the flow, the checks, the data changes, and the failure paths - instead
   of just stating that it exists?
3. Did I explain WHY the design makes sense, labeling any inferences?
4. Did I use the visible project context and avoid inventing callers, runtime
   values, or design decisions?
5. Is the English simple, natural, and technically accurate?
If any answer is no, improve the explanation before returning it.`;

export async function explainCode(
  code: string,
  fileName: string,
  repoName: string
): Promise<CodeExplanation> {
  if (!process.env.GROQ_API_KEY_1) {
    return localExplainCode(code, fileName, repoName);
  }

  try {
    console.log("[KnowYourCode] Explain Code -> Groq 1");
    const text = await callGroq(
      process.env.GROQ_API_KEY_1,
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

  const selected = shuffle(topics).slice(0, 8);
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
  if (!process.env.GROQ_API_KEY_3) return localGenerateQuiz(snippets);

  try {
    console.log("[KnowYourCode] Test Code -> Groq 3");
    const text = await callGroq(
      process.env.GROQ_API_KEY_3,
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

/* ---------------------------------------------------------------------------
 * Interview Practice
 * ------------------------------------------------------------------------- */

export interface InterviewContext {
  name: string;
  description: string;
  files: string[];
}

export interface InterviewTurn {
  role: "ai" | "user";
  text: string;
}

const INTERVIEW_SYSTEM = `You are a senior engineering interviewer at a company that
hired this candidate to own their own project. The candidate built the
repository described below. Interview them conversationally so they can prove
they actually understand their code.

Context about the repository:
- Name: __NAME__
- Description: __DESCRIPTION__
- File layout (sample):
__FILES__

Guidelines:
- Ask one focused question at a time. Follow up on what they just said.
- Mix technical questions (architecture, data flow, auth, error handling,
  testing, deployment) with one behavioral question at the end.
- Do not restate the candidate's answer; build on it.
- Be warm but direct, like a real interviewer.

Respond with JSON only (no markdown) matching this exact shape:
{
  "reply": "Your next question or follow-up",
  "confidenceScore": 7,
  "feedback": "Brief feedback on the candidate's last answer - what was clear and what to go deeper on."
}

Rules:
- confidenceScore is 0-10. Start at 0 for the opening question (the candidate
  has not answered yet).
- For later turns, score the depth, specificity (names real files/functions),
  and clarity of the candidate's answer.
- feedback must be concrete and tied to their last message.`;

function buildInterviewPrompt(
  context: InterviewContext,
  history: InterviewTurn[],
  message: string
): string {
  const filesList =
    context.files.slice(0, 30).map((f) => `  - ${f}`).join("\n") || "  (none)";

  const transcript = history
    .map((turn) => `${turn.role === "ai" ? "Interviewer" : "Candidate"}: ${turn.text}`)
    .join("\n\n");

  return `${transcript ? `\n\nConversation so far:\n${transcript}` : ""}
\nCandidate's latest answer:\n${message || "(opening - no answer yet)"}`;
}

function sanitizeConfidence(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return 0;
  return Math.min(10, Math.max(0, Math.round(num * 10) / 10));
}

function sanitizeReply(parsed: unknown): InterviewReply {
  const obj =
    parsed && typeof parsed === "object"
      ? (parsed as Partial<InterviewReply>)
      : {};
  return {
    reply:
      typeof obj.reply === "string" && obj.reply.trim()
        ? obj.reply.trim()
        : "Let's keep going. Can you go into more detail on that?",
    confidenceScore: sanitizeConfidence(obj.confidenceScore),
    feedback: typeof obj.feedback === "string" ? obj.feedback : "",
  };
}

const TECH_KEYWORDS = [
  "react", "node", "express", "api", "database", "sql", "postgres",
  "mongodb", "auth", "authentication", "docker", "typescript", "component",
  "endpoint", "route", "model", "schema", "cache", "redis", "test", "jest",
  "deploy", "vercel", "graphql", "rest", "state", "props", "middleware",
];

const FOLLOW_UP_QUESTIONS = [
  "Can you walk me through the data flow between the frontend and the backend?",
  "How does authentication work in this project?",
  "What error-handling patterns do you use, and where could they be improved?",
  "How would you test the most important part of this codebase?",
  "Walk me through how you would deploy this project, and why you chose that approach.",
  "If this project had to scale to 10x its current users, what would you change first?",
  "Tell me about a difficult problem you solved while building this project.",
];

function scoreConfidence(text: string): number {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return 0;

  let score = 4.5;
  if (text.length > 120) score += 1;
  if (text.length > 280) score += 0.5;

  const mentions = TECH_KEYWORDS.filter((keyword) =>
    new RegExp(`\\b${keyword}`, "i").test(normalized)
  ).length;
  score += Math.min(2, mentions * 0.4);

  if (/\berror\b/.test(normalized)) score += 0.5;
  if (/\b(testing|test|scale|scalab|deploy|performance)\b/.test(normalized)) {
    score += 0.5;
  }
  if (/\b(index\.|\.tsx?|\.jsx?|\.py|components\/|src\/|routes)\b/.test(normalized)) {
    score += 0.5;
  }

  return Math.min(9.5, Math.max(0, Math.round(score * 10) / 10));
}

function buildFeedback(message: string, confidence: number): string {
  const mentionsFiles =
    /\.(ts|tsx|js|jsx|py|go|rs)\b|components\/|src\/|routes\//i.test(message);
  if (confidence >= 7) {
    return "Clear and detailed. If you mention specific files and trade-offs by name, this will land even harder.";
  }
  if (confidence >= 5) {
    return "Solid answer with good coverage. Naming the exact functions and files involved would add more depth.";
  }
  return "Good start, but the answer stayed general. Point to the actual components, functions, and files in this repo to show ownership.";
}

function localInterviewReply(
  context: InterviewContext,
  message: string,
  history: InterviewTurn[]
): InterviewReply {
  if (!message.trim()) {
    const description = context.description
      ? `The project is described as: ${context.description}`
      : "There is no description on this repository.";
    return {
      reply: `Great - let's get started. Walk me through the architecture of ${context.name}. How is the code organized, and how do the main pieces fit together? (${description})`,
      confidenceScore: 0,
      feedback: "",
    };
  }

  const confidenceScore = scoreConfidence(message);
  const answered = history.filter((turn) => turn.role === "user").length;
  const question = FOLLOW_UP_QUESTIONS[answered % FOLLOW_UP_QUESTIONS.length];

  return {
    reply: `Good. ${question}`,
    confidenceScore,
    feedback: buildFeedback(message, confidenceScore),
  };
}

export async function interviewReply(
  context: InterviewContext,
  message: string,
  history: InterviewTurn[]
): Promise<InterviewReply> {
  if (!process.env.GEMINI_API_KEY) {
    return localInterviewReply(context, message, history);
  }

  try {
    console.log("[KnowYourCode] Interview -> Gemini");
    const system = INTERVIEW_SYSTEM.replace("__NAME__", context.name)
      .replace("__DESCRIPTION__", context.description || "(no description)")
      .replace(
        "__FILES__",
        context.files.slice(0, 30).map((f) => `  - ${f}`).join("\n") || "  (none)"
      );
    const prompt = buildInterviewPrompt(context, history, message);
    const text = await callGemini(
      process.env.GEMINI_API_KEY,
      system,
      prompt,
      1500
    );
    const parsed = extractJson(text);
    const reply = sanitizeReply(parsed);
    if (reply.confidenceScore === 0 && message.trim() && reply.reply) {
      reply.confidenceScore = scoreConfidence(message);
    }
    return reply;
  } catch {
    return localInterviewReply(context, message, history);
  }
}