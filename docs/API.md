# KnowYourCode — API Reference

All endpoints are Next.js API routes under `/api`. They are `POST` only and
expect a JSON body with a `Content-Type: application/json` header.

Every endpoint returns errors as:

```json
{ "error": "Human-readable message" }
```

## Endpoints

| Endpoint          | Purpose                                   |
| ----------------- | ----------------------------------------- |
| `POST /api/analyze` | Analyze a GitHub repository               |
| `POST /api/explain` | Explain a single file in the repository   |
| `POST /api/quiz`    | Generate a multiple-choice knowledge test |
| `POST /api/interview` | Get the next interviewer turn            |

---

## `POST /api/analyze`

Analyzes a GitHub repository and returns its structure and summary.

**Request**

```json
{
  "repoUrl": "https://github.com/user/repo"
}
```

`repoUrl` may be a full URL (`https://github.com/user/repo`) or an
`owner/repo` shorthand.

**Response `200`**

```json
{
  "id": "user/repo",
  "name": "repo",
  "description": "A full-stack React app",
  "techStack": ["React", "Node.js", "PostgreSQL"],
  "fileCount": 47,
  "lineCount": 8342,
  "primaryLanguage": "JavaScript",
  "files": [
    { "path": "src/index.js", "type": "file" },
    { "path": "src/components", "type": "folder" }
  ]
}
```

**Errors**

- `400` — `repoUrl` is missing
- `404` — repository not found
- `429` — GitHub API rate limit exceeded (includes the reset time)
- `500` — GitHub API or other failure

> `id` is set to `owner/repo` and is used as the `repoId` for the other
> endpoints, so a client never needs to re-parse the URL.

---

## `POST /api/explain`

Generates a plain-English explanation for one file.

**Request**

```json
{
  "repoId": "user/repo",
  "filePath": "src/api.js"
}
```

**Response `200`**

```json
{
  "file": "src/api.js",
  "summary": "This file contains API helper functions for fetching and managing user data.",
  "functions": [
    {
      "name": "getUserData",
      "description": "Fetches user data from the API given a user ID",
      "params": ["id: string"],
      "returns": "Promise<User>"
    }
  ],
  "relatedFiles": ["server.js", "models/User.js"],
  "deepDive": "Optional extended explanation",
  "code": "const getUserData = async (id) => { ... }"
}
```

`code` is the fetched file source so the client can render it without a
second request. `deepDive` is optional.

**Errors**

- `400` — `repoId` or `filePath` is missing
- `404` — file could not be fetched from GitHub
- `429` — GitHub API rate limit exceeded (includes the reset time)
- `500` — analysis failure

---

## `POST /api/quiz`

Generates a knowledge test from the repository's most representative source
files (up to 8).

**Request**

```json
{ "repoId": "user/repo" }
```

**Response `200`**

```json
{
  "questions": [
    {
      "id": "q1",
      "question": "What is the purpose of getUserData()?",
      "options": ["A) Fetch user data", "B) Store user data", "C) Validate input", "D) Generate IDs"],
      "correctAnswer": "A",
      "explanation": "The function makes an API call to retrieve user information."
    }
  ]
}
```

`correctAnswer` is the option letter (`A`–`D`). The letter is also embedded at
the start of each option string.

**Errors**

- `400` — `repoId` is missing
- `422` — no source files or no questions could be generated
- `429` — GitHub API rate limit exceeded (includes the reset time)
- `500` — failure

---

## `POST /api/interview`

Sends one user message and returns the interviewer's reply, a confidence
score, and feedback. Send an empty `message` (and empty `history`) to start
the interview.

**Request**

```json
{
  "repoId": "user/repo",
  "message": "The frontend uses React, the backend Node.js and Express…",
  "history": [
    { "role": "ai", "text": "Walk me through the architecture of this project." }
  ]
}
```

`history` is the prior transcript (`ai` / `user`). Only the last 20 turns are
sent to the model.

**Response `200`**

```json
{
  "reply": "Great! Can you elaborate on…",
  "confidenceScore": 7,
  "feedback": "Clear explanation, but could add more details on error handling."
}
```

`confidenceScore` is `0–10` (one decimal place).

**Errors**

- `400` — `repoId` is missing
- `429` — GitHub API rate limit exceeded (includes the reset time)
- `500` — failure
