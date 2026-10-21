/* text.js — limpeza de texto, números e armazenamento do navegador */
window.Liga = window.Liga || {};
(function (L) {
  "use strict";

  // remove caracteres de controle e invisíveis (inclusive os que invertem a direção do texto)
  const BAD = /[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩﻿]/g;
  const clean = (s, max) => String(s ?? "").replace(BAD, " ").replace(/\s+/g, " ").trim().slice(0, max);

  // igual ao clean, mas mantém as quebras de linha (texto de detalhes)
  const cleanLong = (s, max) => String(s ?? "").replace(/\r\n?/g, "\n").split("\n")
    .map((l) => l.replace(BAD, " ").replace(/\s+/g, " ").trim()).join("\n")
    .replace(/\n{3,}/g, "\n\n").trim().slice(0, max);

  const fmtPts = (n) => (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n).toLocaleString("pt-BR");
  const fmtTotal = (n) => (n < 0 ? "−" : "") + Math.abs(n).toLocaleString("pt-BR");
  const plural = (n, um, varios) => n + " " + (n === 1 ? um : varios);
  const firstName = (s) => clean(s, 60).split(" ")[0] || "";

  // localStorage pode falhar (aba anônima, cota cheia) — nunca deixa o site quebrar
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignora */ } },
  };

  L.text = { clean, cleanLong, fmtPts, fmtTotal, plural, firstName, store };
})(window.Liga);
