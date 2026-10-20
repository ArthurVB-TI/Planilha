/* pages/rules.js — Regras da liga */
window.Liga = window.Liga || {};
window.Liga.pages = window.Liga.pages || {};
(function (L) {
  "use strict";
  const { el } = L.dom;

  L.pages.rules = function (v) {
    L.ui.crumbs([{ label: "Regras" }]);
    v.append(L.ui.pageHead("Regras"));
    v.append(el("div", { class: "grid" },
      el("div", { class: "stack" },
        el("section", { class: "panel" },
          el("h2", null, "Pontos"),
          el("p", null, "Cada projeto tem listRats, e cada listRat tem as tarefas de cada integrante. O placar soma tudo desde que cada tarefa foi criada e não zera."),
          el("p", null, "Tarefa normal: ganha os pontos da dificuldade em cada dia (ou semana) em que for feita."),
          el("p", null, "Tarefa obrigatória: não dá pontos. Cada dia (ou semana) que termina sem ela tira os pontos da dificuldade. O dia conta depois da meia-noite; a semana, depois de domingo."),
          el("p", null, "Dá para marcar até 6 dias para trás.")),
        el("section", { class: "panel" },
          el("h2", null, "Quem faz o quê"),
          el("p", null, "Dono da liga: cria, edita e apaga projetos e escolhe os integrantes. Pode mexer em tudo."),
          el("p", null, "Qualquer integrante de um projeto pode criar uma listRat nele e vira o dono dela."),
          el("p", null, "Dono da listRat: renomeia, apaga e escolhe os ajudantes. Dono e ajudantes criam, editam e apagam as tarefas da listRat."),
          el("p", null, "Cada pessoa só marca as próprias tarefas.")),
        el("section", { class: "panel" },
          el("h2", null, "Foto de prova"),
          el("p", null, "Cada tarefa sua tem um botão de foto. No celular ele abre a câmera. Mandar a foto já marca a tarefa."),
          el("p", null, "Todo mundo vê as fotos e quantas marcações têm foto. Desmarcar o dia apaga a foto dele. A foto não é obrigatória."))),
      el("div", { class: "stack" }, L.ui.legend())));
  };
})(window.Liga);
