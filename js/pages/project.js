/* pages/project.js — um projeto, dividido em sub-páginas com um cabeçalho de abas:
   Visão geral · ListRats · Integrantes (página members) · Placar · Editar (dono) · Gerenciar (dono).
   Rota: { page: "project", pid, tab }. */
window.Liga = window.Liga || {};
window.Liga.pages = window.Liga.pages || {};
(function (L) {
  "use strict";
  const S = L.S;
  const P = L.perms;
  const { el, icon, $ } = L.dom;
  const { clean, fmtTotal, plural } = L.text;

  const go = (v) => L.app.go(v);
  const rerender = () => L.app.render();
  const err = (e, f) => L.app.setStatus(L.actions.errMsg(e, f), true);
  const ok = (msg) => L.app.setStatus(msg, false, { auto: true });

  const subsOf = (p) => Object.values(S.subs).filter((s) => s.projectId === p.id).sort((a, b) => a.createdAt - b.createdAt);

  /* ---------- cabeçalho com abas (usado também pela página de integrantes) ---------- */
  function header(v, p, tab) {
    const owner = P.isProjectOwner(p);
    const ptasks = L.score.tasksOfProject(p.id);
    const my = L.score.scoreFor(S.myId, ptasks);
    const subs = subsOf(p);
    const role = owner ? "dono" : P.isProjectHelper(p) ? "ajudante" : "";
    L.ui.crumbs([{ label: "Projetos", go: () => go({ page: "projects" }) }, { label: p.name }]);
    const t = (key, label, ic, extra) => Object.assign({ key, label, ic, go: () => go({ page: key === "integrantes" ? "members" : "project", pid: p.id, tab: key }) }, extra);
    v.append(L.ui.subHeader({
      kicker: "Projeto",
      title: p.name,
      badges: [role ? el("span", { class: "role" }, role) : null],
      sub: p.desc || ("Dono: " + L.ui.nameOf(P.projOwner(p))),
      stats: P.isMember(p) ? [L.ui.stat("Seus pontos", fmtTotal(my.total), my.total < 0 ? "neg" : ""), L.ui.stat("Integrantes", String(p.members.length))] : [],
    }, [
      t("geral", "Visão geral", "home"),
      t("listrats", "ListRats", "list", { count: subs.length }),
      t("integrantes", "Integrantes", "users", { count: p.members.length }),
      t("placar", "Placar", "chart"),
      t("editar", "Editar", "edit", { hidden: !owner }),
      t("gerenciar", "Gerenciar", "gear", { hidden: !owner }),
    ], tab));
  }

  /* ---------- Visão geral ---------- */
  function overview(v, p) {
    const ptasks = L.score.tasksOfProject(p.id);
    const subs = subsOf(p);
    const mine = ptasks.filter((t) => t.assignee === S.myId && L.score.counts(t) && L.score.activeNow(t));
    const pend = mine.filter((t) => !L.score.doneNow(t));
    const insc = subs.filter((s) => s.status === "inscricoes");
    const board = p.members.map((id) => ({ id, t: L.score.scoreFor(id, ptasks).total })).sort((a, b) => b.t - a.t);
    const pos = board.findIndex((r) => r.id === S.myId) + 1;

    v.append(el("div", { class: "cards" },
      el("button", { type: "button", class: "card" + (pend.length ? " accent" : ""), onclick: () => go({ page: "home" }) },
        el("div", { class: "k" }, "Para fazer agora"),
        el("div", { class: "v" }, String(pend.length)),
        el("div", { class: "d" }, mine.length ? plural(mine.length, "tarefa sua valendo", "tarefas suas valendo") : "Nenhuma tarefa sua valendo")),
      el("button", { type: "button", class: "card", onclick: () => go({ page: "project", pid: p.id, tab: "placar" }) },
        el("div", { class: "k" }, "Sua posição"),
        el("div", { class: "v" }, pos ? pos + "º" : "—"),
        el("div", { class: "d" }, "de " + plural(p.members.length, "pessoa", "pessoas"))),
      el("button", { type: "button", class: "card" + (insc.length ? " accent" : ""), onclick: () => go({ page: "project", pid: p.id, tab: "listrats" }) },
        el("div", { class: "k" }, "ListRats"),
        el("div", { class: "v" }, String(subs.length)),
        el("div", { class: "d" }, insc.length ? plural(insc.length, "com inscrições abertas", "com inscrições abertas") : "nenhuma em inscrições"))));

    const grid = el("div", { class: "grid" });
    const left = el("div", { class: "stack" }), right = el("div", { class: "stack" });
    grid.append(left, right);
    v.append(grid);

    left.append(L.ui.block("ListRats recentes", null,
      subs.length ? subList(p, subs.slice(-4).reverse()) : L.ui.empty("Nenhuma listRat ainda."),
      el("div", { class: "row" },
        P.canCreateSub(p) ? el("button", { class: "btn", type: "button", onclick: () => go({ page: "subform", pid: p.id }) }, icon("plus"), "Nova listRat") : null,
        subs.length > 4 ? el("button", { class: "link purple", type: "button", onclick: () => go({ page: "project", pid: p.id, tab: "listrats" }) }, "Ver todas") : null)));

    right.append(L.ui.block("Top do placar", null,
      L.ui.board(board.slice(0, 3).map((r) => r.id), ptasks, "pv" + p.id),
      el("div", null, el("button", { class: "link purple", type: "button", onclick: () => go({ page: "project", pid: p.id, tab: "placar" }) }, "Ver placar completo"))));
  }

  function subList(p, subs) {
    const ptasks = L.score.tasksOfProject(p.id);
    return el("div", { class: "subs" }, subs.map((s) => {
      const st = ptasks.filter((t) => t.subId === s.id);
      const mineN = st.filter((t) => t.assignee === S.myId).length;
      const role = P.roleIn(s, S.myId);
      const pr = L.ui.period(s);
      return el("button", { type: "button", class: "sub", onclick: () => go({ page: "sub", pid: p.id, sid: s.id }) },
        el("div", null,
          el("div", { class: "t" }, s.name, role ? el("span", { class: "role" }, role) : null, L.ui.periodTag(s)),
          pr.text ? el("div", { class: "small muted" }, pr.text) : null,
          el("div", { class: "small muted" }, "dono: " + L.ui.nameOf(P.subOwner(s)) + " · " + plural(st.length, "tarefa", "tarefas") +
            (mineN ? " · " + mineN + " sua" + (mineN > 1 ? "s" : "") : ""))),
        el("span", { class: "go" }, icon("chevron")));
    }));
  }

  /* ---------- ListRats ---------- */
  function listrats(v, p) {
    const subs = subsOf(p);
    const canNew = P.canCreateSub(p);
    const groups = [
      ["Em inscrições", subs.filter((s) => s.status === "inscricoes")],
      ["Valendo agora", subs.filter((s) => s.status !== "inscricoes" && ["agora", "sem"].includes(L.ui.period(s).state))],
      ["Começam em breve", subs.filter((s) => s.status !== "inscricoes" && L.ui.period(s).state === "antes")],
      ["Encerradas", subs.filter((s) => s.status !== "inscricoes" && L.ui.period(s).state === "fim")],
    ].filter((g) => g[1].length);
    v.append(L.ui.block("ListRats do projeto", "Quem cria a listRat vira o dono dela e pode chamar ajudantes.",
      canNew ? el("div", null, el("button", { class: "btn", type: "button", onclick: () => go({ page: "subform", pid: p.id }) }, icon("plus"), "Nova listRat")) : null,
      groups.length
        ? groups.map(([title, list]) => el("div", { class: "group" }, el("h3", { class: "gtitle" }, title + " (" + list.length + ")"), subList(p, list)))
        : L.ui.empty(canNew ? "Nenhuma listRat ainda. Crie a primeira." : "Nenhuma listRat ainda.")));
  }

  /* ---------- Placar ---------- */
  function placar(v, p) {
    const ptasks = L.score.tasksOfProject(p.id);
    v.append(L.ui.block("Placar do projeto", "Total de pontos de cada integrante em todas as listRats do projeto.",
      L.ui.board(p.members, ptasks, "p" + p.id),
      el("div", null, el("button", { class: "link purple", type: "button", onclick: () => {
        S.draft.charts = Object.assign(S.draft.charts || { range: "30", type: "pontos", table: false }, { pid: p.id, sid: "" });
        go({ page: "charts" });
      } }, icon("chart"), "Ver gráficos do projeto"))));
  }

  /* ---------- Editar (dono) ---------- */
  function editar(v, p) {
    if (!S.draft.editProject || S.draft.editProject.pid !== p.id) S.draft.editProject = { pid: p.id, name: p.name, desc: p.desc };
    const d = S.draft.editProject;
    v.append(L.ui.block("Editar projeto", "Nome e descrição que todos os integrantes veem.",
      el("form", { class: "f", id: "editProjForm", style: "max-width:620px", onsubmit: async (ev) => {
        ev.preventDefault();
        const name = clean(d.name, 60), desc = clean(d.desc, 200);
        const e = $("epErr");
        if (!name) { e.textContent = "Dê um nome ao projeto."; return; }
        e.textContent = "";
        try { await L.actions.saveProject(p.id, { name, desc }); S.draft.editProject = null; ok("Projeto salvo."); go({ page: "project", pid: p.id, tab: "geral" }); }
        catch (x) { e.textContent = L.actions.errMsg(x, "Não deu para salvar o projeto."); }
      } },
        el("div", { class: "field" }, el("label", { for: "epName" }, "Nome"),
          el("input", { id: "epName", maxlength: "60", required: true, autocomplete: "off", value: d.name, oninput: (e) => { d.name = e.target.value; } })),
        el("div", { class: "field" }, el("label", { for: "epDesc" }, "Descrição"),
          el("textarea", { id: "epDesc", maxlength: "200", value: d.desc, oninput: (e) => { d.desc = e.target.value; } })),
        el("div", { class: "row" },
          el("button", { class: "btn", type: "submit" }, "Salvar"),
          el("button", { class: "btn ghost", type: "button", onclick: () => { S.draft.editProject = null; go({ page: "project", pid: p.id, tab: "geral" }); } }, "Cancelar")),
        el("div", { class: "err", id: "epErr" }))));
  }

  /* ---------- Gerenciar (dono) ---------- */
  function gerenciar(v, p) {
    const others = p.members.filter((id) => id !== P.projOwner(p));

    // cargo "ajudante do projeto" (as permissões dele vêm depois)
    v.append(L.ui.block("Cargos", "Ajudante do projeto é um cargo que você dá para integrantes de confiança. As permissões do cargo ainda vão ser definidas.",
      el("div", { class: "toggle-row" },
        el("div", { class: "who" }, L.ui.avatar(P.projOwner(p)), el("b", { text: L.ui.nameOf(P.projOwner(p)) })),
        el("span", { class: "role" }, "dono")),
      others.length
        ? others.map((id) => {
            const on = p.helpers.includes(id);
            return el("div", { class: "toggle-row" },
              el("div", { class: "who" }, L.ui.avatar(id), el("span", { text: L.ui.nameOf(id) })),
              el("div", { class: "seg", role: "group", "aria-label": "Cargo de " + L.ui.nameOf(id) },
                [[false, "Integrante"], [true, "Ajudante"]].map(([val, label]) =>
                  el("button", { type: "button", class: on === val ? "on" : "", "aria-pressed": on === val ? "true" : "false", onclick: async () => {
                    if (on === val) return;
                    try { await L.actions.setProjectHelper(p.id, id, val); ok(L.ui.nameOf(id) + (val ? " agora é ajudante." : " voltou a ser integrante.")); }
                    catch (e) { err(e, "Não deu para mudar o cargo."); }
                    rerender();
                  } }, label))));
          })
        : el("p", { class: "muted small" }, "Ainda não tem outros integrantes. Chame o pessoal na aba Integrantes.")));

    // passar o projeto
    if (!S.draft.transfer || !others.includes(S.draft.transfer)) S.draft.transfer = others[0] || "";
    v.append(L.ui.block("Passar o projeto", "O novo dono passa a editar e gerenciar tudo. Você continua como integrante.",
      others.length
        ? el("div", { class: "row" },
            el("div", { class: "field grow" }, el("label", { for: "trTo" }, "Novo dono"),
              el("select", { id: "trTo", value: S.draft.transfer, onchange: (e) => { S.draft.transfer = e.target.value; } },
                others.map((id) => el("option", { value: id }, L.ui.nameOf(id))))),
            S.confirm === "own:" + p.id
              ? el("div", { class: "row" },
                  el("button", { class: "btn purple", type: "button", onclick: async () => {
                    S.confirm = null;
                    try { await L.actions.transferProject(p.id, S.draft.transfer); ok(L.ui.nameOf(S.draft.transfer) + " agora é o dono do projeto."); go({ page: "project", pid: p.id, tab: "geral" }); }
                    catch (e) { err(e, "Não deu para passar o projeto."); rerender(); }
                  } }, "Confirmar"),
                  el("button", { class: "btn ghost", type: "button", onclick: () => { S.confirm = null; rerender(); } }, "Cancelar"))
              : el("button", { class: "btn purple", type: "button", onclick: () => { S.confirm = "own:" + p.id; rerender(); } }, "Passar o projeto"))
        : el("p", { class: "muted small" }, "Precisa ter pelo menos mais um integrante.")));

    // apagar
    v.append(el("section", { class: "panel block danger-zone" },
      el("header", { class: "block-head" }, el("h2", null, "Apagar projeto"),
        el("p", { class: "muted small" }, "Apaga o projeto, todas as listRats e as tarefas dele. Não dá para desfazer.")),
      S.confirm === "p:" + p.id
        ? L.ui.confirmRow("Tem certeza?", "Apagar tudo", async () => {
            S.confirm = null;
            try { await L.actions.deleteProject(p.id); go({ page: "projects" }); }
            catch (e) { err(e, "Não deu para apagar o projeto."); rerender(); }
          })
        : el("div", null, el("button", { class: "btn danger-ghost", type: "button", onclick: () => { S.confirm = "p:" + p.id; rerender(); } }, "Apagar projeto"))));
  }

  L.pages.project = function (v) {
    const p = S.projects[S.view.pid];
    if (!p || !P.canSeeProject(p)) return L.pages.notFound(v);
    let tab = S.view.tab || "geral";
    if ((tab === "editar" || tab === "gerenciar") && !P.isProjectOwner(p)) tab = "geral";
    header(v, p, tab);
    ({ geral: overview, listrats, placar, editar, gerenciar }[tab] || overview)(v, p);
  };
  L.pages.projectHeader = header;
})(window.Liga);
