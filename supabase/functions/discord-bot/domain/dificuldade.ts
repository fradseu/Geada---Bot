// dificuldade.ts - Calcula o tier de risco da PT com base nas atividades +
// zona + cidade escolhidas, e devolve a imagem correspondente (DIFICULDADES).

import { DificuldadeImagem, DIFICULDADES, DIFICULDADES_VALUE } from "../config.ts";
import { DadosWizard } from "../db/ptWizard.ts";

function buscarImagem(trechoLabel: string): DificuldadeImagem | undefined {
  return DIFICULDADES.find((d) => d.label.includes(trechoLabel));
}

export function calcularDificuldade(dados: DadosWizard): DificuldadeImagem | undefined {
  // Conteúdo de Aliança tem selo próprio, não entra na conta de risco por pontuação
  const temAtividadeAlianca = dados.atividades.some((a) => a.startsWith("Aliança"));
  if (temAtividadeAlianca) return buscarImagem("Aliança");

  const valores: number[] = [];

  for (const atividade of dados.atividades) {
    const entrada = DIFICULDADES_VALUE.find((d) => d.label === atividade);
    if (entrada) valores.push(entrada.value);
  }

  const entradaZona = DIFICULDADES_VALUE.find((d) => d.label === dados.zona);
  if (entradaZona) valores.push(entradaZona.value);

  const entradaCidade = DIFICULDADES_VALUE.find((d) => d.label === dados.cidade);
  if (entradaCidade) valores.push(entradaCidade.value);

  // Sem nenhum valor cadastrado (ex: atividade nova sem entrada em DIFICULDADES_VALUE)
  if (valores.length === 0) return buscarImagem("Tier C");

  // Soma (não média) — cada fator EMPILHA risco, até o teto de 1.0.
  // É por isso que cidade de zona segura (Royal, Amarela) fica pertinho de
  // zero: ela não deve "diluir" o risco de uma atividade/zona perigosa.
  const pontuacao = Math.min(
    valores.reduce((soma, v) => soma + v, 0),
    1.0,
  );

  if (pontuacao >= 0.75) return buscarImagem("Tier S");
  if (pontuacao >= 0.55) return buscarImagem("Tier A");
  if (pontuacao >= 0.35) return buscarImagem("Tier B");
  return buscarImagem("Tier C");
}
