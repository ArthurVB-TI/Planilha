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
  const startEdit = (p) => { S.draft.editProject = { name: p.name, desc: p.desc, members: [...p.members] }; rerender(); };

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
        S.isOwner && !S.draft.editProject ? el("button", { class: "btn ghost", type: "button", onclick: () => startEdit(p) }, "Editar") : null));
    v.append(head);
    if (S.isOwner && S.draft.editProject) v.append(L.forms.projectEditForm(p));

    const grid = el("div", { class: "grid" });
    const left = el("div", { class: "stack" }), right = el("div", { class: "stack" });
    grid.append(left, right);
    v.append(grid);

    // listRats
    const sp = el("section", { class: "panel" },
      el("div", { class: "panel-head" }, el("h2", null, "ListRats"), el("span", { class: "muted" }, plural(subs.length, "listRat", "listRats"))));
    if (!subs.length) {
      sp.append(L.ui.empty(L.perms.canCreateSub(p) ? "Nenhuma listRat ainda. Crie a primeira abaixo." : "Nenhuma listRat ainda."));
    } else {
      sp.append(el("div", { class: "subs" }, subs.map((s) => {
        const st = ptasks.filter((t) => t.subId === s.id);
        const obr = st.filter((t) => t.type === "obrigatoria").length;
        const mineN = st.filter((t) => t.assignee === S.myId).length;
        const role = L.perms.roleIn(s, S.myId);
        return el("button", { type: "button", class: "sub", onclick: () => go({ page: "sub", pid: p.id, sid: s.id }) },
          el("div", null,
            el("div", { class: "t" }, s.name, role ? el("span", { class: "role" }, role) : null),
            el("div", { class: "small muted" },
              "dono: " + L.ui.nameOf(L.perms.subOwner(s)) + " · " +
              plural(st.length, "tarefa", "tarefas") + (obr ? " · " + plural(obr, "obrigatória", "obrigatórias") : "") + (mineN ? " · " + mineN + " sua" + (mineN > 1 ? "s" : "") : ""))),
          el("span", { class: "go" }, icon("chevron")));
      })));
    }
    if (L.perms.canCreateSub(p)) {
      sp.append(el("form", { class: "row", id: "subForm", onsubmit: async (ev) => {
        ev.preventDefault();
        const name = clean(S.draft.sub, 60);
        if (!name) return;
        $("sErr").textContent = "";
        try { await L.actions.createSub(p.id, name); S.draft.sub = ""; rerender(); }
        catch (e) { $("sErr").textContent = L.actions.errMsg(e, "Não deu para criar a listRat."); }
      } },
        el("div", { class: "field grow" }, el("label", { for: "sName" }, "Nova listRat"),
          el("input", { id: "sName", maxlength: "60", required: true, autocomplete: "off", placeholder: "Academia, Faculdade, Casa…",
            value: S.draft.sub, oninput: (e) => { S.draft.sub = e.target.value; } })),
        el("button", { class: "btn", type: "submit" }, "Criar")),
        el("p", { class: "hint" }, "Quem cria a listRat vira o dono dela e pode chamar ajudantes."),
        el("div", { class: "err", id: "sErr" }));
    }
    left.append(sp);

    // integrantes
    const mp = el("section", { class: "panel" },
      el("div", { class: "panel-head" }, el("h2", null, "Integrantes"),
        S.isOwner && !S.draft.editProject
          ? el("button", { class: "link", type: "button", onclick: () => { startEdit(p); window.scrollTo({ top: 0 }); } }, "adicionar ou tirar")
          : el("span", { class: "muted" }, plural(p.members.length, "pessoa", "pessoas"))));
    mp.append(p.members.length ? el("div", { class: "people" }, p.members.map((id) => L.ui.personChip(id))) : L.ui.empty("Sem integrantes."));
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
