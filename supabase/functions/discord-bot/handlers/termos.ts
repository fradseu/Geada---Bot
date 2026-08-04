// termos.ts - /termos (atende à exigência legal do Discord)
import { reply } from "../discord/responses.ts";
import { ButtonStyle, actionRow } from "../discord/types.ts";
import { HandlerResult } from "./context.ts";

export function handleTermos(): HandlerResult {
  const rowLinks = actionRow(
    {
      type: 2 as const,
      style: ButtonStyle.Link,
      label: "📄 Termos de Serviço",
      url: "https://qroosefyfxefjrlhogrh.supabase.co/functions/v1/discord-bot/termos",
    },
    {
      type: 2 as const,
      style: ButtonStyle.Link,
      label: "🔒 Política de Privacidade",
      url: "https://qroosefyfxefjrlhogrh.supabase.co/functions/v1/discord-bot/privacidade",
    },
  );

  return {
    immediate: reply(
      "⚖️ **Informações Legais do Bot**\n\nPara garantir a segurança dos dados e o uso correto das funcionalidades, disponibilizamos nossos documentos oficiais nos botões abaixo:",
      { ephemeral: true, components: [rowLinks] },
    ),
  };
}
