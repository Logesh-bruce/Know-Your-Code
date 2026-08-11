import type { RepoSummaryData } from "@/types/repo";

interface RepoSummaryProps {
  repo: RepoSummaryData;
}

export default function RepoSummary({ repo }: RepoSummaryProps) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-mono text-2xl">{repo.name}</h2>
        {repo.description && (
          <p className="mt-1 text-sm text-text-secondary">{repo.description}</p>
        )}
      </div>

      {repo.techStack.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-text-secondary">
            Tech stack:
          </span>
          {repo.techStack.map((tech) => (
            <span
              key={tech}
              className="rounded-sm border border-line bg-bg-tertiary px-2 py-0.5 text-xs text-text-primary"
            >
              {tech}
            </span>
          ))}
        </div>
      )}

      <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <div className="flex items-center gap-2">
          <dt className="text-text-secondary">Files</dt>
          <dd className="font-medium tabular-nums">
            {repo.fileCount.toLocaleString()}
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="text-text-secondary">Lines</dt>
          <dd className="font-medium tabular-nums">
            {repo.lineCount.toLocaleString()}
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="text-text-secondary">Language</dt>
          <dd className="font-medium">{repo.primaryLanguage || "—"}</dd>
        </div>
      </dl>
    </div>
  );
}