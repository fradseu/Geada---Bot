// vagaInscrever.ts - Jogador escolhe uma classe no dropdown público.
import { deferredUpdate } from "../discord/responses.ts";
import { buscarEmojisDaGuilda, editarMensagem, enviarFollowUp } from "../discord/rest.ts";
import { DiscordInteraction, getInteractionUserId } from "../discord/types.ts";
import { formatarClasseParaMensagem, montarMapaEmojis } from "../domain/emoji.ts";
import {
  ehLinhaCriador,
  encontrarIndiceVagaVazia,
  liberarLinha,
  preencherLinha,
} from "../domain/vagas.ts";
import { HandlerResult, extrairOpcoesDropdownInscricao } from "./context.ts";
import { atualizarComponentesPainel } from "./ui.ts";

export function handleVagaInscrever(interaction: DiscordInteraction): HandlerResult {
  const vagaEscolhida = interaction.data?.values?.[0] ?? "";
  const userMention = `<@${getInteractionUserId(interaction)}>`;
  const mensagem = interaction.message!;
  const canalId = interaction.channel_id!;
  const guildId = interaction.guild_id;
  const applicationId = interaction.application_id;
  const token = interaction.token;
  const opcoesClasse = extrairOpcoesDropdownInscricao(mensagem);

  return {
    immediate: deferredUpdate(),
    background: async () => {
      const emojisGuilda = guildId ? await buscarEmojisDaGuilda(guildId) : [];
      const mapaEmojis = montarMapaEmojis(emojisGuilda);

      // Libera a vaga individual que o jogador ocupava antes (se houver
      // alguma). ⚠️ Nunca mexe na linha do Criador, mesmo se o Criador for
      // quem está se inscrevendo.
      const linhas = mensagem.content.split("\n").map((linha) =>
        !ehLinhaCriador(linha) && linha.includes(userMention) ? liberarLinha(linha) : linha
      );

      const indiceVagaVazia = encontrarIndiceVagaVazia(linhas, vagaEscolhida);
      const vagaFormatada = formatarClasseParaMensagem(vagaEscolhida, mapaEmojis);

      if (indiceVagaVazia === -1) {
        await enviarFollowUp(applicationId, token, {
          content: `⚠️ A vaga para **${vagaFormatada}** já está lotada!`,
          flags: 64,
        });
        return;
      }

      linhas[indiceVagaVazia] = preencherLinha(vagaFormatada, userMention);

      const novosComponentes = await atualizarComponentesPainel(linhas, opcoesClasse, guildId);

      await editarMensagem(canalId, mensagem.id, {
        content: linhas.join("\n"),
        components: novosComponentes,
      });
    },
  };
}
