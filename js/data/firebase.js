/* data/firebase.js — banco online (Firebase Authentication + Firestore).
   Usado quando js/config.js tem a configuração do Firebase.
   Contas com usuário + e-mail + senha; verificação em duas etapas por aplicativo autenticador (TOTP).
   O nome de usuário aponta para o e-mail na coleção "usernames", para dar para entrar com o usuário.
   As fotos de prova ficam no próprio Firestore (coleção "fotos"), reduzidas para caber em 1 MB. */
window.Liga = window.Liga || {};
window.Liga.data = window.Liga.data || {};
(function (L) {
  "use strict";

  const SDK = "https://www.gstatic.com/firebasejs/10.14.1/";
  let A = null, F = null, auth = null, fs = null;
  let pendingSecret = null;

  const fail = (code, original) => Object.assign(new Error(code), { code, original });

  // traduz os erros do Firebase para os códigos que o site entende
  function mapErr(e) {
    if (e && e.code && !String(e.code).includes("/") && !String(e.code).includes("-")) return e; // já traduzido
    const c = String((e && e.code) || "");
    const table = {
      "permission-denied": "denied", "unauthenticated": "denied",
      "resource-exhausted": "quota_exceeded",
      "unavailable": "unavailable", "deadline-exceeded": "unavailable", "auth/network-request-failed": "unavailable",
      "auth/email-already-in-use": "email_taken",
      "auth/invalid-email": "invalid_email",
      "auth/weak-password": "weak_password",
      "auth/invalid-credential": "bad_password", "auth/wrong-password": "bad_password", "auth/user-not-found": "bad_login",
      "auth/invalid-login-credentials": "bad_login",
      "auth/too-many-requests": "too_many",
      "auth/invalid-verification-code": "bad_code", "auth/missing-code": "bad_code",
      "auth/requires-recent-login": "recent_login",
      "auth/unverified-email": "email_not_verified",
      "auth/operation-not-allowed": "not_enabled", "auth/admin-restricted-operation": "not_enabled",
      "auth/multi-factor-auth-required": "need_code",
    };
    for (const k in table) if (c.includes(k)) return fail(table[k], e);
    return fail("unknown", e);
  }
  const wrap = (p) => p.catch((e) => { throw mapErr(e); });
  const unameKey = (u) => String(u || "").toLowerCase();
  // conta criada sem e-mail: o Firebase exige um, então usamos um endereço interno que nunca recebe nada
  // (domínio reservado example.com). O e-mail de verdade só entra depois que a pessoa confirma pelo link.
  const NO_MAIL = "@sem-email.listrats.example.com";
  const isPlaceholder = (e) => !e || String(e).toLowerCase().endsWith(NO_MAIL);
  // a•••@gmail.com
  const maskEmail = (e) => { const [u, dom] = String(e).split("@"); return (u.length > 2 ? u.slice(0, 2) : u.slice(0, 1)) + "•••@" + dom; };
  const placeholderEmail = () => "u" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10) + NO_MAIL;

  function current() {
    const u = auth && auth.currentUser;
    if (!u) return null;
    return {
      id: u.uid,
      name: u.displayName || "",
      email: isPlaceholder(u.email) ? "" : u.email,
      emailVerified: !isPlaceholder(u.email) && !!u.emailVerified,
      createdAt: Date.parse(u.metadata && u.metadata.creationTime) || 0,
      mfa: A.multiFactor(u).enrolledFactors.length > 0,
    };
  }

  // confirma a identidade de novo (senha e, se tiver, código do autenticador)
  async function reauth(password, code) {
    const u = auth.currentUser;
    const cred = A.EmailAuthProvider.credential(u.email, password || "");
    try {
      await A.reauthenticateWithCredential(u, cred);
    } catch (e) {
      if (String(e.code).includes("multi-factor-auth-required")) {
        if (!code) throw fail("need_code");
        const r = A.getMultiFactorResolver(auth, e);
        const hint = r.hints.find((h) => h.factorId === A.TotpMultiFactorGenerator.FACTOR_ID) || r.hints[0];
        await wrap(r.resolveSignIn(A.TotpMultiFactorGenerator.assertionForSignIn(hint.uid, code)));
        return;
      }
      throw mapErr(e);
    }
  }

  const authApi = {
    verifiesEmail: true,
    current,

    // e-mail é opcional: a conta nasce com o endereço interno e, se a pessoa informou um e-mail,
    // mandamos um link de confirmação — ele só vira o e-mail da conta quando o link for aberto (então só vale e-mail que existe)
    async signUp({ username, email, password }) {
      const ref = F.doc(fs, "usernames", unameKey(username));
      if ((await wrap(F.getDoc(ref))).exists()) throw fail("username_taken");
      const temp = placeholderEmail();
      const cred = await wrap(A.createUserWithEmailAndPassword(auth, temp, password));
      try {
        await F.setDoc(ref, { uid: cred.user.uid, email: temp });
      } catch (e) {
        await cred.user.delete().catch(() => {});
        throw fail("username_taken", e);
      }
      await wrap(A.updateProfile(cred.user, { displayName: username }));
      if (email) {
        try {
          await A.verifyBeforeUpdateEmail(cred.user, email);
          await F.setDoc(ref, { uid: cred.user.uid, email: temp, pending: email }).catch(() => {});
          return { pendingEmail: email };
        }
        catch (e) { return { emailError: mapErr(e).code }; }
      }
      return {};
    },

    async signIn(login, password) {
      let email = login.trim(), pending = "";
      if (!email.includes("@") || isPlaceholder(email)) {
        const d = await wrap(F.getDoc(F.doc(fs, "usernames", unameKey(email))));
        if (!d.exists()) throw fail("bad_login");
        email = d.data().email;
        pending = d.data().pending || "";
      }
      try {
        try {
          await A.signInWithEmailAndPassword(auth, email, password);
        } catch (e1) {
          // a pessoa confirmou o e-mail novo pelo link: a conta agora usa o e-mail pendente
          if (!pending || String(e1.code).includes("multi-factor-auth-required")) throw e1;
          await A.signInWithEmailAndPassword(auth, pending, password);
        }
        return {};
      } catch (e) {
        if (!String(e.code).includes("multi-factor-auth-required")) {
          const m = mapErr(e);
          if (m.code === "bad_password") m.code = "bad_login";
          throw m;
        }
        const r = A.getMultiFactorResolver(auth, e);
        const hint = r.hints.find((h) => h.factorId === A.TotpMultiFactorGenerator.FACTOR_ID) || r.hints[0];
        return {
          mfa: true,
          resolve: (code) => wrap(r.resolveSignIn(A.TotpMultiFactorGenerator.assertionForSignIn(hint.uid, code))),
        };
      }
    },

    signOut() { return A.signOut(auth); },

    /* esqueci a senha: o Firebase manda um link para criar uma senha nova.
       Aceita usuário ou e-mail. Devolve o e-mail com parte escondida (a•••@gmail.com) para mostrar na tela. */
    async resetPassword(login) {
      const v = String(login || "").trim();
      let list;
      if (v.includes("@")) {
        if (isPlaceholder(v)) throw fail("no_email_reset");
        list = [v];
      } else {
        const d = await wrap(F.getDoc(F.doc(fs, "usernames", unameKey(v))));
        if (!d.exists()) throw fail("no_user");
        // o e-mail da conta; se a pessoa confirmou um e-mail novo e ainda não entrou, a conta já usa o pendente
        list = [...new Set([d.data().email, d.data().pending].filter((e) => e && !isPlaceholder(e)))];
        if (!list.length) throw fail("no_email_reset");
      }
      const back = { url: location.origin + location.pathname, handleCodeInApp: false };
      let sent = 0, last = null;
      for (const e of list) {
        try {
          try { await A.sendPasswordResetEmail(auth, e, back); }
          catch (e1) {
            // endereço do site não autorizado no Firebase: manda sem o botão "voltar ao site"
            if (!/continue-uri|unauthorized-domain|invalid-continue/.test(String(e1.code))) throw e1;
            await A.sendPasswordResetEmail(auth, e);
          }
          sent++;
        } catch (err) { last = err; }
      }
      if (!sent) {
        const m = mapErr(last);
        if (m.code !== "bad_login") throw m;   // e-mail sem conta: não conta isso para ninguém, só mostra a mensagem de sempre
      }
      return { to: list.map(maskEmail).join(" ou ") };
    },

    async changeUsername(username) {
      const u = auth.currentUser;
      const newRef = F.doc(fs, "usernames", unameKey(username));
      const oldKey = unameKey(u.displayName);
      if (oldKey === unameKey(username)) {
        await wrap(A.updateProfile(u, { displayName: username }));
        return;
      }
      if ((await wrap(F.getDoc(newRef))).exists()) throw fail("username_taken");
      const batch = F.writeBatch(fs);
      const old = oldKey ? await F.getDoc(F.doc(fs, "usernames", oldKey)).catch(() => null) : null;
      const pend = old && old.exists() && old.data().pending;
      batch.set(newRef, pend ? { uid: u.uid, email: u.email, pending: pend } : { uid: u.uid, email: u.email });
      if (oldKey) batch.delete(F.doc(fs, "usernames", oldKey));
      await wrap(batch.commit());
      await wrap(A.updateProfile(u, { displayName: username }));
    },

    async changePassword(currentPw, next, code) {
      await reauth(currentPw, code);
      await wrap(A.updatePassword(auth.currentUser, next));
    },

    async changeEmail(email, password, code) {
      await reauth(password, code);
      const u = auth.currentUser;
      await wrap(A.verifyBeforeUpdateEmail(u, email));
      if (u.displayName) await F.setDoc(F.doc(fs, "usernames", unameKey(u.displayName)), { uid: u.uid, email: u.email, pending: email }).catch(() => {});
      return { pending: true };
    },

    sendVerification() {
      if (isPlaceholder(auth.currentUser.email)) return Promise.reject(fail("no_email"));
      return wrap(A.sendEmailVerification(auth.currentUser));
    },
    async reload() { await wrap(auth.currentUser.reload()); await syncUsername(); },

    async mfaStart(password, code) {
      const u = auth.currentUser;
      if (isPlaceholder(u.email) || !u.emailVerified) throw fail("email_not_verified");
      await reauth(password, code);
      const session = await wrap(A.multiFactor(u).getSession());
      pendingSecret = await wrap(A.TotpMultiFactorGenerator.generateSecret(session));
      return { secret: pendingSecret.secretKey, uri: pendingSecret.generateQrCodeUrl(u.displayName || u.email, "listRats") };
    },
    async mfaConfirm(code) {
      if (!pendingSecret) throw fail("bad_code");
      const assertion = A.TotpMultiFactorGenerator.assertionForEnrollment(pendingSecret, code);
      await wrap(A.multiFactor(auth.currentUser).enroll(assertion, "Autenticador"));
      pendingSecret = null;
    },
    async mfaDisable(password, code) {
      await reauth(password, code);
      const mf = A.multiFactor(auth.currentUser);
      for (const f of mf.enrolledFactors) await wrap(mf.unenroll(f));
    },
  };

  // mantém usernames/<usuario> apontando para o e-mail atual (o e-mail pode ter mudado por link)
  async function syncUsername() {
    const u = auth.currentUser;
    if (!u || !u.displayName) return;
    const ref = F.doc(fs, "usernames", unameKey(u.displayName));
    try {
      const d = await F.getDoc(ref);
      if (!d.exists() || d.data().uid !== u.uid) return;
      const x = d.data();
      // e-mail novo confirmado: grava o novo e esquece o pendente
      if (x.email !== u.email) await F.setDoc(ref, x.pending && x.pending.toLowerCase() !== String(u.email).toLowerCase() ? { uid: u.uid, email: u.email, pending: x.pending } : { uid: u.uid, email: u.email });
    } catch (e) { /* ignora */ }
  }

  const firebaseBackend = {
    mode: "firebase",
    auth: authApi,

    async start(onAuth) {
      const [appMod, authMod, fsMod] = await Promise.all([
        import(SDK + "firebase-app.js"),
        import(SDK + "firebase-auth.js"),
        import(SDK + "firebase-firestore.js"),
      ]);
      A = authMod; F = fsMod;
      const app = appMod.initializeApp(window.LIGA_CONFIG.firebase);
      auth = A.getAuth(app);
      auth.languageCode = "pt";   // e-mails do Firebase (recuperar senha, confirmar e-mail) em português
      fs = F.getFirestore(app);
      A.onAuthStateChanged(auth, (u) => {
        onAuth(u ? current() : null);
        if (u) syncUsername();
      });
    },

    watch(coll, cb, onErr) {
      return F.onSnapshot(F.collection(fs, coll),
        (snap) => { const out = {}; snap.forEach((d) => { out[d.id] = d.data(); }); cb(out); },
        (e) => onErr && onErr(mapErr(e)));
    },
    // só os documentos com campo == valor (ex.: convites criados por mim)
    watchWhere(coll, field, value, cb, onErr, op) {
      return F.onSnapshot(F.query(F.collection(fs, coll), F.where(field, op || "==", value)),
        (snap) => { const out = {}; snap.forEach((d) => { out[d.id] = d.data(); }); cb(out); },
        (e) => onErr && onErr(mapErr(e)));
    },
    watchDoc(path, cb, onErr) {
      return F.onSnapshot(F.doc(fs, path),
        (d) => cb(d.exists() ? d.data() : null),
        (e) => onErr && onErr(mapErr(e)));
    },

    async get(path) {
      const d = await wrap(F.getDoc(F.doc(fs, path)));
      return d.exists() ? d.data() : null;
    },
    newId(coll) { return F.doc(F.collection(fs, coll)).id; },
    set(path, data) { return wrap(F.setDoc(F.doc(fs, path), data)); },
    update(path, data) { return wrap(F.updateDoc(F.doc(fs, path), data)); },
    remove(path) { return wrap(F.deleteDoc(F.doc(fs, path))); },
    // apaga um por um (em grupos de 20 ao mesmo tempo): em lote, as regras do Firestore
    // contam as consultas de permissão de todos os documentos juntos e podem recusar
    async removeMany(paths) {
      for (let i = 0; i < paths.length; i += 20) {
        await Promise.all(paths.slice(i, i + 20).map((p) => wrap(F.deleteDoc(F.doc(fs, p)))));
      }
    },
    claimOwner(uid) { return wrap(F.setDoc(F.doc(fs, "config/liga"), { owner: uid, createdAt: Date.now() })); },

    photos: {
      async save(dataUrl, uid) {
        const ref = F.doc(F.collection(fs, "fotos"));
        await wrap(F.setDoc(ref, { uid, data: dataUrl, createdAt: Date.now() }));
        return ref.id;
      },
      async load(id) {
        const d = await wrap(F.getDoc(F.doc(fs, "fotos/" + id)));
        return d.exists() ? d.data().data : null;
      },
      remove(id) { return wrap(F.deleteDoc(F.doc(fs, "fotos/" + id))); },
    },
  };

  L.data.firebase = firebaseBackend;
})(window.Liga);
