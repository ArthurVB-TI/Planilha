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
    const mineTasks = L.score.myTasks().filter(L.score.activeNow).sort(byUrgency);   // fora do período da listRat não aparece aqui
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

    if (!L.ui.visibleProjects().length) {
      v.append(el("section", { class: "panel" },
        el("h2", null, "Comece por um projeto"),
        el("p", { class: "muted small" }, "Crie um projeto (você vira o dono dele) e chame seus amigos com um link de convite. Se alguém já te mandou um link, é só abrir."),
        el("div", null, el("button", { class: "btn", type: "button", onclick: () => L.app.go({ page: "new" }) }, "Novo projeto"))));
    }

    // listRats em inscrições onde você ainda precisa preencher tarefas
    const insc = Object.values(S.subs).filter((s) => s.status === "inscricoes" && L.perms.canFillOwn(s))
      .map((s) => ({ s, st: L.enroll.personStatus(s, S.myId) }));
    if (insc.length) {
      v.append(el("section", { class: "panel insc-list" },
        el("h2", null, "Inscrições abertas"),
        el("div", { class: "subs" }, insc.map(({ s, st }) => {
          const p = S.projects[s.projectId];
          return el("button", { type: "button", class: "sub", onclick: () => L.app.go({ page: "sub", pid: s.projectId, sid: s.id }) },
            el("div", null,
              el("div", { class: "t" }, s.name, el("span", { class: "ptag-s " + (st.ready ? "agora" : "insc") }, st.ready ? "pronto" : "preencher")),
              el("div", { class: "small muted" }, (p ? p.name + " · " : "") + (st.ready ? "Você já está pronto. Falta o dono começar." : st.text + "."))),
            el("span", { class: "go" }, L.dom.icon("chevron")));
        }))));
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

    // placar geral: só você e seus amigos
    const friends = L.social.friends();
    const ids = [S.myId, ...friends];
    right.append(el("section", { class: "panel" },
      el("div", { class: "panel-head" }, el("h2", null, "Placar dos amigos"),
        el("button", { class: "link purple", type: "button", onclick: () => L.app.go({ page: "friends" }) }, friends.length ? "Amigos" : "Adicionar amigos")),
      L.ui.board(ids, all, "geral"),
      friends.length ? null : el("p", { class: "hint" }, "Só aparecem aqui você e seus amigos. Adicione amigos pelo nome de usuário.")));
  };
})(window.Liga);
