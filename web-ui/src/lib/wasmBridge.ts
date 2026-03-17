import type { SolverRequest, SolverResult } from './types';

declare global {
  interface Window {
    PackingSolverWasm?: {
      optimize: (inputJson: string) => string;
    };
  }
}

export async function runPackingSolver(request: SolverRequest): Promise<SolverResult> {
  const payload = JSON.stringify(request);

  if (window.PackingSolverWasm?.optimize) {
    const response = window.PackingSolverWasm.optimize(payload);
    return JSON.parse(response) as SolverResult;
  }

  return {
    status: 'ok',
    engine: 'fallback',
    message:
      'Ponte WASM preparada. Compile wasm/packingsolver_bridge.cpp com Emscripten para conectar os algoritmos C++ reais.',
    plan: request,
  };
}
