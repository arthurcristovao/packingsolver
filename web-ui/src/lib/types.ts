export type CuttingType = 'Guillotine' | 'Rectangle' | 'Nesting';

export type RotationMode = 'Nenhum' | '90°' | 'Livre';

export type ObjectiveMode =
  | 'Auto'
  | 'BinPacking'
  | 'BinPackingWithLeftovers'
  | 'VariableSizedBinPacking'
  | 'Knapsack';

export type OptimizationMode =
  | 'Auto'
  | 'Anytime'
  | 'NotAnytime'
  | 'NotAnytimeDeterministic'
  | 'NotAnytimeSequential';

export interface PieceConfig {
  id: string;
  label: string;
  kind: 'rectangle' | 'polygon-random';
  quantity: number;
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
  sides: number;
  rotatable: boolean;
}

export interface SolverRequest {
  sheet: { width: number; height: number };
  spacingMm: number;
  trimMm: number;
  allowMirror: boolean;
  rotationMode: RotationMode;
  objective: ObjectiveMode;
  optimizationMode: OptimizationMode;
  cuttingType: CuttingType;
  pieces: PieceConfig[];
}

export interface SolverResult {
  status: 'ok' | 'error';
  engine: 'wasm-cpp' | 'fallback';
  message: string;
  plan?: unknown;
}
