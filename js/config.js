// =====================================================================
// DUPLICA · config.js
// O ÚNICO arquivo que você precisa editar para ligar o sistema ao banco.
//
// 1. No Supabase, abra: Project Settings → API
// 2. Copie "Project URL" para SUPABASE_URL
// 3. Copie a chave "anon public" para SUPABASE_ANON_KEY
//    (essa chave pode ficar no site; a segurança está nas regras do banco)
//
// Enquanto os dois campos estiverem vazios, o sistema roda em
// MODO DEMONSTRAÇÃO: dados de exemplo salvos só no seu navegador.
// =====================================================================

export const CONFIG = {
  SUPABASE_URL: 'https://tnksiwxtdgqypgnlfhzl.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRua3Npd3h0ZGdxeXBnbmxmaHpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQyNjc1MDIsImV4cCI6MjEwOTg0MzUwMn0.48EZu9IuD6HCcyC9VNoH42_ieA6dPvgHrFkHxmcGgGU',

  // O login é "empresa + usuário". Por baixo, o Supabase usa um e-mail
  // montado assim: usuario@codigoempresa.<DOMINIO_LOGIN>  (ninguém recebe e-mail)
  DOMINIO_LOGIN: 'duplica.app',

  // Quantos dias antes do vencimento um boleto que não chegou vira "Atenção"
  DIAS_ATENCAO: 5,

  // Suporte do Duplica (aparece na página de cadastro e quando o teste grátis
  // termina). WhatsApp só com números, com DDI e DDD: '5537999999999'.
  SUPORTE_WHATSAPP: '',
  SUPORTE_EMAIL: '',

// Leitor de código de barras da Scandit (câmera do celular). Chave do painel
  // ssl.scandit.com. Vazio = usa o leitor próprio (mais simples). A chave de
  // teste vale até 12/12/2026; depois disso o Duplica volta sozinho ao leitor próprio.
  SCANDIT_KEY: 'AsHoSxCoOMwgAqAjT6Nu3ckJGXaUCWTHbyCvx8M2c3eRRaOY+koErCkOqVO3F2yQineJO1hag6ykRsn9rwPd0hRiAQ+XQgbkBCIT8dMDQWQ9Qq21QxVTKeYx1815eGuVy3kZxVN8zxEsRrUBRkQxwhF+cbD2FPPDdHPrgR5mjOBRd0dQlHWl9LlOAh/ueV9c5GmTGp5U43RAbUq9FEctdjtoiu9bUKjYimbjFqhn+iv2bAx1w0ca5utHkWYXcAwKc0cRyPtPk1DZE7KNukdtpHtTdP6pe1Gi5WMPUJVsW9uIZWsycnwbcbZW/TxuXIGNNUD0hChtPlBNXBTJXW+iMP4jmpt2E0QhqAY0o+VPIHs5GxLoUjR14N1G7GJsTw79Y2+MtCVLlVQKDH38oEMtbdtsbgOpQOywRCQsgpMZk/DjTIGQ4ElRpP1DI/X4ANytrHnF8lBe7gtYB9AnLXtnxudJBaH4BN4C4VTr0/FaA+wQRMHT8hQGdFc9cH6zTcojOE8aAI94YwFOOy41xSDIrUYCxgAtH255qOWKC1xF5mKiiyhbZnQBLr8sFH5YV25xFgl/IWWHlChQIJ/NLfdvds261lM4OweeCMJ4N9+kRGMQmyYIL8HOU0V9E1EB9FCXPk3XyUc+iEpXUp/wB7oe4ZiRKFsynrPQLTO6xX590I0GzdEpgaqvPqCaad4Waxb1rQ49OR6XX2bpQn1FV+8qN2GLdvfE1qZ7wPOUTz1diyHvLEVjXpNFikAcFIxR/V67ib2sLSP7ELTz7wLH+Ll9fJmOaOcG6HmogG71VI2i+nqA5+gVAWxxZ8Spdq1j57MqKV7nnh//wsQJeiCXJbkUeomFLWIy4n2zhIbl4ai5lVMopO1rNnECDF1azU04PFfkezg9oloe7FpWiBXjOZApRmXBv+mLToi6ZGEsIxclxHNUepyjx/gGktG27cU8VaP6wkUXlNLxwNwOYjcnOcSsc3+j8wuAWehnG9RZY59z9wSc2mwUvEVer+eV3aK7aUSVbTFiz0jm/Nv9Tc2awqNaGVE23MPkxGLUJV/JHa1qiNfnBX1peOz0wA8l/vHv8NQ2C26Z6wgQkzKqIN7ADne+vXR4EkipKsrrlXq/UX1Xo+8gD+lLdmdQyyLEkV1veSv63sgOGsNvqWLOtd9gDg7MgmQDAtDaqjtfxlNUzjGmFbk54SzK00m7d3ep9jQ6nPiCstOpsA==',
};

export const MODO_DEMO = !CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY;
