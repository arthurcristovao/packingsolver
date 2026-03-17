import { useMemo, useState } from 'react';
import { runPackingSolver } from './lib/wasmBridge';
import type {
  CuttingType,
  ObjectiveMode,
  OptimizationMode,
  Piece,
  RandomShapePiece,
  RectPiece,
  RotationMode,
  SolverResult,
} from './lib/types';

const rotationOptions: RotationMode[] = ['Nenhum', '90°', 'Livre'];
const objectiveOptions: ObjectiveMode[] = [
  'Auto',
  'BinPacking',
  'BinPackingWithLeftovers',
  'VariableSizedBinPacking',
  'Knapsack',
];
const optimizationOptions: OptimizationMode[] = [
  'Auto',
  'Anytime',
  'NotAnytime',
  'NotAnytimeDeterministic',
  'NotAnytimeSequential',
];
const cuttingOptions: CuttingType[] = ['Guillotine', 'Rectangle', 'Nesting'];

function App() {
  const [sheetWidth, setSheetWidth] = useState(2750);
  const [sheetHeight, setSheetHeight] = useState(1850);
  const [spacingMm, setSpacingMm] = useState(3);
  const [trimMm, setTrimMm] = useState(10);
  const [rotationMode, setRotationMode] = useState<RotationMode>('Nenhum');
  const [allowMirror, setAllowMirror] = useState(false);
  const [objective, setObjective] = useState<ObjectiveMode>('Auto');
  const [optimizationMode, setOptimizationMode] = useState<OptimizationMode>('Auto');
  const [cuttingType, setCuttingType] = useState<CuttingType>('Nesting');
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [result, setResult] = useState<SolverResult | null>(null);

  const totalPieces = useMemo(
    () => pieces.reduce((sum, p) => sum + p.quantity, 0),
    [pieces],
  );

  const addRectangle = () => {
    const rectangle: RectPiece = {
      id: crypto.randomUUID(),
      type: 'rectangle',
      width: 500,
      height: 300,
      quantity: 1,
      rotatable: rotationMode !== 'Nenhum',
    };
    setPieces((prev) => [...prev, rectangle]);
  };

  const addRandomShape = () => {
    const shape: RandomShapePiece = {
      id: crypto.randomUUID(),
      type: 'random-shape',
      vertices: 7,
      maxWidth: 600,
      maxHeight: 450,
      quantity: 1,
      rotatable: rotationMode !== 'Nenhum',
    };
    setPieces((prev) => [...prev, shape]);
  };

  const solve = async () => {
    const response = await runPackingSolver({
      sheet: { width: sheetWidth, height: sheetHeight },
      spacingMm,
      trimMm,
      allowMirror,
      rotationMode,
      objective,
      optimizationMode,
      cuttingType,
      pieces,
    });
    setResult(response);
  };

  return (
    <main className="mx-auto min-h-screen max-w-5xl p-6 text-slate-900">
      <h1 className="mb-4 text-2xl font-semibold">Planejador de Corte (React + Tailwind + WASM)</h1>
      <div className="grid gap-6 rounded-xl bg-white p-5 shadow-sm md:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Largura da chapa (mm)</span>
          <input className="rounded border p-2" type="number" value={sheetWidth} onChange={(e) => setSheetWidth(Number(e.target.value))} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Altura da chapa (mm)</span>
          <input className="rounded border p-2" type="number" value={sheetHeight} onChange={(e) => setSheetHeight(Number(e.target.value))} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Espaçamento</span>
          <input className="rounded border p-2" type="number" value={spacingMm} onChange={(e) => setSpacingMm(Number(e.target.value))} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Apara</span>
          <input className="rounded border p-2" type="number" value={trimMm} onChange={(e) => setTrimMm(Number(e.target.value))} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Rotações permitidas</span>
          <select className="rounded border p-2" value={rotationMode} onChange={(e) => setRotationMode(e.target.value as RotationMode)}>
            {rotationOptions.map((o) => <option key={o}>{o}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Espelhamento permitido</span>
          <select className="rounded border p-2" value={allowMirror ? 'Sim' : 'Não'} onChange={(e) => setAllowMirror(e.target.value === 'Sim')}>
            <option>Não</option>
            <option>Sim</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Objetivo</span>
          <select className="rounded border p-2" value={objective} onChange={(e) => setObjective(e.target.value as ObjectiveMode)}>
            {objectiveOptions.map((o) => <option key={o}>{o}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Modo de otimização</span>
          <select className="rounded border p-2" value={optimizationMode} onChange={(e) => setOptimizationMode(e.target.value as OptimizationMode)}>
            {optimizationOptions.map((o) => <option key={o}>{o}</option>)}
          </select>
        </label>

        <div className="md:col-span-2">
          <span className="mb-2 block text-sm font-medium">Tipo de corte</span>
          <div className="grid grid-cols-3 overflow-hidden rounded-lg border">
            {cuttingOptions.map((type) => (
              <button
                key={type}
                onClick={() => setCuttingType(type)}
                className={`p-2 text-sm ${cuttingType === type ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700'}`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>

      <section className="mt-6 rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap gap-2">
          <button className="rounded bg-blue-600 px-3 py-2 text-sm text-white" onClick={addRectangle}>+ Peça Retangular</button>
          <button className="rounded bg-indigo-600 px-3 py-2 text-sm text-white" onClick={addRandomShape}>+ Geometria 2D Aleatória</button>
          <button className="rounded bg-emerald-600 px-3 py-2 text-sm text-white" onClick={solve}>Gerar Plano de Corte</button>
        </div>
        <p className="mb-3 text-sm text-slate-600">Peças cadastradas: {totalPieces} (itens: {pieces.length})</p>
        <pre className="max-h-72 overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
          {JSON.stringify(pieces, null, 2)}
        </pre>
      </section>

      {result && (
        <section className="mt-6 rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold">Resultado</h2>
          <p className="mb-2 text-sm text-slate-700">Engine: {result.engine}</p>
          <p className="mb-3 text-sm text-slate-700">{result.message}</p>
          <pre className="max-h-72 overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
            {JSON.stringify(result.plan, null, 2)}
          </pre>
        </section>
      )}
    </main>
  );
}

export default App;
