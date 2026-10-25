/* ui/enroll-panel.js — quadro das inscrições de uma listRat (usado na listRat e na página de editar).
   Mostra as regras, quem já completou as tarefas, o desvio padrão dos pontos e o botão de começar.
   Depois que começa, mostra os participantes gravados e deixa dono/ajudantes incluírem mais alguém. */
window.Liga = window.Liga || {};
(function (L) {
  "use strict";
  const S = L.S;
  const P = L.perms;
  const { el, icon } = L.dom;
  const { plural } = L.text;
  const E = L.enroll;

  const rerender = () => L.app.render();
  const err = (e, f) => L.app.setStatus(L.actions.errMsg(e, f), true);

  function reqText(r) {
    const parts = [];
    if (r.minObr) parts.push("pelo menos " + plural(r.minObr, "tarefa obrigatória", "tarefas obrigatórias"));
    if (!r.maxTasks) parts.push("pelo menos " + plural(r.minTasks, "tarefa normal", "tarefas normais"));
    else parts.push(r.minTasks === r.maxTasks
      ? plural(r.minTasks, "tarefa normal", "tarefas normais")
      : "de " + r.minTasks + " a " + r.maxTasks + " tarefas normais");
    return parts.join(" e ");
  }

  // campos numéricos das regras (dono e ajudantes)
  function reqEditor(s) {
    const d = S.draft.req && S.draft.req.sid === s.id ? S.draft.req : null;
    if (!d) {
      return el("div", null, el("button", { class: "link purple", type: "button", onclick: () => {
        S.draft.req = Object.assign({ sid: s.id }, s.req);
        rerender();
      } }, "Mudar regras"));
    }
    const num = (key, label, attrs) => el("div", { class: "field nfield" }, el("label", { for: "rq-" + key }, label),
      el("input", Object.assign({ id: "rq-" + key, type: "number", inputmode: "decimal", value: key === "maxTasks" && !+d[key] ? "" : String(d[key]),
        oninput: (e) => { d[key] = e.target.value; } }, attrs)));
    return el("form", { class: "f req-form", onsubmit: async (ev) => {
      ev.preventDefault();
      try { await L.actions.setSubReq(s.id, d); S.draft.req = null; }
      catch (e) { err(e, "Não deu para salvar as regras."); }
      rerender();
    } },
      el("div", { class: "req-grid" },
        num("minObr", "Mín. obrigatórias", { min: "0", max: "30", step: "1" }),
        num("minTasks", "Mín. normais", { min: "0", max: "30", step: "1" }),
        num("maxTasks", "Máx. normais (opcional)", { min: "0", max: "30", step: "1", placeholder: "sem máximo" }),
        num("maxDesvio", "Desvio máximo", { min: "0", max: "500", step: "1" })),
      el("p", { class: "hint" }, "O desvio é medido nos pontos possíveis por semana das tarefas normais de quem está pronto. Obrigatórias não entram na conta."),
      el("div", { class: "row" },
        el("button", { class: "btn sm", type: "submit" }, "Salvar regras"),
        el("button", { class: "btn ghost sm", type: "button", onclick: () => { S.draft.req = null; rerender(); } }, "Cancelar")));
  }

  function prepPanel(s) {
    const r = s.req;
    const sm = E.summary(s);
    const run = P.canRunSub(s);
    const max = Math.max(1, ...sm.people.map((x) => x.pts));

    const rows = sm.people.length
      ? el("div", { class: "etable", role: "table", "aria-label": "Situação de cada integrante" },
          el("div", { class: "erow ehead", role: "row" },
            el("span", { role: "columnheader" }, "Integrante"),
            el("span", { role: "columnheader", class: "r" }, "Obrig."),
            el("span", { role: "columnheader", class: "r" }, "Normais"),
            el("span", { role: "columnheader" }, "Pontos por semana"),
            el("span", { role: "columnheader" }, "Situação")),
          sm.people.sort((a, b) => (b.ready - a.ready) || b.pts - a.pts).map((x) =>
            el("div", { class: "erow" + (x.ready ? " ready" : ""), role: "row" },
              el("span", { class: "who", role: "cell" }, L.ui.avatar(x.uid), el("span", { class: "n", text: L.ui.nameOf(x.uid) }),
                x.uid === S.myId ? el("span", { class: "you" }, "você") : null),
              el("span", { class: "r num" + (x.obr < r.minObr ? " low" : ""), role: "cell" }, x.obr + "/" + r.minObr),
              el("span", { class: "r num" + (x.normal < r.minTasks || (r.maxTasks && x.normal > r.maxTasks) ? " low" : ""), role: "cell" }, String(x.normal)),
              el("span", { class: "ebar", role: "cell" },
                el("span", { class: "track" }, el("span", { class: "fill" + (x.ready ? "" : " off"), style: "width:" + Math.round((x.pts / max) * 100) + "%" })),
                el("b", { class: "num" }, String(x.pts))),
              el("span", { class: "est" + (x.ready ? " ok" : ""), role: "cell" }, x.ready ? [icon("check"), " Pronto"] : x.text))))
      : L.ui.empty("O projeto não tem integrantes.");

    const dv = el("div", { class: "desvio" + (sm.desvioOk ? " ok" : " bad") },
      el("div", null,
        el("div", { class: "k" }, "Desvio padrão dos pontos"),
        el("div", { class: "v num" }, E.fmt(sm.desvio), el("small", null, " / máx. " + E.fmt(r.maxDesvio)))),
      el("div", { class: "small" },
        sm.ready.length
          ? plural(sm.ready.length, "pessoa pronta", "pessoas prontas") + " · média de " + E.fmt(sm.mean) + " pontos por semana"
          : "Ninguém pronto ainda",
        el("br"),
        el("span", { class: "muted" }, "Não impede ninguém de entrar; só impede começar.")));

    return el("section", { class: "panel enroll", id: "enrollPanel" },
      el("div", { class: "panel-head" },
        el("h2", null, "Inscrições abertas"),
        el("span", { class: "ptag-s insc" }, "inscrições")),
      el("p", { class: "small" }, "Cada integrante preenche as próprias tarefas aqui. Só participa da listRat quem tiver ", el("b", null, reqText(r)), ". Nada vale pontos até a listRat começar."),
      run ? reqEditor(s) : null,
      rows,
      dv,
      run
        ? el("div", { class: "start-row" },
            el("button", { class: "btn", type: "button", disabled: !sm.canStart, onclick: async () => {
              try {
                const n = await L.actions.startSub(s.id);
                L.app.setStatus("A listRat começou com " + plural(n, "participante", "participantes") + ".", false, { auto: true });
              } catch (e) { err(e, "Não deu para começar a listRat."); }
              rerender();
            } }, sm.ready.length ? "Começar com " + plural(sm.ready.length, "participante", "participantes") : "Começar listRat"),
            sm.block ? el("span", { class: "hint warn" }, sm.block) : el("span", { class: "hint" }, "Quem não estiver pronto fica de fora (o dono ou um ajudante pode incluir depois)."))
        : el("p", { class: "hint" }, "O dono da listRat ou um ajudante começa a listRat quando todos estiverem prontos."));
  }

  function activePanel(s, p) {
    const parts = (s.participants || []);
    const run = P.canRunSub(s);
    const outside = p.members.filter((id) => !parts.includes(id) && !(s.kicked || []).includes(id));
    return el("section", { class: "panel enroll" },
      el("div", { class: "panel-head" },
        el("h2", null, "Participantes"),
        el("span", { class: "muted" }, plural(parts.length, "pessoa", "pessoas") + (s.startedAt ? " · começou em " + L.ui.fmtDate(s.startedAt) : ""))),
      parts.length
        ? el("div", { class: "people" }, parts.map((id) => el("span", { class: "person" + (p.members.includes(id) ? "" : " gone"), title: p.members.includes(id) ? null : "Saiu do projeto" },
            L.ui.avatar(id), el("span", { text: L.ui.nameOf(id) }))))
        : L.ui.empty("Ninguém participou."),
      run && outside.length
        ? el("div", { class: "f" },
            el("span", { class: "lbl" }, "Fora da listRat"),
            el("div", { class: "people" }, outside.map((id) => el("button", { class: "person", type: "button", title: "Incluir " + L.ui.nameOf(id), onclick: async () => {
              try { await L.actions.addParticipant(s.id, id); } catch (e) { err(e, "Não deu para incluir."); }
              rerender();
            } }, L.ui.avatar(id), el("span", { text: L.ui.nameOf(id) }), icon("plus")))),
            el("p", { class: "hint" }, "Toque para incluir. As tarefas da pessoa passam a valer a partir de agora."))
        : null);
  }

  /* ---------- tirar pessoas da listRat (só o dono da listRat ou do projeto) ---------- */
  function kickPanel(s, p) {
    if (!P.canManageSub(s)) return null;
    const kicked = s.kicked || [];
    const inList = s.status === "inscricoes"
      ? p.members.filter((id) => !kicked.includes(id))
      : Array.isArray(s.participants) ? s.participants.filter((id) => p.members.includes(id)) : p.members.filter((id) => !kicked.includes(id));
    const can = inList.filter((id) => P.canKick(s, id));
    if (!can.length && !kicked.length) return null;
    const ask = S.draft.kick && S.draft.kick.sid === s.id ? S.draft.kick.uid : "";
    const act = async (fn, okText) => {
      try { await fn(); L.app.setStatus(okText, false, { auto: true }); }
      catch (e) { err(e, "Não deu certo agora."); }
      S.draft.kick = null;
      rerender();
    };
    const line = (id, right, sub) => el("div", { class: "cand kick-line" + (ask === id ? " asking" : "") },
      L.ui.avatar(id),
      el("div", { class: "pname", style: "display:grid;gap:0;justify-items:start;min-width:0" }, L.ui.userLink(id), sub ? el("span", { class: "small muted" }, sub) : null),
      el("div", { class: "row kick-acts" }, right));

    return el("section", { class: "panel kick", id: "kickPanel" },
      el("div", { class: "panel-head" },
        el("h2", null, "Tirar da listRat"),
        el("span", { class: "muted small" }, "Só você, como dono, vê isto.")),
      el("p", { class: "small muted" }, "Quem for tirado sai do placar, as tarefas dele param de contar, ele não pode criar tarefas aqui e deixa de ser ajudante. As tarefas ficam guardadas: dá para colocar a pessoa de volta depois."),
      can.length ? el("div", { class: "cands" }, can.map((id) => {
        if (ask === id) {
          return line(id, [
            el("button", { class: "btn danger sm", type: "button", onclick: () => act(() => L.actions.kickParticipant(s.id, id), L.ui.nameOf(id) + " foi tirado da listRat.") }, "Sim, tirar"),
            el("button", { class: "btn ghost sm", type: "button", onclick: () => { S.draft.kick = null; rerender(); } }, "Não"),
          ], "Tirar " + L.ui.nameOf(id) + " da listRat?");
        }
        const st = s.status === "inscricoes" ? E.personStatus(s, id) : null;
        return line(id,
          el("button", { class: "btn danger-ghost sm", type: "button", onclick: () => { S.draft.kick = { sid: s.id, uid: id }; rerender(); } }, "Tirar"),
          st ? (st.count ? plural(st.count, "tarefa", "tarefas") + " · " + (st.ready ? "pronto" : st.text.toLowerCase()) : "sem tarefas ainda") : null);
      })) : null,
      kicked.length ? el("div", { class: "f" },
        el("span", { class: "lbl" }, "Tirados da listRat"),
        el("div", { class: "cands" }, kicked.map((id) => line(id,
          el("button", { class: "btn ghost sm", type: "button", onclick: () => act(() => L.actions.readmitParticipant(s.id, id), L.ui.nameOf(id) + " voltou para a listRat.") }, "Colocar de volta"),
          s.status === "inscricoes" ? "pode voltar a preencher as tarefas" : "volta a contar a partir do dia em que voltar")))) : null);
  }

  // painel certo para a fase da listRat (ou nada, para listRats antigas sem inscrição)
  function panel(s, p) {
    if (s.status === "inscricoes") return prepPanel(s);
    if (Array.isArray(s.participants)) return activePanel(s, p);
    return null;
  }

  L.enrollUI = { panel, kickPanel, reqText };
})(window.Liga);
