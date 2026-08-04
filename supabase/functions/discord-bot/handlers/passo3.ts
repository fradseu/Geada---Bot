// passo3.ts - Composição da PT: escolher classes, focar uma, ajustar
// quantidade (+/-), voltar pra seleção de classes.
// Confirma a interação primeiro (defer), banco/REST só depois em background.
import { deferredUpdate } from "../discord/responses.ts";
import { buscarEmojisDaGuilda, editarRespostaOriginal, enviarFollowUp } from "../discord/rest.ts";
import { DiscordInteraction, getInteractionUserId } from "../discord/types.ts";
import { DadosWizard, obterEstadoWizard, salvarEstadoWizard } from "../db/ptWizard.ts";
import { montarMapaEmojis } from "../domain/emoji.ts";
import { HandlerResult } from "./context.ts";
import { montarPayloadPasso3Painel, montarPayloadPasso3Selecao } from "./ui.ts";

const SESSAO_EXPIRADA = "⚠️ Sessão expirada — use /conteudo de novo pra começar.";

async function editarComPainelPasso3(
  applicationId: string,
  token: string,
  guildId: string | undefined,
  dados: DadosWizard,
): Promise<void> {
  const emojisGuilda = guildId ? await buscarEmojisDaGuilda(guildId) : [];
  const mapaEmojis = montarMapaEmojis(emojisGuilda);

  const payload = dados.classesAtivas
    ? montarPayloadPasso3Painel(dados, mapaEmojis)
    : montarPayloadPasso3Selecao(mapaEmojis);

  await editarRespostaOriginal(applicationId, token, payload);
}

export function handleSelecionarClasses(interaction: DiscordInteraction): HandlerResult {
  const liderId = getInteractionUserId(interaction);
  const valores = interaction.data?.values ?? [];
  const applicationId = interaction.application_id;
  const token = interaction.token;
  const guildId = interaction.guild_id;

  return {
    immediate: deferredUpdate(),
    background: async () => {
      const dados = await obterEstadoWizard(liderId);
      if (!dados) {
        await enviarFollowUp(applicationId, token, { content: SESSAO_EXPIRADA, flags: 64 });
        return;
      }

      dados.classesAtivas = valores;
      for (const classe of valores) {
        if (dados.funcoes[classe] === undefined || dados.funcoes[classe] === 0) {
          dados.funcoes[classe] = 1;
        }
      }
      dados.classeFocada = valores[0] ?? null;

      await salvarEstadoWizard(liderId, dados);
      await editarComPainelPasso3(applicationId, token, guildId, dados);
    },
  };
}

export function handleFocarClasse(interaction: DiscordInteraction, classe: string): HandlerResult {
  const liderId = getInteractionUserId(interaction);
  const applicationId = interaction.application_id;
  const token = interaction.token;
  const guildId = interaction.guild_id;

  return {
    immediate: deferredUpdate(),
    background: async () => {
      const dados = await obterEstadoWizard(liderId);
      if (!dados) {
        await enviarFollowUp(applicationId, token, { content: SESSAO_EXPIRADA, flags: 64 });
        return;
      }

      dados.classeFocada = classe;
      await salvarEstadoWizard(liderId, dados);
      await editarComPainelPasso3(applicationId, token, guildId, dados);
    },
  };
}

export function handleAjusteQuantidade(
  interaction: DiscordInteraction,
  customId: "painel_add_1" | "painel_rem_1",
): HandlerResult {
  const liderId = getInteractionUserId(interaction);
  const applicationId = interaction.application_id;
  const token = interaction.token;
  const guildId = interaction.guild_id;

  return {
    immediate: deferredUpdate(),
    background: async () => {
      const dados = await obterEstadoWizard(liderId);
      if (!dados) {
        await enviarFollowUp(applicationId, token, { content: SESSAO_EXPIRADA, flags: 64 });
        return;
      }
      if (!dados.classeFocada) return;

      const atual = dados.funcoes[dados.classeFocada] ?? 0;
      dados.funcoes[dados.classeFocada] =
        customId === "painel_add_1" ? atual + 1 : Math.max(0, atual - 1);

      await salvarEstadoWizard(liderId, dados);
      await editarComPainelPasso3(applicationId, token, guildId, dados);
    },
  };
}

export function handleVoltarClasses(interaction: DiscordInteraction): HandlerResult {
  const liderId = getInteractionUserId(interaction);
  const applicationId = interaction.application_id;
  const token = interaction.token;
  const guildId = interaction.guild_id;

  return {
    immediate: deferredUpdate(),
    background: async () => {
      const dados = await obterEstadoWizard(liderId);
      if (!dados) {
        await enviarFollowUp(applicationId, token, { content: SESSAO_EXPIRADA, flags: 64 });
        return;
      }

      dados.classesAtivas = null;
      dados.classeFocada = null;
      dados.funcoes = {};

      await salvarEstadoWizard(liderId, dados);
      await editarComPainelPasso3(applicationId, token, guildId, dados);
    },
  };
}
