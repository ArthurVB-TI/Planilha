/* ui/photos.js — foto de prova: tirar/escolher, reduzir, enviar e mostrar */
window.Liga = window.Liga || {};
(function (L) {
  "use strict";
  const S = L.S;
  const { el, icon, $ } = L.dom;
  const { todayKey, curWeek, shortDate, isKey } = L.dates;
  const { isPhotoId } = L.rules;

  const MAX_BYTES = 900 * 1024; // o Firestore aceita até 1 MB por documento

  function proofsOf(pid, taskId) {
    const p = L.score.playerDoc(pid);
    const m = p && p.proofs && typeof p.proofs === "object" ? p.proofs[taskId] : null;
    const out = {};
    if (m && typeof m === "object") for (const k in m) if (isKey(k) && isPhotoId(m[k])) out[k] = m[k];
    return out;
  }

  // carrega a imagem (com cache) e coloca no <img>
  const inflight = {};
  function loadInto(img, id, onFail) {
    const cached = S.photoCache[id];
    if (cached) { img.src = cached; return; }
    // a mesma foto (ex.: foto de perfil) pode aparecer várias vezes na tela: baixa uma vez só
    inflight[id] = inflight[id] || S.backend.photos.load(id).then((url) => {
      if (typeof url !== "string" || !url.startsWith("data:image/")) throw new Error("foto inválida");
      S.photoCache[id] = url;
      return url;
    }).finally(() => { delete inflight[id]; });
    inflight[id].then((url) => { img.src = url; }).catch(() => onFail && onFail());
  }

  // recorta no meio em quadrado e reduz (foto de perfil)
  function prepareSquare(file, size) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        const c = document.createElement("canvas");
        c.width = c.height = size;
        c.getContext("2d").drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
        resolve(c.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(Object.assign(new Error("formato"), { code: "unsupported_type" })); };
      img.src = url;
    });
  }

  // reduz a foto (lado maior até 1280 px, JPEG) até caber no limite
  function prepare(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const tries = [[1280, 0.8], [1080, 0.7], [900, 0.6], [720, 0.55]];
        for (const [max, q] of tries) {
          const sc = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
          const c = document.createElement("canvas");
          c.width = Math.max(1, Math.round(img.naturalWidth * sc));
          c.height = Math.max(1, Math.round(img.naturalHeight * sc));
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          const data = c.toDataURL("image/jpeg", q);
          if (data.length <= MAX_BYTES) return resolve(data);
        }
        reject(Object.assign(new Error("grande demais"), { code: "too_large" }));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(Object.assign(new Error("formato"), { code: "unsupported_type" })); };
      img.src = url;
    });
  }

  function startPhoto(task, key) {
    if (S.uploading || !L.actions.canChangeDay(task, key)) return;
    S.camTarget = { taskId: task.id, key };
    const inp = $("camInput");
    inp.value = "";
    inp.setAttribute("capture", "environment");
    inp.click();
  }
  // escolhe uma foto para outra coisa (justificativa, prova de contestação): cb(idDaFoto)
  function pick(tag, cb, opts) {
    if (S.uploading) return;
    S.camTarget = { tag, cb, square: opts && opts.square };
    const inp = $("camInput");
    inp.value = "";
    // foto de perfil: deixa escolher da galeria (sem abrir direto a câmera)
    if (opts && opts.gallery) inp.removeAttribute("capture"); else inp.setAttribute("capture", "environment");
    inp.click();
  }
  const uploadErr = (e) => {
    const c = e && e.code;
    L.app.setStatus(
      c === "too_large" ? "A foto é grande demais. Tente outra." :
      c === "unsupported_type" ? "Esse formato de imagem não é aceito. Use JPG ou PNG." :
      c === "quota_exceeded" ? "O espaço de fotos acabou." :
      L.actions.errMsg(e, "Não deu para enviar a foto. Tente de novo."), true);
  };

  async function onFile(ev) {
    const file = ev.target.files && ev.target.files[0];
    const tgt = S.camTarget;
    S.camTarget = null;
    if (!file || !tgt) return;
    if (tgt.cb) {
      S.uploading = tgt.tag;
      L.app.render();
      try {
        const data = tgt.square ? await prepareSquare(file, tgt.square) : await prepare(file);
        const id = await S.backend.photos.save(data, S.myId);
        S.photoCache[id] = data;
        await tgt.cb(id);
      } catch (e) { uploadErr(e); }
      S.uploading = null;
      L.app.render();
      return;
    }
    const task = S.tasks[tgt.taskId];
    if (!task) return;
    S.uploading = tgt.taskId + "|" + tgt.key;
    L.app.render();
    try {
      const data = await prepare(file);
      const id = await S.backend.photos.save(data, S.myId);
      S.photoCache[id] = data;
      L.actions.attachProof(task, tgt.key, id);
      L.app.setStatus("");
    } catch (e) { uploadErr(e); }
    S.uploading = null;
    L.app.render();
  }

  /* ---------- foto grande (provas e foto de perfil) ---------- */
  // lb.dataset.uid fica com o id da pessoa quando a foto aberta é a foto de perfil dela
  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function closePhoto() {
    const lb = $("lightbox");
    if (lb.hidden) return;
    lb.hidden = true;
    lb.replaceChildren();
    lb.className = "lightbox";
    lb.style.removeProperty("--lb-fade");
    delete lb.dataset.uid;
    document.documentElement.classList.remove("lb-open");
  }

  /* gestos: pinça e roda do mouse dão zoom, toque duplo (ou clique duplo) aproxima e afasta,
     com zoom dá para arrastar a foto, sem zoom arrastar para baixo fecha */
  function gestures(lb, stage, img) {
    let sc = 1, tx = 0, ty = 0, st = null, lastTap = 0;
    const MAX = 4;
    const apply = (anim) => {
      img.style.transition = anim && !reduced() ? "transform .22s ease" : "none";
      img.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + sc + ")";
    };
    const clamp = () => {
      if (sc <= 1.02) { sc = 1; tx = 0; ty = 0; return; }
      const mx = (img.offsetWidth * (sc - 1)) / 2, my = (img.offsetHeight * (sc - 1)) / 2;
      tx = Math.max(-mx, Math.min(mx, tx));
      ty = Math.max(-my, Math.min(my, ty));
    };
    // aproxima mantendo parado o ponto (x, y) da tela
    const zoomAt = (to, x, y) => {
      const r = stage.getBoundingClientRect();
      const px = x - (r.left + r.width / 2), py = y - (r.top + r.height / 2);
      const k = to / sc;
      tx = px - (px - tx) * k; ty = py - (py - ty) * k; sc = to;
      clamp();
    };
    const fade = (v) => lb.style.setProperty("--lb-fade", String(v));
    const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const mid = (t) => [(t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2];

    function begin(e) {
      const t = e.touches;
      if (t.length >= 2) {
        const [cx, cy] = mid(t);
        st = { mode: "pinch", d0: dist(t), sc0: sc, tx0: tx, ty0: ty, cx, cy };
      } else if (t.length === 1) {
        st = { mode: sc > 1 ? "pan" : "drag", x0: t[0].clientX, y0: t[0].clientY, tx0: tx, ty0: ty, t0: Date.now(), moved: false };
      }
    }
    stage.addEventListener("touchstart", begin, { passive: true });
    stage.addEventListener("touchmove", (e) => {
      if (!st) return;
      e.preventDefault();
      const t = e.touches;
      if (st.mode === "pinch" && t.length >= 2) {
        const to = Math.max(1, Math.min(MAX, st.sc0 * (dist(t) / st.d0)));
        const [cx, cy] = mid(t);
        sc = st.sc0; tx = st.tx0 + (cx - st.cx); ty = st.ty0 + (cy - st.cy);
        zoomAt(to, st.cx + (cx - st.cx), st.cy + (cy - st.cy));
        apply(false);
        return;
      }
      if (t.length !== 1) return;
      const dx = t[0].clientX - st.x0, dy = t[0].clientY - st.y0;
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) st.moved = true;
      if (st.mode === "pan") { tx = st.tx0 + dx; ty = st.ty0 + dy; clamp(); apply(false); }
      else if (st.mode === "drag") { tx = 0; ty = dy > 0 ? dy : dy * 0.25; fade(Math.max(0.35, 1 - Math.max(0, dy) / 420)); apply(false); }
    }, { passive: false });
    stage.addEventListener("touchend", (e) => {
      if (!st) return;
      const s0 = st;
      if (e.touches.length) { begin(e); return; }   // tirou um dedo da pinça: continua arrastando com o outro
      st = null;
      if (s0.mode === "drag") {
        if (ty > 110) { closePhoto(); return; }
        ty = 0; fade(1); apply(true);
      } else if (s0.mode === "pinch") { clamp(); apply(true); }
      // toque duplo
      if (!s0.moved && s0.mode !== "pinch" && Date.now() - s0.t0 < 300) {
        const now = Date.now(), x = e.changedTouches[0].clientX, y = e.changedTouches[0].clientY;
        if (now - lastTap < 320) {
          e.preventDefault();
          if (sc > 1) { sc = 1; tx = 0; ty = 0; } else zoomAt(2.5, x, y);
          apply(true);
          lastTap = 0;
        } else lastTap = now;
      }
    });
    // computador
    stage.addEventListener("dblclick", (e) => {
      if (sc > 1) { sc = 1; tx = 0; ty = 0; } else zoomAt(2.5, e.clientX, e.clientY);
      apply(true);
    });
    stage.addEventListener("wheel", (e) => {
      e.preventDefault();
      zoomAt(Math.max(1, Math.min(MAX, sc * (e.deltaY < 0 ? 1.15 : 1 / 1.15))), e.clientX, e.clientY);
      apply(false);
    }, { passive: false });
    img.addEventListener("mousedown", (e) => {
      if (sc <= 1) return;
      e.preventDefault();
      const md = { x0: e.clientX, y0: e.clientY, tx0: tx, ty0: ty };
      const move = (ev) => { tx = md.tx0 + ev.clientX - md.x0; ty = md.ty0 + ev.clientY - md.y0; clamp(); apply(false); };
      const up = () => { document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up); };
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    });
    img.addEventListener("load", () => { sc = 1; tx = 0; ty = 0; apply(false); });
  }

  // monta a tela escura com a foto; foot = o que vai embaixo
  function showBox(id, caption, opts) {
    const lb = $("lightbox");
    lb.replaceChildren();
    lb.className = "lightbox" + (opts.cls ? " " + opts.cls : "");
    lb.setAttribute("aria-label", caption);
    const img = el("img", { alt: caption, draggable: "false" });
    const stage = el("div", { class: "lb-stage" }, img);
    const bg = opts.blur ? el("div", { class: "lb-bg", "aria-hidden": "true" }) : null;
    loadInto(img, id, () => img.replaceWith(el("p", { class: "lb-err" }, "Esta foto não pode ser exibida.")));
    if (bg) {
      const setBg = () => { bg.style.backgroundImage = "url(" + img.src + ")"; };
      if (img.src) setBg(); else img.addEventListener("load", setBg, { once: true });
    }
    lb.append(bg || "",
      el("div", { class: "bar" },
        opts.head || el("div", { class: "lb-cap", text: caption }),
        el("button", { class: "lb-x", type: "button", id: "lbClose", "aria-label": "Fechar", onclick: closePhoto }, icon("close"))),
      stage,
      el("div", { class: "lb-foot" }, opts.foot || null,
        el("div", { class: "lb-hint" }, "Toque duas vezes ou use dois dedos para aproximar. Arraste para baixo para fechar.")));
    lb.onclick = (e) => {
      const t = e.target;
      if (t === lb || t === stage || t.classList.contains("lb-hint") || t.classList.contains("lb-bg")) closePhoto();
    };
    gestures(lb, stage, img);
    lb.hidden = false;
    document.documentElement.classList.add("lb-open");
    if (!reduced()) { lb.classList.add("lb-in"); setTimeout(() => lb.classList.remove("lb-in"), 260); }
    $("lbClose").focus({ preventScroll: true });
    return lb;
  }

  // foto de prova
  function openPhoto(id, caption) {
    showBox(id, caption, {});
  }

  // parte de baixo da foto de perfil: nome, situação da amizade, adicionar e ver perfil
  function avatarFoot(uid) {
    const me = uid === S.myId;
    const onProfile = S.view && S.view.page === "user" && S.view.uid === uid;
    const f = L.social.friendshipWith(uid);
    // o botão de amizade já diz "Vocês são amigos" / "Pedido enviado"; aqui só o que ele não diz
    const sub = me ? "Você" : f && f.status !== "accepted" && f.to === S.myId ? "Quer ser seu amigo" : "";
    return el("div", { class: "pv-info" },
      el("div", { class: "pv-name" },
        el("b", { text: L.ui.nameOf(uid) }),
        sub ? el("span", null, sub) : null),
      el("div", { class: "pv-acts" },
        me ? null : L.social.friendButton(uid, { big: true }),
        onProfile ? null : el("button", { class: "btn ghost", type: "button", onclick: () => { closePhoto(); L.app.go({ page: "user", uid }); } }, icon("users"), "Ver perfil"),
        me ? el("button", { class: "btn ghost", type: "button", onclick: () => { closePhoto(); L.app.go({ page: "settings" }); } }, icon("camera"), "Trocar foto") : null));
  }

  // foto de perfil de alguém, grande
  function openAvatar(uid) {
    const p = L.score.playerDoc(uid);
    const pic = p && p.avatar;
    if (!pic) return;
    const lb = showBox(pic, "Foto de perfil de " + L.ui.nameOf(uid), {
      cls: "pv", blur: true,
      head: el("div", { class: "lb-cap" }, "Foto de perfil"),
      foot: avatarFoot(uid),
    });
    lb.dataset.uid = uid;
  }

  // depois de desenhar a página: atualiza o botão de amizade da foto aberta (pedido enviado, aceito…)
  function refresh() {
    const lb = $("lightbox");
    const uid = lb && !lb.hidden && lb.dataset.uid;
    if (!uid) return;
    const info = lb.querySelector(".pv-info");
    if (info) info.replaceWith(avatarFoot(uid));
  }

  // linha com botão da câmera, miniaturas e contador "X de Y com foto"
  function proofRow(task, r, mine) {
    const today = todayKey(), cw = curWeek();
    const curKey = task.kind === "daily" ? today : cw;
    const proofs = proofsOf(task.assignee, task.id);
    const keys = Object.keys(proofs).filter((k) => r.done.has(k)).sort().reverse();
    const withPhoto = [...r.done].filter((k) => proofs[k]).length;
    const who = L.ui.nameOf(task.assignee);

    const thumbs = keys.slice(0, 6).map((k) => {
      const lab = task.kind === "daily" ? (k === today ? "hoje" : shortDate(k)) : (k === cw ? "semana" : shortDate(k));
      const cap = task.title + " — " + who + " — " + (task.kind === "daily" ? shortDate(k) : "semana de " + shortDate(k));
      const img = el("img", { alt: "", loading: "lazy" });
      const b = el("button", { type: "button", class: "thumb", "aria-label": "Ver foto de " + lab, onclick: () => openPhoto(proofs[k], cap) }, img, el("span", null, lab));
      loadInto(img, proofs[k], () => { b.classList.add("broken"); img.remove(); });
      return b;
    });

    let camBtn = null;
    if (mine) {
      const busy = S.uploading === task.id + "|" + curKey;
      const has = !!proofs[curKey] && r.done.has(curKey);
      const daily = task.kind === "daily";
      camBtn = el("button", { type: "button", class: "cam", disabled: !!S.uploading, onclick: () => startPhoto(task, curKey) },
        icon("camera"),
        busy ? "Enviando…" : has ? "Trocar foto" : (daily ? "Foto de hoje" : "Foto da semana"));
    }
    const ptag = r.done.size ? el("span", { class: "ptag" }, withPhoto + "/" + r.done.size + " com foto") : null;
    if (!camBtn && !thumbs.length && !ptag) return null;
    return el("div", { class: "proof" }, camBtn, thumbs.length ? el("div", { class: "thumbs" }, thumbs) : null, ptag);
  }

  function setup() {
    $("camInput").addEventListener("change", onFile);
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!$("lightbox").hidden) closePhoto();
      else if (S.sheet) { S.sheet = null; L.app.render(); }
    });
  }

  L.photos = { proofRow, openPhoto, openAvatar, closePhoto, refresh, setup, startPhoto, pick, proofsOf, loadInto };
})(window.Liga);
