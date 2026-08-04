// salaVoz.ts - Botão "🔊 Criar/Fechar Sala de Voz" no painel público.
// Só o CRIADOR da PT pode usar (mesma checagem do kick). O canal criado é
// referenciado como uma linha "🔊 Sala de Voz: <#id>" no próprio conteúdo da
// mensagem — não precisa de banco pra lembrar disso, a mensagem já é a fonte
// da verdade (mesmo padrão usado pra tudo mais nesse painel).
import { deferredUpdate, reply } from "../discord/responses.ts";
import { apagarCanal, criarCanalVoz, editarMensagem, enviarFollowUp } from "../discord/rest.ts";
import { DiscordInteraction, getInteractionUserId } from "../discord/types.ts";
import { MARCADOR_SALA_VOZ, atualizarResumoVagas } from "../domain/vagas.ts";
import { HandlerResult, extrairLiderIdDoCriador, extrairOpcoesDropdownInscricao } from "./context.ts";
import { atualizarComponentesPainel } from "./ui.ts";

export function handleSalaVozToggle(interaction: DiscordInteraction): HandlerResult {
  const mensagem = interaction.message!;
  const liderOriginalId = extrairLiderIdDoCriador(mensagem.content);

  if (getInteractionUserId(interaction) !== liderOriginalId) {
    return {
      immediate: reply("❌ Apenas o Líder da PT pode gerenciar a sala de voz!", { ephemeral: true }),
    };
  }

  const guildId = interaction.guild_id;
  if (!guildId) return { immediate: deferredUpdate() };

  const canalId = interaction.channel_id!;
  const applicationId = interaction.application_id;
  const token = interaction.token;
  const opcoesClasse = extrairOpcoesDropdownInscricao(mensagem);

  const linhaSalaAtual = mensagem.content.split("\n").find((l) => l.startsWith(MARCADOR_SALA_VOZ));
  const salaExistenteId = linhaSalaAtual?.match(/<#(\d+)>/)?.[1];

  return {
    immediate: deferredUpdate(),
    background: async () => {
      let linhas = mensagem.content.split("\n").filter((l) => !l.startsWith(MARCADOR_SALA_VOZ));

      try {
        if (salaExistenteId) {
          await apagarCanal(salaExistenteId);
        } else {
          const tituloBruto = linhas[0]?.replace(/\*\*/g, "").trim() || "PT";
          const canal = await criarCanalVoz(guildId, `🔊 ${tituloBruto}`);

          // Insere logo antes de "REQUISITOS MÍNIMOS" — sempre presente no painel.
          const indiceRequisitos = linhas.findIndex((l) => l.includes("REQUISITOS MÍNIMOS"));
          const linhaNova = `${MARCADOR_SALA_VOZ} <#${canal.id}>`;
          if (indiceRequisitos === -1) {
            linhas.push(linhaNova);
          } else {
            linhas.splice(indiceRequisitos, 0, linhaNova);
          }
        }
      } catch (err) {
        console.error("Erro ao gerenciar sala de voz:", err);
        await enviarFollowUp(applicationId, token, {
          content:
            `⚠️ Não consegui ${salaExistenteId ? "fechar" : "criar"} a sala de voz. ` +
            `O bot tem a permissão **Gerenciar Canais** nesse servidor?`,
          flags: 64,
        });
        return;
      }

      linhas = atualizarResumoVagas(linhas);
      const novosComponentes = await atualizarComponentesPainel(linhas, opcoesClasse, guildId);

      await editarMensagem(canalId, mensagem.id, {
        content: linhas.join("\n"),
        components: novosComponentes,
      });
    },
  };
}
