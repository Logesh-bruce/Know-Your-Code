"use client";

import { useMemo } from "react";
import type { FlowEdge } from "@/types/flow";

interface FlowGraphProps {
  nodes: string[];
  edges: FlowEdge[];
  order: string[];
  selected: string | null;
  onSelect: (path: string) => void;
}

const BOX_W = 168;
const BOX_H = 34;
const GAP_X = 72;
const GAP_Y = 18;
const PAD = 20;

interface NodePos {
  x: number;
  y: number;
  layer: number;
}

function computeLayout(
  nodes: string[],
  edges: FlowEdge[],
  order: string[]
) {
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const n of nodes) {
    outgoing.set(n, []);
    incoming.set(n, []);
  }
  for (const edge of edges) {
    if (!outgoing.has(edge.source) || !outgoing.has(edge.target)) continue;
    outgoing.get(edge.source)!.push(edge.target);
    incoming.get(edge.target)!.push(edge.source);
  }

  // Layer = distance from leaves (nodes with no imports).
  const layerMemo = new Map<string, number>();
  const inProgress = new Set<string>();

  const getLayer = (node: string): number => {
    const known = layerMemo.get(node);
    if (known !== undefined) return known;
    if (inProgress.has(node)) return 0; // Cycle guard
    inProgress.add(node);
    let l = 0;
    for (const target of outgoing.get(node) ?? []) {
      l = Math.max(l, 1 + getLayer(target));
    }
    layerMemo.set(node, l);
    inProgress.delete(node);
    return l;
  };

  const byLayer = new Map<number, string[]>();
  for (const node of nodes) {
    const l = getLayer(node);
    if (!byLayer.has(l)) byLayer.set(l, []);
    byLayer.get(l)!.push(node);
  }

  const orderIndex = new Map(order.map((path, idx) => [path, idx]));
  const pos = new Map<string, NodePos>();

  for (const [l, list] of byLayer) {
    const sorted = [...list].sort(
      (a, b) => (orderIndex.get(a) ?? 0) - (orderIndex.get(b) ?? 0)
    );
    sorted.forEach((node, idx) => {
      pos.set(node, {
        layer: l,
        x: PAD + l * (BOX_W + GAP_X),
        y: PAD + idx * (BOX_H + GAP_Y),
      });
    });
  }

  const maxLayer = Math.max(0, ...byLayer.keys());
  const maxRows = Math.max(1, ...[...byLayer.values()].map((a) => a.length));
  const width = PAD + maxLayer * (BOX_W + GAP_X) + BOX_W + PAD;
  const height = PAD + maxRows * (BOX_H + GAP_Y) - GAP_Y + PAD;

  return { pos, width, height, outgoing, incoming };
}

function basename(path: string): string {
  return path.split("/").pop() ?? path;
}

export default function FlowGraph({
  nodes,
  edges,
  order,
  selected,
  onSelect,
}: FlowGraphProps) {
  const { pos, width, height } = useMemo(
    () => computeLayout(nodes, edges, order),
    [nodes, edges, order]
  );

  const importsOf = useMemo(
    () =>
      selected
        ? edges.filter((e) => e.source === selected).map((e) => e.target)
        : [],
    [selected, edges]
  );

  const importersOf = useMemo(
    () =>
      selected
        ? edges.filter((e) => e.target === selected).map((e) => e.source)
        : [],
    [selected, edges]
  );

  const related = useMemo(
    () => new Set([...importsOf, ...importersOf]),
    [importsOf, importersOf]
  );

  return (
    <div className="overflow-auto" style={{ maxHeight: "440px" }}>
      <svg
        width={width}
        height={height}
        className="min-w-full"
        role="img"
        aria-label="File import relationship graph"
      >
        {/* Render edges */}
        {edges.map((edge, i) => {
          const s = pos.get(edge.source);
          const t = pos.get(edge.target);
          if (!s || !t) return null;

          const sx = s.x + BOX_W;
          const sy = s.y + BOX_H / 2;
          const tx = t.x;
          const ty = t.y + BOX_H / 2;
          const isHot =
            selected ? edge.source === selected || edge.target === selected : false;
          const midX = (sx + tx) / 2;

          return (
            <path
              key={i}
              d={`M${sx} ${sy} C${midX} ${sy}, ${midX} ${ty}, ${tx} ${ty}`}
              fill="none"
              stroke={isHot ? "var(--accent)" : "var(--border)"}
              strokeWidth={isHot ? 1.5 : 1}
              opacity={selected ? (isHot ? 1 : 0.2) : 0.6}
            />
          );
        })}

        {/* Render file boxes */}
        {nodes.map((node) => {
          const p = pos.get(node);
          if (!p) return null;

          const isSelected = node === selected;
          const isRelated = selected ? related.has(node) : false;
          const isDimmed = Boolean(selected && !isSelected && !isRelated);

          const stroke =
            isSelected || isRelated ? "var(--accent)" : "var(--border)";

          return (
            <g
              key={node}
              onClick={() => onSelect(node)}
              className="cursor-pointer transition-opacity duration-150"
              role="button"
              aria-label={node}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(node);
                }
              }}
            >
              <rect
                x={p.x}
                y={p.y}
                width={BOX_W}
                height={BOX_H}
                rx={6}
                fill="var(--bg-secondary)"
                stroke={stroke}
                strokeWidth={isSelected ? 1.5 : 1}
                opacity={isDimmed ? 0.35 : 1}
              />
              <text
                x={p.x + 10}
                y={p.y + BOX_H / 2 + 4}
                fontSize={11}
                fontFamily="var(--font-mono)"
                fill="var(--text-primary)"
                opacity={isDimmed ? 0.5 : 1}
              >
                {basename(node)}
              </text>
              <title>{node}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
