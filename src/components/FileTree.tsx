import { useState } from "react";
import clsx from "clsx";
import type { FileTreeNode } from "@/types/repo";

interface FileTreeProps {
  nodes: FileTreeNode[];
  selectedPath?: string;
  onSelect?: (path: string) => void;
  initiallyExpanded?: boolean;
  className?: string;
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={clsx(
        "shrink-0 text-text-secondary transition-transform duration-150 ease-in-out",
        open && "rotate-90"
      )}
    >
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0 text-[#d29922]">
      <path
        d="M1.5 3.5A1.5 1.5 0 0 1 3 2h3l1.5 2H13a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 13 14H3a1.5 1.5 0 0 1-1.5-1.5v-9Z"
        fill="currentColor"
        fillOpacity="0.35"
        stroke="currentColor"
      />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0 text-text-secondary">
      <path
        d="M4 2.5A1.5 1.5 0 0 1 5.5 1H11l3 3v8.5A1.5 1.5 0 0 1 12.5 14h-7A1.5 1.5 0 0 1 4 12.5v-10Z"
        stroke="currentColor"
      />
      <path d="M11 1v3.5h3.5" stroke="currentColor" strokeLinejoin="round" />
    </svg>
  );
}

function NodeRow({
  node,
  depth,
  selectedPath,
  defaultOpen,
  onSelect,
}: {
  node: FileTreeNode;
  depth: number;
  selectedPath?: string;
  defaultOpen: boolean;
  onSelect?: (path: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isFolder = node.type === "folder";
  const isSelected = node.path === selectedPath;

  return (
    <div>
      <button
        onClick={() => {
          if (isFolder) setOpen((o) => !o);
          else onSelect?.(node.path);
        }}
        aria-expanded={isFolder ? open : undefined}
        className={clsx(
          "flex w-full items-center gap-1 rounded-sm px-2 py-1 text-left text-small transition-colors duration-150 ease-in-out",
          isFolder
            ? "text-text-secondary hover:text-text-primary"
            : isSelected
              ? "bg-accent/15 text-text-primary"
              : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
        )}
        style={{ paddingLeft: depth * 16 + 8 }}
      >
        {isFolder ? <ChevronIcon open={open} /> : <span className="w-3" />}
        {isFolder ? <FolderIcon /> : <FileIcon />}
        <span className="truncate text-sm">{node.name}</span>
      </button>
      {isFolder && open && node.children && (
        <div className="animate-[fadeIn_150ms_ease-in-out]">
          {node.children.map((child) => (
            <NodeRow
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              defaultOpen={defaultOpen}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FileTree({
  nodes,
  selectedPath,
  onSelect,
  initiallyExpanded = false,
  className,
}: FileTreeProps) {
  return (
    <div className={className}>
      {nodes.map((node) => (
        <NodeRow
          key={node.path}
          node={node}
          depth={0}
          selectedPath={selectedPath}
          defaultOpen={initiallyExpanded}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}