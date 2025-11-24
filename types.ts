import { SimulationNodeDatum, SimulationLinkDatum } from 'd3';

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
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  level?: number;
}

export interface GraphLink extends SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  column?: string;
}

export enum AnalysisStatus {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export interface AnalysisReport {
  summary: string;
  potentialIssues: string[];
  suggestions: string[];
}

export type LayoutType = 'FORCE' | 'GRID' | 'CIRCLE' | 'TREE';