/* pages/home.js — Início: todas as suas tarefas (de qualquer projeto), seus pontos e o placar geral */
window.Liga = window.Liga || {};
window.Liga.pages = window.Liga.pages || {};
(function (L) {
  "use strict";
  const S = L.S;
  const { el } = L.dom;
  const { clean, fmtTotal, fmtPts, plural } = L.text;
  const { DIFF_KEYS, NICK_MAX } = L.rules;

  const byUrgency = (a, b) =>
    (a.type === "obrigatoria" ? 0 : 1) - (b.type === "obrigatoria" ? 0 : 1) ||
    (a.kind === "daily" ? 0 : 1) - (b.kind === "daily" ? 0 : 1) ||
    DIFF_KEYS.indexOf(b.diff) - DIFF_KEYS.indexOf(a.diff) ||
    a.createdAt - b.createdAt;

  function where(t) {
    const sub = S.subs[t.subId], proj = sub && S.projects[sub.projectId];
    return (proj ? proj.name + " / " : "") + (sub ? sub.name : "");
  }

  L.pages.home = function (v) {
    L.ui.crumbs([{ label: "Início" }]);
    const all = Object.values(S.tasks);
    const my = L.score.scoreFor(S.myId, all);
    const mineTasks = L.score.myTasks().sort(byUrgency);
    const pend = mineTasks.filter((t) => !L.score.doneNow(t));
    const done = mineTasks.filter((t) => L.score.doneNow(t));

    const date = L.dates.longToday();
    v.append(L.ui.pageHead("Hoje", date.charAt(0).toUpperCase() + date.slice(1),
      el("div", { class: "stats" },
        L.ui.stat("Total", my.total, my.total < 0 ? "neg" : "", { key: "home-total", fmt: fmtTotal }),
        L.ui.stat("Ganhos", my.plus, my.plus ? "pos" : "", { key: "home-plus", fmt: fmtPts }),
        L.ui.stat("Perdidos", -my.minus, my.minus ? "neg" : "", { key: "home-minus", fmt: fmtPts }))));

    if (mineTasks.length) {
      const pct = Math.round((done.length / mineTasks.length) * 100);
      const meter = el("div", { class: "meter" },
        el("div", { class: "lbl-row" },
          el("span", null, pend.length ? "Faltam " + plural(pend.length, "tarefa", "tarefas") : "Tudo feito"),
          el("b", { "data-count": "home-done" }, L.fx.count("home-done", done.length, (n) => n + "/" + mineTasks.length))),
        el("div", { class: "bar" }, L.fx.bar("home", pct)));
      v.append(meter);
      L.fx.progress(done.length, mineTasks.length, meter);
    }

    if (S.mode === "firebase" && S.configLoaded && !S.ownerId) {
      v.append(el("div", { class: "status warn" }, "A liga ainda não tem dono. Se o site é seu, assuma em ",
        el("button", { class: "link", type: "button", onclick: () => L.app.go({ page: "settings" }) }, "Configurações"), "."));
    }

    const grid = el("div", { class: "grid" });
    const left = el("div", { class: "stack" }), right = el("div", { class: "stack" });
    grid.append(left, right);
    v.append(grid);

    // tarefas que eu tenho que fazer, de todos os projetos juntos
    const todo = el("section", { class: "stack", style: "gap:10px" },
      el("div", { class: "panel-head" }, el("h2", null, "Minhas tarefas"),
        el("span", { class: "muted" }, mineTasks.length ? pend.length + " pendente" + (pend.length === 1 ? "" : "s") : "")));
    if (!mineTasks.length) {
      todo.append(L.ui.empty("Você ainda não tem tarefas. Entre num projeto em Projetos, crie uma listRat e adicione tarefas."));
    } else if (!pend.length) {
      todo.append(L.ui.empty("Nada pendente por agora."));
    } else {
      todo.append(el("div", { class: "tlist" }, pend.map((t) => L.ui.taskCard(t, { where: where(t) }))));
    }
    left.append(todo);

    if (done.length) {
      left.append(el("section", { class: "stack", style: "gap:10px" },
        el("div", { class: "panel-head" }, el("h2", null, "Feitas"), el("span", { class: "muted" }, String(done.length))),
        el("div", { class: "tlist" }, done.map((t) => L.ui.taskCard(t, { where: where(t) })))));
    }

    const ids = Object.keys(S.players).filter((id) => clean(S.players[id].nick, NICK_MAX));
    right.append(el("section", { class: "panel" },
      el("div", { class: "panel-head" }, el("h2", null, "Placar geral")),
      L.ui.board(ids, all, "geral")));
  };
})(window.Liga);
