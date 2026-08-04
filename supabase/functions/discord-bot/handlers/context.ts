// context.ts - Tipo de retorno comum de todo handler.
//
// `immediate` é o que respondemos AO DISCORD dentro dos 3s (obrigatório).
// `background`, quando existe, roda DEPOIS de responder (edição de mensagem,
// chamadas REST extras, etc) — a function chama isso via EdgeRuntime.waitUntil()
// no index.ts, pra não cortar o trabalho assim que a resposta HTTP sai.
import { DiscordInteraction, InteractionResponse, SelectOption } from "../discord/types.ts";

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
