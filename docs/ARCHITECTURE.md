# KnowYourCode — Architecture

KnowYourCode is a Next.js 14 (App Router) application written in TypeScript.
It is a **stateless** MVP: nothing is stored in a database. Every request
fetches what it needs from the GitHub API and (optionally) the Claude API, so
the whole product runs on API routes plus static frontend pages.

## High-level flow

```
Entrance page → POST /api/analyze → Dashboard
                                      ├─ Explain  → POST /api/explain
                                      ├─ Test     → POST /api/quiz
                                      └─ Interview→ POST /api/interview
```

1. The user pastes a GitHub URL on the entrance page.
2. `POST /api/analyze` fetches the repository metadata and file tree from
   GitHub and returns a `RepoAnalysis`.
3. The client stores the analysis in React state and passes `repo.id`
   (which is `owner/repo`) to the other endpoints. The dashboard never needs
   to keep the analysis server-side.

## Repository layout

```
src/
  app/                    Next.js App Router
    page.tsx              Entrance page (left column + ProductDemo)
    dashboard/page.tsx    Dashboard (sidebar, summary, tabs)
    api/
      analyze/route.ts    Repo analysis
      explain/route.ts    File explanation
      quiz/route.ts       Knowledge test generation
      interview/route.ts  Interviewer turn
  components/             Reusable UI components
    ProductDemo.tsx       Looping 6-scene product simulation
    ExplainView.tsx       Split code/explanation view
    QuizView.tsx          Quiz interface + results
    InterviewView.tsx     Chat interface + summary
    ...                  Button, Input, Card, Tabs, ProgressBar, ChatBubble,
                          CodeBlock, FileTree, RepoSummary
  hooks/                  Client-side data hooks
    useRepoAnalysis.ts    /api/analyze
    useCodeExplanation.ts /api/explain
    useInterview.ts       /api/interview state machine
  services/               Server-only logic
    githubService.ts      Octokit + parsing, tech-stack detection, line counts
    llmService.ts         Claude calls + deterministic fallback engine
  types/                  Shared TypeScript contracts
  utils/                  api.ts (fetch helper), formatting.ts (file tree),
                          validation.ts (GitHub URL validation)
  styles/                 CSS variables (design system) + globals
```

## Data contracts

Types live in `src/types/` and are shared by the client, the API routes, and
the services:

- `repo.ts` — `RepoAnalysis`, `RepoFile`, `FileTreeNode`
- `code.ts` — `CodeExplanation`
- `quiz.ts` — `QuizQuestion`
- `interview.ts` — `InterviewMessage`, `InterviewReply`

The response of `/api/analyze` includes `id: owner/repo`. Because
`parseRepoUrl` accepts `owner/repo` shorthand, every subsequent endpoint can
resolve the repository without any stored state.

## GitHub integration (`githubService.ts`)

Uses [Octokit](https://github.com/octokit/octokit.js).

- `parseRepoUrl` — normalizes a URL or `owner/repo` into `{ owner, repo }`.
- `getRepoMetadata` — name, description, default branch, language.
- `listRepoFiles` — recursive `git trees` listing → flat `RepoFile[]`.
- `selectRepresentativeFiles` — scores files (`src/`, `lib/`, `index`,
  known source extensions) and picks the top N for context-heavy features.
- `detectTechStack` / `detectPrimaryLanguage` — extension counts plus
  `package.json` dependency inspection.
- `estimateLineCount` — samples up to 40 text files and scales the average to
  the whole repository.

## AI integration (`llmService.ts`)

Every AI feature has the same shape:

```
calls Claude via the Messages API  →  parse JSON  →  sanitize
        │                                    │
        └────────  no key / failure ─────────┘
                     deterministic fallback
```

- `explainCode` — plain-English summary, key functions, related files,
  optional deep dive. Fallback parses functions/comments/imports locally.
- `generateQuiz` — 6–8 multiple-choice questions. Fallback builds questions
  from the locally extracted functions of the sampled files.
- `interviewReply` — conversational follow-ups with a `0–10` confidence
  score. Fallback scores answer depth against a technical keyword list and
  cycles through interview topics.

The `CLAUDE_API_KEY` is only ever read server-side, inside the API routes.

## Styling

Two stylesheets are imported in `src/app/layout.tsx`:

- `variables.css` — the design system: colors (dark default + light override
  via `html[data-theme="light"]`), typography, spacing, radii, motion.
- `globals.css` — Tailwind directives, base element styles, keyframes.

Tailwind's theme maps its color tokens to the CSS variables (see
`tailwind.config.ts`), so a single theme toggle re-themes the entire app.

## Design decisions

- **No database.** Analyses are ephemeral. Persistence (PostgreSQL) can be
  added later without changing the client contract.
- **Stateless endpoints.** `repoId` carries all repository identity, avoiding
  an in-memory cache that would break on serverless deployments.
- **Fallback engine.** The app is fully usable without API keys, which makes
  local development and CI reliable and keeps the demo self-sufficient.
- **Self-contained demo.** `ProductDemo.tsx` loops six scenes
  (URL → analysis → file tree → explanation → quiz → interview) inside a fixed
  aspect-ratio panel. It can be replaced with a recorded product video without
  touching the page layout.

## Security notes

- Secrets live only in `.env` (gitignored). `.env.example` is committed.
- Only public repositories are analyzed by default; a scoped `GITHUB_TOKEN`
  unlocks private ones.
- The frontend never sees `CLAUDE_API_KEY` or `GITHUB_TOKEN` — all calls go
  through server API routes.
