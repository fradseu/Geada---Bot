// salaVoz.ts - Botão "🔊 Criar/Fechar Sala de Voz" no painel público.
// Só o CRIADOR da PT pode usar (mesma checagem do kick). O canal criado é
// referenciado como uma linha "🔊 Sala de Voz: <#id>" no próprio CONTENT da
// mensagem (não no embed — a lista de vagas não muda aqui) — não precisa de
// banco pra lembrar disso, a mensagem já é a fonte da verdade.
import { deferredUpdate, reply } from "../discord/responses.ts";
import {
  apagarCanal,
  criarCanalVoz,
  editarMensagem,
  enviarFollowUp,
  obterOuCriarCategoria,
} from "../discord/rest.ts";
import { DiscordInteraction, getInteractionUserId } from "../discord/types.ts";
import { NOME_CATEGORIA_SALAS_VOZ } from "../config.ts";
import { MARCADOR_SALA_VOZ } from "../domain/vagas.ts";
import {
  HandlerResult,
  extrairLiderIdDoCriador,
  extrairLinhasVagasDoEmbed,
  extrairOpcoesDropdownInscricao,
} from "./context.ts";
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
  const linhasVagas = extrairLinhasVagasDoEmbed(mensagem); // não muda aqui, só pra reconstruir o kick

  const linhaSalaAtual = mensagem.content.split("\n").find((l) => l.startsWith(MARCADOR_SALA_VOZ));
  const salaExistenteId = linhaSalaAtual?.match(/<#(\d+)>/)?.[1];

  return {
    immediate: deferredUpdate(),
    background: async () => {
      const linhasContent = mensagem.content.split("\n").filter((l) => !l.startsWith(MARCADOR_SALA_VOZ));

      try {
        if (salaExistenteId) {
          await apagarCanal(salaExistenteId);
        } else {
          const tituloBruto = linhasContent[0]?.replace(/\*\*/g, "").trim() || "PT";
          const categoriaId = await obterOuCriarCategoria(guildId, NOME_CATEGORIA_SALAS_VOZ);
          const canal = await criarCanalVoz(guildId, `🔊 ${tituloBruto}`, categoriaId);

          // Insere logo antes de "REQUISITOS MÍNIMOS" — sempre presente no painel.
          const indiceRequisitos = linhasContent.findIndex((l) => l.includes("REQUISITOS MÍNIMOS"));
          const linhaNova = `${MARCADOR_SALA_VOZ} <#${canal.id}>`;
          if (indiceRequisitos === -1) {
            linhasContent.push(linhaNova);
          } else {
            linhasContent.splice(indiceRequisitos, 0, linhaNova);
          }
        }
      } catch (err) {
        console.error("Erro ao gerenciar sala de voz:", err);
        const detalhe = err instanceof Error ? err.stack ?? err.message : String(err);
        await enviarFollowUp(applicationId, token, {
          content:
            `⚠️ Não consegui ${salaExistenteId ? "fechar" : "criar"} a sala de voz.\n` +
            `\`\`\`${detalhe.slice(0, 1900)}\`\`\``,
          flags: 64,
        });
        return;
      }

      const novoConteudo = linhasContent.join("\n");
      const novosComponentes = await atualizarComponentesPainel(
        linhasVagas,
        novoConteudo,
        opcoesClasse,
        guildId,
      );

      await editarMensagem(canalId, mensagem.id, {
        content: novoConteudo,
        components: novosComponentes,
      });
    },
  };
}
