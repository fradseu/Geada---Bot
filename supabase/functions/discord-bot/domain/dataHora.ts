// dataHora.ts - Data/hora atual (fuso do Brasil) pra pré-preencher o modal, e
// normalização do que a pessoa digitou (aceita só números, sem separador).

const FUSO_BRASIL = "America/Sao_Paulo";

export function dataHoraAtualBR(): { data: string; hora: string } {
  const agora = new Date();

  const data = new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO_BRASIL,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(agora);

  const hora = new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO_BRASIL,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(agora);

  return { data, hora };
}

// "04082026" -> "04/08/2026". Se já tiver alguma pontuação (ou não for só
// dígitos com 8 caracteres), devolve exatamente como a pessoa digitou.
export function normalizarData(valor: string): string {
  const limpo = valor.trim();
  if (/^\d{8}$/.test(limpo)) {
    return `${limpo.slice(0, 2)}/${limpo.slice(2, 4)}/${limpo.slice(4, 8)}`;
  }
  return limpo;
}

// "2356" -> "23:56", "930" -> "09:30". Só mexe se for 3 ou 4 dígitos puros.
export function normalizarHora(valor: string): string {
  const limpo = valor.trim();
  if (/^\d{3,4}$/.test(limpo)) {
    const comZero = limpo.padStart(4, "0");
    return `${comZero.slice(0, 2)}:${comZero.slice(2, 4)}`;
  }
  return limpo;
}
