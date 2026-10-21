/* pages/sub.js — uma listRat: hierarquia (dono e ajudantes), nova tarefa e uma coluna por integrante */
window.Liga = window.Liga || {};
window.Liga.pages = window.Liga.pages || {};
(function (L) {
  "use strict";
  const S = L.S;
  const P = L.perms;
  const { el } = L.dom;
  const { clean, fmtTotal, plural } = L.text;

  const go = (v) => L.app.go(v);
  const rerender = () => L.app.render();
  const byType = (a, b) => (a.type === "obrigatoria" ? 0 : 1) - (b.type === "obrigatoria" ? 0 : 1) || a.createdAt - b.createdAt;

  /* ---------- dono e ajudantes ---------- */
  function team(s, p) {
    const owner = P.subOwner(s);
    const editing = S.draft.editHelpers && S.draft.editHelpers.sid === s.id ? S.draft.editHelpers : null;

    const ownerRow = el("div", { class: "rank-row" },
      el("span", { class: "role-lbl" }, "Dono"),
      el("div", { class: "people" }, owner ? L.ui.personChip(owner) : el("span", { class: "muted" }, "—")));

    let helpersBody;
    if (editing) {
      const candidates = p.members.filter((id) => id !== owner);
      helpersBody = el("div", { class: "f" },
        candidates.length
          ? el("div", { class: "people" }, candidates.map((id) => L.ui.personChip(id, () => {
              const set = new Set(editing.helpers);
              set.has(id) ? set.delete(id) : set.add(id);
              editing.helpers = [...set];
              rerender();
            }, editing.helpers.includes(id))))
          : el("p", { class: "hint" }, "Não tem mais ninguém no projeto para chamar."),
        el("div", { class: "row" },
          el("button", { class: "btn sm", type: "button", onclick: async () => {
            try { await L.actions.setSubHelpers(s.id, editing.helpers); S.draft.editHelpers = null; rerender(); }
            catch (e) { L.app.setStatus(L.actions.errMsg(e, "Não deu para salvar os ajudantes."), true); }
          } }, "Salvar"),
          el("button", { class: "btn ghost sm", type: "button", onclick: () => { S.draft.editHelpers = null; rerender(); } }, "Cancelar")));
    } else {
      helpersBody = s.helpers.length
        ? el("div", { class: "people" }, s.helpers.map((id) => L.ui.personChip(id)))
        : el("span", { class: "muted small" }, "Nenhum ajudante.");
    }

    const helpersRow = el("div", { class: "rank-row" },
      el("span", { class: "role-lbl" }, "Ajudantes"),
      helpersBody);

    return el("section", { class: "panel" },
      el("div", { class: "panel-head" }, el("h2", null, "Equipe da listRat"),
        P.canManageSub(s) && !editing
          ? el("button", { class: "link", type: "button", onclick: () => { S.draft.editHelpers = { sid: s.id, helpers: [...s.helpers] }; rerender(); } }, "escolher ajudantes")
          : null),
      ownerRow, helpersRow,
      el("p", { class: "hint" }, "O dono e os ajudantes criam, editam e apagam as tarefas desta listRat. Só o dono edita a listRat (nome, datas e detalhes), apaga e escolhe os ajudantes."));
  }

  /* ---------- renomear e apagar (dono da listRat) ---------- */
  function manage(s, p) {
    const es = S.draft.editSub;
    return el("section", { class: "panel", style: "max-width:560px" },
      el("h3", null, "Gerenciar listRat"),
      es
        ? el("form", { class: "row", id: "editSubForm", onsubmit: async (ev) => {
            ev.preventDefault();
            const name = clean(es.name, 60);
            if (!name) return;
            try { await L.actions.renameSub(s.id, name); S.draft.editSub = null; rerender(); }
            catch (e) { L.app.setStatus(L.actions.errMsg(e, "Não deu para renomear a listRat."), true); }
          } },
            el("div", { class: "field grow" }, el("label", { for: "esName" }, "Nome"),
              el("input", { id: "esName", maxlength: "60", required: true, autocomplete: "off", value: es.name, oninput: (e) => { es.name = e.target.value; } })),
            el("button", { class: "btn", type: "submit" }, "Salvar"),
            el("button", { class: "btn ghost", type: "button", onclick: () => { S.draft.editSub = null; rerender(); } }, "Cancelar"))
        : null,
      S.confirm === "s:" + s.id
        ? L.ui.confirmRow("Apagar a listRat e as tarefas dela?", "Apagar", async () => {
            S.confirm = null;
            try { await L.actions.deleteSub(s.id); go({ page: "project", pid: p.id }); }
            catch (e) { L.app.setStatus(L.actions.errMsg(e, "Não deu para apagar a listRat."), true); rerender(); }
          })
        : el("div", { class: "admin" },
            el("button", { class: "link", type: "button", onclick: () => go({ page: "subform", pid: p.id, sid: s.id }) }, "editar nome, datas e detalhes"),
            el("button", { class: "link danger", type: "button", onclick: () => { S.confirm = "s:" + s.id; rerender(); } }, "apagar listRat")));
  }

  L.pages.sub = function (v) {
    const p = S.projects[S.view.pid], s = S.subs[S.view.sid];
    if (!p || !s || s.projectId !== p.id) return L.pages.notFound(v);
    if (!P.canSeeProject(p)) return L.pages.notFound(v);
    L.ui.crumbs([
      { label: "Projetos", go: () => go({ page: "projects" }) },
      { label: p.name, go: () => go({ page: "project", pid: p.id }) },
      { label: s.name },
    ]);

    const role = P.roleIn(s, S.myId);
    const stasks = Object.values(S.tasks).filter((t) => t.subId === s.id).sort(byType);
    v.append(L.ui.pageHead(s.name, "ListRat de " + p.name + (role ? " · você é " + role : ""),
      el("div", { class: "row", style: "align-items:center" },
        el("div", { class: "stats" },
          L.ui.stat("Tarefas", String(stasks.length)),
          L.ui.stat("Obrigatórias", String(stasks.filter((t) => t.type === "obrigatoria").length))),
        P.canManageSub(s) ? el("button", { class: "btn ghost", type: "button", onclick: () => go({ page: "subform", pid: p.id, sid: s.id }) }, "Editar") : null)));

    // período e detalhes
    const pr = L.ui.period(s);
    const showPeriod = pr.text && pr.state !== "insc";   // em inscrições o quadro de inscrições já explica
    if (showPeriod || s.desc) {
      v.append(el("section", { class: "panel about" },
        showPeriod ? el("div", { class: "about-period" }, L.ui.periodTag(s), el("span", null, pr.text),
          s.start && s.end ? el("span", { class: "muted" }, "(" + L.ui.fmtDate(s.start) + " a " + L.ui.fmtDate(s.end) + ")") : null) : null,
        pr.state === "fim" ? el("p", { class: "hint" }, "As tarefas desta listRat não valem mais pontos; o que foi feito continua no placar.") : null,
        pr.state === "antes" ? el("p", { class: "hint" }, "As tarefas começam a valer no dia do início.") : null,
        s.desc ? el("p", { class: "about-desc", text: s.desc }) : null));
    }

    const ep = L.enrollUI.panel(s, p);
    if (ep) v.append(ep);
    v.append(team(s, p));
    if (P.canEditTasks(s) || P.canFillOwn(s)) v.append(L.forms.taskForm(p, s));

    const cols = el("div", { class: "members" });
    const inList = (id) => L.score.isParticipant(s, id);
    const order = p.members.filter(inList).sort((a, b) => (a === S.myId ? -1 : b === S.myId ? 1 : 0));
    for (const id of order) {
      const mt = stasks.filter((t) => t.assignee === id);
      const sc = L.score.scoreFor(id, mt);
      const r = P.roleIn(s, id);
      cols.append(el("section", { class: "mcol" },
        el("div", { class: "mhead" },
          el("div", { class: "who" }, L.ui.avatar(id),
            el("div", { style: "min-width:0" },
              el("div", { class: "n" }, L.ui.nameOf(id), r ? el("span", { class: "role" }, r) : null),
              el("div", { class: "small muted" }, plural(mt.length, "tarefa", "tarefas")))),
          el("div", { class: "pts" + (sc.total < 0 ? " neg" : "") }, fmtTotal(sc.total))),
        mt.length ? el("div", { class: "tlist" }, mt.map((t) => L.ui.taskCard(t, { admin: true }))) : L.ui.empty("Sem tarefas.")));
    }
    const orphan = stasks.filter((t) => !p.members.includes(t.assignee) || !inList(t.assignee));
    if (P.canEditTasks(s) && orphan.length) {
      cols.append(el("section", { class: "mcol" },
        el("div", { class: "mhead" }, el("div", null, el("div", { class: "n" }, "Fora da listRat"), el("div", { class: "small muted" }, "Não participam ou saíram do projeto. Não contam no placar."))),
        el("div", { class: "tlist" }, orphan.map((t) => L.ui.taskCard(t, { admin: true, where: L.ui.nameOf(t.assignee) })))));
    }
    v.append(p.members.length ? cols : L.ui.empty("Este projeto não tem integrantes."));

    if (P.canManageSub(s)) v.append(manage(s, p));
  };
})(window.Liga);
