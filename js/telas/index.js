// =====================================================================
// DUPLICA · telas/index.js
// Lista das telas, na ordem em que aparecem no menu.
// Para criar uma tela nova: copie um arquivo desta pasta, mude o "id",
// "rotulo", "visivel" e "render", e acrescente aqui.
// =====================================================================
import { telaFiscal } from './fiscal.js?v=e0df3f1';
import { telaFinanceiro } from './financeiro.js?v=e0df3f1';
import { telaCalendario } from './calendario.js?v=e0df3f1';
import { telaContasFixas } from './contas-fixas.js?v=e0df3f1';
import { telaContabilidade } from './contabilidade.js?v=e0df3f1';
import { telaUsuarios } from './usuarios.js?v=e0df3f1';
import { telaFiliais } from './filiais.js?v=e0df3f1';
import { telaRecebimento } from './recebimento.js?v=e0df3f1';

export const TELAS = [telaFiscal, telaRecebimento, telaFinanceiro, telaCalendario, telaContasFixas, telaContabilidade, telaUsuarios, telaFiliais];

/** Telas que a pessoa logada pode ver */
export const telasDe = (perfil) => TELAS.filter((t) => t.visivel(perfil));

/** Tela que abre ao entrar, conforme o setor */
export function telaInicial(perfil) {
  const preferida = { Fiscal: 'fiscal', Financeiro: 'financeiro', Contabilidade: 'contabilidade', Recebimento: 'receber' }[perfil.setor];
  return telasDe(perfil).find((t) => t.id === preferida)?.id || telasDe(perfil)[0]?.id;
}
