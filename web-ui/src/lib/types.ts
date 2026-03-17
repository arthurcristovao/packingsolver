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

export interface RectPiece {
  id: string;
  type: 'rectangle';
  width: number;
  height: number;
  quantity: number;
  rotatable: boolean;
}

export interface RandomShapePiece {
  id: string;
  type: 'random-shape';
  vertices: number;
  maxWidth: number;
  maxHeight: number;
  quantity: number;
  rotatable: boolean;
}

export type Piece = RectPiece | RandomShapePiece;

export interface SolverRequest {
  sheet: { width: number; height: number };
  spacingMm: number;
  trimMm: number;
  allowMirror: boolean;
  rotationMode: RotationMode;
  objective: ObjectiveMode;
  optimizationMode: OptimizationMode;
  cuttingType: CuttingType;
  pieces: Piece[];
}

export interface SolverResult {
  status: 'ok' | 'error';
  engine: 'wasm-cpp' | 'fallback';
  message: string;
  plan?: unknown;
}
