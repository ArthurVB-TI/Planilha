/* ui/components.js — peças reaproveitadas pelas telas */
window.Liga = window.Liga || {};
(function (L) {
  "use strict";
  const S = L.S;
  const { el, icon, $ } = L.dom;
  const { clean, fmtPts, fmtTotal, plural } = L.text;
  const { WD, addDays, parseKey, todayKey, curWeek, weekOf, shortDate } = L.dates;
  const { DIFF, DIFF_KEYS, NICK_MAX } = L.rules;

  const go = (v) => L.app.go(v);
  const rerender = () => L.app.render();

  /* ---------- nomes e iniciais ---------- */

  function nameOf(id) {
    if (id === S.myId && S.user && S.user.name) return S.user.name;
    const p = S.players[id];
    return (p && clean(p.nick, NICK_MAX)) || "jogador";
  }

  function avatar(id, big) {
    return el("span", { class: "av" + (big ? " lg" : ""), "aria-hidden": "true" }, (nameOf(id)[0] || "?").toUpperCase());
  }

  function personChip(id, onToggle, on) {
    const kids = [avatar(id), el("span", { text: nameOf(id) })];
    if (onToggle) {
      return el("button", { type: "button", class: "person" + (on ? " on" : ""), "aria-pressed": on ? "true" : "false", onclick: onToggle },
        kids, el("span", { class: "ck" }, icon("check")));
    }
    return el("span", { class: "person" }, kids);
  }

  /* ---------- pequenos blocos ---------- */

  const empty = (text) => el("div", { class: "empty" }, text);

  // stat("Total", 50, "pos", { key: "home-total", fmt }) conta de onde estava até o valor novo
  function stat(label, value, cls, anim) {
    const v = el("div", { class: "v" + (cls ? " " + cls : "") });
    if (anim && typeof value === "number") {
      v.setAttribute("data-count", anim.key);
      v.textContent = L.fx.count(anim.key, value, anim.fmt || String);
    } else {
      v.textContent = value;
    }
    return el("div", { class: "stat" }, el("div", { class: "k" }, label), v);
  }

  function pageHead(title, sub, extra) {
    return el("div", { class: "head" },
      el("div", null, el("h1", { text: title }), sub ? el("div", { class: "sub-t", text: sub }) : null),
      extra || null);
  }

  function crumbs(parts) {
    const c = $("crumbs");
    c.replaceChildren();
    parts.forEach((p, i) => {
      if (i) c.append(el("span", { class: "sl", "aria-hidden": "true" }, "/"));
      c.append(p.go ? el("button", { type: "button", onclick: p.go, text: p.label }) : el("span", { class: "cur", text: p.label }));
    });
  }

  function diffText(diff) {
    const D = DIFF[diff];
    return [el("span", { class: "dots", "aria-hidden": "true" }, D.dots), " " + D.label];
  }

  function confirmRow(question, yesLabel, onYes) {
    return el("div", { class: "row" },
      el("span", { class: "small muted" }, question),
      el("button", { class: "btn danger sm", type: "button", onclick: onYes }, yesLabel),
      el("button", { class: "btn ghost sm", type: "button", onclick: () => { S.confirm = null; rerender(); } }, "Cancelar"));
  }

  /* ---------- cabeçalho de sub-páginas (projeto e listRat) ---------- */

  // hero({ kicker, title, sub, badges[], stats[], actions }) + abas [{ key, label, go, count, hidden }]
  function subHeader(o, tabs, active) {
    const hero = el("section", { class: "hero" },
      el("div", { class: "hero-main" },
        o.kicker ? el("div", { class: "hero-kicker" }, o.kicker) : null,
        el("h1", { class: "hero-title" }, el("span", { text: o.title }), (o.badges || []).filter(Boolean)),
        o.sub ? el("p", { class: "hero-sub", text: o.sub }) : null),
      (o.stats && o.stats.length) || o.actions
        ? el("div", { class: "hero-side" }, o.stats && o.stats.length ? el("div", { class: "stats" }, o.stats) : null, o.actions || null)
        : null);
    const shown = tabs.filter((t) => t && !t.hidden);
    if (!shown.length) { hero.classList.add("solo"); return el("div", { class: "subhead" }, hero); }
    const bar = el("nav", { class: "tabsbar", "aria-label": "Seções" }, shown.map((t) =>
      el("button", {
        type: "button", class: "tabbtn" + (t.key === active ? " on" : "") + (t.tone ? " " + t.tone : ""),
        "aria-current": t.key === active ? "page" : null, onclick: t.go,
      }, t.ic ? icon(t.ic) : null, el("span", null, t.label), t.count ? el("span", { class: "tcount" }, String(t.count)) : null)));
    return el("div", { class: "subhead" }, hero, bar);
  }

  // "agora", "há 5 min", "há 3 h", "há 2 dias"
  function ago(ms) {
    const s = Math.max(0, (Date.now() - ms) / 1000);
    if (s < 60) return "agora";
    if (s < 3600) return "há " + Math.floor(s / 60) + " min";
    if (s < 86400) return "há " + Math.floor(s / 3600) + " h";
    const dd = Math.floor(s / 86400);
    return "há " + dd + (dd === 1 ? " dia" : " dias");
  }

  // caixinha de título para cada sub-página
  function block(title, desc, ...kids) {
    return el("section", { class: "panel block" },
      el("header", { class: "block-head" }, el("h2", null, title), desc ? el("p", { class: "muted small" }, desc) : null),
      kids);
  }

  /* ---------- janela de confirmação (sobre a tela) ---------- */
  function modal(title, body, actions) {
    return el("div", { class: "modal-back", role: "presentation" },
      el("div", { class: "modal", role: "dialog", "aria-modal": "true", "aria-label": title },
        el("h2", null, title), body, el("div", { class: "row modal-actions" }, actions)));
  }

  /* ---------- datas e período da listRat ---------- */

  // 20/10 (mesmo ano) ou 20/10/2027
  function fmtDate(k) {
    const d = parseKey(k);
    if (!d) return "";
    const base = shortDate(k);
    return d.getFullYear() === new Date().getFullYear() ? base : base + "/" + d.getFullYear();
  }

  // situação da listRat: { state: "sem" | "antes" | "agora" | "fim", text }
  function period(s) {
    const t = todayKey();
    const start = s && s.start, end = s && s.end;
    const days = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 86400000);
    if (s && s.status === "inscricoes") {
      return { state: "insc", text: "Inscrições abertas" + (start ? " · período de " + fmtDate(start) + (end ? " a " + fmtDate(end) : " em diante") : "") };
    }
    if (!start && !end) return { state: "sem", text: "" };
    if (start && start > t) {
      const n = days(t, start);
      return { state: "antes", text: "Começa " + (n === 1 ? "amanhã" : "em " + fmtDate(start) + " (em " + n + " dias)") + (end ? " · termina em " + fmtDate(end) : "") };
    }
    if (end && end < t) return { state: "fim", text: "Terminou em " + fmtDate(end) };
    if (end) {
      const n = days(t, end);
      return { state: "agora", text: (n === 0 ? "Termina hoje" : "Termina em " + fmtDate(end) + " · " + plural(n, "dia restante", "dias restantes")) };
    }
    return { state: "agora", text: "Desde " + fmtDate(start) + " · sem data para acabar" };
  }

  // selo curto para listas
  function periodTag(s) {
    const pr = period(s);
    if (pr.state === "sem") return null;
    const label = pr.state === "insc" ? "inscrições" : pr.state === "antes" ? "em breve" : pr.state === "fim" ? "encerrada" : "em andamento";
    return el("span", { class: "ptag-s " + pr.state }, label);
  }

  /* ---------- cartão de tarefa ---------- */

  function taskCard(task, opts) {
    opts = opts || {};
    const sub = S.subs[task.subId];
    const canEdit = !!opts.admin && L.perms.canEditTask(task);
    if (canEdit && S.draft.editTask && S.draft.editTask.id === task.id) return L.forms.taskEditCard(task);

    const r = L.score.taskResult(task);
    const mine = L.actions.canMark(task);
    const isObr = task.type === "obrigatoria";
    const daily = task.kind === "daily";
    const today = todayKey(), cw = curWeek();
    const doneNow = r.done.has(daily ? today : cw);
    const scoreVal = isObr ? -r.minus : r.plus;
    const D = DIFF[task.diff];
    const sp = L.score.span(task);           // período em que a tarefa vale
    const active = L.score.activeNow(task);

    const meta = el("div", { class: "tmeta" },
      isObr ? el("span", { class: "obr" }, "Obrigatória") : "Normal",
      " · ", daily ? "diária" : "semanal",
      " · ", diffText(task.diff),
      " · ", isObr ? "−" + D.pen + " se faltar" : "+" + D.pts,
      opts.where ? " · " + opts.where : "");

    const top = el("div", { class: "task-top" },
      el("div", null, el("div", { class: "tname", text: task.title }), meta),
      el("span", { class: "tscore " + (scoreVal > 0 ? "pos" : scoreVal < 0 ? "neg" : "zero"), title: "Saldo desta tarefa" }, fmtPts(scoreVal)));

    // botões de marcar
    let controls;
    if (daily) {
      const btns = [];
      for (let i = 6; i >= 0; i--) {
        const k = addDays(today, -i);
        const before = k < sp.from || (!!sp.end && k > sp.end);
        const on = r.done.has(k);
        const miss = isObr && !on && !before && k < today;
        const d = parseKey(k);
        const isToday = k === today;
        btns.push(el("button", {
          type: "button", "data-mark": task.id + "|" + k,
          class: "day" + (on ? " on" : "") + (miss ? " miss" : "") + (isToday ? " today" : "") + (before ? " off" : "") + (on && L.fx.isFlashing(task.id, k) ? " pop" : ""),
          disabled: !mine || before,
          "aria-pressed": on ? "true" : "false",
          "aria-label": task.title + " — " + WD[d.getDay()] + " " + shortDate(k) + (on ? ", feita" : miss ? ", não feita" : ""),
          title: before ? (k < sp.from ? "Fora do período (antes do início)" : "Fora do período (depois do fim)") : isToday ? "Hoje" : WD[d.getDay()] + " " + shortDate(k),
          onclick: () => L.actions.toggleMark(task, k),
        }, el("span", null, isToday ? "hoje" : WD[d.getDay()].toLowerCase()), el("b", null, on ? icon("check") : String(d.getDate()))));
      }
      controls = el("div", { class: "days" }, btns);
    } else {
      const lw = addDays(cw, -7);
      const mk = (k, label) => {
        if (k < weekOf(sp.from) || (sp.end && k > weekOf(sp.end))) return null;
        const on = r.done.has(k);
        const miss = isObr && !on && k < cw;
        return el("button", {
          type: "button", "data-mark": task.id + "|" + k, disabled: !mine,
          class: "wk" + (on ? " on" : "") + (miss ? " miss" : "") + (on && L.fx.isFlashing(task.id, k) ? " pop" : ""),
          "aria-pressed": on ? "true" : "false", onclick: () => L.actions.toggleMark(task, k),
        }, on ? icon("check") : null, label);
      };
      const wks = [mk(lw, "Semana passada"), mk(cw, "Esta semana")].filter(Boolean);
      controls = el("div", { class: "days" }, wks.length ? wks : el("span", { class: "hint" }, "Fora do período da listRat."));
    }

    // linha de baixo: situação + ações do dono
    const unit = daily ? ["dia", "dias"] : ["semana", "semanas"];
    let hint;
    const offTxt = sp.prep ? "Vale quando a listRat começar." : !active ? ((daily ? sp.from > today : weekOf(sp.from) > cw) ? "Começa em " + fmtDate(sp.from) + "." : "A listRat terminou.") : "";
    if (isObr) {
      const txt = (r.missed ? "Faltou " + plural(r.missed, unit[0], unit[1]) + ". " : "") +
        (offTxt || (doneNow ? "" : daily ? "Hoje ainda não foi feita." : "Esta semana ainda não foi feita."));
      hint = txt ? el("span", { class: "hint" + (doneNow || offTxt ? "" : " warn") }, txt) : null;
    } else {
      hint = el("span", { class: "hint" }, "Feita " + plural(r.done.size, "vez", "vezes") + (offTxt ? ". " + offTxt : ""));
    }

    let admin = null;
    if (canEdit) {
      admin = S.confirm === "t:" + task.id
        ? confirmRow("Apagar esta tarefa?", "Apagar", async () => {
            S.confirm = null;
            try { await L.actions.deleteTask(task.id); } catch (e) { L.app.setStatus(L.actions.errMsg(e, "Não deu para apagar agora."), true); }
            rerender();
          })
        : el("div", { class: "admin" },
            el("button", { class: "link", type: "button", onclick: () => {
              S.confirm = null;
              S.draft.editTask = { id: task.id, title: task.title, assignee: task.assignee, type: task.type, kind: task.kind, diff: task.diff };
              rerender();
            } }, "editar"),
            el("button", { class: "link danger", type: "button", onclick: () => { S.confirm = "t:" + task.id; rerender(); } }, "apagar"));
    }

    return el("div", { class: "task" + (isObr ? " obr" : "") + (L.fx.isFlashTask(task.id) ? " flash" : "") },
      top, controls, L.photos.proofRow(task, r, mine && active),
      (hint || admin) ? el("div", { class: "task-foot" }, hint || el("span"), admin) : null);
  }

  /* ---------- placar ---------- */

  function board(ids, tasks, boardKey) {
    boardKey = boardKey || "geral";
    const rows = ids.map((id) => Object.assign({ id }, L.score.scoreFor(id, tasks)))
      .sort((a, b) => b.total - a.total || nameOf(a.id).localeCompare(nameOf(b.id)));
    if (!rows.length) return empty("Ninguém no placar ainda.");
    const ol = el("ol", { class: "board" });
    let last = null, rank = 0;
    rows.forEach((r, i) => {
      if (r.total !== last) { rank = i + 1; last = r.total; }
      const lead = rank === 1 && r.total > 0;
      ol.append(el("li", { class: lead ? "first" : "" },
        el("div", { class: "rank" }, rank + "º"),
        avatar(r.id),
        el("div", { style: "min-width:0" },
          el("div", { class: "pname" }, el("span", { text: nameOf(r.id) }), r.id === S.myId ? el("span", { class: "you" }, "você") : null),
          el("div", { class: "split" }, "+" + r.plus.toLocaleString("pt-BR") + "  −" + r.minus.toLocaleString("pt-BR"))),
        el("div", { class: "pts" + (r.total < 0 ? " neg" : ""), "data-count": "board-" + boardKey + "-" + r.id },
          L.fx.count("board-" + boardKey + "-" + r.id, r.total, fmtTotal))));
    });
    return ol;
  }

  /* ---------- tabela de dificuldades ---------- */

  function legend() {
    return el("section", { class: "panel" },
      el("h2", null, "Dificuldades"),
      el("div", { style: "overflow-x:auto" }, el("table", { class: "legend" },
        el("thead", null, el("tr", null, el("th", null, "Nível"), el("th", { class: "r" }, "Normal ganha"), el("th", { class: "r" }, "Obrigatória perde"))),
        el("tbody", null, DIFF_KEYS.map((k) =>
          el("tr", null, el("td", null, diffText(k)), el("td", { class: "r num" }, "+" + DIFF[k].pts), el("td", { class: "r num" }, "−" + DIFF[k].pen)))))));
  }

  /* ---------- projetos ---------- */

  function visibleProjects() {
    return Object.values(S.projects)
      .filter((p) => L.perms.canSeeProject(p))
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  function projectList() {
    const list = visibleProjects();
    if (!list.length) return empty("Você ainda não está em nenhum projeto. Crie um em \"Novo projeto\" ou abra um link de convite.");
    return el("div", { class: "plist" }, list.map((p) => {
      const subsN = Object.values(S.subs).filter((s) => s.projectId === p.id).length;
      const member = p.members.includes(S.myId);
      const sc = member ? L.score.scoreFor(S.myId, L.score.tasksOfProject(p.id)) : null;
      return el("button", { type: "button", class: "prow", onclick: () => go({ page: "project", pid: p.id }) },
        el("div", { class: "t" }, p.name, L.perms.isProjectOwner(p) ? el("span", { class: "role" }, "dono") : null),
        p.desc ? el("div", { class: "d", text: p.desc }) : null,
        el("div", { class: "m" }, plural(p.members.length, "integrante", "integrantes") + " · " + plural(subsN, "listRat", "listRats")),
        sc ? el("div", { class: "score" }, fmtTotal(sc.total), el("small", null, "seus pontos")) : null);
    }));
  }

  L.ui = { subHeader, block, modal, ago, fmtDate, period, periodTag, nameOf, avatar, personChip, empty, stat, pageHead, crumbs, diffText, confirmRow, taskCard, board, legend, visibleProjects, projectList };
})(window.Liga);
