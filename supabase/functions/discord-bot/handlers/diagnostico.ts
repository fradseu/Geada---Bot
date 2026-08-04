// diagnostico.ts - /diagnostico: confirma se os emojis do config.ts estão
// resolvendo certo NESSE bot/servidor (sem depender de "boot", já que aqui
// não existe processo residente — busca os emojis do servidor na hora).
import { buscarEmojisDaGuilda, editarRespostaOriginal } from "../discord/rest.ts";
import { deferredReply } from "../discord/responses.ts";
import { DiscordInteraction } from "../discord/types.ts";
import { EMOJIS_FUNCAO } from "../config.ts";
import { montarMapaEmojis } from "../domain/emoji.ts";
import { HandlerResult } from "./context.ts";

export function handleDiagnostico(interaction: DiscordInteraction): HandlerResult {
  const guildId = interaction.guild_id;
  const applicationId = interaction.application_id;
  const token = interaction.token;

  return {
    immediate: deferredReply(true),
    background: async () => {
      const emojisGuilda = guildId ? await buscarEmojisDaGuilda(guildId) : [];
      const mapa = montarMapaEmojis(emojisGuilda);

      let relatorio = `🔎 **Diagnóstico de Emojis** (v1.2 — Supabase Edge Functions)\n\n`;

      for (const [tag, idBruto] of Object.entries(EMOJIS_FUNCAO)) {
        const resolvidoPorNome = mapa.get(tag.toLowerCase());
        const animated = idBruto.startsWith("a:");
        const id = idBruto.replace(/^a:/, "");
        const codigo = `<${animated ? "a" : ""}:${tag}:${id}>`;

        const status = resolvidoPorNome
          ? resolvidoPorNome.id === id
            ? "id confere"
            : `id do config DIFERE (config: ${id} / real: ${resolvidoPorNome.id})`
          : "não achado por nome no servidor, usando id do config.ts";

        relatorio += `${codigo} \`:${tag}:\` — ${status}\n`;
      }

      relatorio +=
        `\n👉 Se os ícones da ESQUERDA aparecerem como imagem, os IDs estão corretos.\n` +
        `👉 Se aparecer o texto \`<:tag:id>\` cru, o ID não é de um emoji acessível ao bot.`;

      await editarRespostaOriginal(applicationId, token, { content: relatorio });
    },
  };
}
