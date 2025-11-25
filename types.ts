
// Manually define D3 simulation types to avoid import dependency issues in the runtime environment
export interface SimulationNodeDatum {
  index?: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface SimulationLinkDatum<NodeDatum extends SimulationNodeDatum> {
  source: NodeDatum | string | number;
  target: NodeDatum | string | number;
  index?: number;
}

export interface Column {
  name: string;
  type: string;
  details?: string;
}

export interface Table {
  id: string; // The table name
  columns: Column[];
}

export interface Relationship {
  source: string; // Table name
  target: string; // Table name
  column?: string;
}

export interface SchemaData {
  tables: Table[];
  relationships: Relationship[];
  rawContent: string;
}

export interface GraphNode extends SimulationNodeDatum {
  id: string;
  type: 'table';
  data: Table;
  level?: number;
}

export interface GraphLink extends SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  column?: string;
}

// Standard TS pattern for string enums to avoid collisions and runtime issues
export const AnalysisStatus = {
  IDLE: 'IDLE',
  LOADING: 'LOADING',
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR'
} as const;

export type AnalysisStatus = typeof AnalysisStatus[keyof typeof AnalysisStatus];

export interface AnalysisReport {
  summary: string;
  potentialIssues: string[];
  suggestions: string[];
}

export type LayoutType = 'FORCE' | 'GRID' | 'CIRCLE' | 'TREE';
