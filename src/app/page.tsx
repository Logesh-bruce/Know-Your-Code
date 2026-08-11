"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import Input from "@/components/Input";
import ProductDemo from "@/components/ProductDemo";
import { SESSION_KEY, validateRepoUrl } from "@/utils/validation";

function Logo() {
  return (
    <span className="flex items-center gap-2">
      <span className="flex h-6 w-6 items-center justify-center rounded-sm bg-accent">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="1.5" y="1.5" width="13" height="13" rx="3" stroke="white" />
          <path d="M5.5 5.5v5M8 10V6M10.5 8v2" stroke="white" strokeLinecap="round" />
        </svg>
      </span>
      <span className="text-sm font-semibold tracking-tight text-text-primary">
        KnowYourCode
      </span>
    </span>
  );
}

export default function Home() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);

  const analyze = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) {
      setError("Enter a GitHub repository URL");
      return;
    }
    if (!validateRepoUrl(trimmed)) {
      setError("That doesn't look like a GitHub repository URL");
      return;
    }
    try {
      sessionStorage.setItem(SESSION_KEY, trimmed);
    } catch {
      /* storage unavailable — fall back to navigation without persistence */
    }
    router.push("/dashboard");
  };

  return (
    <main className="min-h-screen bg-bg-primary">
      <div className="mx-auto grid min-h-screen max-w-6xl gap-12 px-6 py-6 lg:grid-cols-[minmax(0,420px)_1fr] lg:gap-16 lg:py-8">
        <section className="flex flex-col justify-center gap-6">
          <Logo />

          <div className="flex flex-col gap-3">
            <h1 className="text-[32px] font-semibold leading-[1.25] tracking-tight text-text-primary">
              Prove you understand your own code.
            </h1>
            <p className="max-w-[36ch] text-base leading-relaxed text-text-secondary">
              Paste any GitHub repository. KnowYourCode analyzes your codebase,
              explains what every file does, tests your knowledge, and
              interviews you like a senior engineer — so you can prove you
              actually built it.
            </p>
          </div>

          <form onSubmit={analyze} className="flex flex-col gap-2">
            <Input
              label="GitHub repository"
              placeholder="https://github.com/user/repo"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (error) setError(undefined);
              }}
              error={error}
              autoComplete="off"
              spellCheck={false}
            />
            <Button type="submit" size="lg" className="mt-1 self-start">
              Analyze Repository →
            </Button>
          </form>

          <p className="text-xs leading-relaxed text-text-secondary">
            No sign-up. Public repositories only. Your code stays with you.
          </p>
        </section>

        <section className="flex items-center justify-center py-4">
          <div className="w-full max-w-2xl">
            <ProductDemo />
          </div>
        </section>
      </div>
    </main>
  );
}