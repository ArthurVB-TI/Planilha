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

  /* ---------- cartão de tarefa ---------- */

  function taskCard(task, opts) {
    opts = opts || {};
    const sub = S.subs[task.subId];
    const canEdit = !!opts.admin && L.perms.canEditTasks(sub);
    if (canEdit && S.draft.editTask && S.draft.editTask.id === task.id) return L.forms.taskEditCard(task);

    const r = L.score.taskResult(task);
    const mine = L.actions.canMark(task);
    const isObr = task.type === "obrigatoria";
    const daily = task.kind === "daily";
    const today = todayKey(), cw = curWeek();
    const doneNow = r.done.has(daily ? today : cw);
    const scoreVal = isObr ? -r.minus : r.plus;
    const D = DIFF[task.diff];

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
        const before = k < task.startKey;
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
          title: before ? "Antes da tarefa existir" : isToday ? "Hoje" : WD[d.getDay()] + " " + shortDate(k),
          onclick: () => L.actions.toggleMark(task, k),
        }, el("span", null, isToday ? "hoje" : WD[d.getDay()].toLowerCase()), el("b", null, on ? icon("check") : String(d.getDate()))));
      }
      controls = el("div", { class: "days" }, btns);
    } else {
      const lw = addDays(cw, -7);
      const mk = (k, label) => {
        if (k < weekOf(task.startKey)) return null;
        const on = r.done.has(k);
        const miss = isObr && !on && k < cw;
        return el("button", {
          type: "button", "data-mark": task.id + "|" + k, disabled: !mine,
          class: "wk" + (on ? " on" : "") + (miss ? " miss" : "") + (on && L.fx.isFlashing(task.id, k) ? " pop" : ""),
          "aria-pressed": on ? "true" : "false", onclick: () => L.actions.toggleMark(task, k),
        }, on ? icon("check") : null, label);
      };
      controls = el("div", { class: "days" }, mk(lw, "Semana passada"), mk(cw, "Esta semana"));
    }

    // linha de baixo: situação + ações do dono
    const unit = daily ? ["dia", "dias"] : ["semana", "semanas"];
    let hint;
    if (isObr) {
      const txt = (r.missed ? "Faltou " + plural(r.missed, unit[0], unit[1]) + ". " : "") +
        (doneNow ? "" : daily ? "Hoje ainda não foi feita." : "Esta semana ainda não foi feita.");
      hint = txt ? el("span", { class: "hint" + (doneNow ? "" : " warn") }, txt) : null;
    } else {
      hint = el("span", { class: "hint" }, "Feita " + plural(r.done.size, "vez", "vezes"));
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
      top, controls, L.photos.proofRow(task, r, mine),
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
      .filter((p) => S.isOwner || p.members.includes(S.myId))
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  function projectList() {
    const list = visibleProjects();
    if (!list.length) return empty(S.isOwner ? "Nenhum projeto ainda." : "Você ainda não está em nenhum projeto.");
    return el("div", { class: "plist" }, list.map((p) => {
      const subsN = Object.values(S.subs).filter((s) => s.projectId === p.id).length;
      const member = p.members.includes(S.myId);
      const sc = member ? L.score.scoreFor(S.myId, L.score.tasksOfProject(p.id)) : null;
      return el("button", { type: "button", class: "prow", onclick: () => go({ page: "project", pid: p.id }) },
        el("div", { class: "t", text: p.name }),
        p.desc ? el("div", { class: "d", text: p.desc }) : null,
        el("div", { class: "m" }, plural(p.members.length, "integrante", "integrantes") + " · " + plural(subsN, "listRat", "listRats")),
        sc ? el("div", { class: "score" }, fmtTotal(sc.total), el("small", null, "seus pontos")) : null);
    }));
  }

  L.ui = { nameOf, avatar, personChip, empty, stat, pageHead, crumbs, diffText, confirmRow, taskCard, board, legend, visibleProjects, projectList };
})(window.Liga);
