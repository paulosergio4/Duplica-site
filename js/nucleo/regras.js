// =====================================================================
// DUPLICA · nucleo/regras.js
// Quem pode fazer o quê, NA TELA (para mostrar ou esconder botões).
// A regra que vale de verdade está no banco (sql/02_funcoes.sql);
// se mudar uma regra lá, mude aqui também.
// =====================================================================
import { estado } from './estado.js?v=fbcaef1';

const eu = () => estado.perfil || {};

export const ehGerente = () => eu().papel === 'gerente';
export const ehAdminSetor = () => eu().papel === 'admin_setor';

/** Fiscal: adicionar XML, "Chegou", "Enviar ao financeiro" */
export const podeFiscal = () => ehGerente() || eu().setor === 'Fiscal';

/** Financeiro: "Dar visto" */
export const podeFinanceiro = () => ehGerente() || eu().setor === 'Financeiro';

/** Texto do botão da próxima etapa do boleto, ou '' se a pessoa não pode */
export function proximaAcao(b) {
  if (b.etapa === 'esperado' && podeFiscal()) return 'Chegou';
  if (b.etapa === 'chegou' && podeFiscal()) return 'Enviar ao financeiro';
  if (b.etapa === 'enviado' && podeFinanceiro()) return 'Dar visto';
  return '';
}

/** Cancelar boleto ou nota (nota devolvida, cancelada, parcela renegociada) */
export const podeCancelar = () => podeFiscal();

/** Pode alterar o vencimento? Fiscal, Financeiro ou Admin, em qualquer etapa menos cancelado */
export const podeAlterarVencimento = (b) => (podeFiscal() || podeFinanceiro()) && b.etapa !== 'cancelado';

/** Pode marcar como pago? Financeiro/gerente, boleto ainda não pago e não cancelado.
 *  Com visto: pago no boleto (ou direto). Sem visto: só "pago direto" (Pix, transferência...) */
export const podePagar = (b) => podeFinanceiro() && b.etapa !== 'cancelado' && !b.pago_em;

/** Pode corrigir (voltar) a etapa atual deste boleto? */
export function podeCorrigir(b) {
  if (b.etapa === 'cancelado') return podeCancelar();
  if (b.etapa === 'chegou' || b.etapa === 'enviado') return podeFiscal();
  if (b.etapa === 'visto') return podeFinanceiro();   // se já estiver pago, a correção desfaz o pagamento
  return false;
}

/** Pode ativar/desativar esta pessoa? */
export function podeAlterarPessoa(alvo) {
  if (alvo.id === eu().id || alvo.papel === 'gerente') return false;
  if (ehGerente()) return true;
  return ehAdminSetor() && alvo.setor === eu().setor && alvo.papel === 'usuario';
}

// "gerente" é o nome interno do papel de quem pode tudo; na tela aparece como "Admin"
export const NOME_PAPEL = { gerente: 'Admin', admin_setor: 'Admin do setor', usuario: 'Usuário' };
export const NOME_ETAPA = { esperado: 'Não chegou', chegou: 'Chegou', enviado: 'No financeiro', visto: 'Visto do financeiro', cancelado: 'Cancelado' };
