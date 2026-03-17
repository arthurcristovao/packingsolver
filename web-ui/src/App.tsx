import { useMemo, useState } from 'react';
import { runPackingSolver } from './lib/wasmBridge';
import type {
  CuttingType,
  ObjectiveMode,
  OptimizationMode,
  PieceConfig,
  RotationMode,
  SolverResult,
} from './lib/types';

interface GeneratedPiece {
  id: string;
  label: string;
  kind: 'rectangle' | 'polygon-random';
  width: number;
  height: number;
  sides: number;
  color: string;
  rotatable: boolean;
}

interface PlacedPiece extends GeneratedPiece {
  x: number;
  y: number;
  widthPlaced: number;
  heightPlaced: number;
  rotated: boolean;
}

const colors = ['#e07b39', '#3b9e6e', '#4a7fc1', '#9b59b6', '#c0392b', '#16a085', '#d4ac0d', '#2980b9'];
const rotationOptions: RotationMode[] = ['Nenhum', '90°', 'Livre'];
const objectiveOptions: ObjectiveMode[] = ['Auto', 'BinPacking', 'BinPackingWithLeftovers', 'VariableSizedBinPacking', 'Knapsack'];
const optimizationOptions: OptimizationMode[] = ['Auto', 'Anytime', 'NotAnytime', 'NotAnytimeDeterministic', 'NotAnytimeSequential'];
const cuttingOptions: CuttingType[] = ['Guillotine', 'Rectangle', 'Nesting'];

const algoDescription: Record<CuttingType, string> = {
  Guillotine: 'Cortes de borda a borda em estágios, organização em faixas retangulares.',
  Rectangle: 'Heurística retangular (MaxRects simplificado), melhor aproveitamento de sobras.',
  Nesting: 'Nesting 2D com posicionamento por grade para peças retangulares e poligonais.',
};

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildPolygonPoints(sides: number, w: number, h: number): [number, number][] {
  const cx = w / 2;
  const cy = h / 2;
  return Array.from({ length: sides }, (_, i) => {
    const angle = (-Math.PI / 2) + ((2 * Math.PI * i) / sides);
    const rx = (w / 2) * (0.75 + Math.random() * 0.25);
    const ry = (h / 2) * (0.75 + Math.random() * 0.25);
    return [cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)];
  });
}

function expandPieces(configs: PieceConfig[]): GeneratedPiece[] {
  const pieces: GeneratedPiece[] = [];
  configs.forEach((cfg, idx) => {
    const quantity = Math.max(0, Math.floor(cfg.quantity));
    for (let i = 0; i < quantity; i += 1) {
      pieces.push({
        id: crypto.randomUUID(),
        label: `${cfg.label}-${i + 1}`,
        kind: cfg.kind,
        width: randInt(cfg.minWidth, Math.max(cfg.minWidth, cfg.maxWidth)),
        height: randInt(cfg.minHeight, Math.max(cfg.minHeight, cfg.maxHeight)),
        sides: cfg.kind === 'polygon-random' ? Math.max(3, Math.floor(cfg.sides)) : 4,
        color: colors[(idx + i) % colors.length],
        rotatable: cfg.rotatable,
      });
    }
  });
  return pieces.sort((a, b) => (b.width * b.height) - (a.width * a.height));
}

function guillotinePack(sheetW: number, sheetH: number, trim: number, kerf: number, pieces: GeneratedPiece[], allowRotation: boolean) {
  const free = [{ x: trim, y: trim, w: sheetW - trim * 2, h: sheetH - trim * 2 }];
  const placed: PlacedPiece[] = [];
  const unplaced: GeneratedPiece[] = [];

  for (const p of pieces) {
    let placedCurrent = false;
    for (let i = 0; i < free.length && !placedCurrent; i += 1) {
      const slot = free[i];
      const orientations = [{ w: p.width, h: p.height, rotated: false }];
      if (allowRotation && p.rotatable) orientations.push({ w: p.height, h: p.width, rotated: true });
      for (const o of orientations) {
        if (o.w <= slot.w && o.h <= slot.h) {
          placed.push({ ...p, x: slot.x, y: slot.y, widthPlaced: o.w, heightPlaced: o.h, rotated: o.rotated });
          const rightW = slot.w - o.w - kerf;
          const bottomH = slot.h - o.h - kerf;
          free.splice(i, 1);
          if (rightW > 0) free.push({ x: slot.x + o.w + kerf, y: slot.y, w: rightW, h: o.h });
          if (bottomH > 0) free.push({ x: slot.x, y: slot.y + o.h + kerf, w: slot.w, h: bottomH });
          placedCurrent = true;
          break;
        }
      }
    }
    if (!placedCurrent) unplaced.push(p);
  }
  return { placed, unplaced };
}

function rectanglePack(sheetW: number, sheetH: number, trim: number, kerf: number, pieces: GeneratedPiece[], allowRotation: boolean) {
  let free = [{ x: trim, y: trim, w: sheetW - trim * 2, h: sheetH - trim * 2 }];
  const placed: PlacedPiece[] = [];
  const unplaced: GeneratedPiece[] = [];

  for (const p of pieces) {
    let best: { idx: number; w: number; h: number; rotated: boolean; score: number } | null = null;
    free.forEach((slot, idx) => {
      const orientations = [{ w: p.width, h: p.height, rotated: false }];
      if (allowRotation && p.rotatable) orientations.push({ w: p.height, h: p.width, rotated: true });
      orientations.forEach((o) => {
        if (o.w <= slot.w && o.h <= slot.h) {
          const score = (slot.w - o.w) + (slot.h - o.h);
          if (!best || score < best.score) best = { idx, ...o, score };
        }
      });
    });

    if (!best) {
      unplaced.push(p);
      continue;
    }

    const slot = free[best.idx];
    placed.push({ ...p, x: slot.x, y: slot.y, widthPlaced: best.w, heightPlaced: best.h, rotated: best.rotated });

    const split: typeof free = [];
    const rightW = slot.w - best.w - kerf;
    const bottomH = slot.h - best.h - kerf;
    if (rightW > 0) split.push({ x: slot.x + best.w + kerf, y: slot.y, w: rightW, h: slot.h });
    if (bottomH > 0) split.push({ x: slot.x, y: slot.y + best.h + kerf, w: best.w, h: bottomH });
    free = free.filter((_, idx) => idx !== best.idx).concat(split).filter((r) => r.w > 0 && r.h > 0);
  }

  return { placed, unplaced };
}

function nestingPack(sheetW: number, sheetH: number, trim: number, kerf: number, pieces: GeneratedPiece[], allowRotation: boolean) {
  const placed: PlacedPiece[] = [];
  const unplaced: GeneratedPiece[] = [];
  const step = 30;
  const usableW = sheetW - trim * 2;
  const usableH = sheetH - trim * 2;

  const overlap = (a: PlacedPiece, x: number, y: number, w: number, h: number) => {
    return !(x + w + kerf <= a.x || a.x + a.widthPlaced + kerf <= x || y + h + kerf <= a.y || a.y + a.heightPlaced + kerf <= y);
  };

  for (const p of pieces) {
    const orientations = [{ w: p.width, h: p.height, rotated: false }];
    if (allowRotation && p.rotatable) orientations.push({ w: p.height, h: p.width, rotated: true });

    let found: { x: number; y: number; w: number; h: number; rotated: boolean } | null = null;
    for (const o of orientations) {
      for (let y = trim; y <= trim + usableH - o.h && !found; y += step) {
        for (let x = trim; x <= trim + usableW - o.w; x += step) {
          const collision = placed.some((pp) => overlap(pp, x, y, o.w, o.h));
          if (!collision) {
            found = { x, y, w: o.w, h: o.h, rotated: o.rotated };
            break;
          }
        }
      }
      if (found) break;
    }

    if (found) placed.push({ ...p, x: found.x, y: found.y, widthPlaced: found.w, heightPlaced: found.h, rotated: found.rotated });
    else unplaced.push(p);
  }

  return { placed, unplaced };
}

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
  const [pieces, setPieces] = useState<PieceConfig[]>([]);
  const [result, setResult] = useState<SolverResult | null>(null);
  const [preview, setPreview] = useState<{ placed: PlacedPiece[]; unplaced: GeneratedPiece[] } | null>(null);

  const totalPieces = useMemo(() => pieces.reduce((sum, p) => sum + Math.max(0, Math.floor(p.quantity)), 0), [pieces]);

  const addPiece = (kind: 'rectangle' | 'polygon-random') => {
    setPieces((prev) => ([
      ...prev,
      {
        id: crypto.randomUUID(),
        label: kind === 'rectangle' ? 'RET' : 'POLY',
        kind,
        quantity: 3,
        minWidth: 180,
        maxWidth: 520,
        minHeight: 150,
        maxHeight: 450,
        sides: 6,
        rotatable: rotationMode !== 'Nenhum',
      },
    ]));
  };

  const updatePiece = (id: string, patch: Partial<PieceConfig>) => {
    setPieces((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const removePiece = (id: string) => setPieces((prev) => prev.filter((p) => p.id !== id));

  const solve = async () => {
    const generated = expandPieces(pieces);
    const allowRotation = rotationMode !== 'Nenhum';

    let packed;
    if (cuttingType === 'Guillotine') packed = guillotinePack(sheetWidth, sheetHeight, trimMm, spacingMm, generated, allowRotation);
    else if (cuttingType === 'Rectangle') packed = rectanglePack(sheetWidth, sheetHeight, trimMm, spacingMm, generated, allowRotation);
    else packed = nestingPack(sheetWidth, sheetHeight, trimMm, spacingMm, generated, allowRotation);

    setPreview(packed);

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

    setResult({ ...response, plan: { ...response.plan, frontendPreview: { placed: packed.placed.length, unplaced: packed.unplaced.length } } });
  };

  const viewW = 900;
  const viewH = 560;
  const scale = Math.min(viewW / sheetWidth, viewH / sheetHeight);

  return (
    <main className="mx-auto min-h-screen max-w-7xl p-6 text-slate-900">
      <h1 className="mb-4 text-2xl font-semibold">Planejador de Corte (React + Tailwind + WASM)</h1>

      <div className="mb-4 rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-sm text-indigo-900">
        <strong>{cuttingType}</strong>: {algoDescription[cuttingType]}
      </div>

      <div className="grid gap-6 rounded-xl bg-white p-5 shadow-sm md:grid-cols-2">
        <label className="flex flex-col gap-1"><span className="text-sm font-medium">Largura da chapa (mm)</span><input className="rounded border p-2" type="number" value={sheetWidth} onChange={(e) => setSheetWidth(Number(e.target.value))} /></label>
        <label className="flex flex-col gap-1"><span className="text-sm font-medium">Altura da chapa (mm)</span><input className="rounded border p-2" type="number" value={sheetHeight} onChange={(e) => setSheetHeight(Number(e.target.value))} /></label>
        <label className="flex flex-col gap-1"><span className="text-sm font-medium">Espaçamento/Kerf (mm)</span><input className="rounded border p-2" type="number" value={spacingMm} onChange={(e) => setSpacingMm(Number(e.target.value))} /></label>
        <label className="flex flex-col gap-1"><span className="text-sm font-medium">Apara (mm)</span><input className="rounded border p-2" type="number" value={trimMm} onChange={(e) => setTrimMm(Number(e.target.value))} /></label>

        <label className="flex flex-col gap-1"><span className="text-sm font-medium">Rotações permitidas</span><select className="rounded border p-2" value={rotationMode} onChange={(e) => setRotationMode(e.target.value as RotationMode)}>{rotationOptions.map((o) => <option key={o}>{o}</option>)}</select></label>
        <label className="flex flex-col gap-1"><span className="text-sm font-medium">Espelhamento permitido</span><select className="rounded border p-2" value={allowMirror ? 'Sim' : 'Não'} onChange={(e) => setAllowMirror(e.target.value === 'Sim')}><option>Não</option><option>Sim</option></select></label>

        <label className="flex flex-col gap-1"><span className="text-sm font-medium">Objetivo</span><select className="rounded border p-2" value={objective} onChange={(e) => setObjective(e.target.value as ObjectiveMode)}>{objectiveOptions.map((o) => <option key={o}>{o}</option>)}</select></label>
        <label className="flex flex-col gap-1"><span className="text-sm font-medium">Modo de otimização</span><select className="rounded border p-2" value={optimizationMode} onChange={(e) => setOptimizationMode(e.target.value as OptimizationMode)}>{optimizationOptions.map((o) => <option key={o}>{o}</option>)}</select></label>

        <div className="md:col-span-2">
          <span className="mb-2 block text-sm font-medium">Tipo de corte</span>
          <div className="grid grid-cols-3 overflow-hidden rounded-lg border">
            {cuttingOptions.map((type) => <button key={type} onClick={() => setCuttingType(type)} className={`p-2 text-sm ${cuttingType === type ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700'}`}>{type}</button>)}
          </div>
        </div>
      </div>

      <section className="mt-6 rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap gap-2">
          <button className="rounded bg-blue-600 px-3 py-2 text-sm text-white" onClick={() => addPiece('rectangle')}>+ Família Retangular</button>
          <button className="rounded bg-indigo-600 px-3 py-2 text-sm text-white" onClick={() => addPiece('polygon-random')}>+ Família Poligonal Aleatória</button>
          <button className="rounded bg-emerald-600 px-3 py-2 text-sm text-white" onClick={solve}>Gerar Plano de Corte</button>
        </div>
        <p className="mb-3 text-sm text-slate-600">Quantidade total de peças (inteiro): {totalPieces}</p>

        <div className="overflow-auto">
          <table className="min-w-full border text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="border p-2">Tipo</th><th className="border p-2">Qtd</th><th className="border p-2">Min W</th><th className="border p-2">Max W</th><th className="border p-2">Min H</th><th className="border p-2">Max H</th><th className="border p-2">Lados</th><th className="border p-2">Rot.</th><th className="border p-2">Ação</th>
              </tr>
            </thead>
            <tbody>
              {pieces.map((p) => (
                <tr key={p.id}>
                  <td className="border p-2">{p.kind === 'rectangle' ? 'Retangular' : 'Poligonal'}</td>
                  <td className="border p-2"><input className="w-20 rounded border p-1" type="number" min={1} step={1} value={p.quantity} onChange={(e) => updatePiece(p.id, { quantity: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} /></td>
                  <td className="border p-2"><input className="w-20 rounded border p-1" type="number" value={p.minWidth} onChange={(e) => updatePiece(p.id, { minWidth: Number(e.target.value) })} /></td>
                  <td className="border p-2"><input className="w-20 rounded border p-1" type="number" value={p.maxWidth} onChange={(e) => updatePiece(p.id, { maxWidth: Number(e.target.value) })} /></td>
                  <td className="border p-2"><input className="w-20 rounded border p-1" type="number" value={p.minHeight} onChange={(e) => updatePiece(p.id, { minHeight: Number(e.target.value) })} /></td>
                  <td className="border p-2"><input className="w-20 rounded border p-1" type="number" value={p.maxHeight} onChange={(e) => updatePiece(p.id, { maxHeight: Number(e.target.value) })} /></td>
                  <td className="border p-2"><input className="w-20 rounded border p-1" disabled={p.kind === 'rectangle'} type="number" min={3} step={1} value={p.sides} onChange={(e) => updatePiece(p.id, { sides: Math.max(3, Math.floor(Number(e.target.value) || 3)) })} /></td>
                  <td className="border p-2"><input type="checkbox" checked={p.rotatable} onChange={(e) => updatePiece(p.id, { rotatable: e.target.checked })} /></td>
                  <td className="border p-2"><button className="rounded bg-red-500 px-2 py-1 text-white" onClick={() => removePiece(p.id)}>Excluir</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 rounded-xl bg-white p-5 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold">Representação visual do algoritmo ({cuttingType})</h2>
        <div className="overflow-auto rounded border bg-slate-900 p-2">
          <svg width={viewW} height={viewH}>
            <rect x={0} y={0} width={viewW} height={viewH} fill="#0f172a" />
            <rect x={trimMm * scale} y={trimMm * scale} width={(sheetWidth - trimMm * 2) * scale} height={(sheetHeight - trimMm * 2) * scale} fill="none" stroke="#334155" strokeDasharray="4 4" />
            {preview?.placed.map((p) => {
              const x = p.x * scale;
              const y = p.y * scale;
              const w = p.widthPlaced * scale;
              const h = p.heightPlaced * scale;

              if (p.kind === 'rectangle') {
                return <g key={p.id}><rect x={x} y={y} width={w} height={h} fill={p.color} stroke="#0b1020" /><text x={x + 4} y={y + 12} fontSize={10} fill="#fff">{p.label}</text></g>;
              }

              const points = buildPolygonPoints(p.sides, w, h).map(([px, py]) => `${x + px},${y + py}`).join(' ');
              return <g key={p.id}><polygon points={points} fill={p.color} stroke="#0b1020" /><text x={x + 4} y={y + 12} fontSize={10} fill="#fff">{p.label}</text></g>;
            })}
          </svg>
        </div>
        <p className="mt-2 text-sm text-slate-600">Encaixadas: {preview?.placed.length ?? 0} | Não encaixadas: {preview?.unplaced.length ?? 0}</p>
      </section>

      {result && (
        <section className="mt-6 rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold">Resultado da ponte WASM</h2>
          <p className="mb-2 text-sm text-slate-700">Engine: {result.engine}</p>
          <p className="mb-3 text-sm text-slate-700">{result.message}</p>
          <pre className="max-h-72 overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-100">{JSON.stringify(result.plan, null, 2)}</pre>
        </section>
      )}
    </main>
  );
}

export default App;
