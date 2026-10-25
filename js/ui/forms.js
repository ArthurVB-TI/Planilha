/* ui/forms.js — formulários de projeto e tarefa. Todo campo grava no rascunho (S.draft)
   enquanto você digita, então nada se perde quando a tela é redesenhada. */
window.Liga = window.Liga || {};
(function (L) {
  "use strict";
  const S = L.S;
  const { el, $ } = L.dom;
  const { clean, plural } = L.text;
  const { DIFF, DIFF_KEYS, NICK_MAX, TASK_MAX } = L.rules;

  const rerender = () => L.app.render();
  const errMsg = (e, f) => L.actions.errMsg(e, f);
  const setErr = (id, msg) => { const n = $(id); if (n) n.textContent = msg; };

  function seg(d, field, options, onPick) {
    return el("div", { class: "seg", role: "group" }, options.map(([val, label]) =>
      el("button", {
        type: "button", class: d[field] === val ? "on" : "", "aria-pressed": d[field] === val ? "true" : "false",
        onclick: () => { d[field] = val; if (onPick) onPick(val); rerender(); },
      }, label)));
  }

  function diffPick(d) {
    return el("div", { class: "dpick", role: "group" }, DIFF_KEYS.map((k) =>
      el("button", {
        type: "button", class: "dopt" + (d.diff === k ? " on" : ""), "aria-pressed": d.diff === k ? "true" : "false",
        onclick: () => { d.diff = k; rerender(); },
      },
        el("span", { class: "l" }, L.ui.diffText(k)),
        el("span", { class: "v" }, d.type === "normal" ? "+" + DIFF[k].pts + " pts" : L.rules.OBR_PENALTY ? "−" + DIFF[k].pen + " se faltar" : "sem pontos"))));
  }

  function memberPicker(selected, onChange) {
    const set = new Set(Object.keys(S.players).filter((id) => clean(S.players[id].nick, NICK_MAX)));
    if (S.myId) set.add(S.myId);
    for (const id of selected) set.add(id);
    const ids = [...set].sort((a, b) => (a === S.myId ? -1 : b === S.myId ? 1 : L.ui.nameOf(a).localeCompare(L.ui.nameOf(b))));
    return el("div", { class: "people" }, ids.map((id) => L.ui.personChip(id, () => {
      const s = new Set(selected);
      s.has(id) ? s.delete(id) : s.add(id);
      onChange([...s]);
    }, selected.includes(id))));
  }

  const input = (attrs, d, field) => el("input", Object.assign({ autocomplete: "off", value: d[field] || "", oninput: (e) => { d[field] = e.target.value; } }, attrs));
  const textarea = (attrs, d, field) => el("textarea", Object.assign({ value: d[field] || "", oninput: (e) => { d[field] = e.target.value; } }, attrs));

  /* ---------- projeto ---------- */

  function projectFields(d, prefix) {
    return [
      el("div", { class: "field" }, el("label", { for: prefix + "Name" }, "Nome"),
        input({ id: prefix + "Name", maxlength: "60", required: true, placeholder: "Semestre 2026.2" }, d, "name")),
      el("div", { class: "field" }, el("label", { for: prefix + "Desc" }, "Descrição"),
        textarea({ id: prefix + "Desc", maxlength: "200" }, d, "desc")),
    ];
  }

  function newProjectForm() {
    const d = S.draft.newProject;
    return el("form", { class: "f panel", id: "newProjForm", style: "max-width:680px", onsubmit: async (ev) => {
      ev.preventDefault();
      const name = clean(d.name, 60), desc = clean(d.desc, 200);
      if (!name) return setErr("pErr", "Dê um nome ao projeto.");
      $("pSubmit").disabled = true;
      try {
        const id = await L.actions.createProject({ name, desc });
        S.draft.newProject = null;
        L.pages.openMembers(id, "Projeto criado. Agora convide quem vai participar.");
      } catch (e) {
        setErr("pErr", errMsg(e, "Não deu para criar o projeto."));
        $("pSubmit").disabled = false;
      }
    } },
      projectFields(d, "p"),
      el("p", { class: "hint" }, "Você vira o dono do projeto. Depois de criar, abre a página de integrantes para chamar o pessoal (por link de convite ou pelo nome de usuário)."),
      el("div", { class: "row" },
        el("button", { class: "btn", type: "submit", id: "pSubmit" }, "Criar projeto"),
        el("button", { class: "btn ghost", type: "button", onclick: () => { S.draft.newProject = null; L.app.go({ page: "projects" }); } }, "Cancelar")),
      el("div", { class: "err", id: "pErr" }));
  }

  function projectEditForm(p) {
    const d = S.draft.editProject;
    return el("form", { class: "f panel", id: "editProjForm", onsubmit: async (ev) => {
      ev.preventDefault();
      const name = clean(d.name, 60), desc = clean(d.desc, 200);
      if (!name) return setErr("epErr", "Dê um nome ao projeto.");
      $("epSave").disabled = true;
      try {
        await L.actions.saveProject(p.id, { name, desc });
        S.draft.editProject = null;
        rerender();
      } catch (e) {
        setErr("epErr", errMsg(e, "Não deu para salvar o projeto."));
        $("epSave").disabled = false;
      }
    } },
      el("h2", null, "Editar projeto"),
      projectFields(d, "ep"),
      el("p", { class: "hint" }, "Integrantes ficam na página Integrantes do projeto."),
      el("div", { class: "row" },
        el("button", { class: "btn", type: "submit", id: "epSave" }, "Salvar"),
        el("button", { class: "btn ghost", type: "button", onclick: () => { S.draft.editProject = null; rerender(); } }, "Cancelar")),
      el("div", { class: "err", id: "epErr" }));
  }

  /* ---------- tarefa ---------- */

  function taskForm(p, s) {
    const d = S.draft.task;
    // cada pessoa só cria tarefas para si mesma (nas inscrições)
    d.assignee = S.myId;
    const insc = s.status === "inscricoes";
    let quota = null;
    if (insc) {
      const st = L.enroll.personStatus(s, d.assignee);
      quota = el("p", { class: "hint" + (st.ready ? "" : " warn") },
        "Você tem " +
        plural(st.obr, "obrigatória", "obrigatórias") + " (mín. " + s.req.minObr + ") e " +
        plural(st.normal, "normal", "normais") + " (" + (s.req.maxTasks ? s.req.minTasks + " a " + s.req.maxTasks : "mín. " + s.req.minTasks) + "). " +
        (st.ready ? "Pronto para participar." : st.text + "."));
    }

    return el("form", { class: "f panel", id: "taskForm", onsubmit: async (ev) => {
      ev.preventDefault();
      const title = clean(d.title, TASK_MAX);
      if (!title) return setErr("tErr", "Escreva o nome da tarefa.");
      setErr("tErr", "");
      $("tSubmit").disabled = true;
      try {
        await L.actions.createTask(p, s, Object.assign({}, d, { title }));
        d.title = "";
        rerender();
        const t = $("tTitle"); if (t) t.focus();
      } catch (e) {
        setErr("tErr", errMsg(e, "Não deu para criar a tarefa."));
      }
      if ($("tSubmit")) $("tSubmit").disabled = false;
    } },
      el("h2", null, "Nova tarefa sua"),
      el("p", { class: "muted small" }, "Cada pessoa cria as próprias tarefas. Ninguém cria nem edita tarefa de outra pessoa."),
      el("div", { class: "row" },
        el("div", { class: "field grow" }, el("label", { for: "tTitle" }, "Tarefa"),
          input({ id: "tTitle", maxlength: String(TASK_MAX), required: true, placeholder: "Ler 20 páginas" }, d, "title"))),
      el("div", { class: "row" },
        el("div", { class: "field" }, el("span", { class: "lbl" }, "Tipo"), seg(d, "type", [["normal", "Normal"], ["obrigatoria", "Obrigatória"]])),
        el("div", { class: "field" }, el("span", { class: "lbl" }, "Frequência"), seg(d, "kind", [["daily", "Diária"], ["weekly", "Semanal"]]))),
      el("div", { class: "field" }, el("span", { class: "lbl" }, "Dificuldade"), diffPick(d)),
      el("p", { class: "hint" }, d.type === "normal"
        ? "Ganha os pontos a cada " + (d.kind === "daily" ? "dia" : "semana") + " em que for feita."
        : L.rules.OBR_PENALTY ? "Não dá pontos. Perde os pontos a cada " + (d.kind === "daily" ? "dia" : "semana") + " sem fazer."
          : "Não dá nem tira pontos: é o compromisso que você precisa ter para entrar na listRat. Quando não for feita, aparece como \"faltou\"."),
      quota,
      el("div", { class: "row" }, el("button", { class: "btn", type: "submit", id: "tSubmit" }, "Criar tarefa")),
      el("div", { class: "err", id: "tErr" }));
  }

  L.forms = { seg, diffPick, memberPicker, input, newProjectForm, projectEditForm, taskForm };
})(window.Liga);
