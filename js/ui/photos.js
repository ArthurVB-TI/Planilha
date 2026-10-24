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
  function loadInto(img, id, onFail) {
    const cached = S.photoCache[id];
    if (cached) { img.src = cached; return; }
    S.backend.photos.load(id)
      .then((url) => {
        if (typeof url !== "string" || !url.startsWith("data:image/")) throw new Error("foto inválida");
        S.photoCache[id] = url;
        img.src = url;
      })
      .catch(() => onFail && onFail());
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
    inp.click();
  }
  // escolhe uma foto para outra coisa (justificativa, prova de contestação): cb(idDaFoto)
  function pick(tag, cb) {
    if (S.uploading) return;
    S.camTarget = { tag, cb };
    const inp = $("camInput");
    inp.value = "";
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
        const data = await prepare(file);
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

  function closePhoto() {
    const lb = $("lightbox");
    lb.hidden = true;
    lb.replaceChildren();
  }

  function openPhoto(id, caption) {
    const lb = $("lightbox");
    lb.replaceChildren();
    const img = el("img", { alt: "Foto de prova: " + caption });
    loadInto(img, id, () => img.replaceWith(el("p", { style: "color:#fff;margin:auto;text-align:center" }, "Esta foto não pode ser exibida.")));
    lb.append(el("div", { class: "bar" },
      el("div", { text: caption }),
      el("button", { class: "btn ghost sm", type: "button", id: "lbClose", onclick: closePhoto }, icon("close"), "Fechar")), img);
    lb.onclick = (e) => { if (e.target === lb) closePhoto(); };
    lb.hidden = false;
    $("lbClose").focus();
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

  L.photos = { proofRow, openPhoto, setup, startPhoto, pick, proofsOf, loadInto };
})(window.Liga);
