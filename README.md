# KnowYourCode

A developer tool that analyzes GitHub repositories and helps developers prove they
understand their own code through AI-powered explanations, knowledge tests, and
interview practice.

**Core loop:** Understand your code → Test your knowledge → Prove you can explain it.

## Features

- **Repository Analysis** — paste a GitHub URL and get back the tech stack, file tree, and project summary.
- **Code Explanation** — select a file and get a plain-English explanation of what it does, its key functions, and how it connects to the project.
- **Knowledge Test** — an AI-generated multiple-choice quiz that checks whether you really understand the codebase.
- **Interview Practice** — chat with an AI interviewer about your project, with confidence scoring and feedback.

## Getting Started

Prerequisites: Node.js 18+ and npm.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

### Environment variables

Copy `.env.example` to `.env` and fill in your keys:

```bash
cp .env.example .env
```

| Variable       | Required | Description                                                              |
| -------------- | -------- | ------------------------------------------------------------------------ |
| `GITHUB_TOKEN` | Optional | GitHub personal access token for higher rate limits / private repos.     |
| `CLAUDE_API_KEY` | Optional | Anthropic API key used by the AI endpoints. Untitled without it.       |

> The app ships with deterministic, dependency-free fallbacks so it works without
> API keys in development. Add keys for richer AI responses.

## Scripts

| Command          | Description                        |
| ---------------- | ---------------------------------- |
| `npm run dev`    | Start the development server.      |
| `npm run build`  | Production build.                  |
| `npm start`      | Run the production build.          |
| `npm run lint`   | Run the linter.                    |
| `npm run typecheck` | Run TypeScript type checking.   |

## Tech Stack

- Next.js 14 (App Router), TypeScript
- Tailwind CSS
- Octokit (GitHub API client)
- Claude API (Anthropic) for AI-powered features

## Docs

- [API.md](docs/API.md) — API endpoint reference.
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — how the pieces fit together.
- [SETUP.md](docs/SETUP.md) — full setup and troubleshooting guide.

## License

MIT. See [LICENSE](LICENSE).