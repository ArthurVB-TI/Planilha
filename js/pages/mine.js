/* pages/mine.js — Minhas tarefas, agrupadas por listRat */
window.Liga = window.Liga || {};
window.Liga.pages = window.Liga.pages || {};
(function (L) {
  "use strict";
  const S = L.S;
  const { el } = L.dom;
  const { fmtTotal } = L.text;

  L.pages.mine = function (v) {
    L.ui.crumbs([{ label: "Minhas tarefas" }]);
    const mt = L.score.myTasks();
    const sc = L.score.scoreFor(S.myId, mt);
    v.append(L.ui.pageHead("Minhas tarefas", "Em todos os projetos",
      el("div", { class: "stats" },
        L.ui.stat("Tarefas", String(mt.length)),
        L.ui.stat("Saldo", fmtTotal(sc.total), sc.total < 0 ? "neg" : ""))));

    if (!mt.length) { v.append(L.ui.empty("Você ainda não tem tarefas.")); return; }

    for (const p of L.ui.visibleProjects()) {
      const subs = Object.values(S.subs).filter((s) => s.projectId === p.id).sort((a, b) => a.createdAt - b.createdAt);
      for (const s of subs) {
        const list = mt.filter((t) => t.subId === s.id)
          .sort((a, b) => (a.type === "obrigatoria" ? 0 : 1) - (b.type === "obrigatoria" ? 0 : 1) || a.createdAt - b.createdAt);
        if (!list.length) continue;
        v.append(el("section", { class: "stack", style: "gap:10px" },
          el("div", { class: "panel-head" },
            el("h2", { text: s.name }),
            el("button", { class: "link", type: "button", onclick: () => L.app.go({ page: "sub", pid: p.id, sid: s.id }), text: p.name })),
          el("div", { class: "tlist" }, list.map((t) => L.ui.taskCard(t)))));
      }
    }
  };
})(window.Liga);
