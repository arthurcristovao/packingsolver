# Web UI (Node.js + React + Tailwind)

Interface para configurar plano de corte com:

- Chapa padrão `2750 x 1850`
- Espaçamento e apara
- Rotações permitidas e espelhamento
- Objetivo e modo de otimização
- Tipos de corte: `Guillotine`, `Rectangle`, `Nesting`
- Cadastro de famílias de peças com **quantidade inteira**
- Peças **retangulares** e **poligonais aleatórias**, com tamanhos aleatórios por faixa min/max
- Visualização SVG da organização final para cada algoritmo de corte

## Rodando

```bash
cd web-ui
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Ponte WASM com C++

Arquivo base: `wasm/packingsolver_bridge.cpp`.

Exemplo de compilação com Emscripten (ajustar includes/libs do projeto):

```bash
em++ wasm/packingsolver_bridge.cpp \
  -O3 \
  -s WASM=1 \
  -s MODULARIZE=0 \
  -s EXPORT_ES6=0 \
  --bind \
  -o public/packingsolver.js
```

Depois de gerar os artefatos JS/WASM e carregá-los na página, a UI passa a chamar
`window.PackingSolverWasm.optimize(json)`.
