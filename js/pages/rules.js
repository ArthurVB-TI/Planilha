/* pages/rules.js — Regras do listRats (o que vale hoje no site) */
window.Liga = window.Liga || {};
window.Liga.pages = window.Liga.pages || {};
(function (L) {
  "use strict";
  const { el } = L.dom;

  const sec = (title, ...ps) => el("section", { class: "panel" }, el("h2", null, title), ps.map((p) => (typeof p === "string" ? el("p", null, p) : p)));
  const list = (items) => el("ul", { class: "rules-list" }, items.map((t) => el("li", null, t)));

  L.pages.rules = function (v) {
    L.ui.crumbs([{ label: "Regras" }]);
    v.append(L.ui.pageHead("Regras"));
    const grace = L.rules.PROOF_GRACE;
    const D = L.rules.DIFF;
    v.append(el("div", { class: "grid" },
      el("div", { class: "stack" },
        sec("Projetos e listRats",
          "Qualquer pessoa cria um projeto e vira o dono dele. Ninguém entra direto: o dono convida (a pessoa aceita nas notificações) ou manda um link de convite que vence.",
          "Cada projeto tem listRats: uma competição com começo e (se quiser) fim. Qualquer integrante pode criar uma listRat no projeto e vira o dono dela."),

        sec("Inscrições",
          "Toda listRat começa em inscrições. Cada integrante cria as próprias tarefas e só participa quem cumprir as regras do dono: mínimo de obrigatórias e mínimo (e, se tiver, máximo) de tarefas normais.",
          "O desvio padrão dos pontos possíveis por semana de quem está pronto precisa ficar dentro do máximo para a listRat começar. Ele não impede ninguém de entrar, só impede começar.",
          "Depois que a listRat começa, as tarefas ficam travadas: ninguém muda nada, nem o nome, e ninguém apaga."),

        sec("Pontos e placar",
          list([
            "Tarefa normal: ganha os pontos da dificuldade (fácil " + D.facil.pts + ", média " + D.media.pts + ", difícil " + D.dificil.pts + ") em cada dia (ou semana) feito.",
            L.rules.OBR_PENALTY
              ? "Tarefa obrigatória: não dá pontos; cada dia (ou semana) sem ela tira os pontos da dificuldade."
              : "Tarefa obrigatória: não vale pontos. É o compromisso mínimo para entrar, e o dia sem ela aparece como \"faltou\" para todo mundo ver.",
          ]),
          el("p", null, el("b", null, "Cada listRat escolhe o tipo de placar"), " na hora de criar (não muda depois de começar):"),
          list([
            "Por pontos: ganha quem somar mais pontos.",
            "Por porcentagem: ganha quem fizer a maior parte do que dava para fazer. A conta é pontos feitos ÷ pontos possíveis das próprias tarefas normais (ex.: 150 de 200 = 75%). Assim não importa se alguém escolheu tarefas que valem mais ou menos. O dia de hoje só entra na conta depois de feito.",
          ]),
          "O placar do Início e o do projeto somam os pontos de todas as listRats. O gráfico de pontuação mostra a porcentagem quando você escolhe uma listRat por porcentagem."),

        sec("Marcar e provar",
          "Cada pessoa só marca as próprias tarefas. Dá para marcar o dia de hoje e o de ontem (na tarefa semanal, a semana atual e a anterior até segunda-feira).",
          el("p", null, el("b", null, "Um dia marcado só conta com prova: uma foto ou um comentário"), " (pelo menos um dos dois). Mandar a foto já marca o dia."),
          "Você tem até o fim do dia seguinte ao prazo para pôr a prova (" + (grace === 1 ? "1 dia" : grace + " dias") + " depois; na semanal, até a segunda-feira depois da semana). Enquanto falta, o dia aparece como \"falta foto ou comentário\" e não dá pontos. Depois do prazo, ele não conta.",
          "Todo mundo vê as fotos, os comentários e em que dia e hora cada prova foi colocada."),

        sec("Não consegui fazer",
          "Quem não fez um dia pode mandar uma justificativa (comentário obrigatório, foto opcional). Ela só conta como feita se o dono ou um ajudante da listRat aceitar."),

        sec("Fim da listRat: contestação e resultado",
          "No dia seguinte ao fim é o dia de contestação: cada participante pode duvidar de até " + L.review.MAX_CONTESTS + " tarefas de outras pessoas, e cada tarefa só pode ser contestada uma vez.",
          "Quem for contestado tem até o fim do dia para mandar uma prova. Sem prova (ou se o dono ou um ajudante recusar), a tarefa perde os pontos.",
          "Depois aparece o resultado final, com ouro, prata e bronze."),

        sec("Valores em reais",
          "Quem cria a listRat pode definir quanto o 1º, o 2º e o 3º ganham e quanto o último, o penúltimo e o antepenúltimo pagam. Os valores aparecem no placar e no resultado.",
          "Quem está no top 3 não paga: os 3 piores são contados entre os outros. Com empate, os dois levam o valor da posição. O site só mostra os valores; o pagamento é combinado entre vocês."),

        sec("Quem faz o quê",
          list([
            "Dono do projeto: edita e apaga o projeto, convida e tira integrantes, cria links de convite, passa o projeto para outra pessoa e mexe em todas as listRats dele.",
            "Dono da listRat: edita as datas e os detalhes (tipo de placar, valores e regras só antes de começar), apaga, escolhe ajudantes e pode tirar pessoas da listRat.",
            "Ajudantes da listRat: mudam as regras de inscrição, começam a listRat, incluem participantes e aceitam ou recusam justificativas e provas.",
            "Cada pessoa: cria, edita e apaga só as próprias tarefas, e só nas inscrições.",
          ]))),
      el("div", { class: "stack" }, L.ui.legend())));
  };
})(window.Liga);
