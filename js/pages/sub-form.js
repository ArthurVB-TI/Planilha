/* pages/sub-form.js — página de criar e editar uma listRat:
   nome, quando começa, quando termina (ou sem data) e detalhes.
   Rota: { page: "subform", pid } cria; { page: "subform", pid, sid } edita. */
window.Liga = window.Liga || {};
window.Liga.pages = window.Liga.pages || {};
(function (L) {
  "use strict";
  const S = L.S;
  const P = L.perms;
  const { el, $ } = L.dom;
  const { clean, cleanLong, plural } = L.text;
  const { todayKey, addDays, parseKey, isKey } = L.dates;

  const go = (v) => L.app.go(v);
  const rerender = () => L.app.render();
  const DAY = 86400000;
  const daysBetween = (a, b) => Math.round((parseKey(b) - parseKey(a)) / DAY);

  function addMonths(k, n) {
    const d = parseKey(k);
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + n);
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
    return L.dates.keyOf(d);
  }

  const PRESETS = [
    ["1 semana", (k) => addDays(k, 6)],
    ["2 semanas", (k) => addDays(k, 13)],
    ["1 mês", (k) => addDays(addMonths(k, 1), -1)],
    ["3 meses", (k) => addDays(addMonths(k, 3), -1)],
    ["6 meses", (k) => addDays(addMonths(k, 6), -1)],
  ];

  function draftFor(s) {
    const key = s ? "e:" + s.id : "n:" + S.view.pid;
    if (!S.draft.subForm || S.draft.subForm.key !== key) {
      S.draft.subForm = s
        ? { key, name: s.name, desc: s.desc, start: s.start || "", end: s.end || "", hasEnd: !!s.end, req: Object.assign({}, s.req, { maxTasks: s.req.maxTasks || "" }) }
        : { key, name: "", desc: "", start: todayKey(), end: "", hasEnd: false, req: Object.assign({}, L.rules.DEFAULT_REQ, { maxTasks: "" }) };
    }
    return S.draft.subForm;
  }

  // resumo do período escolhido, atualizado enquanto a pessoa mexe
  function summary(d) {
    const start = d.start || todayKey();
    if (!d.hasEnd) return "Sem data para acabar. Começa " + (start === todayKey() ? "hoje" : "em " + L.ui.fmtDate(start)) + ".";
    if (!isKey(d.end)) return "Escolha quando a listRat termina.";
    if (d.end < start) return "O fim precisa ser depois do início.";
    const n = daysBetween(start, d.end) + 1;
    return "Dura " + plural(n, "dia", "dias") + (n >= 14 ? " (" + plural(Math.round(n / 7), "semana", "semanas") + ")" : "") +
      ": de " + L.ui.fmtDate(start) + " a " + L.ui.fmtDate(d.end) + ".";
  }

  L.pages.subform = function (v, opts) {
    opts = opts || {};
    const p = S.projects[S.view.pid];
    const s = S.view.sid ? S.subs[S.view.sid] : null;
    if (!p || !P.canSeeProject(p) || (S.view.sid && (!s || s.projectId !== p.id))) return L.pages.notFound(v);
    const editing = !!s;
    const allowed = editing ? P.canManageSub(s) : P.canCreateSub(p);

    const crumbs = [
      { label: "Projetos", go: () => go({ page: "projects" }) },
      { label: p.name, go: () => go({ page: "project", pid: p.id }) },
    ];
    if (editing) crumbs.push({ label: s.name, go: () => go({ page: "sub", pid: p.id, sid: s.id }) });
    crumbs.push({ label: editing ? "Editar" : "Nova listRat" });
    if (!opts.embedded) {
      L.ui.crumbs(crumbs);
      v.append(L.ui.pageHead(editing ? "Editar listRat" : "Nova listRat", editing ? s.name + " · " + p.name : "Em " + p.name));
    }
    if (!allowed) {
      v.append(L.ui.empty(editing ? "Só o dono da listRat (ou o dono do projeto) edita." : "Só quem é integrante do projeto cria listRats."));
      return;
    }

    const d = draftFor(s);
    const back = () => { S.draft.subForm = null; go(editing ? { page: "sub", pid: p.id, sid: s.id } : { page: "project", pid: p.id }); };
    const setErr = (msg) => { const n = $("sfErr"); if (n) n.textContent = msg; };

    const form = el("form", { class: "f panel sform", id: "subFormPage", onsubmit: async (ev) => {
      ev.preventDefault();
      const name = clean(d.name, 60);
      if (!name) return setErr("Dê um nome à listRat.");
      const start = isKey(d.start) ? d.start : "";
      const end = d.hasEnd ? (isKey(d.end) ? d.end : "") : "";
      if (d.hasEnd && !end) return setErr("Escolha quando a listRat termina, ou marque \"Sem data para acabar\".");
      if (start && end && end < start) return setErr("O fim precisa ser depois do início.");
      setErr("");
      $("sfSave").disabled = true;
      const req = L.rules.normReq(d.req);
      if (d.req.maxTasks !== "" && +d.req.maxTasks > 0 && +d.req.maxTasks < +d.req.minTasks) return setErr("O máximo de tarefas normais precisa ser maior ou igual ao mínimo (ou deixe em branco para não ter máximo).");
      const info = { name, desc: cleanLong(d.desc, 500), start, end, req };
      try {
        if (editing) {
          await L.actions.saveSub(s.id, info);
          if (s.status === "inscricoes") await L.actions.setSubReq(s.id, req);
          S.draft.subForm = null;
          go({ page: "sub", pid: p.id, sid: s.id });
        } else {
          const id = await L.actions.createSub(p.id, info);
          S.draft.subForm = null;
          S.draft.sub = "";
          go({ page: "sub", pid: p.id, sid: id });
        }
      } catch (e) {
        setErr(L.actions.errMsg(e, editing ? "Não deu para salvar a listRat." : "Não deu para criar a listRat."));
        const b = $("sfSave"); if (b) b.disabled = false;
      }
    } },
      // nome
      el("div", { class: "field" }, el("label", { for: "sfName" }, "Nome"),
        el("input", { id: "sfName", maxlength: "60", required: true, autocomplete: "off", placeholder: "Academia, Faculdade, Casa…",
          value: d.name, oninput: (e) => { d.name = e.target.value; } })),

      // período
      el("fieldset", { class: "period" },
        el("legend", { class: "lbl" }, "Período"),
        el("div", { class: "dates" },
          el("div", { class: "field" }, el("label", { for: "sfStart" }, "Começa"),
            el("input", { id: "sfStart", type: "date", value: d.start, onchange: (e) => { d.start = e.target.value; rerender(); } })),
          el("div", { class: "field" + (d.hasEnd ? "" : " off") }, el("label", { for: "sfEnd" }, "Termina"),
            el("input", { id: "sfEnd", type: "date", value: d.end, min: d.start || null, disabled: !d.hasEnd,
              onchange: (e) => { d.end = e.target.value; rerender(); } }))),
        el("label", { class: "check" },
          el("input", { type: "checkbox", id: "sfNoEnd", checked: !d.hasEnd, onchange: (e) => {
            d.hasEnd = !e.target.checked;
            if (d.hasEnd && !d.end) d.end = PRESETS[2][1](d.start || todayKey());
            rerender();
          } }),
          el("span", null, "Sem data para acabar")),
        d.hasEnd
          ? el("div", { class: "presets", role: "group", "aria-label": "Duração rápida" },
              el("span", { class: "small muted" }, "Duração:"),
              PRESETS.map(([label, fn]) => {
                const target = fn(d.start || todayKey());
                return el("button", { type: "button", class: "chip" + (d.end === target ? " on" : ""), onclick: () => { d.end = target; rerender(); } }, label);
              }))
          : null,
        el("p", { class: "hint period-sum", role: "status" }, summary(d))),

      // detalhes
      el("div", { class: "field" }, el("label", { for: "sfDesc" }, "Detalhes"),
        el("textarea", { id: "sfDesc", maxlength: "500", rows: "5", placeholder: "Objetivo, combinados, o que vale como prova…",
          value: d.desc, oninput: (e) => { d.desc = e.target.value; const c = $("sfCount"); if (c) c.textContent = e.target.value.length + "/500"; } }),
        el("div", { class: "hint", id: "sfCount", style: "text-align:right" }, (d.desc || "").length + "/500")),

      // regras de inscrição (só enquanto a listRat não começou)
      !editing || s.status === "inscricoes"
        ? el("fieldset", { class: "period" },
            el("legend", { class: "lbl" }, "Inscrições"),
            el("p", { class: "small muted" }, editing
              ? "Cada integrante preenche as próprias tarefas. Só participa quem cumprir as regras abaixo."
              : "A listRat começa em inscrições: cada integrante preenche as próprias tarefas e só participa quem cumprir as regras abaixo. Você (ou um ajudante) começa a listRat quando o desvio padrão estiver dentro do máximo."),
            el("div", { class: "req-grid" },
              [["minObr", "Mín. obrigatórias", "0", "30", ""], ["minTasks", "Mín. tarefas normais", "0", "30", ""], ["maxTasks", "Máx. tarefas normais (opcional)", "0", "30", "sem máximo"], ["maxDesvio", "Desvio padrão máximo", "0", "500", ""]]
                .map(([k, label, min, max, ph]) => el("div", { class: "field nfield" }, el("label", { for: "sf-" + k }, label),
                  el("input", { id: "sf-" + k, type: "number", inputmode: "numeric", min, max, step: "1", placeholder: ph || null,
                    value: d.req[k] === "" || d.req[k] == null ? "" : String(d.req[k]), oninput: (e) => { d.req[k] = e.target.value; } })))),
            el("div", { class: "row", style: "align-items:center" },
              el("span", { class: "hint" }, "Desvio recomendado: " + L.rules.RECOMMENDED_DESVIO + "."),
              +d.req.maxDesvio !== L.rules.RECOMMENDED_DESVIO
                ? el("button", { class: "link purple", type: "button", onclick: () => { d.req.maxDesvio = L.rules.RECOMMENDED_DESVIO; rerender(); } }, "Usar " + L.rules.RECOMMENDED_DESVIO)
                : null),
            el("p", { class: "hint" }, "O desvio é medido nos pontos possíveis por semana das tarefas normais de quem está pronto (diária vale os pontos × 7). " +
              "35 deixa duas pessoas ficarem até 1 tarefa fácil diária de diferença (70 pontos por semana). Obrigatórias não entram no desvio, e ele não impede ninguém de entrar: só impede começar."))
        : el("p", { class: "hint" }, "Esta listRat já começou" + (s.startedAt ? " em " + L.ui.fmtDate(s.startedAt) : "") + " com " +
            plural((s.participants || []).length, "participante", "participantes") + "."),

      el("p", { class: "hint" }, "As tarefas só valem dentro do período: antes do início e depois do fim não ganham nem perdem pontos." +
        (editing ? " Mudar as datas recalcula os pontos desta listRat." : " Quem cria a listRat vira o dono dela.")),
      el("div", { class: "row" },
        el("button", { class: "btn", type: "submit", id: "sfSave" }, editing ? "Salvar" : "Criar listRat"),
        el("button", { class: "btn ghost", type: "button", onclick: back }, "Cancelar")),
      el("div", { class: "err", id: "sfErr" }));

    v.append(form);
    // situação das inscrições e desvio padrão atual
    if (editing) { const ep = L.enrollUI.panel(s, p); if (ep) { ep.classList.add("sform"); v.append(ep); } }
  };
})(window.Liga);
