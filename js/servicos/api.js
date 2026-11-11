// =====================================================================
// DUPLICA · servicos/api.js
// Ponto único de acesso aos dados. As telas NUNCA falam com o banco
// direto: sempre chamam api.alguma_coisa().
//
// Se o config.js tiver as chaves do Supabase → usa api-supabase.js
// Se não tiver                              → usa api-demo.js (exemplo local)
//
// As duas versões têm exatamente as mesmas funções (veja a lista em
// api-demo.js, que é a mais fácil de ler).
// =====================================================================
import { MODO_DEMO } from '../config.js?v=ead054a';

let _api = null;

/** Carrega a versão certa da API (só na primeira vez) */
export async function obterApi() {
  if (!_api) {
    _api = MODO_DEMO
      ? (await import('./api-demo.js?v=ead054a')).apiDemo
      : (await import('./api-supabase.js?v=ead054a')).apiSupabase;
  }
  return _api;
}
