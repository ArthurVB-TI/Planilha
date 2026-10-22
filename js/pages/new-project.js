/* pages/new-project.js — Novo projeto (qualquer pessoa; quem cria vira o dono do projeto) */
window.Liga = window.Liga || {};
window.Liga.pages = window.Liga.pages || {};
(function (L) {
  "use strict";
  const S = L.S;
  const { el } = L.dom;

  L.pages.new = function (v) {
    L.ui.crumbs([{ label: "Projetos", go: () => L.app.go({ page: "projects" }) }, { label: "Novo projeto" }]);
    if (!S.draft.newProject) S.draft.newProject = { name: "", desc: "" };
    v.append(L.ui.pageHead("Novo projeto"), L.forms.newProjectForm());
  };
})(window.Liga);
