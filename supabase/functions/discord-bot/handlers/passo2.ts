// passo2.ts - Requisitos de entrada (tier / set de skip) e transição pro Passo 3.
import { deferredUpdate, reply } from "../discord/responses.ts";
import { buscarEmojisDaGuilda, editarRespostaOriginal } from "../discord/rest.ts";
import { DiscordInteraction, getInteractionUserId } from "../discord/types.ts";
import { obterEstadoWizard, salvarEstadoWizard } from "../db/ptWizard.ts";
import { montarMapaEmojis } from "../domain/emoji.ts";
import { HandlerResult } from "./context.ts";
import { montarPayloadPasso2, montarPayloadPasso3Selecao } from "./ui.ts";

const SESSAO_EXPIRADA = "⚠️ Sessão expirada — use /conteudo de novo pra começar.";

export async function handleBotaoPasso2(
  interaction: DiscordInteraction,
  customId: "tier_true" | "tier_false" | "skip_true" | "skip_false",
): Promise<HandlerResult> {
  const liderId = getInteractionUserId(interaction);
  const dados = await obterEstadoWizard(liderId);
  if (!dados) return { immediate: reply(SESSAO_EXPIRADA, { ephemeral: true }) };

  if (customId === "tier_true") dados.temTier = true;
  if (customId === "tier_false") {
    dados.temTier = false;
    dados.tier = "Livre";
  }
  if (customId === "skip_true") dados.precisaSkip = true;
  if (customId === "skip_false") dados.precisaSkip = false;

  await salvarEstadoWizard(liderId, dados);

  const applicationId = interaction.application_id;
  const token = interaction.token;

  return {
    immediate: deferredUpdate(),
    background: async () => {
      const payload = montarPayloadPasso2(dados);
      await editarRespostaOriginal(applicationId, token, payload);
    },
  };
}

export async function handleSelectTierEspecifico(interaction: DiscordInteraction): Promise<HandlerResult> {
  const liderId = getInteractionUserId(interaction);
  const dados = await obterEstadoWizard(liderId);
  if (!dados) return { immediate: reply(SESSAO_EXPIRADA, { ephemeral: true }) };

  dados.tier = interaction.data?.values?.[0] ?? dados.tier;
  await salvarEstadoWizard(liderId, dados);

  const applicationId = interaction.application_id;
  const token = interaction.token;

  return {
    immediate: deferredUpdate(),
    background: async () => {
      const payload = montarPayloadPasso2(dados);
      await editarRespostaOriginal(applicationId, token, payload);
    },
  };
}

export async function handleBtnPasso3(interaction: DiscordInteraction): Promise<HandlerResult> {
  const liderId = getInteractionUserId(interaction);
  const dados = await obterEstadoWizard(liderId);
  if (!dados) return { immediate: reply(SESSAO_EXPIRADA, { ephemeral: true }) };

  const applicationId = interaction.application_id;
  const token = interaction.token;
  const guildId = interaction.guild_id;

  return {
    immediate: deferredUpdate(),
    background: async () => {
      const emojisGuilda = guildId ? await buscarEmojisDaGuilda(guildId) : [];
      const mapaEmojis = montarMapaEmojis(emojisGuilda);
      const payload = montarPayloadPasso3Selecao(mapaEmojis);
      await editarRespostaOriginal(applicationId, token, payload);
    },
  };
}
