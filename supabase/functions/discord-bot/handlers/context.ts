// context.ts - Tipo de retorno comum de todo handler.
//
// `immediate` é o que respondemos AO DISCORD dentro dos 3s (obrigatório).
// `background`, quando existe, roda DEPOIS de responder (edição de mensagem,
// chamadas REST extras, etc) — a function chama isso via EdgeRuntime.waitUntil()
// no index.ts, pra não cortar o trabalho assim que a resposta HTTP sai.
import { DiscordEmbed, DiscordInteraction, InteractionResponse, SelectOption } from "../discord/types.ts";

export interface HandlerResult {
  immediate: InteractionResponse;
  background?: () => Promise<void>;
}

export function extrairLiderIdDoCriador(conteudoMensagem: string): string {
  const match = conteudoMensagem.match(/👑 Criador:\s*<@!?(\d+)>/);
  return match ? match[1] : "";
}

// Pega as opções do dropdown principal de inscrição direto do snapshot da
// mensagem que veio na própria interação (igual o v1 fazia com
// interaction.message.components[0].components[0].options) — evita ter que
// reconstruir do zero toda vez.
export function extrairOpcoesDropdownInscricao(
  mensagem: DiscordInteraction["message"],
): SelectOption[] {
  const primeiroComponente = mensagem?.components?.[0]?.components?.[0] as
    | { options?: SelectOption[] }
    | undefined;
  return primeiroComponente?.options ?? [];
}

// A lista de vagas vive na description do primeiro Embed da mensagem (não no
// content — isso é o que permite ir além do limite de 2000 caracteres).
export function extrairLinhasVagasDoEmbed(mensagem: DiscordInteraction["message"]): string[] {
  const description = mensagem?.embeds?.[0]?.description ?? "";
  return description.split("\n");
}

// Reconstrói o Embed preservando título/imagem, só trocando a lista de vagas.
export function reconstruirEmbedVagas(
  mensagem: DiscordInteraction["message"],
  novasLinhasVagas: string[],
): DiscordEmbed {
  const embedAtual = mensagem?.embeds?.[0];
  return {
    title: embedAtual?.title ?? "📝 Inscrições Abertas",
    description: novasLinhasVagas.join("\n"),
    image: embedAtual?.image,
  };
}
