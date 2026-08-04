// bonusToggle.ts - Botões Mana/Runa/Reset/Guardião: liga/desliga o bônus na
// linha do jogador. Só funciona pra quem já está numa vaga (validado aqui).
import { deferredUpdate, reply } from "../discord/responses.ts";
import { editarMensagem } from "../discord/rest.ts";
import { DiscordInteraction, getInteractionUserId } from "../discord/types.ts";
import { BONUS } from "../config.ts";
import { ehLinhaCriador } from "../domain/vagas.ts";
import { HandlerResult, extrairOpcoesDropdownInscricao } from "./context.ts";
import { atualizarComponentesPainel } from "./ui.ts";

export function handleBonusToggle(interaction: DiscordInteraction, valorBonus: string): HandlerResult {
  const bonusInfo = BONUS.find((b) => b.value === valorBonus);
  if (!bonusInfo) return { immediate: deferredUpdate() };

  const userMention = `<@${getInteractionUserId(interaction)}>`;
  const mensagem = interaction.message!;
  const linhasOriginais = mensagem.content.split("\n");

  const indiceLinha = linhasOriginais.findIndex(
    (linha) => !ehLinhaCriador(linha) && linha.includes(userMention),
  );

  // Só deixa marcar bônus quem já está ocupando uma vaga na PT
  if (indiceLinha === -1) {
    return {
      immediate: reply("⚠️ Você precisa entrar em uma vaga antes de escolher um bônus.", {
        ephemeral: true,
      }),
    };
  }

  const canalId = interaction.channel_id!;
  const guildId = interaction.guild_id;
  const opcoesClasse = extrairOpcoesDropdownInscricao(mensagem);

  return {
    immediate: deferredUpdate(),
    background: async () => {
      const linhas = [...linhasOriginais];
      const linhaAtual = linhas[indiceLinha];

      if (linhaAtual.includes(bonusInfo.emoji)) {
        // Já tinha esse bônus marcado -> tira (toggle off)
        linhas[indiceLinha] =
          linhaAtual.replace(bonusInfo.emoji, "").replace(/\s+/g, " ").trimEnd() + " ";
      } else {
        // Ainda não tinha -> adiciona (toggle on)
        linhas[indiceLinha] = linhaAtual.trimEnd() + ` ${bonusInfo.emoji} `;
      }

      const novosComponentes = await atualizarComponentesPainel(linhas, opcoesClasse, guildId);

      await editarMensagem(canalId, mensagem.id, {
        content: linhas.join("\n"),
        components: novosComponentes,
      });
    },
  };
}
