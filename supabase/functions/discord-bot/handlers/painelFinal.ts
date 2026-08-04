// painelFinal.ts - Gera o painel público (equivalente ao "PASSO FINAL:
// ENVIAR O PAINEL DE INSCRIÇÃO PÚBLICO" do v1).
//
// Melhoria sobre o v1: lá o clique só era confirmado DEPOIS de criar o
// tópico e mandar a mensagem (risco real de estourar os 3s do Discord).
// Aqui confirmamos o clique na hora (deferredUpdate) e fazemos todo o
// trabalho pesado em background, editando a resposta original no final.
import { deferredUpdate, reply } from "../discord/responses.ts";
import {
  buscarEmojisDaGuilda,
  criarTopico,
  editarRespostaOriginal,
  enviarMensagem,
} from "../discord/rest.ts";
import {
  ButtonStyle,
  DiscordEmbed,
  DiscordInteraction,
  SelectOption,
  actionRow,
  getInteractionUserId,
} from "../discord/types.ts";
import { apagarEstadoWizard, obterEstadoWizard } from "../db/ptWizard.ts";
import {
  aplicarEmojisNoTexto,
  emojiParaComponente,
  montarMapaEmojis,
  parseClasseComEmoji,
} from "../domain/emoji.ts";
import { gerarLinhasDaFuncao } from "../domain/vagas.ts";
import { calcularDificuldade } from "../domain/dificuldade.ts";
import { HandlerResult } from "./context.ts";
import { montarBotoesBonus } from "./ui.ts";

const SESSAO_EXPIRADA = "⚠️ Sessão expirada — use /conteudo de novo pra começar.";

export async function handleGerarPainelFinal(interaction: DiscordInteraction): Promise<HandlerResult> {
  const liderId = getInteractionUserId(interaction);
  const dados = await obterEstadoWizard(liderId);
  if (!dados) return { immediate: reply(SESSAO_EXPIRADA, { ephemeral: true }) };

  const vagasFiltradas = Object.entries(dados.funcoes).filter(([, qtd]) => qtd > 0);
  if (vagasFiltradas.length === 0) {
    return {
      immediate: reply(
        "⚠️ Você precisa adicionar pelo menos 1 vaga na composição da sua PT antes de gerar o painel!",
        { ephemeral: true },
      ),
    };
  }

  const applicationId = interaction.application_id;
  const token = interaction.token;
  const guildId = interaction.guild_id;

  return {
    immediate: deferredUpdate(),
    background: async () => {
      const emojisGuilda = guildId ? await buscarEmojisDaGuilda(guildId) : [];
      const mapaEmojis = montarMapaEmojis(emojisGuilda);

      let textoVagas = "";
      const opcoesDropdown: SelectOption[] = [];

      for (const [classe, maximo] of vagasFiltradas) {
        // Uma linha por vaga individual — dá pra ver exatamente quem ocupa
        // qual vaga + bônus de cada um.
        textoVagas += gerarLinhasDaFuncao(classe, maximo, mapaEmojis).join("\n") + "\n";

        const { nome, emoji } = parseClasseComEmoji(classe, mapaEmojis);
        opcoesDropdown.push({
          label: `${nome} (Max ${maximo})`,
          value: classe,
          emoji: emojiParaComponente(emoji),
        });
      }

      const tituloFinal =
        dados.titulo && dados.titulo.length > 0 ? dados.titulo : "🔱 PROMPT DE CONTEÚDO";

      const textoFinalPainel =
        `**${tituloFinal}**\n` +
        `👑 Criador: <@${liderId}>\n` +
        `📋 **Atividade:** ${dados.atividades.join(" + ")}\n` +
        `📍 **Ponto de Encontro:** ${dados.cidade}\n` +
        `🗺️ **Ambiente:** ${dados.zona}\n\n` +
        `⚔️ **REQUISITOS MÍNIMOS:**\n` +
        `• **Builds tier:** ${dados.tier}\n` +
        `• **Set de Skip:** ${dados.precisaSkip ? "Obrigatório Mínimo T4" : "Dispensado"}\n\n` +
        `📝 **INSCRIÇÕES ABERTAS:**\n\n${textoVagas}\n` +
        `💬 Escolha seu papel no dropdown abaixo. Caso desista da vaga, clique no botão ❌ Sair da PT.\n` +
        `@everyone`;

      const dropdownPublico = {
        type: 3 as const,
        custom_id: "vaga_publica_inscrever",
        placeholder: "Selecione sua classe para entrar nesta PT",
        options: opcoesDropdown,
      };

      const btnDesistir = {
        type: 2 as const,
        custom_id: "vaga_publica_desistir",
        label: "❌ Sair da PT",
        style: ButtonStyle.Danger,
      };

      const dificuldadeInfo = calcularDificuldade(dados);
      const embeds: DiscordEmbed[] = dificuldadeInfo
        ? [{ image: { url: dificuldadeInfo.value } }]
        : [];

      // Cria o tópico ANTES de enviar o painel, e manda o painel DENTRO dele
      // — se der erro (ex: canal não suporta tópicos), cai de volta pro canal normal.
      let canalDestinoId = dados.canalId;
      try {
        const topico = await criarTopico(dados.canalId, tituloFinal, 1440);
        canalDestinoId = topico.id;
      } catch (err) {
        console.error("Erro ao criar o tópico do painel:", err);
      }

      await enviarMensagem(canalDestinoId, {
        content: aplicarEmojisNoTexto(textoFinalPainel),
        embeds,
        components: [actionRow(dropdownPublico), actionRow(btnDesistir), montarBotoesBonus()],
      });

      await apagarEstadoWizard(liderId);

      await editarRespostaOriginal(applicationId, token, {
        content: "✅ **Sucesso!** O painel do conteúdo foi gerado e enviado no canal público com sucesso.",
        components: [],
      });
    },
  };
}
