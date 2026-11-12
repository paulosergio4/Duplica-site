// =====================================================================
// DUPLICA · util/xml-nfe.js
// Lê o texto de um XML de NF-e e devolve só o que o Duplica usa.
//
// Onde cada informação fica no XML:
//   chave        → atributo Id de <infNFe> ("NFe" + 44 números) ou <chNFe>
//   número/série → <ide><nNF> e <ide><serie>
//   emissão      → <ide><dhEmi> (ou <dEmi> nas notas antigas)
//   fornecedor   → <emit><xNome> e <emit><CNPJ>
//   loja (filial)→ <dest><CNPJ>   (é por ele que a nota cai na filial certa)
//   valor        → <total><ICMSTot><vNF>
//   boletos      → cada <cobr><dup>: <nDup> número, <dVenc> vencimento, <vDup> valor
// =====================================================================

/** Primeiro elemento com esse nome (ignora o namespace da NF-e) */
function el(raiz, nome) {
  return raiz ? raiz.getElementsByTagNameNS('*', nome)[0] || raiz.getElementsByTagName(nome)[0] || null : null;
}
function txt(raiz, nome) {
  const e = el(raiz, nome);
  return e ? e.textContent.trim() : '';
}

/**
 * @param {string} texto  conteúdo do arquivo .xml
 * @returns {object} dados prontos para a função importar_nota do banco
 * @throws Error com mensagem amigável se não for uma NF-e válida
 */
export function lerXmlNfe(texto) {
  const doc = new DOMParser().parseFromString(texto, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('arquivo não é um XML válido');

  // o CT-e também tem <infNFe> dentro (lista as notas que transportou), então é testado primeiro
  if (el(doc, 'infCte')) throw new Error('é um CT-e (conhecimento de frete), não uma NF-e. Não tem boleto de nota.');
  const inf = el(doc, 'infNFe');
  if (!inf) {
    throw new Error('não é uma NF-e (pode ser um evento, como cancelamento ou carta de correção)');
  }

  let chave = (inf.getAttribute('Id') || '').replace(/^NFe/, '');
  if (!/^\d{44}$/.test(chave)) chave = txt(doc, 'chNFe');
  if (!/^\d{44}$/.test(chave)) throw new Error('chave de acesso não encontrada');

  const ide = el(inf, 'ide'), emit = el(inf, 'emit'), dest = el(inf, 'dest');
  const destCnpj = txt(dest, 'CNPJ');
  if (!destCnpj) throw new Error('nota sem CNPJ de destinatário');

  const duplicatas = [...inf.getElementsByTagNameNS('*', 'dup')].map((d) => ({
    numero: txt(d, 'nDup'),
    vencimento: txt(d, 'dVenc'),
    valor: Number(txt(d, 'vDup')),
  })).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.vencimento) && d.valor > 0);

  // forma de pagamento <detPag><tPag>15</tPag> = boleto (usado quando a nota não traz <dup>)
  const pags = [...inf.getElementsByTagNameNS('*', 'detPag')].filter((p) => txt(p, 'tPag') === '15');

  return {
    chave,
    numero: txt(ide, 'nNF'),
    serie: txt(ide, 'serie'),
    emissao: (txt(ide, 'dhEmi') || txt(ide, 'dEmi')).slice(0, 10),
    valor: Number(txt(el(inf, 'ICMSTot'), 'vNF') || 0),
    fornecedor: txt(emit, 'xNome'),
    fornecedor_cnpj: txt(emit, 'CNPJ') || txt(emit, 'CPF'),
    dest_cnpj: destCnpj,
    duplicatas,
    pagamento_boleto: pags.length > 0,
    valor_pagamento: pags.reduce((s, p) => s + Number(txt(p, 'vPag') || 0), 0),
    // produtos (conferência por EAN no recebimento)
    itens: [...inf.getElementsByTagNameNS('*', 'det')].map((det, i) => {
      const prod = el(det, 'prod');
      const ean = [txt(prod, 'cEAN'), txt(prod, 'cEANTrib')].map((v) => v.replace(/\D/g, '')).find((v) => [8, 12, 13, 14].includes(v.length)) || '';
      return { n_item: Number(det.getAttribute('nItem')) || i + 1, codigo: txt(prod, 'cProd'), ean, descricao: txt(prod, 'xProd'),
        quantidade: txt(prod, 'qCom'), unidade: txt(prod, 'uCom'), valor: txt(prod, 'vProd') };
    }),
  };
}
