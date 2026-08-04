// passo3.ts - Composição da PT: escolher classes, focar uma, ajustar
// quantidade (+/-), voltar pra seleção de classes.
import { deferredUpdate, reply } from "../discord/responses.ts";
import { buscarEmojisDaGuilda, editarRespostaOriginal } from "../discord/rest.ts";
import { DiscordInteraction, getInteractionUserId } from "../discord/types.ts";
import { obterEstadoWizard, salvarEstadoWizard } from "../db/ptWizard.ts";
import { montarMapaEmojis } from "../domain/emoji.ts";
import { HandlerResult } from "./context.ts";
import { montarPayloadPasso3Painel, montarPayloadPasso3Selecao } from "./ui.ts";

const SESSAO_EXPIRADA = "⚠️ Sessão expirada — use /conteudo de novo pra começar.";

async function responderComPainelPasso3(
  interaction: DiscordInteraction,
): Promise<HandlerResult> {
  const liderId = getInteractionUserId(interaction);
  const dados = await obterEstadoWizard(liderId);
  if (!dados) return { immediate: reply(SESSAO_EXPIRADA, { ephemeral: true }) };

  const applicationId = interaction.application_id;
  const token = interaction.token;
  const guildId = interaction.guild_id;

  return {
    immediate: deferredUpdate(),
    background: async () => {
      if (!dados.classesAtivas) {
        const emojisGuilda = guildId ? await buscarEmojisDaGuilda(guildId) : [];
        const mapaEmojis = montarMapaEmojis(emojisGuilda);
        await editarRespostaOriginal(applicationId, token, montarPayloadPasso3Selecao(mapaEmojis));
        return;
      }

      const emojisGuilda = guildId ? await buscarEmojisDaGuilda(guildId) : [];
      const mapaEmojis = montarMapaEmojis(emojisGuilda);
      await editarRespostaOriginal(applicationId, token, montarPayloadPasso3Painel(dados, mapaEmojis));
    },
  };
}

export async function handleSelecionarClasses(interaction: DiscordInteraction): Promise<HandlerResult> {
  const liderId = getInteractionUserId(interaction);
  const dados = await obterEstadoWizard(liderId);
  if (!dados) return { immediate: reply(SESSAO_EXPIRADA, { ephemeral: true }) };

  const valores = interaction.data?.values ?? [];
  dados.classesAtivas = valores;

  for (const classe of valores) {
    if (dados.funcoes[classe] === undefined || dados.funcoes[classe] === 0) {
      dados.funcoes[classe] = 1;
    }
  }
  dados.classeFocada = valores[0] ?? null;

  await salvarEstadoWizard(liderId, dados);
  return responderComPainelPasso3(interaction);
}

export async function handleFocarClasse(
  interaction: DiscordInteraction,
  classe: string,
): Promise<HandlerResult> {
  const liderId = getInteractionUserId(interaction);
  const dados = await obterEstadoWizard(liderId);
  if (!dados) return { immediate: reply(SESSAO_EXPIRADA, { ephemeral: true }) };

  dados.classeFocada = classe;
  await salvarEstadoWizard(liderId, dados);
  return responderComPainelPasso3(interaction);
}

export async function handleAjusteQuantidade(
  interaction: DiscordInteraction,
  customId: "painel_add_1" | "painel_rem_1",
): Promise<HandlerResult> {
  const liderId = getInteractionUserId(interaction);
  const dados = await obterEstadoWizard(liderId);
  if (!dados) return { immediate: reply(SESSAO_EXPIRADA, { ephemeral: true }) };
  if (!dados.classeFocada) return { immediate: deferredUpdate() };

  const atual = dados.funcoes[dados.classeFocada] ?? 0;
  dados.funcoes[dados.classeFocada] =
    customId === "painel_add_1" ? atual + 1 : Math.max(0, atual - 1);

  await salvarEstadoWizard(liderId, dados);
  return responderComPainelPasso3(interaction);
}

export async function handleVoltarClasses(interaction: DiscordInteraction): Promise<HandlerResult> {
  const liderId = getInteractionUserId(interaction);
  const dados = await obterEstadoWizard(liderId);
  if (!dados) return { immediate: reply(SESSAO_EXPIRADA, { ephemeral: true }) };

  dados.classesAtivas = null;
  dados.classeFocada = null;
  dados.funcoes = {};

  await salvarEstadoWizard(liderId, dados);
  return responderComPainelPasso3(interaction);
}
