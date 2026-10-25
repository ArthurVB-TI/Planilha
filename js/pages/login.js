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
      el("button", { class: "btn block", type: "submit", disabled: d.busy }, d.busy ? "Entrando…" : "Entrar"),
      el("button", { class: "btn ghost block", type: "button", onclick: () => { d.tab = "reset"; d.err = ""; d.resetOk = ""; d.resetLogin = d.login; rerender(); } }, "Esqueci minha senha"));
  }

  // recuperar a conta pelo e-mail: o Firebase manda um link para criar uma senha nova
  function resetForm(d) {
    if (d.resetOk) {
      return el("div", { class: "f" },
        el("p", null, "Mandamos um link para ", el("b", { text: d.resetOk }), "."),
        el("p", { class: "hint" }, "Abra o e-mail (olhe também a pasta de spam), toque no link e escolha a senha nova. Depois volte aqui e entre com ela. O link vale por pouco tempo."),
        el("button", { class: "btn block", type: "button", onclick: () => { d.tab = "login"; d.resetOk = ""; d.password = ""; rerender(); } }, "Voltar para entrar"),
        el("button", { class: "btn ghost block", type: "button", disabled: d.busy, onclick: () => send() }, d.busy ? "Mandando…" : "Mandar de novo"));
    }
    function send() {
      const v = (d.resetLogin || "").trim();
      if (!v) { d.err = "Digite seu usuário ou e-mail."; return rerender(); }
      if (v.includes("@") && R.checkEmail(v)) { d.err = R.checkEmail(v); return rerender(); }
      run(d, async () => {
        const r = await S.backend.auth.resetPassword(v);
        d.resetOk = (r && r.to) || v;
      });
    }
    return el("form", { class: "f", id: "resetForm", onsubmit: (ev) => { ev.preventDefault(); send(); } },
      el("p", { class: "muted small" }, "Digite seu usuário ou o e-mail da conta. Vamos mandar um link para o e-mail cadastrado para você criar uma senha nova."),
      field("aReset", "Usuário ou e-mail", { autocomplete: "username", autocapitalize: "none", spellcheck: "false" }, d, "resetLogin"),
      el("button", { class: "btn block purple", type: "submit", disabled: d.busy }, d.busy ? "Mandando…" : "Mandar link de recuperação"),
      el("button", { class: "btn ghost block", type: "button", onclick: () => { d.tab = "login"; d.err = ""; rerender(); } }, "Voltar para entrar"),
      el("p", { class: "hint" }, "Só funciona se a conta tiver e-mail confirmado. Conta sem e-mail não tem como ser recuperada."));
  }

  function signupForm(d) {
    return el("form", { class: "f", id: "signupForm", onsubmit: (ev) => {
      ev.preventDefault();
      const username = d.username.trim(), email = d.email.trim();
      const problem = R.checkUsername(username) || (email ? R.checkEmail(email) : "") || R.checkPassword(d.password, d.password2);
      if (problem) { d.err = problem; return rerender(); }
      run(d, async () => {
        const r = (await S.backend.auth.signUp({ username, email, password: d.password })) || {};
        S.draft.auth = S.newAuthDraft();
        L.app.refreshUser();
        if (r.pendingEmail) {
          L.text.store.set("listrats.pendingEmail", r.pendingEmail);
          L.app.setStatus("Conta criada. Enviamos um link para " + r.pendingEmail + ": o e-mail só entra na conta depois que você abrir o link.", false);
        } else if (r.emailError) {
          L.app.setStatus("Conta criada, mas não deu para mandar o link para esse e-mail. Tente de novo em Configurações.", true);
        }
      });
    } },
      field("aUser", "Usuário", { autocomplete: "username", autocapitalize: "none", spellcheck: "false", maxlength: "20" }, d, "username"),
      field("aNew", "Senha", { type: "password", autocomplete: "new-password" }, d, "password"),
      field("aNew2", "Repita a senha", { type: "password", autocomplete: "new-password" }, d, "password2"),
      field("aEmail", "E-mail (opcional)", { type: "email", autocomplete: "email", placeholder: "pode deixar em branco" }, d, "email"),
      el("p", { class: "hint" }, "O usuário é o nome que aparece no placar. Senha com pelo menos 8 caracteres. " +
        "Se colocar um e-mail, mandamos um link: ele só passa a valer depois que você abrir o link (assim só entra e-mail que existe). Dá para pôr ou trocar o e-mail depois em Configurações."),
      el("button", { class: "btn block", type: "submit", disabled: d.busy }, d.busy ? "Criando…" : "Criar conta"));
  }

  L.pages.login = function (v) {
    const d = S.draft.auth;
    if (S.invite && !d.touched) { d.tab = "signup"; d.touched = true; }   // quem chega por convite geralmente ainda não tem conta
    const tab = (id, label) => el("button", { type: "button", class: d.tab === id ? "on" : "",
      onclick: () => { d.tab = id; d.err = ""; d.mfa = null; rerender(); } }, label);

    v.append(el("div", { class: "auth" }, el("div", { class: "auth-box" },
      el("div", { class: "brand" }, el("img", { class: "mark", src: "assets/icon.svg", alt: "", width: "34", height: "34" }), el("span", null, "listRats")),
      S.invite ? el("div", { class: "notice invite-note" }, el("b", null, "Você recebeu um convite."), " Entre ou crie sua conta e você já entra no projeto.") : null,
      el("section", { class: "panel" },
        d.mfa ? el("h2", null, "Verificação em duas etapas")
          : d.tab === "reset" ? el("h2", null, "Recuperar a conta")
          : el("div", { class: "tabs" }, tab("login", "Entrar"), tab("signup", "Criar conta")),
        d.mfa ? loginForm(d) : d.tab === "signup" ? signupForm(d) : d.tab === "reset" ? resetForm(d) : loginForm(d),
        el("div", { class: "err", role: "alert" }, d.err || "")))));
  };
})(window.Liga);
