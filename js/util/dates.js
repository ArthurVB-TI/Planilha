/* dates.js — datas no formato AAAA-MM-DD (fuso do aparelho); semanas começam na segunda */
window.Liga = window.Liga || {};
(function (L) {
  "use strict";

  const WD = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const pad = (n) => String(n).padStart(2, "0");
  const keyOf = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const isKey = (k) => typeof k === "string" && /^\d{4}-\d{2}-\d{2}$/.test(k);

  function parseKey(k) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k);
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function addDays(k, n) {
    const d = parseKey(k);
    d.setDate(d.getDate() + n);
    return keyOf(d);
  }
  // segunda-feira da semana de k
  function weekOf(k) {
    const d = parseKey(k);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return keyOf(d);
  }
  const todayKey = () => keyOf(new Date());
  const curWeek = () => weekOf(todayKey());
  const shortDate = (k) => {
    const d = parseKey(k);
    return pad(d.getDate()) + "/" + pad(d.getMonth() + 1);
  };
  const longToday = () => new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  L.dates = { WD, pad, keyOf, isKey, parseKey, addDays, weekOf, todayKey, curWeek, shortDate, longToday };
})(window.Liga);
