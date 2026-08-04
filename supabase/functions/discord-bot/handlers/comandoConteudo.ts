// comandoConteudo.ts - /conteudo (equivalente ao "PASSO 1: INVOCAR COMANDO SLASH" do v1)
//
// Confirma o comando IMEDIATAMENTE (deferredReply) e só depois escreve no
// banco + monta o Passo 1 — a escrita no Postgres pode passar de 1s num
// cold start, o que estoura os 3s que o Discord dá pra reconhecer o comando.
import { deferredReply } from "../discord/responses.ts";
import { editarRespostaOriginal } from "../discord/rest.ts";
import { DiscordInteraction, getInteractionUserId } from "../discord/types.ts";
import { criarEstadoWizard } from "../db/ptWizard.ts";
import { HandlerResult } from "./context.ts";
import { montarPayloadPasso1 } from "./ui.ts";

export function handleComandoConteudo(interaction: DiscordInteraction): HandlerResult {
  const liderId = getInteractionUserId(interaction);
  const canalId = interaction.channel_id!;
  const applicationId = interaction.application_id;
  const token = interaction.token;

  return {
    immediate: deferredReply(true),
    background: async () => {
      const dados = await criarEstadoWizard(liderId, canalId);
      const payload = montarPayloadPasso1(dados);
      await editarRespostaOriginal(applicationId, token, payload);
    },
  };
}
