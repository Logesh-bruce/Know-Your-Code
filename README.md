# KnowYourCode

> **Understand your code. Test your knowledge. Prove you can explain it.**

KnowYourCode is an AI-powered developer tool that analyzes GitHub repositories and helps developers truly understand the code they work with through **code explanations, knowledge tests, and interview practice**.

[![Live Demo](https://img.shields.io/badge/🚀%20Live%20Demo-Visit%20KnowYourCode-black?style=for-the-badge)]([https://know-your-code-rho.vercel.app/])

---

## 📸 Product Preview

<p align="center">
  <img src="C:\Users\M.G.Logesh\Downloads\ChatGPT Image Aug 12, 2026, 09_28_57 PM.png"alt="KnowYourCode Product Preview" width="900"/>
</p>


---

## 🎯 Core Idea

Developers often use code without being able to confidently explain how it works.

KnowYourCode solves this by creating a simple loop:

```text
Understand your code
        ↓
Test your knowledge
        ↓
Practice explaining it
        ↓
Prove you understand it
```

---

## ✨ Features

### 🔍 Repository Analysis

Paste a GitHub repository URL and KnowYourCode analyzes the project to provide:

* Technology stack
* Project structure
* File tree
* Project summary
* Repository information

### 💡 Code Explanation

Select a file and receive a plain-English explanation covering:

* What the code does
* Why it exists
* Key functions and logic
* Important classes and components
* How it connects with the rest of the project

### 🧠 Knowledge Test

Test whether you actually understand the codebase with AI-generated multiple-choice questions.

The quiz evaluates your understanding of:

* Code behavior
* Project architecture
* Functions and responsibilities
* Dependencies
* Implementation decisions

### 🎤 Interview Practice

Practice explaining your project like you are in a real technical interview.

The AI interviewer:

* Asks project-specific questions
* Evaluates your responses
* Scores your confidence
* Identifies weak areas
* Provides actionable feedback

---

## 🚀 How It Works

```text
┌──────────────────────┐
│   Paste GitHub URL   │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│   Analyze Repository │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│      Dashboard       │
└──────────┬───────────┘
           │
     ┌─────┼─────┐
     ↓     ↓     ↓
 Explain  Test  Interview
     │     │     │
     ↓     ↓     ↓
   Code   Quiz   AI Chat
 Explanation       +
                Feedback
```

---

## 🎬 Product Demo

The entrance page includes a self-contained **6-scene product demonstration** located in:

```text
src/components/ProductDemo.tsx
```

The demo allows visitors to understand the complete product workflow in approximately **30 seconds without interacting with the application**.

---

## 🏗️ Project Structure

```text
src/
├── app/
│   ├── pages
│   └── api/
│
├── components/
│   ├── ProductDemo
│   └── reusable UI components
│
├── hooks/
│   └── client-side data hooks
│
├── services/
│   ├── githubService.ts
│   └── llmService.ts
│
├── types/
│   └── shared TypeScript contracts
│
├── utils/
│   ├── fetch helper
│   ├── file-tree builder
│   └── URL validation
│
└── styles/
    ├── design-system variables
    └── globals

docs/
├── API.md
├── ARCHITECTURE.md
└── SETUP.md
```

---

## 🛠️ Tech Stack

| Technology             | Purpose                                         |
| ---------------------- | ----------------------------------------------- |
| **Next.js 14**         | Full-stack React framework                      |
| **TypeScript**         | Type-safe development                           |
| **Tailwind CSS**       | UI styling                                      |
| **Octokit**            | GitHub API integration                          |
| **Claude API**         | AI-powered explanations, quizzes and interviews |
| **Next.js App Router** | Application routing and API routes              |

---

## ⚙️ Getting Started

### Prerequisites

Make sure you have:

* Node.js 18+
* npm

### 1. Clone the repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd KnowYourCode
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example environment file:

```bash
cp .env.example .env
```

Then add your API keys:

```env
GITHUB_TOKEN=your_github_token
CLAUDE_API_KEY=your_claude_api_key
```

### 4. Start the development server

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

## 🔐 Environment Variables

| Variable         | Required | Description                                                                      |
| ---------------- | -------- | -------------------------------------------------------------------------------- |
| `GITHUB_TOKEN`   | Optional | GitHub personal access token for higher API rate limits and private repositories |
| `CLAUDE_API_KEY` | Optional | Anthropic API key used for AI-powered features                                   |

KnowYourCode includes deterministic, dependency-free fallbacks, allowing the application to run during development without API keys.

Adding the API keys enables richer AI-powered responses.

---

## 📜 Available Scripts

```bash
npm run dev
```

Start the development server.

```bash
npm run build
```

Create a production build.

```bash
npm start
```

Run the production build.

```bash
npm run lint
```

Run the linter.

```bash
npm run typecheck
```

Run TypeScript type checking.

---

## 📚 Documentation

Additional technical documentation is available in the `docs/` directory.

* **[API Documentation](docs/API.md)** — API endpoints and request/response details
* **[Architecture](docs/ARCHITECTURE.md)** — application architecture and component relationships
* **[Setup Guide](docs/SETUP.md)** — complete setup and troubleshooting instructions

---

## 🔄 Core Product Loop

```text
       ┌───────────────┐
       │ Understand    │
       │ Your Code     │
       └───────┬───────┘
               ↓
       ┌───────────────┐
       │ Test Your     │
       │ Knowledge     │
       └───────┬───────┘
               ↓
       ┌───────────────┐
       │ Practice      │
       │ Interview     │
       └───────┬───────┘
               ↓
       ┌───────────────┐
       │ Prove You     │
       │ Understand It │
       └───────────────┘
```

---

## 🌟 Why KnowYourCode?

KnowYourCode is built around a simple problem:

> **Having code in your GitHub repository doesn't necessarily mean you can explain it.**

Instead of simply generating code, KnowYourCode helps developers develop the ability to **understand, explain, and defend their own projects**.

This makes it especially useful for:

* 🎓 Students preparing for placements
* 💼 Developers preparing for technical interviews
* 🚀 Developers presenting portfolio projects
* 🧑‍💻 Teams onboarding unfamiliar codebases
* 📖 Developers learning from existing repositories

---

## 📄 License

This project is licensed under the **MIT License**.

See [LICENSE](LICENSE) for more information.
