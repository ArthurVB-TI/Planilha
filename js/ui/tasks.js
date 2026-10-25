/* ui/tasks.js — como as tarefas aparecem.
   - row(task): linha compacta (nome, tipo, dificuldade, situação, faixa dos últimos dias e saldo).
     Na própria tarefa, tocar num dia marca/desmarca; tocar no resto abre o painel da tarefa.
   - sheet(): painel da tarefa (S.sheet = { id, key }) com tudo num lugar só: escolher o dia,
     marcar, foto, comentário, justificativa ("não consegui fazer"), contestação, editar e apagar.
   - group(...): tarefas de uma pessoa, com cabeçalho.
   - results(s, p): resultado da listRat (1º ouro, 2º prata, 3º bronze). */
window.Liga = window.Liga || {};
(function (L) {
  "use strict";
  const S = L.S;
  const { el, icon } = L.dom;
  const { fmtPts, fmtTotal, plural } = L.text;
  const { WD, todayKey, curWeek, addDays, weekOf, parseKey, shortDate } = L.dates;
  const { DIFF } = L.rules;

  const rerender = () => L.app.render();
  const ok = (m) => L.app.setStatus(m, false, { auto: true });
  const R = () => L.review;

  /* ---------- dias que aparecem ---------- */
  // listRat que já terminou mostra os últimos dias dela; senão, os últimos 7 dias até hoje
  function anchor(task) {
    const sp = L.score.span(task), t = todayKey();
    return sp.end && sp.end < t ? sp.end : t;
  }
  function windowKeys(task) {
    const a = anchor(task);
    if (task.kind === "daily") return [6, 5, 4, 3, 2, 1, 0].map((i) => addDays(a, -i));
    const w = weekOf(a);
    return [addDays(w, -7), w];
  }
  const nowKey = (task) => (task.kind === "daily" ? todayKey() : curWeek());
  const keyLabel = (task, k) => {
    if (task.kind !== "daily") return (k === curWeek() ? "Esta semana" : "Semana de " + shortDate(k));
    if (k === todayKey()) return "Hoje";
    if (k === addDays(todayKey(), -1)) return "Ontem";
    const d = parseKey(k);
    return WD[d.getDay()] + " " + shortDate(k);
  };

  // situação de um dia/semana: off | on | just (justificativa aceita) | jpend | jno | miss | open
  function dayState(task, k, r, sp, marked) {
    const daily = task.kind === "daily";
    const from = daily ? sp.from : weekOf(sp.from);
    const endK = sp.end ? (daily ? sp.end : weekOf(sp.end)) : null;
    if (sp.prep || k < from || (endK && k > endK) || k > nowKey(task)) return "off";
    const j = R().justOf(task.id, k);
    if (r.done.has(k)) return marked.has(k) ? "on" : "just";
    if (j && j.status === "pendente") return "jpend";
    if (j && j.status === "recusada" && task.type === "obrigatoria") return "jno";
    if (task.type === "obrigatoria" && k < nowKey(task)) return "miss";
    return "open";
  }
  const STATE_TEXT = {
    off: "fora do período", on: "feita", just: "justificada (aceita)", jpend: "justificativa esperando",
    jno: "justificativa recusada", miss: "não feita", open: "ainda não feita",
  };

  function openSheet(task, key) {
    const keys = windowKeys(task), sp = L.score.span(task), r = L.score.taskResult(task);
    const marked = new Set(L.score.marksOf(task.assignee, task.id));
    let k = key;
    if (!k) {
      const valid = keys.filter((x) => dayState(task, x, r, sp, marked) !== "off");
      k = valid.includes(nowKey(task)) ? nowKey(task) : valid[valid.length - 1] || keys[keys.length - 1];
    }
    S.sheet = { id: task.id, key: k, mode: "", note: null, jText: "", jPhoto: "", pText: "", pPhoto: "", err: "", confirm: "", edit: null };
    rerender();
  }

  /* ---------- chips de informação ---------- */
  function chips(task, extra) {
    const isObr = task.type === "obrigatoria", D = DIFF[task.diff];
    return el("div", { class: "tchips" },
      el("span", { class: "tc " + (isObr ? "c-obr" : "c-norm") }, isObr ? "Obrigatória" : "Normal"),
      el("span", { class: "tc" }, task.kind === "daily" ? "Diária" : "Semanal"),
      el("span", { class: "tc c-diff" }, el("i", { class: "dots", "aria-hidden": "true" }, D.dots), D.label),
      el("span", { class: "tc c-pts" }, isObr ? "−" + D.pen + " se faltar" : "+" + D.pts + " por vez"),
      extra || null);
  }

  // frase curta da situação da tarefa
  function status(task, r, sp) {
    const s = S.subs[task.subId];
    const c = R().contestOf(task.id);
    if (r.voided) return ["bad", "Perdeu a contestação: não vale pontos"];
    if (c) return ["warn", "Contestada por " + L.ui.nameOf(c.by) + ": " + R().contestText(c)];
    if (sp.prep) return ["", "Vale quando a listRat começar"];
    const t = todayKey();
    if (sp.end && t > sp.end) {
      const ph = R().phase(s);
      return ["", ph === "contestacao" ? "Encerrada · hoje é o dia de contestação" : "Encerrada"];
    }
    if ((task.kind === "daily" ? sp.from : weekOf(sp.from)) > nowKey(task)) return ["", "Começa em " + L.ui.fmtDate(sp.from)];
    const pend = R().justsOfTask(task.id).filter((j) => j.status === "pendente").length;
    const done = r.done.has(nowKey(task));
    const unit = task.kind === "daily" ? "hoje" : "esta semana";
    if (done) return ["good", "Feita " + unit];
    if (pend) return ["purple", plural(pend, "justificativa esperando", "justificativas esperando")];
    if (task.type === "obrigatoria") return ["bad", "Falta " + unit];
    return ["", "Feita " + plural(r.done.size, "vez", "vezes")];
  }

  /* ---------- linha compacta ---------- */
  function row(task, opts) {
    opts = opts || {};
    const r = L.score.taskResult(task), sp = L.score.span(task);
    const isObr = task.type === "obrigatoria", daily = task.kind === "daily";
    const marked = new Set(L.score.marksOf(task.assignee, task.id));
    const val = isObr ? -r.minus : r.plus;
    const [tone, text] = status(task, r, sp);

    const strip = el("div", { class: "tr-strip" + (daily ? "" : " wk"), role: "group", "aria-label": daily ? "Últimos dias" : "Semanas" },
      windowKeys(task).map((k) => {
        const st = dayState(task, k, r, sp, marked);
        const can = L.actions.canChangeDay(task, k);
        const d = parseKey(k);
        return el("button", {
          type: "button", class: "cell st-" + st + (k === nowKey(task) ? " now" : "") + (r.done.has(k) && L.fx.isFlashing(task.id, k) ? " pop" : ""),
          title: keyLabel(task, k) + " · " + STATE_TEXT[st] + (can ? (marked.has(k) ? " · tocar para desmarcar" : " · tocar para marcar") : ""),
          "aria-label": task.title + ", " + keyLabel(task, k) + ": " + STATE_TEXT[st],
          "aria-pressed": marked.has(k) ? "true" : "false",
          onclick: (e) => { e.stopPropagation(); if (can && st !== "jpend") L.actions.toggleMark(task, k); else openSheet(task, k); },
        }, daily
          ? [el("span", null, WD[d.getDay()].charAt(0)), el("b", null, st === "on" || st === "just" ? icon("check") : String(d.getDate()))]
          : [el("span", null, k === curWeek() ? "esta" : "sem."), el("b", null, st === "on" || st === "just" ? icon("check") : shortDate(k))]);
      }));

    const c = R().contestOf(task.id);
    return el("div", { class: "trow" + (isObr ? " obr" : "") + (r.voided ? " void" : "") + (L.fx.isFlashTask(task.id) ? " flash" : "") },
      el("button", { type: "button", class: "tr-open", onclick: () => openSheet(task), "aria-label": "Abrir " + task.title },
        el("div", { class: "tr-title" }, el("span", { text: task.title }), c ? el("span", { class: "flag", title: "Contestada" }, icon("flag")) : null),
        chips(task, opts.where ? el("span", { class: "tc c-where" }, opts.where) : null),
        el("div", { class: "tr-status " + tone }, text)),
      strip,
      el("div", { class: "tr-end" },
        el("span", { class: "tscore " + (val > 0 ? "pos" : val < 0 ? "neg" : "zero"), title: "Saldo desta tarefa" }, fmtPts(val)),
        el("button", { type: "button", class: "icon-btn tr-more", title: "Abrir tarefa", "aria-label": "Abrir " + task.title, onclick: () => openSheet(task) }, icon("chevron"))));
  }

  /* ---------- tarefas de uma pessoa ---------- */
  function group(id, tasks, s, opts) {
    opts = opts || {};
    const sc = L.score.scoreFor(id, tasks);
    const role = s ? L.perms.roleIn(s, id) : "";
    const late = tasks.filter((t) => t.type === "obrigatoria" && L.score.activeNow(t) && L.score.counts(t) && !L.score.doneNow(t)).length;
    return el("section", { class: "pgroup" + (id === S.myId ? " me" : "") },
      el("header", { class: "pg-head" },
        el("div", { class: "who" }, id ? L.ui.avatar(id) : null,
          el("div", { style: "min-width:0" },
            el("div", { class: "n" }, opts.title || !id ? el("span", { text: opts.title || "" }) : L.ui.userLink(id), id === S.myId ? el("span", { class: "you" }, "você") : null, role ? el("span", { class: "role" }, role) : null),
            el("div", { class: "small muted" }, opts.sub || (plural(tasks.length, "tarefa", "tarefas") + (late ? " · " + plural(late, "obrigatória falta hoje", "obrigatórias faltam hoje") : ""))))),
        opts.noScore ? null : el("div", { class: "pts" + (sc.total < 0 ? " neg" : "") }, fmtTotal(sc.total))),
      tasks.length ? el("div", { class: "tr-list" }, tasks.map((t) => row(t, opts.where ? { where: L.ui.nameOf(t.assignee) } : {}))) : el("p", { class: "muted small pg-empty" }, "Sem tarefas."));
  }

  /* ---------- painel da tarefa ---------- */
  async function run(sh, fn, okMsg) {
    try { await fn(); sh.err = ""; if (okMsg) ok(okMsg); }
    catch (e) { sh.err = L.actions.errMsg(e, "Não deu para fazer isso agora."); }
    rerender();
  }

  function photoThumb(id, caption) {
    const img = el("img", { alt: "", loading: "lazy" });
    const b = el("button", { type: "button", class: "sh-photo", "aria-label": "Ver foto", onclick: () => L.photos.openPhoto(id, caption) }, img);
    L.photos.loadInto(img, id, () => { b.classList.add("broken"); b.textContent = "foto indisponível"; });
    return b;
  }
  // botão de escolher foto que guarda o id no rascunho do painel
  function pickBtn(sh, field, tag) {
    const busy = S.uploading === tag;
    return el("div", { class: "row", style: "align-items:center" },
      el("button", { type: "button", class: "btn ghost sm", disabled: !!S.uploading, onclick: () => L.photos.pick(tag, (id) => {
        if (sh[field]) S.backend.photos.remove(sh[field]).catch(() => {});
        sh[field] = id;
      }) }, icon("camera"), busy ? "Enviando…" : sh[field] ? "Trocar foto" : "Adicionar foto (opcional)"),
      sh[field] ? photoThumb(sh[field], "Foto escolhida") : null);
  }

  function sheet() {
    const sh = S.sheet;
    const task = sh && S.tasks[sh.id];
    if (!task) { S.sheet = null; return null; }
    const s = S.subs[task.subId], p = s && S.projects[s.projectId];
    const r = L.score.taskResult(task), sp = L.score.span(task);
    const mine = task.assignee === S.myId;
    const judge = !!s && R().isJudge(s);
    const marked = new Set(L.score.marksOf(task.assignee, task.id));
    const isObr = task.type === "obrigatoria";
    const val = isObr ? -r.minus : r.plus;
    const close = () => { S.sheet = null; rerender(); };
    const who = mine ? "você" : L.ui.nameOf(task.assignee);

    const head = el("header", { class: "sh-head" },
      el("div", { style: "min-width:0" },
        el("div", { class: "sh-kicker" }, (s ? s.name : "") + (p ? " · " + p.name : "") + " · de " + who),
        el("h2", { class: "sh-title", text: task.title }),
        chips(task)),
      el("div", { class: "sh-side" },
        el("div", { class: "tscore " + (val > 0 ? "pos" : val < 0 ? "neg" : "zero") }, fmtPts(val)),
        el("button", { type: "button", class: "icon-btn", "aria-label": "Fechar", title: "Fechar", onclick: close }, icon("close"))));

    const body = el("div", { class: "sh-body" });
    const [tone, text] = status(task, r, sp);
    body.append(el("div", { class: "tr-status " + tone }, text));

    /* --- escolher o dia --- */
    const keys = windowKeys(task);
    body.append(el("section", { class: "sh-sec" },
      el("div", { class: "sh-lbl" }, task.kind === "daily" ? "Escolha o dia" : "Escolha a semana"),
      el("div", { class: "sh-days" + (task.kind === "daily" ? "" : " wk") }, keys.map((k) => {
        const st = dayState(task, k, r, sp, marked);
        const d = parseKey(k);
        return el("button", {
          type: "button", class: "sday st-" + st + (k === sh.key ? " sel" : ""), "aria-pressed": k === sh.key ? "true" : "false",
          onclick: () => { sh.key = k; sh.mode = ""; sh.note = null; sh.err = ""; sh.confirm = ""; rerender(); },
        },
          el("span", null, task.kind === "daily" ? (k === todayKey() ? "hoje" : WD[d.getDay()].toLowerCase()) : (k === curWeek() ? "esta" : "semana")),
          el("b", null, task.kind === "daily" ? String(d.getDate()) : shortDate(k)),
          el("i", null, st === "on" ? "feita" : st === "just" ? "justif." : st === "jpend" ? "esperando" : st === "miss" || st === "jno" ? "faltou" : st === "off" ? "—" : ""));
      }))));

    /* --- o dia escolhido --- */
    const k = sh.key;
    const st = dayState(task, k, r, sp, marked);
    const can = L.actions.canChangeDay(task, k);
    const proofs = L.photos.proofsOf(task.assignee, task.id);
    const note = L.actions.noteOf(task, k);
    const j = R().justOf(task.id, k);
    const day = el("section", { class: "sh-sec sh-day" },
      el("div", { class: "sh-dayhead" },
        el("h3", null, keyLabel(task, k)),
        el("span", { class: "dstate st-" + st }, STATE_TEXT[st])));

    if (mine && can) {
      day.append(el("div", { class: "row sh-actions" },
        marked.has(k)
          ? el("button", { type: "button", class: "btn ghost", onclick: () => L.actions.toggleMark(task, k) }, "Desmarcar")
          : el("button", { type: "button", class: "btn purple", onclick: () => {
              L.actions.toggleMark(task, k);
              if (j && j.status === "pendente") R().removeJustification(j).catch(() => {});
            } }, icon("check"), "Marcar como feita"),
        el("button", { type: "button", class: "btn ghost", disabled: !!S.uploading, onclick: () => L.photos.startPhoto(task, k) },
          icon("camera"), S.uploading === task.id + "|" + k ? "Enviando…" : proofs[k] ? "Trocar foto" : "Mandar foto"),
        !marked.has(k) && !j && sh.mode !== "justify"
          ? el("button", { type: "button", class: "btn ghost", onclick: () => { sh.mode = "justify"; rerender(); } }, icon("help"), "Não consegui fazer")
          : null));
      if (!marked.has(k) && !proofs[k]) day.append(el("p", { class: "hint" }, "A foto já marca como feita."));
    } else if (mine && !can && st !== "off") {
      day.append(el("p", { class: "hint" }, sp.end && todayKey() > sp.end ? "A listRat terminou: não dá mais para mudar este dia." : "Este dia não pode ser mudado."));
    }

    if (proofs[k] && marked.has(k)) {
      day.append(el("div", { class: "sh-field" }, el("div", { class: "sh-lbl" }, "Foto"), photoThumb(proofs[k], task.title + " — " + who + " — " + keyLabel(task, k))));
    }

    // comentário
    if (mine && can) {
      const cur = sh.note == null ? note : sh.note;
      day.append(el("div", { class: "sh-field" },
        el("label", { class: "sh-lbl", for: "shNote" }, icon("msg"), "Comentário"),
        el("textarea", { id: "shNote", maxlength: "300", rows: "2", placeholder: "Como foi? (opcional)", value: cur, oninput: (e) => { sh.note = e.target.value; } }),
        el("div", { class: "row" },
          el("button", { type: "button", class: "btn sm", onclick: () => run(sh, () => { L.actions.setNote(task, k, sh.note == null ? note : sh.note); sh.note = null; }, "Comentário salvo.") }, "Salvar comentário"),
          note ? el("button", { type: "button", class: "btn ghost sm", onclick: () => run(sh, () => { L.actions.setNote(task, k, ""); sh.note = null; }) }, "Apagar") : null)));
    } else if (note) {
      day.append(el("div", { class: "sh-field" }, el("div", { class: "sh-lbl" }, icon("msg"), "Comentário de " + who), el("p", { class: "sh-note", text: note })));
    }

    // justificativa
    if (j) {
      const pend = j.status === "pendente";
      day.append(el("div", { class: "sh-card j-" + j.status },
        el("div", { class: "sh-cardhead" }, el("b", null, "Justificativa"),
          el("span", { class: "dstate " + (j.status === "aceita" ? "st-on" : j.status === "recusada" ? "st-miss" : "st-jpend") },
            pend ? "esperando o dono ou um ajudante" : j.status === "aceita" ? "aceita: conta como feita" : "recusada")),
        el("p", { class: "sh-note", text: j.comment }),
        j.photo ? photoThumb(j.photo, "Justificativa — " + task.title) : null,
        j.decidedBy ? el("p", { class: "muted small" }, (j.status === "aceita" ? "Aceita" : "Recusada") + " por " + L.ui.nameOf(j.decidedBy) + ".") : null,
        el("div", { class: "row" },
          mine && pend && can ? el("button", { type: "button", class: "btn ghost sm", onclick: () => run(sh, () => R().removeJustification(j), "Justificativa apagada.") }, "Apagar justificativa") : null,
          judge && !mine && j.status !== "aceita" ? el("button", { type: "button", class: "btn purple sm", onclick: () => run(sh, () => R().judgeJustification(j, true), "Justificativa aceita.") }, icon("check"), "Aceitar") : null,
          judge && !mine && j.status !== "recusada" ? el("button", { type: "button", class: "btn danger-ghost sm", onclick: () => run(sh, () => R().judgeJustification(j, false), "Justificativa recusada.") }, "Recusar") : null)));
    } else if (sh.mode === "justify" && mine && can) {
      day.append(el("div", { class: "sh-card j-form" },
        el("div", { class: "sh-cardhead" }, el("b", null, "Justificar: por que não deu para fazer?")),
        el("p", { class: "muted small" }, "Só vale como feita se o dono ou um ajudante da listRat aceitar."),
        el("textarea", { id: "shJust", maxlength: "300", rows: "3", required: true, placeholder: "Escreva o motivo (obrigatório)", value: sh.jText, oninput: (e) => { sh.jText = e.target.value; } }),
        pickBtn(sh, "jPhoto", "j"),
        el("div", { class: "row" },
          el("button", { type: "button", class: "btn purple sm", onclick: () => run(sh, async () => {
            await R().sendJustification(task, k, sh.jText, sh.jPhoto);
            sh.jText = ""; sh.jPhoto = ""; sh.mode = "";
          }, "Justificativa enviada.") }, "Enviar justificativa"),
          el("button", { type: "button", class: "btn ghost sm", onclick: () => {
            if (sh.jPhoto) S.backend.photos.remove(sh.jPhoto).catch(() => {});
            sh.jPhoto = ""; sh.mode = ""; rerender();
          } }, "Cancelar"))));
    }
    body.append(day);

    /* --- contestação --- */
    const ph = s ? R().phase(s) : "";
    const c = R().contestOf(task.id);
    if (c) {
      const canProve = c.accused === S.myId && ph === "contestacao";
      const sec = el("section", { class: "sh-sec sh-card c-" + c.status + (R().lost(c) ? " lost" : "") },
        el("div", { class: "sh-cardhead" }, el("b", null, icon("flag"), "Contestada por " + (c.by === S.myId ? "você" : L.ui.nameOf(c.by))),
          el("span", { class: "dstate " + (R().lost(c) ? "st-miss" : c.status === "aberta" ? "st-jpend" : "st-on") }, R().contestText(c))),
        c.status === "aberta" && ph === "contestacao"
          ? el("p", { class: "muted small" }, (c.accused === S.myId ? "Você tem" : who + " tem") + " até o fim de hoje para mandar uma prova. Sem prova, a tarefa perde os pontos.")
          : null,
        c.proofComment ? el("p", { class: "sh-note", text: c.proofComment }) : null,
        c.proofPhoto ? photoThumb(c.proofPhoto, "Prova — " + task.title) : null);
      if (canProve) {
        sec.append(
          el("textarea", { id: "shProof", maxlength: "300", rows: "2", placeholder: "Explique ou descreva a prova", value: sh.pText, oninput: (e) => { sh.pText = e.target.value; } }),
          pickBtn(sh, "pPhoto", "p"),
          el("div", null, el("button", { type: "button", class: "btn purple sm", onclick: () => run(sh, async () => {
            await R().sendProof(c, sh.pPhoto || c.proofPhoto, sh.pText || c.proofComment);
            sh.pText = ""; sh.pPhoto = "";
          }, "Prova enviada.") }, c.status === "aberta" ? "Enviar prova" : "Atualizar prova")));
      }
      const row2 = el("div", { class: "row" },
        judge && (c.status === "provada" || c.status === "recusada") && c.accused !== S.myId
          ? el("button", { type: "button", class: "btn purple sm", onclick: () => run(sh, () => R().judgeContest(c, true), "Prova aceita.") }, "Aceitar prova") : null,
        judge && (c.status === "provada" || c.status === "aceita") && c.accused !== S.myId
          ? el("button", { type: "button", class: "btn danger-ghost sm", onclick: () => run(sh, () => R().judgeContest(c, false), "Prova recusada.") }, "Recusar prova") : null,
        c.by === S.myId && c.status === "aberta" && ph === "contestacao"
          ? el("button", { type: "button", class: "btn ghost sm", onclick: () => run(sh, () => R().cancelContest(c), "Contestação desfeita.") }, "Desistir da contestação") : null);
      if (row2.childNodes.length) sec.append(row2);
      body.append(sec);
    } else if (ph === "contestacao" && !mine) {
      const cc = R().canContest(task);
      body.append(el("section", { class: "sh-sec sh-card" },
        el("div", { class: "sh-cardhead" }, el("b", null, icon("flag"), "Contestar"),
          el("span", { class: "muted small" }, "Você ainda pode contestar " + R().left(s) + " de " + R().MAX_CONTESTS)),
        cc.ok
          ? (sh.confirm === "contest"
              ? el("div", { class: "row", style: "align-items:center" },
                  el("span", { class: "small" }, "Duvidar que " + who + " fez esta tarefa? Isso usa 1 contestação."),
                  el("button", { type: "button", class: "btn danger sm", onclick: () => run(sh, async () => { await R().openContest(task); sh.confirm = ""; }, "Tarefa contestada.") }, "Contestar"),
                  el("button", { type: "button", class: "btn ghost sm", onclick: () => { sh.confirm = ""; rerender(); } }, "Cancelar"))
              : el("div", null, el("button", { type: "button", class: "btn ghost", onclick: () => { sh.confirm = "contest"; rerender(); } }, icon("flag"), "Duvidar desta tarefa")))
          : el("p", { class: "muted small" }, cc.why || "Esta tarefa não pode ser contestada.")));
    }

    /* --- editar / apagar (só a própria pessoa) --- */
    const lvl = L.perms.editLevel(task);
    if (lvl) {
      const foot = el("section", { class: "sh-sec sh-foot" });
      if (sh.mode === "edit") {
        const d = sh.edit;
        foot.append(el("form", { class: "f", onsubmit: (ev) => {
          ev.preventDefault();
          const title = L.text.clean(d.title, 80);
          if (!title) { sh.err = "Escreva o nome da tarefa."; return rerender(); }
          run(sh, async () => { await L.actions.saveTask(task.id, Object.assign({}, d, { title })); sh.mode = ""; sh.edit = null; }, "Tarefa salva.");
        } },
          el("div", { class: "sh-lbl" }, "Editar tarefa"),
          el("div", { class: "field" }, el("label", { for: "shTitle" }, "Nome"),
            el("input", { id: "shTitle", maxlength: "80", required: true, value: d.title, oninput: (e) => { d.title = e.target.value; } })),
          lvl === "full" ? el("div", { class: "row" },
            el("div", { class: "field" }, el("span", { class: "lbl" }, "Tipo"), L.forms.seg(d, "type", [["normal", "Normal"], ["obrigatoria", "Obrigatória"]])),
            el("div", { class: "field" }, el("span", { class: "lbl" }, "Frequência"), L.forms.seg(d, "kind", [["daily", "Diária"], ["weekly", "Semanal"]]))) : null,
          lvl === "full" ? el("div", { class: "field" }, el("span", { class: "lbl" }, "Dificuldade"), L.forms.diffPick(d)) : null,
          lvl === "name" ? el("p", { class: "hint" }, "Depois que a listRat começa, só dá para mudar o nome.") : null,
          el("div", { class: "row" },
            el("button", { class: "btn sm", type: "submit" }, "Salvar"),
            el("button", { class: "btn ghost sm", type: "button", onclick: () => { sh.mode = ""; sh.edit = null; rerender(); } }, "Cancelar"))));
      } else if (sh.confirm === "del") {
        foot.append(el("div", { class: "row", style: "align-items:center" },
          el("span", { class: "small" }, "Apagar esta tarefa? As marcações dela somem."),
          el("button", { type: "button", class: "btn danger sm", onclick: async () => {
            try { await L.actions.deleteTask(task.id); S.sheet = null; ok("Tarefa apagada."); }
            catch (e) { sh.err = L.actions.errMsg(e, "Não deu para apagar."); }
            rerender();
          } }, "Apagar"),
          el("button", { type: "button", class: "btn ghost sm", onclick: () => { sh.confirm = ""; rerender(); } }, "Cancelar")));
      } else {
        foot.append(el("div", { class: "row" },
          el("button", { type: "button", class: "btn ghost sm", onclick: () => { sh.mode = "edit"; sh.edit = { title: task.title, type: task.type, kind: task.kind, diff: task.diff }; rerender(); } }, icon("edit"), lvl === "name" ? "Mudar o nome" : "Editar tarefa"),
          L.perms.canDeleteTask(task) ? el("button", { type: "button", class: "btn danger-ghost sm", onclick: () => { sh.confirm = "del"; rerender(); } }, icon("trash"), "Apagar tarefa") : null));
      }
      body.append(foot);
    }

    if (sh.err) body.append(el("p", { class: "err", role: "alert" }, sh.err));

    return el("div", { class: "modal-back sheet-back", role: "presentation", onclick: (e) => { if (e.target === e.currentTarget) close(); } },
      el("div", { class: "sheet", role: "dialog", "aria-modal": "true", "aria-label": task.title }, head, body));
  }

  /* ---------- resultado da listRat ---------- */
  function results(s, p, final) {
    const st = Object.values(S.tasks).filter((t) => t.subId === s.id);
    const ids = p.members.filter((id) => L.score.isParticipant(s, id));
    const rows = ids.map((id) => Object.assign({ id }, L.score.scoreFor(id, st))).sort((a, b) => b.total - a.total || L.ui.nameOf(a.id).localeCompare(L.ui.nameOf(b.id)));
    let last = null, rank = 0;
    const MEDAL = { 1: "gold", 2: "silver", 3: "bronze" };
    return el("ol", { class: "results" + (final ? " final" : "") }, rows.map((r, i) => {
      if (r.total !== last) { rank = i + 1; last = r.total; }
      const m = MEDAL[rank] || "";
      return el("li", { class: m },
        el("span", { class: "rk" }, rank + "º"),
        L.ui.avatar(r.id),
        el("span", { class: "nm" }, L.ui.userLink(r.id), r.id === S.myId ? el("span", { class: "you" }, "você") : null),
        m ? el("span", { class: "medal", "aria-label": m === "gold" ? "ouro" : m === "silver" ? "prata" : "bronze" }, icon("trophy")) : null,
        el("span", { class: "pt" + (r.total < 0 ? " neg" : "") }, fmtTotal(r.total)));
    }));
  }

  L.tasksUI = { row, group, sheet, openSheet, results, windowKeys };
})(window.Liga);
