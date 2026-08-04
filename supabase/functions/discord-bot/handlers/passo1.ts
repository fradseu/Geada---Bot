// passo1.ts - Configuração inicial (atividades/cidade/zona), título via modal,
// e transição pro Passo 2. Equivalente aos blocos "Salvando Passo 1",
// "Transição do Passo 1 para o Passo 2" e "TÍTULO/DESCRIÇÃO CUSTOMIZADO" do v1.
import { deferredUpdate, reply, showModal, updateMessage } from "../discord/responses.ts";
import { editarRespostaOriginal } from "../discord/rest.ts";
import { DiscordInteraction, getInteractionUserId } from "../discord/types.ts";
import { obterEstadoWizard, salvarEstadoWizard } from "../db/ptWizard.ts";
import { HandlerResult } from "./context.ts";
import { montarModalTitulo, montarPayloadPasso1, montarPayloadPasso2 } from "./ui.ts";

const SESSAO_EXPIRADA = "⚠️ Sessão expirada — use /conteudo de novo pra começar.";

export async function handleConfigSelect(
  interaction: DiscordInteraction,
  customId: "config_atividade" | "config_cidade" | "config_zona",
): Promise<HandlerResult> {
  const liderId = getInteractionUserId(interaction);
  const dados = await obterEstadoWizard(liderId);
  if (!dados) return { immediate: reply(SESSAO_EXPIRADA, { ephemeral: true }) };

  const valores = interaction.data?.values ?? [];
  if (customId === "config_atividade") dados.atividades = valores;
  if (customId === "config_cidade") dados.cidade = valores[0] ?? "";
  if (customId === "config_zona") dados.zona = valores[0] ?? "";

  await salvarEstadoWizard(liderId, dados);

  // Igual o v1: só confirma o clique, o próprio Discord já mostra a seleção
  // no dropdown — não precisa reescrever o conteúdo da mensagem.
  return { immediate: deferredUpdate() };
}

export async function handleBtnPasso2(interaction: DiscordInteraction): Promise<HandlerResult> {
  const liderId = getInteractionUserId(interaction);
  const dados = await obterEstadoWizard(liderId);
  if (!dados) return { immediate: reply(SESSAO_EXPIRADA, { ephemeral: true }) };

  if (dados.atividades.length === 0 || !dados.cidade || !dados.zona) {
    return {
      immediate: reply(
        "⚠️ **Faltam dados!** Selecione pelo menos uma Atividade, Cidade e Zona antes de avançar.",
        { ephemeral: true },
      ),
    };
  }

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

export async function handleBtnDefinirTitulo(interaction: DiscordInteraction): Promise<HandlerResult> {
  const liderId = getInteractionUserId(interaction);
  const dados = await obterEstadoWizard(liderId);
  if (!dados) return { immediate: reply(SESSAO_EXPIRADA, { ephemeral: true }) };

  const modal = montarModalTitulo(dados.titulo);
  return { immediate: showModal(modal.customId, modal.title, modal.components) };
}

export async function handleModalTitulo(interaction: DiscordInteraction): Promise<HandlerResult> {
  const liderId = getInteractionUserId(interaction);
  const dados = await obterEstadoWizard(liderId);
  if (!dados) return { immediate: reply(SESSAO_EXPIRADA, { ephemeral: true }) };

  const valor = interaction.data?.components?.[0]?.components?.[0]?.value ?? "";
  dados.titulo = valor.trim();
  await salvarEstadoWizard(liderId, dados);

  const payload = montarPayloadPasso1(dados);
  return { immediate: updateMessage(payload.content ?? "", payload.components ?? []) };
}
