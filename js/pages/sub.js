/* pages/sub.js — uma listRat, dividida em sub-páginas com um cabeçalho de abas:
   Visão geral · Tarefas · Inscrições (ou Participantes) · Contestação/Resultado · Equipe · Editar · Gerenciar.
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
    const pct = L.score.isPercent(s);
    const mine = L.score.standing(S.myId, st, pct);
    L.ui.crumbs([
      { label: "Projetos", go: () => go({ page: "projects" }) },
      { label: p.name, go: () => go({ page: "project", pid: p.id }) },
      { label: s.name },
    ]);
    const t = (key, label, ic, extra) => Object.assign({ key, label, ic, go: () => go({ page: "sub", pid: p.id, sid: s.id, tab: key }) }, extra);
    const manage = P.canManageSub(s), run = P.canRunSub(s);
    const ph = L.review.phase(s);
    const pendJ = run ? L.review.pendingFor(s).length : 0;
    const openAgainstMe = L.review.contestsOf(s).filter((c) => c.accused === S.myId && c.status === "aberta").length;
    v.append(L.ui.subHeader({
      kicker: "ListRat de " + p.name,
      title: s.name,
      badges: [L.ui.periodTag(s), el("span", { class: "role mode", title: pct ? "Ganha quem fizer a maior parte do que dava para fazer" : "Ganha quem somar mais pontos" }, pct ? "por porcentagem" : "por pontos"),
        role ? el("span", { class: "role" }, "você é " + role) : null],
      sub: L.ui.period(s).text || null,
      stats: [
        L.ui.stat("Tarefas", String(st.length)),
        insc ? L.ui.stat("Prontos", String(L.enroll.summary(s).ready.length)) : L.ui.stat(pct ? "Seu aproveitamento" : "Seus pontos", mine.text, mine.neg ? "neg" : ""),
      ],
    }, [
      t("geral", "Visão geral", "home"),
      t("tarefas", "Tarefas", "list", { count: st.filter((x) => x.assignee === S.myId).length }),
      t("inscricoes", insc ? "Inscrições" : "Participantes", "users", { count: insc ? null : participants(s, p).length }),
      t("resultado", ph === "contestacao" ? "Contestação" : "Resultado", ph === "contestacao" ? "flag" : "trophy",
        { hidden: ph !== "contestacao" && ph !== "final", count: ph === "contestacao" ? openAgainstMe || null : null, tone: ph === "contestacao" ? "hot" : "" }),
      t("equipe", "Equipe", "heart"),
      t("editar", "Editar", "edit", { hidden: !manage }),
      t("gerenciar", "Gerenciar", "gear", { hidden: !(manage || run), count: pendJ || null }),
    ], tab));
  }

  /* ---------- Visão geral ---------- */
  function overview(v, p, s) {
    const st = tasksOf(s);
    const insc = s.status === "inscricoes";
    const mine = st.filter((t) => t.assignee === S.myId);
    const cards = el("div", { class: "cards" });
    const ph = L.review.phase(s);
    if (ph === "contestacao" || ph === "final") {
      const contra = L.review.contestsOf(s).filter((c) => c.accused === S.myId && c.status === "aberta");
      v.append(el("button", { type: "button", class: "banner " + (ph === "contestacao" ? "hot" : "done"), onclick: () => go({ page: "sub", pid: p.id, sid: s.id, tab: "resultado" }) },
        icon(ph === "contestacao" ? "flag" : "trophy"),
        el("div", null,
          el("b", null, ph === "contestacao" ? "Hoje é o dia de contestação" : "A listRat terminou"),
          el("span", null, ph === "contestacao"
            ? (contra.length ? "Contestaram " + plural(contra.length, "tarefa sua", "tarefas suas") + ": mande a prova até o fim do dia. " : "") +
              "Você pode duvidar de até " + L.review.MAX_CONTESTS + " tarefas dos outros (restam " + L.review.left(s) + ")."
            : "Veja o resultado final.")),
        el("span", { class: "go" }, icon("chevron"))));
    }

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
      const pct = L.score.isPercent(s);
      const my = L.score.standing(S.myId, st, pct);
      const board = participants(s, p).map((id) => ({ id, t: L.score.standing(id, st, pct).value })).sort((a, b) => b.t - a.t);
      const pos = board.findIndex((r) => r.id === S.myId) + 1;
      cards.append(
        el("button", { type: "button", class: "card" + (pend.length ? " accent" : ""), onclick: () => go({ page: "sub", pid: p.id, sid: s.id, tab: "tarefas" }) },
          el("div", { class: "k" }, "Para fazer agora"),
          el("div", { class: "v" }, String(pend.length)),
          el("div", { class: "d" }, active.length ? plural(active.length, "tarefa sua valendo", "tarefas suas valendo") : "Nenhuma tarefa sua valendo")),
        el("div", { class: "card" },
          el("div", { class: "k" }, pct ? "Seu aproveitamento" : "Seus pontos aqui"),
          el("div", { class: "v" + (my.neg ? " neg" : "") }, my.text),
          el("div", { class: "d" }, pos ? pos + "º de " + board.length + (pct ? " · " + my.detail : "") : "Você não participa desta listRat")),
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
      el("p", { class: "small" }, L.score.isPercent(s)
        ? [el("b", null, "Placar por porcentagem: "), "cada pessoa vale pelo que fez do total de pontos que dava para fazer com as próprias tarefas normais. Quem tem tarefas mais difíceis não sai na frente só por isso."]
        : [el("b", null, "Placar por pontos: "), "ganha quem somar mais pontos com as tarefas normais."]),
      L.score.hasMoney(s) ? moneyRules(s) : null,
      s.desc ? el("p", { class: "about-desc", text: s.desc }) : el("p", { class: "muted small" }, "Sem detalhes."),
      el("p", { class: "muted small" }, "Dono: " + L.ui.nameOf(P.subOwner(s)) + (s.helpers.length ? " · Ajudantes: " + s.helpers.map(L.ui.nameOf).join(", ") : ""))));

    right.append(L.ui.block("Placar da listRat", insc ? "Começa quando a listRat começar." : null,
      L.ui.board(insc ? [] : participants(s, p), st, "s" + s.id, { pct: L.score.isPercent(s), sub: s })));
  }

  // quanto o top 3 ganha e quanto os 3 piores pagam
  function moneyRules(s) {
    const B = L.score.fmtBRL, w = s.money.win, pay = s.money.pay;
    const line = (label, v, cls) => (v > 0 ? el("div", { class: "mny " + cls }, el("span", null, label), el("b", null, B(v))) : null);
    return el("div", { class: "mrules" },
      el("div", { class: "mr-col" }, el("div", { class: "lbl" }, "Ganham"), line("1º lugar", w[0], "win"), line("2º lugar", w[1], "win"), line("3º lugar", w[2], "win"),
        w.every((x) => !x) ? el("span", { class: "muted small" }, "Ninguém ganha dinheiro.") : null),
      el("div", { class: "mr-col" }, el("div", { class: "lbl" }, "Pagam"), line("Último", pay[0], "pay"), line("Penúltimo", pay[1], "pay"), line("Antepenúltimo", pay[2], "pay"),
        pay.every((x) => !x) ? el("span", { class: "muted small" }, "Ninguém paga.") : null));
  }

  /* ---------- Tarefas ---------- */
  function tasks(v, p, s) {
    const st = tasksOf(s);
    const d = S.draft.subView = S.draft.subView && S.draft.subView.sid === s.id ? S.draft.subView : { sid: s.id, only: false };
    if (P.canFillOwn(s)) v.append(L.forms.taskForm(p, s));
    else if (s.status !== "inscricoes" && P.isMember(p)) {
      v.append(el("p", { class: "hint" }, "As tarefas são criadas e editadas só nas inscrições. Agora elas estão travadas. Toque numa tarefa para ver tudo dela; na sua, toque num dia para marcar."));
    }

    v.append(el("div", { class: "row", style: "align-items:center;justify-content:space-between" },
      el("h2", null, "Tarefas de cada pessoa"),
      el("div", { class: "seg", role: "group", "aria-label": "Mostrar" },
        [[false, "Todas"], [true, "Só as minhas"]].map(([val, label]) =>
          el("button", { type: "button", class: d.only === val ? "on" : "", "aria-pressed": d.only === val ? "true" : "false", onclick: () => { d.only = val; rerender(); } }, label)))));

    const inList = (id) => L.score.isParticipant(s, id);
    let order = p.members.filter(inList).sort((a, b) => (a === S.myId ? -1 : b === S.myId ? 1 : 0));
    if (d.only) order = order.filter((id) => id === S.myId);
    const groups = el("div", { class: "pgroups" });
    for (const id of order) groups.append(L.tasksUI.group(id, st.filter((t) => t.assignee === id), s));
    const orphan = st.filter((t) => !p.members.includes(t.assignee) || !inList(t.assignee));
    if (P.canRunSub(s) && orphan.length && !d.only) {
      groups.append(L.tasksUI.group("", orphan, s, { title: "Fora da listRat", sub: "Não participam ou saíram do projeto. Não contam no placar.", noScore: true, where: true }));
    }
    v.append(order.length || orphan.length ? groups : L.ui.empty(d.only ? "Você não tem tarefas nesta listRat." : "Ninguém nesta listRat ainda."));
  }

  /* ---------- Contestação / Resultado ---------- */
  function resultado(v, p, s) {
    const ph = L.review.phase(s);
    const R = L.review;
    const cs = R.contestsOf(s);
    if (ph === "contestacao") {
      v.append(L.ui.block("Dia de contestação", "Hoje (dia seguinte ao fim) cada participante pode duvidar de até " + R.MAX_CONTESTS +
        " tarefas de outras pessoas, e cada tarefa só pode ser contestada uma vez. Quem for contestado tem até o fim do dia para mandar uma prova; sem prova, a tarefa perde os pontos. Para contestar, abra a tarefa na aba Tarefas.",
        el("div", { class: "row", style: "align-items:center" },
          el("span", { class: "badge" }, "Você ainda pode contestar " + R.left(s) + " de " + R.MAX_CONTESTS),
          el("button", { type: "button", class: "btn purple", onclick: () => go({ page: "sub", pid: p.id, sid: s.id, tab: "tarefas" }) }, icon("list"), "Ver as tarefas"))));
    }
    const grid = el("div", { class: "grid" });
    const left = el("div", { class: "stack" }), right = el("div", { class: "stack" });
    grid.append(left, right);
    v.append(grid);

    left.append(L.ui.block(ph === "final" ? "Resultado final" : "Placar parcial",
      ph === "final" ? "Pontos de cada participante depois das contestações." : "Pode mudar até o fim do dia, conforme as contestações.",
      L.tasksUI.results(s, p, ph === "final")));

    right.append(L.ui.block("Contestações", cs.length ? plural(cs.length, "tarefa contestada", "tarefas contestadas") : null,
      cs.length
        ? el("div", { class: "clist" }, cs.map((c) => {
            const t = S.tasks[c.taskId];
            const lost = R.lost(c);
            return el("button", { type: "button", class: "citem" + (lost ? " lost" : ""), onclick: () => t && L.tasksUI.openSheet(t) },
              el("div", { style: "min-width:0" },
                el("div", { class: "t", text: t ? t.title : "tarefa apagada" }),
                el("div", { class: "small muted" }, (c.by === S.myId ? "Você" : L.ui.nameOf(c.by)) + " contestou " + (c.accused === S.myId ? "você" : L.ui.nameOf(c.accused)))),
              el("span", { class: "dstate " + (lost ? "st-miss" : c.status === "aberta" ? "st-jpend" : "st-on") }, R.contestText(c)));
          }))
        : L.ui.empty(ph === "contestacao" ? "Ninguém contestou nada ainda." : "Ninguém contestou nada.")));
  }

  /* ---------- Inscrições / Participantes ---------- */
  function enroll(v, p, s) {
    const ep = L.enrollUI.panel(s, p);
    v.append(ep || L.ui.block("Participantes", "Esta listRat foi criada antes das inscrições existirem: todos os integrantes do projeto participam.",
      el("div", { class: "people" }, p.members.map((id) => L.ui.personChip(id)))));
    const kp = L.enrollUI.kickPanel(s, p);
    if (kp) v.append(kp);
  }

  /* ---------- Equipe ---------- */
  function team(v, p, s) {
    const owner = P.subOwner(s);
    v.append(L.ui.block("Equipe da listRat", "O dono e os ajudantes cuidam das regras, começam a listRat e aceitam ou recusam justificativas e provas. Só o dono edita a listRat, apaga e escolhe os ajudantes. Cada pessoa cuida só das próprias tarefas.",
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
      v.append(L.ui.block("Ajudantes", "Ajudantes mudam as regras de inscrição, podem começar a listRat e aceitam ou recusam justificativas e provas de contestação. Eles não mexem nas tarefas dos outros.",
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

    // justificativas esperando (dono e ajudantes)
    if (P.canRunSub(s)) {
      const pend = L.review.pendingFor(s).filter((j) => S.tasks[j.taskId]);
      v.append(L.ui.block("Justificativas esperando", "Quem não conseguiu fazer uma tarefa pode justificar. Só conta como feita se você aceitar.",
        pend.length
          ? el("div", { class: "clist" }, pend.map((j) => {
              const t = S.tasks[j.taskId];
              return el("div", { class: "citem jrow" },
                el("button", { type: "button", class: "jopen", onclick: () => L.tasksUI.openSheet(t, j.key) },
                  el("div", { class: "t" }, L.ui.nameOf(j.uid) + " · " + t.title + " · " + L.dates.shortDate(j.key)),
                  el("div", { class: "small muted", text: j.comment })),
                j.uid === S.myId ? el("span", { class: "muted small" }, "sua") : el("div", { class: "row", style: "gap:6px" },
                  el("button", { type: "button", class: "btn purple sm", onclick: async () => { try { await L.review.judgeJustification(j, true); ok("Justificativa aceita."); } catch (e) { err(e, "Não deu para aceitar."); } rerender(); } }, "Aceitar"),
                  el("button", { type: "button", class: "btn danger-ghost sm", onclick: async () => { try { await L.review.judgeJustification(j, false); ok("Justificativa recusada."); } catch (e) { err(e, "Não deu para recusar."); } rerender(); } }, "Recusar")));
            }))
          : el("p", { class: "muted small" }, "Nenhuma justificativa esperando.")));
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
    if (tab === "resultado" && !["contestacao", "final"].includes(L.review.phase(s))) tab = "geral";
    header(v, p, s, tab);
    if (P.isKicked(s)) {
      v.append(el("div", { class: "notice kicked-note", role: "status" },
        el("b", null, "Você foi tirado desta listRat."), " Suas tarefas daqui não contam no placar e você não pode criar novas. Só o dono pode colocar você de volta."));
    }
    ({ geral: overview, tarefas: tasks, inscricoes: enroll, resultado, equipe: team, editar, gerenciar }[tab] || overview)(v, p, s);
  };
})(window.Liga);
