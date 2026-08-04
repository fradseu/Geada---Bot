// index.ts - Entrypoint HTTP da Edge Function. Todo clique, comando e modal
// do Discord chega AQUI como uma requisição POST avulsa (nada de conexão
// permanente/gateway, diferente do v1).
//
// (bump trivial pra testar o deploy automático via GitHub Action)
//
// Fluxo de toda requisição:
//   1. Verifica a assinatura Ed25519 (garante que veio mesmo do Discord)
//   2. Responde PING com PONG (obrigatório pro Discord aceitar o endpoint)
//   3. Roteia pro handler certo com base no tipo de interação + custom_id
//   4. Responde dentro de 3s (`immediate`) e, se precisar de mais trabalho,
//      deixa rodando em background via EdgeRuntime.waitUntil()
import { verifyKey } from "discord-interactions";
import { pong, reply } from "./discord/responses.ts";
import {
  ComponentType,
  DiscordInteraction,
  InteractionType,
} from "./discord/types.ts";
import { HandlerResult } from "./handlers/context.ts";
import { handleComandoConteudo } from "./handlers/comandoConteudo.ts";
import { handleTermos } from "./handlers/termos.ts";
import { handleDiagnostico } from "./handlers/diagnostico.ts";
import {
  handleBtnDefinirTitulo,
  handleBtnPasso2,
  handleConfigSelect,
  handleModalTitulo,
} from "./handlers/passo1.ts";
import {
  handleBotaoPasso2,
  handleBtnPasso3,
  handleSelectTierEspecifico,
} from "./handlers/passo2.ts";
import {
  handleAjusteQuantidade,
  handleFocarClasse,
  handleSelecionarClasses,
  handleVoltarClasses,
} from "./handlers/passo3.ts";
import { handleGerarPainelFinal } from "./handlers/painelFinal.ts";
import { handleVagaInscrever } from "./handlers/vagaInscrever.ts";
import { handleVagaDesistir } from "./handlers/vagaDesistir.ts";
import { handleVagaKickar } from "./handlers/vagaKickar.ts";
import { handleBonusToggle } from "./handlers/bonusToggle.ts";

const PUBLIC_KEY = Deno.env.get("DISCORD_PUBLIC_KEY") ?? "";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function rotear(interaction: DiscordInteraction): Promise<HandlerResult> {
  if (interaction.type === InteractionType.ApplicationCommand) {
    switch (interaction.data?.name) {
      case "conteudo":
        return await handleComandoConteudo(interaction);
      case "termos":
        return handleTermos();
      case "diagnostico":
        return await handleDiagnostico(interaction);
      default:
        return { immediate: reply("Comando desconhecido.", { ephemeral: true }) };
    }
  }

  if (interaction.type === InteractionType.ModalSubmit) {
    if (interaction.data?.custom_id === "modal_titulo") {
      return await handleModalTitulo(interaction);
    }
    return { immediate: reply("Modal desconhecido.", { ephemeral: true }) };
  }

  if (interaction.type === InteractionType.MessageComponent) {
    const customId = interaction.data?.custom_id ?? "";
    const componentType = interaction.data?.component_type;

    // --- Painel público (funciona pra qualquer jogador, sem exigir sessão de wizard) ---
    if (customId === "vaga_publica_inscrever") return handleVagaInscrever(interaction);
    if (customId === "vaga_publica_desistir") return handleVagaDesistir(interaction);
    if (customId === "vaga_publica_kickar") return handleVagaKickar(interaction);
    if (customId.startsWith("bonus_")) {
      return handleBonusToggle(interaction, customId.replace("bonus_", ""));
    }

    // --- Passo 1 ---
    if (customId === "btn_definir_titulo") return await handleBtnDefinirTitulo(interaction);
    if (
      componentType === ComponentType.StringSelect &&
      ["config_atividade", "config_cidade", "config_zona"].includes(customId)
    ) {
      return await handleConfigSelect(
        interaction,
        customId as "config_atividade" | "config_cidade" | "config_zona",
      );
    }
    if (customId === "btn_passo2") return await handleBtnPasso2(interaction);

    // --- Passo 2 ---
    if (["tier_true", "tier_false", "skip_true", "skip_false"].includes(customId)) {
      return await handleBotaoPasso2(interaction, customId as "tier_true" | "tier_false" | "skip_true" | "skip_false");
    }
    if (customId === "select_tier_especifico") return await handleSelectTierEspecifico(interaction);
    if (customId === "btn_passo3") return await handleBtnPasso3(interaction);

    // --- Passo 3 ---
    if (customId === "selecionar_classes_da_pt") return await handleSelecionarClasses(interaction);
    if (customId.startsWith("focar_cl_")) {
      return await handleFocarClasse(interaction, customId.replace("focar_cl_", ""));
    }
    if (customId === "painel_add_1" || customId === "painel_rem_1") {
      return await handleAjusteQuantidade(interaction, customId);
    }
    if (customId === "btn_voltar_classes") return await handleVoltarClasses(interaction);

    // --- Passo final ---
    if (customId === "btn_gerar_painel_final") return await handleGerarPainelFinal(interaction);

    return { immediate: reply("Componente desconhecido.", { ephemeral: true }) };
  }

  return { immediate: reply("Tipo de interação não suportado.", { ephemeral: true }) };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const signature = req.headers.get("x-signature-ed25519");
  const timestamp = req.headers.get("x-signature-timestamp");
  const rawBody = await req.text();

  const assinaturaValida =
    signature && timestamp && (await verifyKey(rawBody, signature, timestamp, PUBLIC_KEY));

  if (!assinaturaValida) {
    return new Response("invalid request signature", { status: 401 });
  }

  const interaction = JSON.parse(rawBody) as DiscordInteraction;

  if (interaction.type === InteractionType.Ping) {
    return jsonResponse(pong());
  }

  try {
    const { immediate, background } = await rotear(interaction);

    if (background) {
      // deno-lint-ignore no-explicit-any
      const waitUntil = (globalThis as any).EdgeRuntime?.waitUntil;
      if (waitUntil) {
        waitUntil(background());
      } else {
        // Fora do runtime do Supabase (ex: rodando local sem EdgeRuntime) —
        // roda sem bloquear a resposta, só sem a garantia de não ser cortado.
        background().catch((err) => console.error("Erro no background():", err));
      }
    }

    return jsonResponse(immediate);
  } catch (err) {
    console.error("Erro ao rotear interação:", err);
    return jsonResponse(
      reply(`⚠️ Erro interno: ${err instanceof Error ? err.message : String(err)}`, {
        ephemeral: true,
      }),
    );
  }
});
