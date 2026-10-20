/* pages/login.js — entrar ou criar conta (usuário, e-mail e senha) e, se a conta tiver,
   o código da verificação em duas etapas */
window.Liga = window.Liga || {};
window.Liga.pages = window.Liga.pages || {};
(function (L) {
  "use strict";
  const S = L.S;
  const { el } = L.dom;
  const R = L.rules;

  const rerender = () => L.app.render();

  function field(id, label, attrs, d, key) {
    return el("div", { class: "field" }, el("label", { for: id }, label),
      el("input", Object.assign({ id, value: d[key] || "", oninput: (e) => { d[key] = e.target.value; } }, attrs)));
  }

  async function run(d, fn) {
    if (d.busy) return;
    d.busy = true; d.err = "";
    rerender();
    try { await fn(); }
    catch (e) { d.err = L.actions.errMsg(e, "Algo deu errado. Tente de novo."); }
    d.busy = false;
    if (S.draft.auth === d) rerender();
  }

  function loginForm(d) {
    if (d.mfa) {
      return el("form", { class: "f", id: "mfaForm", onsubmit: (ev) => {
        ev.preventDefault();
        run(d, async () => { await d.mfa.resolve(d.code.replace(/\s/g, "")); S.draft.auth = S.newAuthDraft(); });
      } },
        el("p", { class: "muted small" }, "Digite o código de 6 dígitos do seu aplicativo autenticador."),
        el("div", { class: "field" }, el("label", { for: "aCode" }, "Código"),
          el("input", { id: "aCode", class: "code", inputmode: "numeric", autocomplete: "one-time-code", maxlength: "7", value: d.code, oninput: (e) => { d.code = e.target.value; } })),
        el("button", { class: "btn block", type: "submit", disabled: d.busy }, d.busy ? "Conferindo…" : "Confirmar"),
        el("button", { class: "link", type: "button", onclick: () => { d.mfa = null; d.code = ""; d.err = ""; rerender(); } }, "Voltar"));
    }
    return el("form", { class: "f", id: "loginForm", onsubmit: (ev) => {
      ev.preventDefault();
      if (!d.login.trim() || !d.password) { d.err = "Preencha usuário e senha."; return rerender(); }
      run(d, async () => {
        const r = await S.backend.auth.signIn(d.login, d.password);
        if (r && r.mfa) { d.mfa = r; d.code = ""; }
        else S.draft.auth = S.newAuthDraft();
      });
    } },
      field("aLogin", "Usuário ou e-mail", { autocomplete: "username", autocapitalize: "none", spellcheck: "false" }, d, "login"),
      field("aPass", "Senha", { type: "password", autocomplete: "current-password" }, d, "password"),
      el("button", { class: "btn block", type: "submit", disabled: d.busy }, d.busy ? "Entrando…" : "Entrar"));
  }

  function signupForm(d) {
    return el("form", { class: "f", id: "signupForm", onsubmit: (ev) => {
      ev.preventDefault();
      const username = d.username.trim(), email = d.email.trim();
      const problem = R.checkUsername(username) || R.checkEmail(email) || R.checkPassword(d.password, d.password2);
      if (problem) { d.err = problem; return rerender(); }
      run(d, async () => {
        await S.backend.auth.signUp({ username, email, password: d.password });
        S.draft.auth = S.newAuthDraft();
        L.app.refreshUser();
      });
    } },
      field("aUser", "Usuário", { autocomplete: "username", autocapitalize: "none", spellcheck: "false", maxlength: "20" }, d, "username"),
      field("aEmail", "E-mail", { type: "email", autocomplete: "email" }, d, "email"),
      field("aNew", "Senha", { type: "password", autocomplete: "new-password" }, d, "password"),
      field("aNew2", "Repita a senha", { type: "password", autocomplete: "new-password" }, d, "password2"),
      el("p", { class: "hint" }, "O usuário é o nome que aparece no placar. Senha com pelo menos 8 caracteres."),
      el("button", { class: "btn block", type: "submit", disabled: d.busy }, d.busy ? "Criando…" : "Criar conta"));
  }

  L.pages.login = function (v) {
    const d = S.draft.auth;
    const tab = (id, label) => el("button", { type: "button", class: d.tab === id ? "on" : "",
      onclick: () => { d.tab = id; d.err = ""; d.mfa = null; rerender(); } }, label);

    v.append(el("div", { class: "auth" }, el("div", { class: "auth-box" },
      el("div", { class: "brand" }, el("span", { class: "mark", "aria-hidden": "true" }), el("span", null, "Liga das Tarefas")),
      el("section", { class: "panel" },
        d.mfa ? el("h2", null, "Verificação em duas etapas") : el("div", { class: "tabs" }, tab("login", "Entrar"), tab("signup", "Criar conta")),
        d.tab === "signup" && !d.mfa ? signupForm(d) : loginForm(d),
        el("div", { class: "err", role: "alert" }, d.err || "")))));
  };
})(window.Liga);
