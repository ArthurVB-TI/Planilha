/* pages/sub.js — uma listRat, dividida em sub-páginas com um cabeçalho de abas:
   Visão geral · Tarefas · Inscrições (ou Participantes) · Equipe · Editar · Gerenciar.
   Rota: { page: "sub", pid, sid, tab }. */
window.Liga = window.Liga || {};
window.Liga.pages = window.Liga.pages || {};
(function (L) {
  "use strict";
  const S = L.S;
  const P = L.perms;
  const { el, icon } = L.dom;
  const { fmtTotal, plural } = L.text;

  const go = (v) => L.app.go(v);
  const rerender = () => L.app.render();
  const err = (e, f) => L.app.setStatus(L.actions.errMsg(e, f), true);
  const ok = (m) => L.app.setStatus(m, false, { auto: true });
  const byType = (a, b) => (a.type === "obrigatoria" ? 0 : 1) - (b.type === "obrigatoria" ? 0 : 1) || a.createdAt - b.createdAt;
  const tasksOf = (s) => Object.values(S.tasks).filter((t) => t.subId === s.id).sort(byType);
  const participants = (s, p) => p.members.filter((id) => L.score.isParticipant(s, id));

  /* ---------- cabeçalho ---------- */
  function header(v, p, s, tab) {
    const role = P.roleIn(s, S.myId);
    const st = tasksOf(s);
    const insc = s.status === "inscricoes";
    const my = L.score.scoreFor(S.myId, st);
    L.ui.crumbs([
      { label: "Projetos", go: () => go({ page: "projects" }) },
      { label: p.name, go: () => go({ page: "project", pid: p.id }) },
      { label: s.name },
    ]);
    const t = (key, label, ic, extra) => Object.assign({ key, label, ic, go: () => go({ page: "sub", pid: p.id, sid: s.id, tab: key }) }, extra);
    const manage = P.canManageSub(s), run = P.canRunSub(s);
    v.append(L.ui.subHeader({
      kicker: "ListRat de " + p.name,
      title: s.name,
      badges: [L.ui.periodTag(s), role ? el("span", { class: "role" }, "você é " + role) : null],
      sub: L.ui.period(s).text || null,
      stats: [
        L.ui.stat("Tarefas", String(st.length)),
        insc ? L.ui.stat("Prontos", String(L.enroll.summary(s).ready.length)) : L.ui.stat("Seus pontos", fmtTotal(my.total), my.total < 0 ? "neg" : ""),
      ],
    }, [
      t("geral", "Visão geral", "home"),
      t("tarefas", "Tarefas", "list", { count: st.filter((x) => x.assignee === S.myId).length }),
      t("inscricoes", insc ? "Inscrições" : "Participantes", "users", { count: insc ? null : participants(s, p).length }),
      t("equipe", "Equipe", "heart"),
      t("editar", "Editar", "edit", { hidden: !manage }),
      t("gerenciar", "Gerenciar", "gear", { hidden: !(manage || run) }),
    ], tab));
  }

  /* ---------- Visão geral ---------- */
  function overview(v, p, s) {
    const st = tasksOf(s);
    const insc = s.status === "inscricoes";
    const mine = st.filter((t) => t.assignee === S.myId);
    const cards = el("div", { class: "cards" });

    if (insc) {
      const me = L.enroll.personStatus(s, S.myId);
      const sm = L.enroll.summary(s);
      cards.append(
        el("button", { type: "button", class: "card" + (me.ready ? "" : " accent"), onclick: () => go({ page: "sub", pid: p.id, sid: s.id, tab: "tarefas" }) },
          el("div", { class: "k" }, "Sua inscrição"),
          el("div", { class: "v" }, me.ready ? "Pronto" : "Falta"),
          el("div", { class: "d" }, me.ready ? "Você já completou suas tarefas." : me.text + ". Toque para preencher.")),
        el("button", { type: "button", class: "card", onclick: () => go({ page: "sub", pid: p.id, sid: s.id, tab: "inscricoes" }) },
          el("div", { class: "k" }, "Prontos para começar"),
          el("div", { class: "v" }, sm.ready.length + "/" + p.members.length),
          el("div", { class: "d" }, "Desvio dos pontos: " + L.enroll.fmt(sm.desvio) + " (máx. " + L.enroll.fmt(s.req.maxDesvio) + ")")),
        el("div", { class: "card" },
          el("div", { class: "k" }, "Regras"),
          el("div", { class: "d" }, "Cada pessoa precisa de " + L.enrollUI.reqText(s.req) + ".")));
    } else {
      const active = mine.filter((t) => L.score.activeNow(t) && L.score.counts(t));
      const pend = active.filter((t) => !L.score.doneNow(t));
      const my = L.score.scoreFor(S.myId, st);
      const board = participants(s, p).map((id) => ({ id, t: L.score.scoreFor(id, st).total })).sort((a, b) => b.t - a.t);
      const pos = board.findIndex((r) => r.id === S.myId) + 1;
      cards.append(
        el("button", { type: "button", class: "card" + (pend.length ? " accent" : ""), onclick: () => go({ page: "sub", pid: p.id, sid: s.id, tab: "tarefas" }) },
          el("div", { class: "k" }, "Para fazer agora"),
          el("div", { class: "v" }, String(pend.length)),
          el("div", { class: "d" }, active.length ? plural(active.length, "tarefa sua valendo", "tarefas suas valendo") : "Nenhuma tarefa sua valendo")),
        el("div", { class: "card" },
          el("div", { class: "k" }, "Seus pontos aqui"),
          el("div", { class: "v" + (my.total < 0 ? " neg" : "") }, fmtTotal(my.total)),
          el("div", { class: "d" }, pos ? pos + "º de " + board.length : "Você não participa desta listRat")),
        el("button", { type: "button", class: "card", onclick: () => go({ page: "sub", pid: p.id, sid: s.id, tab: "inscricoes" }) },
          el("div", { class: "k" }, "Participantes"),
          el("div", { class: "v" }, String(board.length)),
          el("div", { class: "d" }, s.startedAt ? "começou em " + L.ui.fmtDate(s.startedAt) : "listRat sem inscrição")));
    }
    v.append(cards);

    const grid = el("div", { class: "grid" });
    const left = el("div", { class: "stack" }), right = el("div", { class: "stack" });
    grid.append(left, right);
    v.append(grid);

    const pr = L.ui.period(s);
    left.append(L.ui.block("Sobre esta listRat", null,
      pr.text ? el("div", { class: "about-period" }, L.ui.periodTag(s), el("span", null, pr.text),
        s.start && s.end ? el("span", { class: "muted" }, "(" + L.ui.fmtDate(s.start) + " a " + L.ui.fmtDate(s.end) + ")") : null) : null,
      pr.state === "fim" ? el("p", { class: "hint" }, "As tarefas desta listRat não valem mais pontos; o que foi feito continua no placar.") : null,
      pr.state === "antes" ? el("p", { class: "hint" }, "As tarefas começam a valer no dia do início.") : null,
      insc ? el("p", { class: "hint" }, "Nada vale pontos até a listRat começar.") : null,
      s.desc ? el("p", { class: "about-desc", text: s.desc }) : el("p", { class: "muted small" }, "Sem detalhes."),
      el("p", { class: "muted small" }, "Dono: " + L.ui.nameOf(P.subOwner(s)) + (s.helpers.length ? " · Ajudantes: " + s.helpers.map(L.ui.nameOf).join(", ") : ""))));

    right.append(L.ui.block("Placar da listRat", insc ? "Começa quando a listRat começar." : null,
      L.ui.board(insc ? [] : participants(s, p), st, "s" + s.id)));
  }

  /* ---------- Tarefas ---------- */
  function tasks(v, p, s) {
    const st = tasksOf(s);
    const d = S.draft.subView = S.draft.subView && S.draft.subView.sid === s.id ? S.draft.subView : { sid: s.id, only: false };
    if (P.canEditTasks(s) || P.canFillOwn(s)) v.append(L.forms.taskForm(p, s));

    v.append(el("div", { class: "row", style: "align-items:center;justify-content:space-between" },
      el("h2", null, "Tarefas de cada pessoa"),
      el("div", { class: "seg", role: "group", "aria-label": "Mostrar" },
        [[false, "Todas"], [true, "Só as minhas"]].map(([val, label]) =>
          el("button", { type: "button", class: d.only === val ? "on" : "", "aria-pressed": d.only === val ? "true" : "false", onclick: () => { d.only = val; rerender(); } }, label)))));

    const cols = el("div", { class: "members" });
    const inList = (id) => L.score.isParticipant(s, id);
    let order = p.members.filter(inList).sort((a, b) => (a === S.myId ? -1 : b === S.myId ? 1 : 0));
    if (d.only) order = order.filter((id) => id === S.myId);
    for (const id of order) {
      const mt = st.filter((t) => t.assignee === id);
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
    const orphan = st.filter((t) => !p.members.includes(t.assignee) || !inList(t.assignee));
    if (P.canEditTasks(s) && orphan.length && !d.only) {
      cols.append(el("section", { class: "mcol" },
        el("div", { class: "mhead" }, el("div", null, el("div", { class: "n" }, "Fora da listRat"), el("div", { class: "small muted" }, "Não participam ou saíram do projeto. Não contam no placar."))),
        el("div", { class: "tlist" }, orphan.map((t) => L.ui.taskCard(t, { admin: true, where: L.ui.nameOf(t.assignee) })))));
    }
    v.append(order.length || orphan.length ? cols : L.ui.empty(d.only ? "Você não tem tarefas nesta listRat." : "Ninguém nesta listRat ainda."));
  }

  /* ---------- Inscrições / Participantes ---------- */
  function enroll(v, p, s) {
    const ep = L.enrollUI.panel(s, p);
    v.append(ep || L.ui.block("Participantes", "Esta listRat foi criada antes das inscrições existirem: todos os integrantes do projeto participam.",
      el("div", { class: "people" }, p.members.map((id) => L.ui.personChip(id)))));
  }

  /* ---------- Equipe ---------- */
  function team(v, p, s) {
    const owner = P.subOwner(s);
    v.append(L.ui.block("Equipe da listRat", "O dono e os ajudantes criam, editam e apagam as tarefas desta listRat. Só o dono edita a listRat, apaga e escolhe os ajudantes.",
      el("div", { class: "toggle-row" }, el("div", { class: "who" }, L.ui.avatar(owner), el("b", { text: L.ui.nameOf(owner) })), el("span", { class: "role" }, "dono")),
      s.helpers.length
        ? s.helpers.map((id) => el("div", { class: "toggle-row" }, el("div", { class: "who" }, L.ui.avatar(id), el("span", { text: L.ui.nameOf(id) })), el("span", { class: "role" }, "ajudante")))
        : el("p", { class: "muted small" }, "Nenhum ajudante."),
      P.canManageSub(s) ? el("div", null, el("button", { class: "btn purple", type: "button", onclick: () => go({ page: "sub", pid: p.id, sid: s.id, tab: "gerenciar" }) }, icon("gear"), "Escolher ajudantes")) : null));
  }

  /* ---------- Editar ---------- */
  function editar(v) { L.pages.subform(v, { embedded: true }); }

  /* ---------- Gerenciar ---------- */
  function gerenciar(v, p, s) {
    const manage = P.canManageSub(s);
    const owner = P.subOwner(s);

    // ajudantes (dono da listRat ou dono do projeto)
    if (manage) {
      const cand = p.members.filter((id) => id !== owner);
      v.append(L.ui.block("Ajudantes", "Ajudantes criam, editam e apagam tarefas, mudam as regras de inscrição e podem começar a listRat.",
        cand.length
          ? cand.map((id) => {
              const on = s.helpers.includes(id);
              return el("div", { class: "toggle-row" },
                el("div", { class: "who" }, L.ui.avatar(id), el("span", { text: L.ui.nameOf(id) })),
                el("div", { class: "seg", role: "group", "aria-label": "Papel de " + L.ui.nameOf(id) },
                  [[false, "Participante"], [true, "Ajudante"]].map(([val, label]) =>
                    el("button", { type: "button", class: on === val ? "on" : "", "aria-pressed": on === val ? "true" : "false", onclick: async () => {
                      if (on === val) return;
                      const helpers = val ? [...s.helpers, id] : s.helpers.filter((x) => x !== id);
                      try { await L.actions.setSubHelpers(s.id, helpers); ok(L.ui.nameOf(id) + (val ? " agora é ajudante." : " não é mais ajudante.")); }
                      catch (e) { err(e, "Não deu para salvar os ajudantes."); }
                      rerender();
                    } }, label))));
            })
          : el("p", { class: "muted small" }, "Não tem mais ninguém no projeto para chamar.")));
    }

    // regras de inscrição e começar (dono e ajudantes)
    if (s.status === "inscricoes") {
      const sm = L.enroll.summary(s);
      v.append(L.ui.block("Inscrições", "Regras: " + L.enrollUI.reqText(s.req) + ". Desvio máximo: " + L.enroll.fmt(s.req.maxDesvio) + ".",
        el("div", { class: "row" },
          el("button", { class: "btn purple", type: "button", onclick: () => go({ page: "sub", pid: p.id, sid: s.id, tab: "inscricoes" }) }, sm.canStart ? "Ver e começar a listRat" : "Ver inscrições"),
          manage ? el("button", { class: "btn ghost", type: "button", onclick: () => go({ page: "sub", pid: p.id, sid: s.id, tab: "editar" }) }, "Mudar regras") : null),
        sm.block ? el("p", { class: "hint warn" }, sm.block) : el("p", { class: "hint" }, "Já dá para começar.")));
    }

    // apagar (dono da listRat ou do projeto)
    if (manage) {
      v.append(el("section", { class: "panel block danger-zone" },
        el("header", { class: "block-head" }, el("h2", null, "Apagar listRat"),
          el("p", { class: "muted small" }, "Apaga a listRat e todas as tarefas dela. Não dá para desfazer.")),
        S.confirm === "s:" + s.id
          ? L.ui.confirmRow("Apagar a listRat e as tarefas dela?", "Apagar", async () => {
              S.confirm = null;
              try { await L.actions.deleteSub(s.id); go({ page: "project", pid: p.id, tab: "listrats" }); }
              catch (e) { err(e, "Não deu para apagar a listRat."); rerender(); }
            })
          : el("div", null, el("button", { class: "btn danger-ghost", type: "button", onclick: () => { S.confirm = "s:" + s.id; rerender(); } }, icon("trash"), "Apagar listRat"))));
    }
  }

  L.pages.sub = function (v) {
    const p = S.projects[S.view.pid], s = S.subs[S.view.sid];
    if (!p || !s || s.projectId !== p.id) return L.pages.notFound(v);
    if (!P.canSeeProject(p)) return L.pages.notFound(v);
    let tab = S.view.tab || "geral";
    if (tab === "editar" && !P.canManageSub(s)) tab = "geral";
    if (tab === "gerenciar" && !(P.canManageSub(s) || P.canRunSub(s))) tab = "geral";
    header(v, p, s, tab);
    ({ geral: overview, tarefas: tasks, inscricoes: enroll, equipe: team, editar, gerenciar }[tab] || overview)(v, p, s);
  };
})(window.Liga);
