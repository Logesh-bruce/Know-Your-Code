export interface FlowEdge {
  source: string;
  target: string;
}

export interface FlowData {
  nodes: string[];
  edges: FlowEdge[];
  order: string[];
}
