ão Inicial**\n` +
      `📌 Título: ${tituloExibido}\n\n` +
      `Defina os parâmetros do conteúdo usando os menus abaixo e clique em Avançar:`,
    components: [
      new ActionRowBuilder().addComponents(menuAtividades),
      new ActionRowBuilder().addComponents(menuCidades),
      new ActionRowBuilder().addComponents(menuZonas),
      new ActionRowBuilder().addComponents(botaoTitulo),
      new ActionRowBuilder().addComponents(botaoAvancar),
    ],
  };
}

// Monta a linha de botões de bônus (Mana/Runa/Reset/Guardião etc.) a partir do config.js
function montarBotoesBonus() {
  const botoes = listaDeConfig.bonus.map((b) =>
    new ButtonBuilder()
      .setCustomId(`bonus_${b.value}`)
      .setLabel(b.label)
      .setEmoji(b.emoji)
      .setStyle(ButtonStyle.Secondary),
  );
  return new ActionRowBuilder().addComponents(botoes);
}

async function atualizarComponentesPainel(
  linhas,
  opcoesClasse,
  liderId,
  guild,
) {
  const componentes = [];

  // 1. Recria o menu select principal de inscrições
  const menuInscricao = new StringSelectMenuBuilder()
    .setCustomId("vaga_publica_inscrever")
    .setPlaceholder("Selecione sua classe para entrar nesta PT")
    .addOptions(opcoesClasse);
  componentes.push(new ActionRowBuilder().addComponents(menuInscricao));

  // 2. Recria o botão Sair da PT
  const btnDesistir = new ButtonBuilder()
    .setCustomId("vaga_publica_desistir")
    .setLabel("❌ Sair da PT")
    .setStyle(ButtonStyle.Danger);

  componentes.push(new ActionRowBuilder().addComponents(btnDesistir));

  // 2.5. Recria a linha de botões de bônus
  componentes.push(montarBotoesBonus());

  // 3. Varre dinamicamente a mensagem pública mapeando quem está na PT e em qual vaga
  const jogadoresInscritos = []; // [{ mention, cargo }]
  linhas.forEach((linha) => {
    if (linha.includes("👑 Criador:")) return;
    const matches = linha.match(/<@\d+>/g);
    if (matches) {
      const matchCargo = linha.match(/\(\d+\/\d+\)\s*(.+?)\s*(?:<@|$)/);
      // Remove o código cru de emoji customizado (<:tag:id>) — labels de dropdown
      // não renderizam isso, então mostraria texto feio tipo "<:arcolongo:123...>"
      const cargo = matchCargo
        ? matchCargo[1]
            .replace(/<a?:\w+:\d+>\s*/g, "")
            .replace(/:\w+:\s*/g, "")
            .replace(/\s+/g, " ")
            .trim()
        : "";
      matches.forEach((membro) => {
        if (!jogadoresInscritos.some((j) => j.mention === membro)) {
          jogadoresInscritos.push({ mention: membro, cargo });
        }
      });
    }
  });

  // Se a lista possuir membros integrados, gera o menu secreto de kick
  if (jogadoresInscritos.length > 0) {
    const opcoesKick = [];
    for (const { mention, cargo } of jogadoresInscritos) {
      const idBruto = mention.replace(/[<@>]/g, "");
      let nomeExibicao = idBruto;

      // Busca o apelido/nome real do jogador no servidor (cache primeiro, depois API)
      if (guild) {
        try {
          let membro = guild.members.cache.get(idBruto);
          if (!membro) membro = await guild.members.fetch(idBruto);
          nomeExibicao = membro.displayName;
        } catch (err) {
          nomeExibicao = idBruto; // Jogador saiu do servidor ou não encontrado
        }
      }

      const rotulo = cargo ? `${nomeExibicao} — ${cargo}` : nomeExibicao;

      opcoesKick.push(
        new StringSelectMenuOptionBuilder()
          .setLabel(rotulo.slice(0, 100)) // Discord limita labels a 100 caracteres
          .setValue(mention),
      );
    }

    const menuKick = new StringSelectMenuBuilder()
      .setCustomId("vaga_publica_kickar")
      .setPlaceholder("⚙️ Gerenciar PT: Kickar jogador (Apenas Líder)")
      .addOptions(opcoesKick);

    componentes.push(new ActionRowBuilder().addComponents(menuKick));
  }

  return componentes;
}

async function renderizarPasso2(interaction, dados) {
  const rowBotoesTier = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("tier_true")
      .setLabel("Com limite de Tier")
      .setStyle(
        dados.temTier === true ? ButtonStyle.Primary : ButtonStyle.Secondary,
      ),
    new ButtonBuilder()
      .setCustomId("tier_false")
      .setLabel("Tier Livre")
      .setStyle(
        dados.temTier === false ? ButtonStyle.Primary : ButtonStyle.Secondary,
      ),
  );

  const rowBotoesSkip = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("skip_true")
      .setLabel("Precisa Set Skip (T4)")
      .setStyle(
        dados.precisaSkip === true ? ButtonStyle.Danger : ButtonStyle.Secondary,
      ),
    new ButtonBuilder()
      .setCustomId("skip_false")
      .setLabel("Não precisa de Skip")
      .setStyle(
        dados.precisaSkip === false
          ? ButtonStyle.Success
          : ButtonStyle.Secondary,
      ),
  );

  const rows = [rowBotoesTier];

  if (dados.temTier === true) {
    const menuTiers = new StringSelectMenuBuilder()
      .setCustomId("select_tier_especifico")
      .setPlaceholder(`📊 Selecione o Tier`)
      .addOptions(
        { label: "T4.1 Equivalente", value: "T4.1 Equivalente" },
        { label: "T4.2 Equivalente", value: "T4.2 Equivalente" },
        { label: "T4.3 Equivalente", value: "T4.3 Equivalente" },
        { label: "T5.0 Equivalente", value: "T5.0 Equivalente" },
        { label: "T6.0 Equivalente", value: "T6.0 Equivalente" },
        { label: "T7.0 Equivalente", value: "T7.0 Equivalente" },
        { label: "T8.0 Equivalente", value: "T8.0 Equivalente" },
      );
    rows.push(new ActionRowBuilder().addComponents(menuTiers));
  }

  rows.push(rowBotoesSkip);
  const pronto = dados.temTier !== null && dados.precisaSkip !== null;

  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("btn_passo3")
        .setLabel("Avançar para Montar a PT ➡️")
        .setStyle(ButtonStyle.Success)
        .setDisabled(!pronto),
    ),
  );

  await interaction.editReply({
    content: `🛠 **PASSO 2: Requisitos de Entrada**\n• Tier Mínimo: **${dados.tier}**\n• Set de Skip: **${dados.precisaSkip === null ? "Pendente" : dados.precisaSkip ? "Obrigatório T4+" : "Dispensado"}**`,
    components: rows,
  });
}

async function renderizarPasso3(interaction, dados) {
  if (!dados.classesAtivas) {
    let textoSelecao =
      `🛠️ **PASSO 3: Seleção de Composição da PT**\n` +
      `Escolha no menu abaixo **quais classes** farão parte deste conteúdo (Máximo de 25 exibidas):`;

    const opcoesDropdown = listaDeConfig.funcoes.slice(0, 25).map((classe) => {
      const { nome, emoji } = parseClasseComEmoji(classe);
      const opcao = new StringSelectMenuOptionBuilder()
        .setLabel(nome)
        .setValue(classe);
      if (emoji) opcao.setEmoji(emoji);
      return opcao;
    });

    const menuSelecaoClasses = new StringSelectMenuBuilder()
      .setCustomId("selecionar_classes_da_pt")
      .setPlaceholder("🧙‍♂️ Quais classes terão vagas nesta PT?")
      .setMinValues(1)
      .setMaxValues(opcoesDropdown.length)
      .addOptions(opcoesDropdown);

    return interaction
      .editReply({
        content: textoSelecao,
        components: [new ActionRowBuilder().addComponents(menuSelecaoClasses)],
      })
      .catch((err) =>
        console.log("Erro ao renderizar seleção de classes:", err),
      );
  }

  if (
    !dados.classeFocada ||
    !dados.classesAtivas.includes(dados.classeFocada)
  ) {
    dados.classeFocada = dados.classesAtivas[0];
  }

  let textoPainel =
    `🛠️ **PASSO 3: Painel de Vagas da PT**\n` +
    `Selecione a classe nos botões abaixo para ver os controles de ajuste individual:\n\n` +
    `➡️ **Modificando agora:** ${formatarClasseParaMensagem(dados.classeFocada)}\n`;

  const componentesInterface = [];

  let linhaBotaoAtual = new ActionRowBuilder();
  let botoesNaLinha = 0;

  for (const classe of dados.classesAtivas) {
    const qtd = dados.funcoes[classe] !== undefined ? dados.funcoes[classe] : 1;

    const { nome: nomeClasse, emoji: emojiClasse } =
      parseClasseComEmoji(classe);

    const btnClasse = new ButtonBuilder()
      .setCustomId(`focar_cl_${classe}`)
      .setLabel(`${nomeClasse} (${qtd})`)
      .setStyle(
        classe === dados.classeFocada
          ? ButtonStyle.Primary
          : ButtonStyle.Secondary,
      );
    if (emojiClasse) btnClasse.setEmoji(emojiClasse);

    linhaBotaoAtual.addComponents(btnClasse);
    botoesNaLinha++;

    if (botoesNaLinha === 5) {
      componentesInterface.push(linhaBotaoAtual);
      linhaBotaoAtual = new ActionRowBuilder();
      botoesNaLinha = 0;
    }
  }
  if (botoesNaLinha > 0 && componentesInterface.length < 3) {
    componentesInterface.push(linhaBotaoAtual);
  }

  const { nome: nomeClasseFoco } = parseClasseComEmoji(dados.classeFocada);
  const qtdAtualFoco =
    dados.funcoes[dados.classeFocada] !== undefined
      ? dados.funcoes[dados.classeFocada]
      : 1;

  const rowAjusteDireto = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("painel_rem_1")
      .setLabel(`➖ Diminuir ${nomeClasseFoco}`)
      .setStyle(ButtonStyle.Danger)
      .setDisabled(qtdAtualFoco <= 0),
    new ButtonBuilder()
      .setCustomId("painel_add_1")
      .setLabel(`➕ Aumentar ${nomeClasseFoco}`)
      .setStyle(ButtonStyle.Success),
  );
  componentesInterface.push(rowAjusteDireto);

  const rowControlesFinais = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("btn_voltar_classes")
      .setLabel("🔄 Mudar Classes")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("btn_gerar_painel_final")
      .setLabel("🚀 GERAR PAINEL FINAL")
      .setStyle(ButtonStyle.Success),
  );
  componentesInterface.push(rowControlesFinais);

  await interaction
    .editReply({
      content: textoPainel,
      components: componentesInterface,
    })
    .catch((err) => console.log("Erro no Passo 3 Botões Dinâmicos:", err));
}

client.login(token);
