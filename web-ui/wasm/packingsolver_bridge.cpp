#include <string>
#include <emscripten/bind.h>

/*
 * Ponte inicial para os algoritmos C++ do packingsolver.
 * A ideia é receber um JSON da UI, montar a instância apropriada
 * (guillotine, rectangle ou irregular/nesting) e retornar o plano em JSON.
 */

std::string optimize(std::string input_json)
{
    // TODO: integrar com include/packingsolver/* builders e optimize().
    // Placeholder para validar o contrato React <-> WASM.
    return std::string("{\"status\":\"ok\",\"engine\":\"wasm-cpp\",\"message\":\"WASM bridge compilada. Integração C++ pendente.\",\"plan\":")
        + input_json + "}";
}

EMSCRIPTEN_BINDINGS(packingsolver_module) {
    emscripten::function("optimize", &optimize);
}
