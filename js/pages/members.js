/* pages/members.js — página só dos integrantes de um projeto.
   Lista: ver, editar (papel em cada listRat, passar tarefas) e tirar.
   Lado direito: procurar e adicionar quem já tem conta.
   Com S.view.uid abre a ficha de uma pessoa no projeto.
   Só o dono do projeto adiciona, edita, tira e passa o projeto; os outros integrantes só veem. */
window.Liga = window.Liga || {};
window.Liga.pages = window.Liga.pages || {};
(function (L) {
  "use strict";
  const S = L.S;
  const P = L.perms;
  const { el, icon, $ } = L.dom;
  const { clean, fmtTotal, plural } = L.text;
  const { NICK_MAX } = L.rules;

  const go = (v) => L.app.go(v);
  const rerender = () => L.app.render();
  const err = (e, f) => L.app.setStatus(L.actions.errMsg(e, f), true);

  const draft = () => (S.draft.mem = S.draft.mem || { q: "", edit: null, moveTo: "", note: "", fresh: [], freshUntil: 0, ttl: "1d", copied: "" });
  const subsOf = (p) => Object.values(S.subs).filter((s) => s.projectId === p.id).sort((a, b) => a.createdAt - b.createdAt);
  const note = (msg) => { draft().note = msg; };
  // "a tarefa" / "as 3 tarefas"
  const theTasks = (n) => (n === 1 ? "a tarefa" : "as " + n + " tarefas");
  const you = (id) => (id === S.myId ? el("span", { class: "you" }, "você") : null);

  // resumo de uma pessoa dentro do projeto
  function summary(p, id) {
    const ptasks = L.score.tasksOfProject(p.id);
    const mine = ptasks.filter((t) => t.assignee === id);
    const subs = subsOf(p);
    return {
      tasks: mine,
      score: L.score.scoreFor(id, ptasks),
      owns: subs.filter((s) => P.subOwner(s) === id),
      helps: subs.filter((s) => s.helpers.includes(id) && P.subOwner(s) !== id),
    };
  }

  function rolesLine(sm) {
    const parts = [plural(sm.tasks.length, "tarefa", "tarefas")];
    if (sm.owns.length) parts.push("dono de " + plural(sm.owns.length, "listRat", "listRats"));
    if (sm.helps.length) parts.push("ajudante em " + plural(sm.helps.length, "listRat", "listRats"));
    return parts.join(" · ");
  }

  /* ---------- editar: papel em cada listRat e passar tarefas ---------- */
  function editor(p, id) {
    const d = draft();
    const subs = subsOf(p);
    const sm = summary(p, id);
    const others = p.members.filter((x) => x !== id);

    const roles = subs.length
      ? el("div", { class: "roles" }, subs.map((s) => {
          const cur = P.subOwner(s) === id ? "dono" : s.helpers.includes(id) ? "ajudante" : "";
          const locked = cur === "dono";
          return el("div", { class: "role-line" },
            el("span", { class: "rn", text: s.name }),
            el("div", { class: "seg", role: "group", "aria-label": "Papel em " + s.name },
              [["", "Nenhum"], ["ajudante", "Ajudante"], ["dono", "Dono"]].map(([val, label]) =>
                el("button", {
                  type: "button", class: cur === val ? "on" : "", "aria-pressed": cur === val ? "true" : "false",
                  disabled: locked && val !== "dono",
                  title: locked && val !== "dono" ? "Para tirar o comando, escolha outra pessoa como dona" : null,
                  onclick: async () => {
                    if (cur === val) return;
                    try { await L.actions.setSubRole(s.id, id, val); } catch (e) { err(e, "Não deu para mudar o papel."); }
                    rerender();
                  },
                }, label))));
        }))
      : el("p", { class: "hint" }, "Este projeto ainda não tem listRats.");

    return el("div", { class: "medit" },
      P.projOwner(p) !== id ? transferPanel(p, id, true) : null,
      el("div", { class: "lbl" }, "Papel nas listRats"),
      roles,
      el("p", { class: "hint" }, "Dono e ajudantes cuidam da listRat (regras, começar, aprovar justificativas). Cada pessoa cria e edita só as próprias tarefas. Quem era dono vira ajudante quando outra pessoa assume."));
  }

  /* ---------- passar o projeto para outra pessoa ---------- */
  function transferPanel(p, id, inline) {
    const asking = S.confirm === "own:" + id;
    const body = asking
      ? el("div", { class: "row", style: "align-items:center" },
          el("span", { class: "small" }, "Passar o projeto para ", el("b", { text: L.ui.nameOf(id) }), "? Você continua como integrante, mas só o novo dono gerencia."),
          el("button", { class: "btn sm", type: "button", onclick: async () => {
            S.confirm = null;
            try { await L.actions.transferProject(p.id, id); note(L.ui.nameOf(id) + " agora é o dono do projeto."); draft().edit = null; }
            catch (e) { err(e, "Não deu para passar o projeto."); }
            rerender();
          } }, "Passar"),
          el("button", { class: "btn ghost sm", type: "button", onclick: () => { S.confirm = null; rerender(); } }, "Cancelar"))
      : el("div", null, el("button", { class: inline ? "link" : "btn ghost sm", type: "button", onclick: () => { S.confirm = "own:" + id; rerender(); } },
          inline ? "tornar dono do projeto" : "Tornar " + L.ui.nameOf(id) + " dono do projeto"));
    return inline ? body : el("section", { class: "panel" }, el("h3", null, "Dono do projeto"), body);
  }

  /* ---------- tirar do projeto ---------- */
  function removeBox(p, id, after) {
    const d = draft();
    const sm = summary(p, id);
    const others = p.members.filter((x) => x !== id);
    const heir = P.projOwner(p);

    return el("div", { class: "mremove" },
      el("p", null, "Tirar ", el("b", { text: L.ui.nameOf(id) }), " do projeto?"),
      sm.tasks.length
        ? el("p", { class: "hint" }, (sm.tasks.length === 1 ? "A tarefa" : "As " + sm.tasks.length + " tarefas") + " dessa pessoa ficam guardadas e param de contar (ninguém mexe nas tarefas dos outros).")
        : null,
      sm.owns.length
        ? el("p", { class: "hint" }, (sm.owns.length > 1 ? "As listRats " : "A listRat ") + sm.owns.map((s) => s.name).join(", ") +
            (sm.owns.length > 1 ? " passam" : " passa") + " para " + L.ui.nameOf(heir) + ".")
        : null,
      el("p", { class: "hint" }, "Os pontos que a pessoa fez aqui deixam de contar. Dá para adicionar de volta depois."),
      el("div", { class: "row" },
        el("button", { class: "btn danger sm", type: "button", onclick: async () => {
          S.confirm = null;
          try {
            await L.actions.removeMember(p.id, id);
            note(L.ui.nameOf(id) + " saiu do projeto.");
            if (after) after();
          } catch (e) { err(e, "Não deu para tirar do projeto."); }
          rerender();
        } }, "Tirar do projeto"),
        el("button", { class: "btn ghost sm", type: "button", onclick: () => { S.confirm = null; rerender(); } }, "Cancelar")));
  }

  /* ---------- uma linha da lista ---------- */
  function memberRow(p, id, admin) {
    const d = draft();
    const sm = summary(p, id);
    const editing = admin && d.edit === id;
    const removing = admin && S.confirm === "m:" + id;
    const fresh = Date.now() < d.freshUntil && d.fresh.includes(id);

    const acts = el("div", { class: "acts" },
      el("button", { class: "btn ghost sm", type: "button", onclick: () => go({ page: "members", pid: p.id, uid: id }) }, "Ver"),
      admin ? el("button", { class: "btn ghost sm" + (editing ? " on" : ""), type: "button", "aria-expanded": editing ? "true" : "false",
        onclick: () => { d.edit = editing ? null : id; S.confirm = null; rerender(); } }, editing ? "Fechar" : "Editar") : null,
      admin && P.projOwner(p) !== id ? el("button", { class: "btn ghost sm danger-t", type: "button",
        onclick: () => { S.confirm = removing ? null : "m:" + id; d.edit = null; d.moveTo = ""; rerender(); } }, "Tirar") : null);

    return el("div", { class: "mrow" + (editing || removing ? " open" : "") + (fresh ? " fresh" : "") },
      el("div", { class: "mline" },
        L.ui.avatar(id),
        el("div", { class: "mi" },
          el("div", { class: "pname" }, el("span", { text: L.ui.nameOf(id) }), you(id),
            P.projOwner(p) === id ? el("span", { class: "badge" }, "dono do projeto") : p.helpers.includes(id) ? el("span", { class: "badge" }, "ajudante") : null),
          el("div", { class: "small muted", text: rolesLine(sm) })),
        el("div", { class: "pts" + (sm.score.total < 0 ? " neg" : "") }, fmtTotal(sm.score.total)),
        acts),
      editing ? editor(p, id) : null,
      removing ? removeBox(p, id) : null);
  }

  /* ---------- adicionar ---------- */
  // procura pelo nome de usuário: só mostra quem existe e combina com o que foi digitado
  // (primeiro quem começa com o texto, depois quem contém); nada é listado antes de digitar
  const MIN_Q = 2, MAX_RESULTS = 6;
  function search(p, q) {
    if (q.length < MIN_Q) return [];
    const ids = new Set(Object.keys(S.players).filter((id) => clean(S.players[id].nick, NICK_MAX)));
    if (S.myId) ids.add(S.myId);
    const hits = [...ids].map((id) => ({ id, n: L.ui.nameOf(id).toLowerCase() })).filter((h) => h.n.includes(q));
    hits.sort((a, b) => (a.n.startsWith(q) ? 0 : 1) - (b.n.startsWith(q) ? 0 : 1) || a.n.localeCompare(b.n));
    return hits.slice(0, MAX_RESULTS).map((h) => h.id);
  }

  function addPanel(p) {
    const d = draft();
    const q = clean(d.q, 20).toLowerCase();
    const found = search(p, q);

    // ninguém entra direto: a pessoa recebe um convite e aceita na página de notificações
    const sent = (id) => Object.values(S.sentReqs).find((r) => r.projectId === p.id && r.to === id);
    const add = async (id) => {
      try {
        await L.actions.sendProjectInvite(p.id, id);
        d.q = "";
        note("Convite enviado para " + L.ui.nameOf(id) + ". A pessoa entra quando aceitar nas notificações.");
      } catch (e) { err(e, "Não deu para mandar o convite."); }
      rerender();
      const i = $("mSearch"); if (i) i.focus({ preventScroll: true });
    };
    const pendingHere = Object.values(S.sentReqs).filter((r) => r.projectId === p.id).sort((a, b) => b.createdAt - a.createdAt);

    return el("section", { class: "panel", id: "addPanel" },
      el("h2", null, "Convidar pelo nome de usuário"),
      el("p", { class: "muted small" }, "Ninguém entra direto: a pessoa recebe o convite nas notificações e decide se entra."),
      el("form", { class: "field", role: "search", onsubmit: (ev) => {
        ev.preventDefault();
        // Enter adiciona quando o nome digitado é exatamente o de alguém fora do projeto
        const exact = found.find((id) => L.ui.nameOf(id).toLowerCase() === q && !p.members.includes(id));
        if (exact) add(exact);
      } },
        el("label", { for: "mSearch" }, "Nome de usuário da pessoa"),
        el("input", { id: "mSearch", type: "search", autocomplete: "off", autocapitalize: "none", spellcheck: "false", maxlength: "20",
          value: d.q, placeholder: "digite o usuário…", oninput: (e) => { d.q = e.target.value; rerender(); } })),
      found.length
        ? el("div", { class: "cands" }, found.map((id) => {
            const inside = p.members.includes(id);
            return el("div", { class: "cand" },
              L.ui.avatar(id),
              el("div", { class: "pname" }, el("span", { text: L.ui.nameOf(id) }), you(id)),
              inside
                ? el("span", { class: "small muted" }, "já está no projeto")
                : sent(id)
                  ? el("span", { class: "small muted" }, "convite enviado")
                  : el("button", { class: "btn sm", type: "button", onclick: () => add(id) }, icon("plus"), "Convidar"));
          }))
        : null,
      pendingHere.length
        ? el("div", { class: "f" },
            el("span", { class: "lbl" }, "Aguardando resposta"),
            el("div", { class: "cands" }, pendingHere.map((r) => el("div", { class: "cand" },
              L.ui.avatar(r.to),
              el("div", { class: "pname" }, el("span", { text: L.ui.nameOf(r.to) }), el("span", { class: "small muted" }, L.ui.ago(r.createdAt))),
              el("button", { class: "link danger", type: "button", onclick: async () => {
                try { await L.actions.cancelProjectInvite(r); note("Convite para " + L.ui.nameOf(r.to) + " cancelado."); } catch (e) { err(e, "Não deu para cancelar."); }
                rerender();
              } }, "Cancelar")))))
        : null,
      el("p", { class: "hint" }, q.length < MIN_Q
        ? "Digite pelo menos " + MIN_Q + " letras do usuário. A pessoa precisa ter criado conta no site."
        : "A pessoa precisa ter criado conta no site. Quem ainda não tem conta pode entrar pelo link de convite."));
  }

  /* ---------- link de convite ---------- */
  const TTL = [["1h", "1 hora", 3600e3], ["1d", "1 dia", 86400e3], ["7d", "7 dias", 7 * 86400e3]];

  function leftText(ms) {
    const min = Math.max(1, Math.round(ms / 60000));
    if (min < 60) return "vence em " + plural(min, "minuto", "minutos");
    const h = Math.round(min / 60);
    if (h < 48) return "vence em " + plural(h, "hora", "horas");
    return "vence em " + plural(Math.round(h / 24), "dia", "dias");
  }

  let cleaning = false;
  function invitePanel(p) {
    const d = draft();
    const now = Date.now();
    const mine = Object.values(S.invites).filter((i) => i.projectId === p.id);
    // links vencidos são apagados sozinhos
    const old = mine.filter((i) => i.expiresAt <= now);
    if (old.length && !cleaning) {
      cleaning = true;
      Promise.all(old.map((i) => L.actions.deleteInvite(i.id).catch(() => {}))).then(() => { cleaning = false; });
    }
    const active = mine.filter((i) => i.expiresAt > now).sort((a, b) => b.createdAt - a.createdAt);

    const copy = async (i) => {
      const url = L.actions.inviteUrl(i.id);
      let ok = false;
      try { await navigator.clipboard.writeText(url); ok = true; } catch (e) {
        const inp = $("inv-" + i.id);
        if (inp) { inp.select(); try { ok = document.execCommand("copy"); } catch (e2) { ok = false; } }
      }
      d.copied = ok ? i.id : "";
      if (!ok) note("Não deu para copiar sozinho. Selecione o link e copie.");
      rerender();
      if (ok) setTimeout(() => { if (draft().copied === i.id) { draft().copied = ""; rerender(); } }, 2500);
    };

    return el("section", { class: "panel", id: "invitePanel" },
      el("div", { class: "panel-head" }, el("h2", null, "Link de convite"),
        active.length ? el("span", { class: "muted" }, plural(active.length, "ativo", "ativos")) : null),
      el("p", { class: "muted small" }, "Quem abrir o link e entrar na conta (ou criar uma) entra direto neste projeto. Depois que vence, o link para de funcionar."),
      el("div", { class: "row", style: "align-items:center" },
        el("div", { class: "seg", role: "group", "aria-label": "Validade do link" }, TTL.map(([k, label]) =>
          el("button", { type: "button", class: d.ttl === k ? "on" : "", "aria-pressed": d.ttl === k ? "true" : "false",
            onclick: () => { d.ttl = k; rerender(); } }, label))),
        el("button", { class: "btn", type: "button", onclick: async () => {
          const ms = (TTL.find((t) => t[0] === d.ttl) || TTL[1])[2];
          try {
            const token = await L.actions.createInvite(p.id, ms);
            d.fresh = [token]; d.freshUntil = Date.now() + 1200;
            rerender();
            copy({ id: token });
          } catch (e) { err(e, "Não deu para criar o link."); }
        } }, "Criar link")),
      active.length
        ? el("div", { class: "invites" }, active.map((i) =>
            el("div", { class: "inv" + (Date.now() < d.freshUntil && d.fresh.includes(i.id) ? " fresh" : "") },
              el("input", { id: "inv-" + i.id, class: "inv-url", readonly: true, value: L.actions.inviteUrl(i.id), "aria-label": "Link de convite",
                onfocus: (e) => e.target.select() }),
              el("div", { class: "inv-foot" },
                el("span", { class: "small muted" }, leftText(i.expiresAt - now)),
                el("div", { class: "admin" },
                  el("button", { class: "link" + (d.copied === i.id ? " ok" : ""), type: "button", onclick: () => copy(i) }, d.copied === i.id ? "copiado" : "copiar"),
                  el("button", { class: "link danger", type: "button", onclick: async () => {
                    try { await L.actions.deleteInvite(i.id); } catch (e) { err(e, "Não deu para apagar o link."); }
                    rerender();
                  } }, "apagar"))))))
        : null);
  }

  /* ---------- ficha de uma pessoa ---------- */
  function detail(v, p, id) {
    const admin = P.isProjectOwner(p);
    const inProject = p.members.includes(id);
    L.ui.crumbs([
      { label: "Projetos", go: () => go({ page: "projects" }) },
      { label: p.name, go: () => go({ page: "project", pid: p.id }) },
      { label: "Integrantes", go: () => go({ page: "members", pid: p.id }) },
      { label: L.ui.nameOf(id) },
    ]);
    v.append(el("div", null, el("button", { class: "link", type: "button", onclick: () => go({ page: "members", pid: p.id }) }, "← Voltar para integrantes")));
    if (draft().note) v.append(el("div", { class: "notice", role: "status" }, draft().note));
    const sm = summary(p, id);
    const ptasks = L.score.tasksOfProject(p.id);
    const ranking = p.members.map((x) => ({ x, t: L.score.scoreFor(x, ptasks).total })).sort((a, b) => b.t - a.t);
    const pos = inProject ? ranking.findIndex((r) => r.t === sm.score.total) + 1 : 0;
    const pend = sm.tasks.filter((t) => t.type === "obrigatoria" && !L.score.doneNow(t)).length;

    v.append(el("div", { class: "head" },
      el("div", { class: "who" }, L.ui.avatar(id, true),
        el("div", { style: "min-width:0" },
          el("h1", { class: "pname" }, el("span", { text: L.ui.nameOf(id) }), you(id)),
          el("div", { class: "sub-t" }, inProject ? "Integrante de " + p.name + (P.projOwner(p) === id ? " · dono do projeto" : "") : "Fora do projeto " + p.name))),
      el("div", { class: "stats" },
        L.ui.stat("Pontos aqui", fmtTotal(sm.score.total), sm.score.total < 0 ? "neg" : ""),
        L.ui.stat("Posição", pos ? pos + "º de " + p.members.length : "—"),
        L.ui.stat("Obrigatórias hoje", String(pend), pend ? "neg" : ""))));

    const grid = el("div", { class: "grid" });
    const left = el("div", { class: "stack" }), right = el("div", { class: "stack" });
    grid.append(left, right);
    v.append(grid);

    // tarefas, agrupadas por listRat
    const tp = el("section", { class: "panel" },
      el("div", { class: "panel-head" }, el("h2", null, "Tarefas"), el("span", { class: "muted" }, plural(sm.tasks.length, "tarefa", "tarefas"))));
    if (!sm.tasks.length) tp.append(L.ui.empty("Nenhuma tarefa neste projeto."));
    for (const s of subsOf(p)) {
      const st = sm.tasks.filter((t) => t.subId === s.id)
        .sort((a, b) => (a.type === "obrigatoria" ? 0 : 1) - (b.type === "obrigatoria" ? 0 : 1) || a.createdAt - b.createdAt);
      if (!st.length) continue;
      tp.append(el("div", { class: "group" },
        el("button", { class: "link gname", type: "button", onclick: () => go({ page: "sub", pid: p.id, sid: s.id }) }, s.name),
        el("div", { class: "tlist" }, st.map((t) => L.ui.taskCard(t)))));
    }
    left.append(tp);

    // papéis
    const rp = el("section", { class: "panel" },
      el("div", { class: "panel-head" }, el("h2", null, "ListRats"),
        admin && inProject && !(draft().edit === id) ? el("button", { class: "link purple", type: "button", onclick: () => { draft().edit = id; S.confirm = null; rerender(); } }, "editar papéis") : null));
    if (admin && inProject && draft().edit === id) {
      rp.append(editor(p, id), el("div", null, el("button", { class: "btn sm", type: "button", onclick: () => { draft().edit = null; rerender(); } }, "Pronto")));
    } else if (!sm.owns.length && !sm.helps.length) {
      rp.append(el("p", { class: "muted small" }, "Não é dono nem ajudante de nenhuma listRat."));
    } else {
      rp.append(el("div", { class: "roles" },
        sm.owns.map((s) => el("div", { class: "role-line" }, el("span", { class: "rn", text: s.name }), el("span", { class: "role" }, "dono"))),
        sm.helps.map((s) => el("div", { class: "role-line" }, el("span", { class: "rn", text: s.name }), el("span", { class: "role" }, "ajudante")))));
    }
    right.append(rp);

    if (admin && inProject && P.projOwner(p) !== id) right.append(transferPanel(p, id));
    if (admin && P.projOwner(p) !== id) {
      right.append(el("section", { class: "panel" },
        el("h3", null, inProject ? "Tirar do projeto" : "Chamar de volta"),
        inProject
          ? (S.confirm === "m:" + id
              ? removeBox(p, id)
              : el("div", null, el("button", { class: "btn ghost sm", type: "button", onclick: () => { S.confirm = "m:" + id; draft().moveTo = ""; rerender(); } }, "Tirar " + L.ui.nameOf(id))))
          : el("div", null, el("button", { class: "btn sm", type: "button", onclick: async () => {
              try { await L.actions.sendProjectInvite(p.id, id); note("Convite enviado para " + L.ui.nameOf(id) + "."); }
              catch (e) { err(e, "Não deu para mandar o convite."); }
              rerender();
            } }, "Convidar de novo"))));
    }
  }

  /* ---------- página ---------- */
  L.pages.members = function (v) {
    const p = S.projects[S.view.pid];
    if (!p || !P.canSeeProject(p)) return L.pages.notFound(v);
    const d = draft();
    if (S.view.uid) return detail(v, p, S.view.uid);

    const admin = P.isProjectOwner(p);
    L.pages.projectHeader(v, p, "integrantes");
    if (admin) {
      v.append(el("div", { class: "row only-narrow-row" },
        el("button", { class: "btn purple", type: "button", onclick: () => {
          const a = $("addPanel"); if (!a) return;
          a.scrollIntoView({ behavior: "smooth", block: "start" });
          const q = $("mSearch"); if (q) q.focus({ preventScroll: true });
        } }, icon("plus"), "Convidar pessoas")));
    }

    if (d.note) v.append(el("div", { class: "notice", role: "status" }, d.note));

    const grid = el("div", { class: "grid" });
    const left = el("div", { class: "stack" }), right = el("div", { class: "stack" });
    grid.append(left, right);
    v.append(grid);

    const order = [...p.members].sort((a, b) => (a === S.myId ? -1 : b === S.myId ? 1 : L.ui.nameOf(a).localeCompare(L.ui.nameOf(b))));
    left.append(el("section", { class: "panel" },
      el("div", { class: "panel-head" }, el("h2", null, "No projeto"), el("span", { class: "muted" }, plural(p.members.length, "pessoa", "pessoas"))),
      order.length
        ? el("div", { class: "mlist" }, order.map((id) => memberRow(p, id, admin)))
        : L.ui.empty(admin ? "Ninguém ainda. Adicione as pessoas ao lado." : "Ninguém ainda.")));

    if (admin) right.append(addPanel(p), invitePanel(p));
    else right.append(el("section", { class: "panel" }, el("h2", null, "Quem gerencia"),
      el("p", { class: "muted small" }, "Só o dono do projeto (" + L.ui.nameOf(P.projOwner(p)) + ") adiciona, edita e tira integrantes.")));

  };

  // abre a página de integrantes (com um aviso opcional no topo)
  L.pages.openMembers = function (pid, note) {
    go({ page: "members", pid });
    draft().note = note || "";
    rerender();
  };
})(window.Liga);
