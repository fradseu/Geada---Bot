// passo1.ts - Configuração inicial (atividades/cidade/zona), título via modal,
// e transição pro Passo 2. Equivalente aos blocos "Salvando Passo 1",
// "Transição do Passo 1 para o Passo 2" e "TÍTULO/DESCRIÇÃO CUSTOMIZADO" do v1.
//
// Padrão em todo handler aqui: confirma a interação IMEDIATAMENTE (defer) e
// só faz leitura/escrita no banco depois, em background — uma escrita no
// Postgres pode passar de 1s num cold start, e o Discord só dá 3s pra ackar.
import { deferredUpdate, reply, showModal } from "../discord/responses.ts";
import { editarRespostaOriginal, enviarFollowUp } from "../discord/rest.ts";
import { DiscordInteraction, getInteractionUserId } from "../discord/types.ts";
import { obterEstadoWizard, salvarEstadoWizard } from "../db/ptWizard.ts";
import { HandlerResult } from "./context.ts";
import { montarModalTitulo, montarPayloadPasso1, montarPayloadPasso2 } from "./ui.ts";

const SESSAO_EXPIRADA = "⚠️ Sessão expirada — use /conteudo de novo pra começar.";

export function handleConfigSelect(
  interaction: DiscordInteraction,
  customId: "config_atividade" | "config_cidade" | "config_zona",
): HandlerResult {
  const liderId = getInteractionUserId(interaction);
  const valores = interaction.data?.values ?? [];

  return {
    immediate: deferredUpdate(),
    background: async () => {
      const dados = await obterEstadoWizard(liderId);
      if (!dados) return; // sessão expirada — sem mensagem original pra corrigir, só ignora

      if (customId === "config_atividade") dados.atividades = valores;
      if (customId === "config_cidade") dados.cidade = valores[0] ?? "";
      if (customId === "config_zona") dados.zona = valores[0] ?? "";

      await salvarEstadoWizard(liderId, dados);
      // Igual o v1: o próprio Discord já mostra a seleção no dropdown, não
      // precisa reescrever o conteúdo da mensagem.
    },
  };
}

export function handleBtnPasso2(interaction: DiscordInteraction): HandlerResult {
  const liderId = getInteractionUserId(interaction);
  const applicationId = interaction.application_id;
  const token = interaction.token;

  return {
    immediate: deferredUpdate(),
    background: async () => {
      const dados = await obterEstadoWizard(liderId);
      if (!dados) {
        await enviarFollowUp(applicationId, token, { content: SESSAO_EXPIRADA, flags: 64 });
        return;
      }

      if (dados.atividades.length === 0 || !dados.cidade || !dados.zona) {
        await enviarFollowUp(applicationId, token, {
          content:
            "⚠️ **Faltam dados!** Selecione pelo menos uma Atividade, Cidade e Zona antes de avançar.",
          flags: 64,
        });
        return;
      }

      const payload = montarPayloadPasso2(dados);
      await editarRespostaOriginal(applicationId, token, payload);
    },
  };
}

// Modal precisa ser a resposta IMEDIATA (o Discord não permite defer antes de
// abrir um modal), então essa é a única leitura de banco que continua síncrona
// aqui — é uma leitura simples por chave primária, rápida o bastante.
export async function handleBtnDefinirTitulo(interaction: DiscordInteraction): Promise<HandlerResult> {
  const liderId = getInteractionUserId(interaction);
  const dados = await obterEstadoWizard(liderId);
  if (!dados) return { immediate: reply(SESSAO_EXPIRADA, { ephemeral: true }) };

  const modal = montarModalTitulo(dados.titulo);
  return { immediate: showModal(modal.customId, modal.title, modal.components) };
}

export function handleModalTitulo(interaction: DiscordInteraction): HandlerResult {
  const liderId = getInteractionUserId(interaction);
  const valor = interaction.data?.components?.[0]?.components?.[0]?.value ?? "";
  const applicationId = interaction.application_id;
  const token = interaction.token;

  return {
    immediate: deferredUpdate(),
    background: async () => {
      const dados = await obterEstadoWizard(liderId);
      if (!dados) {
        await enviarFollowUp(applicationId, token, { content: SESSAO_EXPIRADA, flags: 64 });
        return;
      }

      dados.titulo = valor.trim();
      await salvarEstadoWizard(liderId, dados);

      const payload = montarPayloadPasso1(dados);
      await editarRespostaOriginal(applicationId, token, payload);
    },
  };
}
