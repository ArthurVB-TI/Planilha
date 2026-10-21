/* pages/project.js — um projeto: listRats, integrantes, placar e gestão */
window.Liga = window.Liga || {};
window.Liga.pages = window.Liga.pages || {};
(function (L) {
  "use strict";
  const S = L.S;
  const { el, icon, $ } = L.dom;
  const { clean, fmtTotal, plural } = L.text;

  const go = (v) => L.app.go(v);
  const rerender = () => L.app.render();
  const startEdit = (p) => { S.draft.editProject = { name: p.name, desc: p.desc }; rerender(); };

  L.pages.project = function (v) {
    const p = S.projects[S.view.pid];
    if (!p) return L.pages.notFound(v);
    if (!L.perms.canSeeProject(p)) return L.pages.notFound(v);
    L.ui.crumbs([{ label: "Projetos", go: () => go({ page: "projects" }) }, { label: p.name }]);

    const ptasks = L.score.tasksOfProject(p.id);
    const subs = Object.values(S.subs).filter((s) => s.projectId === p.id).sort((a, b) => a.createdAt - b.createdAt);
    const my = L.score.scoreFor(S.myId, ptasks);

    const head = L.ui.pageHead(p.name, p.desc || "",
      el("div", { class: "row", style: "align-items:center" },
        p.members.includes(S.myId) ? el("div", { class: "stats" }, L.ui.stat("Seus pontos aqui", fmtTotal(my.total), my.total < 0 ? "neg" : "")) : null,
        el("button", { class: "btn ghost", type: "button", onclick: () => {
          S.draft.charts = Object.assign(S.draft.charts || { range: "30", type: "pontos", table: false }, { pid: p.id, sid: "" });
          go({ page: "charts" });
        } }, icon("chart"), "Gráficos"),
        S.isOwner && !S.draft.editProject ? el("button", { class: "btn ghost", type: "button", onclick: () => startEdit(p) }, "Editar") : null));
    v.append(head);
    if (S.isOwner && S.draft.editProject) v.append(L.forms.projectEditForm(p));

    const grid = el("div", { class: "grid" });
    const left = el("div", { class: "stack" }), right = el("div", { class: "stack" });
    grid.append(left, right);
    v.append(grid);

    // listRats
    const canNew = L.perms.canCreateSub(p);
    const sp = el("section", { class: "panel" },
      el("div", { class: "panel-head" }, el("h2", null, "ListRats"),
        canNew
          ? el("button", { class: "btn sm", type: "button", onclick: () => go({ page: "subform", pid: p.id }) }, icon("plus"), "Nova listRat")
          : el("span", { class: "muted" }, plural(subs.length, "listRat", "listRats"))));
    if (!subs.length) {
      sp.append(L.ui.empty(canNew ? "Nenhuma listRat ainda. Crie a primeira em \"Nova listRat\"." : "Nenhuma listRat ainda."));
    } else {
      sp.append(el("div", { class: "subs" }, subs.map((s) => {
        const st = ptasks.filter((t) => t.subId === s.id);
        const obr = st.filter((t) => t.type === "obrigatoria").length;
        const mineN = st.filter((t) => t.assignee === S.myId).length;
        const role = L.perms.roleIn(s, S.myId);
        return el("button", { type: "button", class: "sub", onclick: () => go({ page: "sub", pid: p.id, sid: s.id }) },
          el("div", null,
            el("div", { class: "t" }, s.name, role ? el("span", { class: "role" }, role) : null, L.ui.periodTag(s)),
            L.ui.period(s).text ? el("div", { class: "small muted" }, L.ui.period(s).text) : null,
            el("div", { class: "small muted" },
              "dono: " + L.ui.nameOf(L.perms.subOwner(s)) + " · " +
              plural(st.length, "tarefa", "tarefas") + (obr ? " · " + plural(obr, "obrigatória", "obrigatórias") : "") + (mineN ? " · " + mineN + " sua" + (mineN > 1 ? "s" : "") : ""))),
          el("span", { class: "go" }, icon("chevron")));
      })));
    }
    if (canNew) sp.append(el("p", { class: "hint" }, "Quem cria a listRat vira o dono dela e pode chamar ajudantes."));
    left.append(sp);

    // integrantes
    const openMembers = () => go({ page: "members", pid: p.id });
    const mp = el("section", { class: "panel" },
      el("div", { class: "panel-head" }, el("h2", null, "Integrantes"),
        el("span", { class: "muted" }, plural(p.members.length, "pessoa", "pessoas"))));
    mp.append(p.members.length
      ? el("div", { class: "people" }, p.members.map((id) =>
          el("button", { type: "button", class: "person", title: "Ver " + L.ui.nameOf(id), onclick: () => go({ page: "members", pid: p.id, uid: id }) },
            L.ui.avatar(id), el("span", { text: L.ui.nameOf(id) }))))
      : L.ui.empty(S.isOwner ? "Ninguém ainda. Adicione quem vai participar." : "Sem integrantes."));
    mp.append(el("div", null, el("button", { class: S.isOwner ? "btn" : "btn ghost", type: "button", onclick: openMembers },
      icon("users"), S.isOwner ? "Adicionar e gerenciar" : "Ver integrantes")));
    left.append(mp);

    right.append(el("section", { class: "panel" }, el("h2", null, "Placar do projeto"), L.ui.board(p.members, ptasks, "p" + p.id)));

    if (S.isOwner) {
      right.append(el("section", { class: "panel" },
        el("h3", null, "Apagar projeto"),
        el("p", { class: "muted small" }, "Apaga o projeto, as listRats e as tarefas dele."),
        S.confirm === "p:" + p.id
          ? L.ui.confirmRow("Tem certeza?", "Apagar tudo", async () => {
              S.confirm = null;
              try { await L.actions.deleteProject(p.id); go({ page: "projects" }); }
              catch (e) { L.app.setStatus(L.actions.errMsg(e, "Não deu para apagar o projeto."), true); rerender(); }
            })
          : el("div", null, el("button", { class: "btn ghost sm", type: "button", onclick: () => { S.confirm = "p:" + p.id; rerender(); } }, "Apagar projeto"))));
    }
  };
})(window.Liga);
