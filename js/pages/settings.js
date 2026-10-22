/* pages/settings.js — Configurações: dados da conta, usuário, senha, e-mail,
   verificação em duas etapas, tema e sair */
window.Liga = window.Liga || {};
window.Liga.pages = window.Liga.pages || {};
(function (L) {
  "use strict";
  const S = L.S;
  const { el } = L.dom;
  const R = L.rules;

  const rerender = () => L.app.render();
  const auth = () => S.backend.auth;

  function draft() {
    const d = S.draft.settings;
    if (!d.ready) Object.assign(d, { ready: true, msg: {}, busy: {}, uname: S.user.name || "" });
    return d;
  }

  // roda uma ação de uma seção mostrando "erro" ou "ok" embaixo dela
  async function run(sec, fn, okText) {
    const d = draft();
    if (d.busy[sec]) return;
    d.busy[sec] = true;
    d.msg[sec] = {};
    rerender();
    try {
      const r = await fn();
      d.msg[sec] = { ok: typeof r === "string" ? r : okText || "" };
    } catch (e) {
      d.msg[sec] = { err: L.actions.errMsg(e, "Não deu certo. Tente de novo.") };
    }
    d.busy[sec] = false;
    rerender();
  }
  const msg = (sec) => {
    const m = draft().msg[sec] || {};
    return [el("div", { class: "err", role: "alert" }, m.err || ""), el("div", { class: "ok-msg" }, m.ok || "")];
  };

  function input(id, label, d, key, attrs) {
    return el("div", { class: "field" }, el("label", { for: id }, label),
      el("input", Object.assign({ id, value: d[key] || "", oninput: (e) => { d[key] = e.target.value; } }, attrs || {})));
  }
  const pw = (id, label, d, key, auto) => input(id, label, d, key, { type: "password", autocomplete: auto || "current-password" });
  const code = (id, d, key) => S.user.mfa
    ? input(id, "Código do autenticador", d, key, { class: "code", inputmode: "numeric", autocomplete: "one-time-code", maxlength: "7" })
    : null;

  function section(title, desc, ...body) {
    return el("section", { class: "sec" },
      el("header", null, el("h2", null, title), desc ? el("p", null, desc) : null),
      el("div", null, body));
  }

  /* ---------- conta ---------- */
  function account(d) {
    const u = S.user;
    const created = u.createdAt ? new Date(u.createdAt).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" }) : "—";
    const info = el("dl", { class: "info" },
      el("dt", null, "Usuário"), el("dd", { text: u.name || "—" }),
      el("dt", null, "E-mail"), el("dd", null, el("span", { text: u.email || "—" }),
        auth().verifiesEmail ? el("span", { class: "badge " + (u.emailVerified ? "ok" : "warn") }, u.emailVerified ? "confirmado" : "não confirmado") : null),
      el("dt", null, "Conta criada"), el("dd", null, created),
      el("dt", null, "Projetos"), el("dd", null, (() => {
        const mine = L.ui.visibleProjects();
        const own = mine.filter((p) => L.perms.isProjectOwner(p)).length;
        return mine.length ? mine.length + (mine.length === 1 ? " projeto" : " projetos") + (own ? " (dono de " + own + ")" : "") : "Nenhum ainda";
      })()),
      el("dt", null, "Duas etapas"), el("dd", null, u.mfa ? "Ativada" : "Desativada"),
      el("dt", null, "Onde ficam os dados"), el("dd", null, S.mode === "local" ? "Só neste navegador (modo local)" : "Online (Firebase)"));

    const rename = el("form", { class: "row", id: "unameForm", onsubmit: (ev) => {
      ev.preventDefault();
      const name = d.uname.trim();
      const problem = R.checkUsername(name);
      if (problem) { d.msg.acc = { err: problem }; return rerender(); }
      run("acc", async () => {
        await auth().changeUsername(name);
        L.app.refreshUser();
        L.actions.setNick(name);
      }, "Usuário alterado.");
    } },
      el("div", { class: "field grow" }, el("label", { for: "sUname" }, "Trocar nome de usuário"),
        el("input", { id: "sUname", maxlength: "20", autocomplete: "off", autocapitalize: "none", value: d.uname, oninput: (e) => { d.uname = e.target.value; } })),
      el("button", { class: "btn ghost", type: "submit", disabled: !!d.busy.acc }, "Salvar"));

    return section("Conta", "Seus dados. O usuário é o nome que aparece no placar.", L.ui.avatar(S.myId, true), info, rename, msg("acc"));
  }

  /* ---------- senha ---------- */
  function password(d) {
    return section("Senha", "Use pelo menos 8 caracteres.",
      el("form", { class: "f", id: "pwForm", onsubmit: (ev) => {
        ev.preventDefault();
        const problem = R.checkPassword(d.pwNew, d.pwNew2);
        if (problem) { d.msg.pw = { err: problem }; return rerender(); }
        run("pw", async () => {
          await auth().changePassword(d.pwCur, d.pwNew, (d.pwCode || "").replace(/\s/g, ""));
          d.pwCur = d.pwNew = d.pwNew2 = d.pwCode = "";
        }, "Senha alterada.");
      } },
        pw("sPwCur", "Senha atual", d, "pwCur"),
        pw("sPwNew", "Nova senha", d, "pwNew", "new-password"),
        pw("sPwNew2", "Repita a nova senha", d, "pwNew2", "new-password"),
        code("sPwCode", d, "pwCode"),
        el("div", null, el("button", { class: "btn ghost", type: "submit", disabled: !!d.busy.pw }, "Trocar senha"))),
      msg("pw"));
  }

  /* ---------- e-mail ---------- */
  function email(d) {
    const u = S.user;
    const verify = auth().verifiesEmail && !u.emailVerified
      ? el("div", { class: "row", style: "align-items:center" },
          el("span", { class: "small muted" }, "Seu e-mail ainda não foi confirmado."),
          el("button", { class: "btn ghost sm", type: "button", onclick: () => run("em", () => auth().sendVerification(), "Link de confirmação enviado para " + u.email + ".") }, "Reenviar link"),
          el("button", { class: "btn ghost sm", type: "button", onclick: () => run("em", async () => { await auth().reload(); L.app.refreshUser(); return S.user.emailVerified ? "E-mail confirmado." : "Ainda não confirmado."; }) }, "Já confirmei"))
      : null;
    return section("E-mail", "Usado para entrar e para recuperar a conta.",
      verify,
      el("form", { class: "f", id: "emForm", onsubmit: (ev) => {
        ev.preventDefault();
        const e = (d.emNew || "").trim();
        const problem = R.checkEmail(e);
        if (problem) { d.msg.em = { err: problem }; return rerender(); }
        run("em", async () => {
          const r = await auth().changeEmail(e, d.emPw, (d.emCode || "").replace(/\s/g, ""));
          d.emNew = d.emPw = d.emCode = "";
          L.app.refreshUser();
          return r && r.pending ? "Enviamos um link para " + e + ". O e-mail muda quando você abrir o link." : "E-mail alterado.";
        });
      } },
        input("sEmNew", "Novo e-mail", d, "emNew", { type: "email", autocomplete: "email" }),
        pw("sEmPw", "Senha atual", d, "emPw"),
        code("sEmCode", d, "emCode"),
        el("div", null, el("button", { class: "btn ghost", type: "submit", disabled: !!d.busy.em }, "Trocar e-mail"))),
      msg("em"));
  }

  /* ---------- duas etapas ---------- */
  let qrLib = null;
  function loadQr() {
    if (!qrLib) {
      qrLib = new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js";
        s.onload = () => (window.qrcode ? resolve(window.qrcode) : reject(new Error("qr")));
        s.onerror = () => { qrLib = null; reject(new Error("qr")); };
        document.head.append(s);
      });
    }
    return qrLib;
  }
  function qrBox(uri) {
    const box = el("div", { class: "qr", "aria-label": "QR code para o aplicativo autenticador" });
    loadQr().then((qrcode) => {
      const q = qrcode(0, "M");
      q.addData(uri);
      q.make();
      box.innerHTML = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); // SVG gerado pela biblioteca, sem texto de usuário
    }).catch(() => box.replaceWith(el("p", { class: "hint" }, "Não deu para mostrar o QR code. Digite a chave abaixo no aplicativo.")));
    return box;
  }

  function twoFactor(d) {
    const u = S.user;
    const desc = "Além da senha, pede um código de 6 dígitos de um aplicativo autenticador (Google Authenticator, Authy, 2FAS…). É opcional.";

    if (u.mfa) {
      return section("Verificação em duas etapas", desc,
        el("p", null, el("span", { class: "badge ok" }, "ativada")),
        el("form", { class: "f", id: "mfaOffForm", onsubmit: (ev) => {
          ev.preventDefault();
          run("mfa", async () => {
            await auth().mfaDisable(d.offPw, (d.offCode || "").replace(/\s/g, ""));
            d.offPw = d.offCode = "";
            L.app.refreshUser();
          }, "Verificação em duas etapas desativada.");
        } },
          pw("sOffPw", "Senha atual", d, "offPw"),
          input("sOffCode", "Código do autenticador", d, "offCode", { class: "code", inputmode: "numeric", autocomplete: "one-time-code", maxlength: "7" }),
          el("div", null, el("button", { class: "btn ghost", type: "submit", disabled: !!d.busy.mfa }, "Desativar"))),
        msg("mfa"));
    }

    if (d.mfaSecret) {
      return section("Verificação em duas etapas", desc,
        el("p", { class: "small" }, "1. Abra o aplicativo autenticador e escaneie o código, ou digite a chave."),
        qrBox(d.mfaUri),
        el("div", { class: "key", text: d.mfaSecret }),
        el("form", { class: "f", id: "mfaOnForm", onsubmit: (ev) => {
          ev.preventDefault();
          run("mfa", async () => {
            await auth().mfaConfirm((d.mfaCode || "").replace(/\s/g, ""));
            d.mfaSecret = d.mfaUri = d.mfaCode = d.mfaPw = "";
            L.app.refreshUser();
          }, "Verificação em duas etapas ativada.");
        } },
          el("p", { class: "small" }, "2. Digite o código de 6 dígitos que apareceu no aplicativo."),
          input("sMfaCode", "Código", d, "mfaCode", { class: "code", inputmode: "numeric", autocomplete: "one-time-code", maxlength: "7" }),
          el("div", { class: "row" },
            el("button", { class: "btn", type: "submit", disabled: !!d.busy.mfa }, "Ativar"),
            el("button", { class: "btn ghost", type: "button", onclick: () => { d.mfaSecret = d.mfaUri = d.mfaCode = ""; d.msg.mfa = {}; rerender(); } }, "Cancelar"))),
        msg("mfa"));
    }

    return section("Verificação em duas etapas", desc,
      el("p", null, el("span", { class: "badge" }, "desativada")),
      auth().verifiesEmail && !u.emailVerified ? el("p", { class: "hint" }, "Confirme seu e-mail antes de ativar.") : null,
      el("form", { class: "f", id: "mfaStartForm", onsubmit: (ev) => {
        ev.preventDefault();
        run("mfa", async () => {
          const r = await auth().mfaStart(d.mfaPw);
          d.mfaSecret = r.secret;
          d.mfaUri = r.uri;
          d.mfaPw = "";
        });
      } },
        pw("sMfaPw", "Senha atual", d, "mfaPw"),
        el("div", null, el("button", { class: "btn ghost", type: "submit", disabled: !!d.busy.mfa }, "Configurar"))),
      msg("mfa"));
  }

  /* ---------- aparência, liga e sair ---------- */
  function appearance() {
    const t = L.shell.theme();
    return section("Aparência", null,
      el("div", { class: "field" }, el("span", { class: "lbl" }, "Tema"),
        el("div", { class: "seg", role: "group" },
          [["dark", "Escuro"], ["light", "Claro"]].map(([val, label]) =>
            el("button", { type: "button", class: t === val ? "on" : "", "aria-pressed": t === val ? "true" : "false",
              onclick: () => { L.shell.setTheme(val); rerender(); } }, label)))));
  }

  function signOut() {
    return section("Sair", null,
      el("div", null, el("button", { class: "btn ghost", type: "button", onclick: () => auth().signOut() }, "Sair da conta")));
  }

  L.pages.settings = function (v) {
    L.ui.crumbs([{ label: "Configurações" }]);
    const d = draft();
    v.append(L.ui.pageHead("Configurações"));
    v.append(el("div", { class: "settings" },
      account(d), password(d), email(d), twoFactor(d), appearance(), signOut()));
  };
})(window.Liga);
