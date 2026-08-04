// rest.ts - Wrapper fino sobre a API REST do Discord.
// Sem discord.js: tudo aqui é fetch() cru contra https://discord.com/api/v10.
// Usado pra qualquer coisa que precise acontecer DEPOIS da resposta imediata
// da interação (editar a mensagem do painel, criar tópico, buscar membro/emoji).

import { ActionRowComponent, DiscordEmbed } from "./types.ts";

const API_BASE = "https://discord.com/api/v10";

function token(): string {
  const t = Deno.env.get("DISCORD_TOKEN");
  if (!t) throw new Error("DISCORD_TOKEN não configurado nos secrets da function");
  return t;
}

async function discordFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${token()}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    const corpo = await res.text().catch(() => "");
    throw new Error(`Discord REST ${init.method ?? "GET"} ${path} -> ${res.status}: ${corpo}`);
  }

  return res;
}

export interface EditarMensagemPayload {
  content?: string;
  components?: ActionRowComponent[];
  embeds?: DiscordEmbed[];
}

// Edita uma mensagem qualquer do canal (equivalente a interaction.message.edit()).
export async function editarMensagem(
  canalId: string,
  mensagemId: string,
  payload: EditarMensagemPayload,
): Promise<void> {
  await discordFetch(`/channels/${canalId}/messages/${mensagemId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

// Envia uma mensagem nova num canal/tópico (equivalente a channel.send()).
export async function enviarMensagem(
  canalId: string,
  payload: EditarMensagemPayload,
): Promise<{ id: string; content: string }> {
  const res = await discordFetch(`/channels/${canalId}/messages`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.json();
}

// Cria um tópico "solo" (sem mensagem inicial) num canal de texto.
// type: 11 = PUBLIC_THREAD. auto_archive_duration em minutos.
export async function criarTopico(
  canalPaiId: string,
  nome: string,
  autoArchiveDuration = 1440,
): Promise<{ id: string }> {
  const res = await discordFetch(`/channels/${canalPaiId}/threads`, {
    method: "POST",
    body: JSON.stringify({
      name: nome.slice(0, 100),
      type: 11,
      auto_archive_duration: autoArchiveDuration,
    }),
  });
  return res.json();
}

// Cria um canal de voz num servidor. type: 2 = GUILD_VOICE.
export async function criarCanalVoz(guildId: string, nome: string): Promise<{ id: string }> {
  const res = await discordFetch(`/guilds/${guildId}/channels`, {
    method: "POST",
    body: JSON.stringify({ name: nome.slice(0, 100), type: 2 }),
  });
  return res.json();
}

// Apaga um canal (usado pra fechar a sala de voz).
export async function apagarCanal(canalId: string): Promise<void> {
  await discordFetch(`/channels/${canalId}`, { method: "DELETE" });
}

// Edita a resposta original de uma interação (a mensagem criada pelo
// deferredReply/reply inicial) — usa o webhook da própria interação, não
// precisa saber o id da mensagem.
export async function editarRespostaOriginal(
  applicationId: string,
  interactionToken: string,
  payload: EditarMensagemPayload,
): Promise<void> {
  await discordFetch(`/webhooks/${applicationId}/${interactionToken}/messages/@original`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

// Manda uma mensagem de acompanhamento pra mesma interação (equivalente a
// interaction.followUp()) — usado pra avisos de erro depois de um deferUpdate.
export async function enviarFollowUp(
  applicationId: string,
  interactionToken: string,
  payload: EditarMensagemPayload & { flags?: number },
): Promise<void> {
  await discordFetch(`/webhooks/${applicationId}/${interactionToken}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface MembroDiscord {
  user: { id: string; username: string; global_name?: string | null };
  nick?: string | null;
}

// Busca o apelido/nome real do jogador no servidor (equivalente a
// guild.members.fetch()). Se falhar (jogador saiu do servidor), retorna null.
export async function buscarMembro(
  guildId: string,
  userId: string,
): Promise<MembroDiscord | null> {
  try {
    const res = await discordFetch(`/guilds/${guildId}/members/${userId}`);
    return res.json();
  } catch {
    return null;
  }
}

export function nomeExibicaoMembro(membro: MembroDiscord | null, fallbackId: string): string {
  if (!membro) return fallbackId;
  return membro.nick ?? membro.user.global_name ?? membro.user.username;
}

export interface EmojiGuilda {
  id: string;
  name: string;
  animated?: boolean;
}

// Busca os emojis customizados do servidor (equivalente ao client.emojis.cache
// do v1, mas sob demanda em vez de resolvido no boot — não existe "boot" aqui).
export async function buscarEmojisDaGuilda(guildId: string): Promise<EmojiGuilda[]> {
  const res = await discordFetch(`/guilds/${guildId}/emojis`);
  return res.json();
}
