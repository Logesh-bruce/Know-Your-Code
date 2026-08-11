import { useCallback, useState } from "react";

interface CodeBlockProps {
  code: string;
  language?: string;
  fileName?: string;
  showLineNumbers?: boolean;
  className?: string;
}

interface Token {
  type: string;
  value: string;
}

const KEYWORDS = new Set([
  "const", "let", "var", "function", "return", "async", "await", "import",
  "from", "export", "default", "if", "else", "for", "while", "class", "new",
  "try", "catch", "finally", "throw", "switch", "case", "break", "continue",
  "typeof", "instanceof", "in", "of", "this", "super", "extends", "static",
  "get", "set", "yield", "delete", "void", "do", "interface", "type", "enum",
  "public", "private", "protected", "readonly", "as", "keyof", "infer",
]);

const TOKEN_COLORS: Record<string, string> = {
  keyword: "text-[#569CD6]",
  string: "text-[#CE9178]",
  comment: "text-[#6A9955] italic",
  number: "text-[#B5CEA8]",
  function: "text-[#DCDCAA]",
  identifier: "text-[#9CDCFE]",
  operator: "text-[#D4D4D4]",
  punctuation: "text-[#8B949E]",
  text: "text-[#D4D4D4]",
  space: "text-[#D4D4D4]",
};

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let inBlock: boolean = false;

  const lines = source.split("\n");
  for (const line of lines) {
    let rest = line;
    let localInBlock: boolean = inBlock;

    while (rest.length > 0) {
      if (localInBlock) {
        const close = rest.indexOf("*/");
        if (close === -1) {
          tokens.push({ type: "comment", value: rest });
          rest = "";
        } else {
          tokens.push({ type: "comment", value: rest.slice(0, close + 2) });
          rest = rest.slice(close + 2);
          localInBlock = false;
        }
        continue;
      }

      if (rest.startsWith("//")) {
        tokens.push({ type: "comment", value: rest });
        rest = "";
        continue;
      }
      if (rest.startsWith("/*")) {
        const close = rest.indexOf("*/");
        if (close !== -1) {
          tokens.push({ type: "comment", value: rest.slice(0, close + 2) });
          rest = rest.slice(close + 2);
        } else {
          tokens.push({ type: "comment", value: rest });
          rest = "";
          localInBlock = true;
        }
        continue;
      }

      const quote = rest[0];
      if (quote === '"' || quote === "'" || quote === "`") {
        let i = 1;
        while (i < rest.length) {
          if (rest[i] === "\\") i += 2;
          else if (rest[i] === quote) {
            i += 1;
            break;
          } else i += 1;
        }
        tokens.push({ type: "string", value: rest.slice(0, i) });
        rest = rest.slice(i);
        continue;
      }

      const word = /^[A-Za-z_$][\w$]*/.exec(rest);
      if (word) {
        if (KEYWORDS.has(word[0])) {
          tokens.push({ type: "keyword", value: word[0] });
          rest = rest.slice(word[0].length);
        } else {
          tokens.push({ type: "identifier", value: word[0] });
          rest = rest.slice(word[0].length);
        }
        continue;
      }

      const number = /^\d+\.?\d*(?:[eE][+-]?\d+)?/.exec(rest);
      if (number) {
        tokens.push({ type: "number", value: number[0] });
        rest = rest.slice(number[0].length);
        continue;
      }

      const operator = /^[=+|<>!?*/%&^~-]+/.exec(rest);
      if (operator) {
        tokens.push({ type: "operator", value: operator[0] });
        rest = rest.slice(operator[0].length);
        continue;
      }

      const punct = /^[{}()[\],;.:]/.exec(rest);
      if (punct) {
        tokens.push({ type: "punctuation", value: punct[0] });
        rest = rest.slice(1);
        continue;
      }

      if (/\s/.test(rest[0])) {
        tokens.push({ type: "space", value: rest[0] });
        rest = rest.slice(1);
        continue;
      }

      tokens.push({ type: "text", value: rest[0] });
      rest = rest.slice(1);
    }

    tokens.push({ type: "space", value: "\n" });
    inBlock = localInBlock;
  }

  return tokens;
}

function markFunctionCalls(tokens: Token[]): Token[] {
  return tokens.map((token, index) => {
    if (token.type !== "identifier") return token;
    let next = index + 1;
    while (next < tokens.length && tokens[next].type === "space") next += 1;
    if (next < tokens.length && tokens[next].value === "(") {
      return { ...token, type: "function" };
    }
    return token;
  });
}

function toLines(tokens: Token[]): Token[][] {
  const lines: Token[][] = [];
  let current: Token[] = [];
  for (const token of tokens) {
    if (token.value === "\n") {
      lines.push(current);
      current = [];
    } else {
      current.push(token);
    }
  }
  if (current.length) lines.push(current);
  return lines;
}

export default function CodeBlock({
  code,
  language,
  fileName,
  showLineNumbers = true,
  className,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    navigator.clipboard
      ?.writeText(code)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => undefined);
  }, [code]);

  const lines = toLines(markFunctionCalls(tokenize(code)));

  return (
    <div
      className={`overflow-hidden rounded border border-line bg-bg-secondary ${className ?? ""}`}
    >
      <div className="flex items-center justify-between border-b border-line bg-bg-primary px-4 py-2">
        <span className="font-mono text-xs text-text-secondary">
          {fileName ?? language ?? "code"}
        </span>
        <button
          onClick={copy}
          aria-label="Copy code"
          className="flex items-center gap-1 text-xs text-text-secondary transition-colors duration-150 ease-in-out hover:text-text-primary"
        >
          {copied ? (
            <span className="text-success">Copied</span>
          ) : (
            <>
              <svg
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" />
                <path
                  d="M11 3H4.5A1.5 1.5 0 0 0 3 4.5V11"
                  stroke="currentColor"
                  strokeLinecap="round"
                />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>
      <div className="overflow-x-auto px-4 py-4 font-mono text-code leading-[1.6]">
        {lines.map((tokens, index) => (
          <div key={index} className="flex">
            {showLineNumbers && (
              <span className="w-8 select-none pr-4 text-right text-text-secondary/50">
                {index + 1}
              </span>
            )}
            <span className="whitespace-pre">
              {tokens.map((token, i) =>
                token.type === "space" && token.value === "\n" ? null : (
                  <span
                    key={i}
                    className={`${TOKEN_COLORS[token.type] ?? TOKEN_COLORS.text}`}
                  >
                    {token.value}
                  </span>
                )
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}