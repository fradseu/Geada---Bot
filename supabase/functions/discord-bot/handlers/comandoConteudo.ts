// comandoConteudo.ts - /conteudo (equivalente ao "PASSO 1: INVOCAR COMANDO SLASH" do v1)
import { reply } from "../discord/responses.ts";
import { DiscordInteraction, getInteractionUserId } from "../discord/types.ts";
import { criarEstadoWizard } from "../db/ptWizard.ts";
import { HandlerResult } from "./context.ts";
import { montarPayloadPasso1 } from "./ui.ts";

export async function handleComandoConteudo(interaction: DiscordInteraction): Promise<HandlerResult> {
  const liderId = getInteractionUserId(interaction);
  const canalId = interaction.channel_id!;

  const dados = await criarEstadoWizard(liderId, canalId);
  const payload = montarPayloadPasso1(dados);

  return {
    immediate: reply(payload.content ?? "", {
      ephemeral: true,
      components: payload.components,
    }),
  };
}
