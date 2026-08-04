// vagaDesistir.ts - Botão "❌ Sair da PT" (qualquer jogador inscrito pode usar).
import { deferredUpdate, reply } from "../discord/responses.ts";
import { editarMensagem } from "../discord/rest.ts";
import { DiscordInteraction, getInteractionUserId } from "../discord/types.ts";
import { ehLinhaCriador, liberarLinha } from "../domain/vagas.ts";
import { HandlerResult, extrairOpcoesDropdownInscricao } from "./context.ts";
import { atualizarComponentesPainel } from "./ui.ts";

export function handleVagaDesistir(interaction: DiscordInteraction): HandlerResult {
  const userMention = `<@${getInteractionUserId(interaction)}>`;
  const mensagem = interaction.message!;

  if (!mensagem.content.includes(userMention)) {
    return { immediate: reply("⚠️ Você não está inscrito nesta PT!", { ephemeral: true }) };
  }

  const canalId = interaction.channel_id!;
  const guildId = interaction.guild_id;
  const opcoesClasse = extrairOpcoesDropdownInscricao(mensagem);

  return {
    immediate: deferredUpdate(),
    background: async () => {
      // ⚠️ Nunca mexe na linha do Criador, mesmo se o Criador for quem está saindo
      const linhas = mensagem.content.split("\n").map((linha) =>
        !ehLinhaCriador(linha) && linha.includes(userMention) ? liberarLinha(linha) : linha
      );

      const novosComponentes = await atualizarComponentesPainel(linhas, opcoesClasse, guildId);

      await editarMensagem(canalId, mensagem.id, {
        content: linhas.join("\n"),
        components: novosComponentes,
      });
    },
  };
}
