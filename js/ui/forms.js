/* ui/forms.js — formulários de projeto e tarefa. Todo campo grava no rascunho (S.draft)
   enquanto você digita, então nada se perde quando a tela é redesenhada. */
window.Liga = window.Liga || {};
(function (L) {
  "use strict";
  const S = L.S;
  const { el, $ } = L.dom;
  const { clean } = L.text;
  const { DIFF, DIFF_KEYS, NICK_MAX } = L.rules;

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
        el("span", { class: "v" }, d.type === "normal" ? "+" + DIFF[k].pts + " pts" : "−" + DIFF[k].pen + " se faltar"))));
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
      el("div", { class: "field" }, el("span", { class: "lbl" }, "Integrantes"),
        memberPicker(d.members, (m) => { d.members = m; rerender(); }),
        el("p", { class: "hint" }, "Aparece aqui quem já criou conta no site.")),
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
        const id = await L.actions.createProject({ name, desc, members: d.members });
        S.draft.newProject = null;
        L.app.go({ page: "project", pid: id });
      } catch (e) {
        setErr("pErr", errMsg(e, "Não deu para criar o projeto."));
        $("pSubmit").disabled = false;
      }
    } },
      projectFields(d, "p"),
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
        await L.actions.saveProject(p.id, { name, desc, members: d.members });
        S.draft.editProject = null;
        rerender();
      } catch (e) {
        setErr("epErr", errMsg(e, "Não deu para salvar o projeto."));
        $("epSave").disabled = false;
      }
    } },
      el("h2", null, "Editar projeto"),
      projectFields(d, "ep"),
      el("p", { class: "hint" }, "Quem sair do projeto para de pontuar nele; as tarefas ficam guardadas."),
      el("div", { class: "row" },
        el("button", { class: "btn", type: "submit", id: "epSave" }, "Salvar"),
        el("button", { class: "btn ghost", type: "button", onclick: () => { S.draft.editProject = null; rerender(); } }, "Cancelar")),
      el("div", { class: "err", id: "epErr" }));
  }

  /* ---------- tarefa ---------- */

  function taskForm(p, s) {
    const d = S.draft.task;
    if (!p.members.length) {
      return el("section", { class: "panel" }, el("h2", null, "Nova tarefa"),
        el("p", { class: "muted" }, "O projeto não tem integrantes. Adicione alguém (você, por exemplo) para criar tarefas."),
        el("div", null, el("button", { class: "btn ghost", type: "button", onclick: () => {
          L.app.go({ page: "project", pid: p.id });
          S.draft.editProject = { name: p.name, desc: p.desc, members: [...p.members] };
          rerender();
        } }, "Adicionar integrantes")));
    }
    if (!p.members.includes(d.assignee)) d.assignee = p.members.includes(S.myId) ? S.myId : p.members[0];

    return el("form", { class: "f panel", id: "taskForm", onsubmit: async (ev) => {
      ev.preventDefault();
      const title = clean(d.title, 80);
      if (!title) return setErr("tErr", "Escreva o nome da tarefa.");
      if (!p.members.includes(d.assignee)) return setErr("tErr", "Escolha quem vai fazer.");
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
      el("h2", null, "Nova tarefa"),
      el("div", { class: "row" },
        el("div", { class: "field grow" }, el("label", { for: "tTitle" }, "Tarefa"),
          input({ id: "tTitle", maxlength: "80", required: true, placeholder: "Ler 20 páginas" }, d, "title")),
        el("div", { class: "field", style: "flex:0 1 200px" }, el("label", { for: "tWho" }, "Quem faz"),
          el("select", { id: "tWho", value: d.assignee, onchange: (e) => { d.assignee = e.target.value; } },
            p.members.map((id) => el("option", { value: id }, L.ui.nameOf(id) + (id === S.myId ? " (você)" : "")))))),
      el("div", { class: "row" },
        el("div", { class: "field" }, el("span", { class: "lbl" }, "Tipo"), seg(d, "type", [["normal", "Normal"], ["obrigatoria", "Obrigatória"]])),
        el("div", { class: "field" }, el("span", { class: "lbl" }, "Frequência"), seg(d, "kind", [["daily", "Diária"], ["weekly", "Semanal"]]))),
      el("div", { class: "field" }, el("span", { class: "lbl" }, "Dificuldade"), diffPick(d)),
      el("p", { class: "hint" }, d.type === "normal"
        ? "Ganha os pontos a cada " + (d.kind === "daily" ? "dia" : "semana") + " em que for feita."
        : "Não dá pontos. Perde os pontos a cada " + (d.kind === "daily" ? "dia" : "semana") + " sem fazer."),
      el("div", { class: "row" }, el("button", { class: "btn", type: "submit", id: "tSubmit" }, "Criar tarefa")),
      el("div", { class: "err", id: "tErr" }));
  }

  function taskEditCard(task) {
    const d = S.draft.editTask;
    const sub = S.subs[task.subId], p = sub && S.projects[sub.projectId];
    const people = p ? [...new Set([...p.members, task.assignee])] : [task.assignee];
    return el("form", { class: "task f", id: "editTaskForm", onsubmit: async (ev) => {
      ev.preventDefault();
      const title = clean(d.title, 80);
      if (!title) return setErr("etErr", "Escreva o nome da tarefa.");
      $("etSave").disabled = true;
      try {
        await L.actions.saveTask(task.id, Object.assign({}, d, { title }));
        S.draft.editTask = null;
        rerender();
      } catch (e) {
        setErr("etErr", errMsg(e, "Não deu para salvar a tarefa."));
        $("etSave").disabled = false;
      }
    } },
      el("div", { class: "field" }, el("label", { for: "etTitle" }, "Tarefa"), input({ id: "etTitle", maxlength: "80", required: true }, d, "title")),
      el("div", { class: "field" }, el("label", { for: "etWho" }, "Quem faz"),
        el("select", { id: "etWho", value: d.assignee, onchange: (e) => { d.assignee = e.target.value; rerender(); } },
          people.map((id) => el("option", { value: id },
            L.ui.nameOf(id) + (id === S.myId ? " (você)" : "") + (p && !p.members.includes(id) ? " (fora do projeto)" : ""))))),
      el("div", { class: "row" },
        el("div", { class: "field" }, el("span", { class: "lbl" }, "Tipo"), seg(d, "type", [["normal", "Normal"], ["obrigatoria", "Obrigatória"]])),
        el("div", { class: "field" }, el("span", { class: "lbl" }, "Frequência"), seg(d, "kind", [["daily", "Diária"], ["weekly", "Semanal"]]))),
      el("div", { class: "field" }, el("span", { class: "lbl" }, "Dificuldade"), diffPick(d)),
      d.assignee !== task.assignee ? el("p", { class: "hint warn" }, "Trocando quem faz, as marcações da pessoa anterior deixam de contar.")
        : d.kind !== task.kind ? el("p", { class: "hint warn" }, "Trocando a frequência, as marcações antigas deixam de contar.") : null,
      el("div", { class: "row" },
        el("button", { class: "btn sm", type: "submit", id: "etSave" }, "Salvar"),
        el("button", { class: "btn ghost sm", type: "button", onclick: () => { S.draft.editTask = null; rerender(); } }, "Cancelar")),
      el("div", { class: "err", id: "etErr" }));
  }

  L.forms = { seg, diffPick, memberPicker, input, newProjectForm, projectEditForm, taskForm, taskEditCard };
})(window.Liga);
