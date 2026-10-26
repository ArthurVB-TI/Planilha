/* ui/photos.js — foto de prova: tirar/escolher, reduzir, enviar e mostrar */
window.Liga = window.Liga || {};
(function (L) {
  "use strict";
  const S = L.S;
  const { el, icon, $ } = L.dom;
  const { todayKey, curWeek, shortDate, isKey } = L.dates;
  const { isPhotoId } = L.rules;

  const MAX_BYTES = 900 * 1024; // o Firestore aceita até 1 MB por documento

  // provas de uma tarefa: { dia: [ids das fotos/arquivos] } (só dias com pelo menos uma)
  function proofsOf(pid, taskId) {
    const p = L.score.playerDoc(pid);
    const m = p && p.proofs && typeof p.proofs === "object" ? p.proofs[taskId] : null;
    const out = {};
    if (m && typeof m === "object") for (const k in m) { const l = L.rules.photoList(m[k]); if (isKey(k) && l.length) out[k] = l; }
    return out;
  }

  /* carrega a prova (com cache). Pode ser uma imagem ou um arquivo PDF (data:application/pdf).
     loadInto(img, id, onFail, onFile): imagem vai para o <img>; PDF chama onFile(url) (sem onFile, conta como falha) */
  const inflight = {};
  const isFileUrl = (u) => typeof u === "string" && u.startsWith("data:application/pdf");
  const isImgUrl = (u) => typeof u === "string" && u.startsWith("data:image/");
  function loadData(id) {
    const cached = S.photoCache[id];
    if (cached) return Promise.resolve(cached);
    // a mesma foto (ex.: foto de perfil) pode aparecer várias vezes na tela: baixa uma vez só
    inflight[id] = inflight[id] || S.backend.photos.load(id).then((url) => {
      if (!isImgUrl(url) && !isFileUrl(url)) throw new Error("foto inválida");
      S.photoCache[id] = url;
      return url;
    }).finally(() => { delete inflight[id]; });
    return inflight[id];
  }
  function loadInto(img, id, onFail, onFile) {
    const show = (url) => {
      if (isImgUrl(url)) img.src = url;
      else if (onFile) onFile(url);
      else if (onFail) onFail();
    };
    const cached = S.photoCache[id];
    if (cached) return show(cached);
    loadData(id).then(show).catch(() => onFail && onFail());
  }
  const isFile = (id) => isFileUrl(S.photoCache[id]);

  // PDF guardado como texto (data:) → link que abre/baixa o arquivo
  function blobUrl(dataUrl) {
    const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
    const bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  }
  // miniatura de arquivo (no lugar da foto)
  const fileBadge = () => el("span", { class: "file-badge" }, icon("file"), el("b", null, "PDF"));

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

  // PDF: guarda como está, se couber no limite
  function readPdf(file) {
    return new Promise((resolve, reject) => {
      if (file.size > MAX_BYTES * 0.74) return reject(Object.assign(new Error("grande demais"), { code: "file_too_large" }));
      const fr = new FileReader();
      fr.onload = () => {
        const data = String(fr.result || "").replace(/^data:[^;,]*/, "data:application/pdf");
        if (data.length > MAX_BYTES) return reject(Object.assign(new Error("grande demais"), { code: "file_too_large" }));
        resolve(data);
      };
      fr.onerror = () => reject(Object.assign(new Error("formato"), { code: "unsupported_type" }));
      fr.readAsDataURL(file);
    });
  }
  const isPdfFile = (f) => f && (f.type === "application/pdf" || /\.pdf$/i.test(f.name || ""));

  // reduz a foto (lado maior até 1280 px, JPEG) até caber no limite; PDF vai como está
  function prepare(file) {
    if (isPdfFile(file)) return readPdf(file);
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

  /* abre o seletor: mode "camera" (abre a câmera no celular), "gallery" (só imagens: abre a galeria do celular)
     ou "file" (foto ou PDF; no Android abre o gerenciador de arquivos). many = deixa escolher várias de uma vez */
  function openPicker(mode, many) {
    const inp = $("camInput");
    inp.value = "";
    if (mode === "camera") { inp.setAttribute("capture", "environment"); inp.setAttribute("accept", "image/*"); }
    else { inp.removeAttribute("capture"); inp.setAttribute("accept", mode === "file" ? "image/*,application/pdf,.pdf" : "image/*"); }
    if (many && mode !== "camera") inp.setAttribute("multiple", ""); else inp.removeAttribute("multiple");
    inp.click();
  }
  // prova do dia: cada foto escolhida entra junto com as que já estão (até L.rules.PROOF_PHOTOS)
  function startPhoto(task, key, mode) {
    if (S.uploading || !L.actions.canChangeDay(task, key)) return;
    if (L.actions.roomFor(task, key) <= 0) { L.app.setStatus("Já tem " + L.rules.PROOF_PHOTOS + " fotos ou arquivos neste dia. Apague um para pôr outro.", true); return; }
    S.camTarget = { taskId: task.id, key };
    openPicker(mode === "file" || mode === "gallery" ? mode : "camera", true);
  }
  // escolhe uma foto (ou arquivo) para outra coisa (justificativa, prova de contestação, perfil): cb(id)
  function pick(tag, cb, opts) {
    if (S.uploading) return;
    opts = opts || {};
    S.camTarget = { tag, cb, square: opts.square };
    openPicker(opts.gallery ? "gallery" : opts.file ? "file" : "camera", false);
  }
  const uploadErr = (e) => {
    const c = e && e.code;
    L.app.setStatus(
      c === "too_large" ? "A foto é grande demais. Tente outra." :
      c === "file_too_large" ? "O arquivo é grande demais (máximo de uns 650 KB). Tente um PDF menor ou mande uma foto." :
      c === "unsupported_type" ? "Esse formato não é aceito. Use uma foto (JPG ou PNG) ou um PDF." :
      c === "quota_exceeded" ? "O espaço de fotos acabou." :
      L.actions.errMsg(e, "Não deu para enviar a foto. Tente de novo."), true);
  };

  async function onFile(ev) {
    const files = [...(ev.target.files || [])];
    const file = files[0];
    const tgt = S.camTarget;
    S.camTarget = null;
    if (!file || !tgt) return;
    if (tgt.cb) {
      S.uploading = tgt.tag;
      L.app.render();
      try {
        if (tgt.square && isPdfFile(file)) throw Object.assign(new Error("formato"), { code: "unsupported_type" });
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
    // várias fotos de uma vez: envia uma por uma, até encher o limite do dia
    const room = L.actions.roomFor(task, tgt.key);
    const list = files.slice(0, Math.max(0, room));
    S.uploading = tgt.taskId + "|" + tgt.key;
    let sent = 0, err = null;
    for (let i = 0; i < list.length; i++) {
      S.uploadInfo = list.length > 1 ? (i + 1) + " de " + list.length : "";
      L.app.render();
      try {
        const data = await prepare(list[i]);
        const id = await S.backend.photos.save(data, S.myId);
        S.photoCache[id] = data;
        if (L.actions.attachProof(task, tgt.key, id)) sent++;
      } catch (e) { err = e; }
    }
    S.uploading = null;
    S.uploadInfo = "";
    if (err) uploadErr(err);
    else if (files.length > list.length) L.app.setStatus("Só cabem " + L.rules.PROOF_PHOTOS + " fotos ou arquivos por dia: " + (sent ? "foram enviados " + sent + "." : "nenhum foi enviado."), true);
    else L.app.setStatus(sent > 1 ? sent + " fotos enviadas." : "");
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
    loadInto(img, id, () => img.replaceWith(el("p", { class: "lb-err" }, "Esta foto não pode ser exibida.")),
      opts.blur ? null : (url) => {
        // arquivo PDF: mostra um cartão com abrir e baixar (o celular abre no leitor de PDF)
        const href = blobUrl(url);
        const kb = Math.round((url.length * 0.75) / 1024);
        stage.classList.add("lb-file");
        lb.classList.add("is-file");
        img.replaceWith(el("div", { class: "file-card" },
          el("div", { class: "fc-ic" }, icon("file")),
          el("b", null, "Arquivo PDF"),
          el("span", { class: "muted" }, kb ? kb + " KB" : "menos de 1 KB"),
          el("div", { class: "row", style: "justify-content:center;gap:8px" },
            el("a", { class: "btn purple", href, target: "_blank", rel: "noopener" }, "Abrir arquivo"),
            el("a", { class: "btn ghost", href, download: (caption || "prova").replace(/[\\/:*?"<>|]+/g, "-").slice(0, 80) + ".pdf" }, "Baixar"))));
      });
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

  // foto de prova. list = todas as fotos do mesmo dia: mostra "2 de 3" e setas para passar
  function openPhoto(id, caption, list) {
    list = Array.isArray(list) && list.length > 1 ? list : null;
    const i = list ? Math.max(0, list.indexOf(id)) : 0;
    const go = (d) => openPhoto(list[(i + d + list.length) % list.length], caption, list);
    const lb = showBox(id, caption + (list ? " (" + (i + 1) + " de " + list.length + ")" : ""), {
      foot: list ? el("div", { class: "lb-nav" },
        el("button", { type: "button", class: "btn ghost", "aria-label": "Anterior", onclick: (e) => { e.stopPropagation(); go(-1); } }, icon("left"), "Anterior"),
        el("span", null, (i + 1) + " de " + list.length),
        el("button", { type: "button", class: "btn ghost", "aria-label": "Próxima", onclick: (e) => { e.stopPropagation(); go(1); } }, "Próxima", icon("right"))) : null,
    });
    lb.onkeydown = list ? (e) => { if (e.key === "ArrowLeft") go(-1); if (e.key === "ArrowRight") go(1); } : null;
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
      const n = proofs[k].length;
      const b = el("button", { type: "button", class: "thumb", "aria-label": "Ver prova de " + lab, onclick: () => openPhoto(proofs[k][0], cap, proofs[k]) },
        img, el("span", null, lab), n > 1 ? el("em", { class: "thumb-n" }, "+" + (n - 1)) : null);
      loadInto(img, proofs[k][0], () => { b.classList.add("broken"); img.remove(); }, () => img.replaceWith(fileBadge()));
      return b;
    });

    let camBtn = null;
    if (mine) {
      const busy = S.uploading === task.id + "|" + curKey;
      const has = !!proofs[curKey] && r.done.has(curKey);
      const daily = task.kind === "daily";
      // abre o painel do dia, onde dá para tirar foto, escolher da galeria ou mandar PDF
      camBtn = el("button", { type: "button", class: "cam", disabled: !!S.uploading || !L.actions.canChangeDay(task, curKey), onclick: () => L.tasksUI.openSheet(task, curKey) },
        icon("camera"),
        busy ? "Enviando" + (S.uploadInfo ? " " + S.uploadInfo : "") + "…" : has ? "Mais fotos" : (daily ? "Foto de hoje" : "Foto da semana"));
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

  L.photos = { isFile, fileBadge, loadData, proofRow, openPhoto, openAvatar, closePhoto, refresh, setup, startPhoto, pick, proofsOf, loadInto };
})(window.Liga);
