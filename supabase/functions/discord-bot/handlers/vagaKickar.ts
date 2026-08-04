// vagaKickar.ts - Dropdown secreto "Gerenciar PT: Kickar jogador" (só o líder vê e usa).
import { deferredUpdate, reply } from "../discord/responses.ts";
import { editarMensagem, enviarFollowUp } from "../discord/rest.ts";
import { DiscordInteraction, getInteractionUserId } from "../discord/types.ts";
import { atualizarResumoVagas, ehLinhaCriador, liberarLinha } from "../domain/vagas.ts";
import {
  HandlerResult,
  extrairLiderIdDoCriador,
  extrairLinhasVagasDoEmbed,
  extrairOpcoesDropdownInscricao,
  reconstruirEmbedVagas,
} from "./context.ts";
import { atualizarComponentesPainel } from "./ui.ts";

export function handleVagaKickar(interaction: DiscordInteraction): HandlerResult {
  const mensagem = interaction.message!;
  const liderOriginalId = extrairLiderIdDoCriador(mensagem.content);

  if (getInteractionUserId(interaction) !== liderOriginalId) {
    return {
      immediate: reply("❌ Apenas o Líder da PT pode remover jogadores daqui!", { ephemeral: true }),
    };
  }

  const jogadorParaKickar = interaction.data?.values?.[0] ?? "";
  const canalId = interaction.channel_id!;
  const guildId = interaction.guild_id;
  const applicationId = interaction.application_id;
  const token = interaction.token;
  const opcoesClasse = extrairOpcoesDropdownInscricao(mensagem);

  return {
    immediate: deferredUpdate(),
    background: async () => {
      // ⚠️ Proteção extra além da já existente no dropdown de kick: nunca mexe na linha do Criador
      const linhas = extrairLinhasVagasDoEmbed(mensagem).map((linha) =>
        !ehLinhaCriador(linha) && linha.includes(jogadorParaKickar) ? liberarLinha(linha) : linha
      );

      const linhasFinais = atualizarResumoVagas(linhas);
      const novosComponentes = await atualizarComponentesPainel(
        linhasFinais,
        mensagem.content,
        opcoesClasse,
        guildId,
      );

      await enviarFollowUp(applicationId, token, {
        content: `🥾 O jogador ${jogadorParaKickar} foi removido da PT com sucesso.`,
        flags: 64,
      });

      await editarMensagem(canalId, mensagem.id, {
        embeds: [reconstruirEmbedVagas(mensagem, linhasFinais)],
        components: novosComponentes,
      });
    },
  };
}
