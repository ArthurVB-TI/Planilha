/* dom.js — criação de elementos e ícones SVG */
window.Liga = window.Liga || {};
(function (L) {
  "use strict";

  const $ = (id) => document.getElementById(id);

  /**
   * Cria um elemento. Textos sempre entram como texto (nunca como HTML),
   * então nomes e títulos digitados pelos jogadores não executam código.
   */
  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    let value;
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === "class") n.className = v;
        else if (k === "text") n.textContent = v;
        else if (k === "value") value = v;
        else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
        else if (v === true) n.setAttribute(k, "");
        else n.setAttribute(k, String(v));
      }
    }
    for (const c of kids.flat(Infinity)) {
      if (c == null || c === false) continue;
      n.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    if (value !== undefined) n.value = value; // depois dos filhos, para <select> funcionar
    return n;
  }

  const ICONS = {
    check: "M4 12.5l5 5L20 6.5",
    camera: "M4 8h3l2-3h6l2 3h3v11H4z M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
    home: "M4 11l8-7 8 7v9h-5v-6H9v6H4z",
    folder: "M3 6h7l2 2h9v11H3z",
    list: "M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01",
    book: "M4 5h7v15H4z M13 5h7v15h-7z",
    plus: "M12 5v14M5 12h14",
    close: "M6 6l12 12M18 6L6 18",
    chevron: "M9 6l6 6-6 6",
    logout: "M15 4h4v16h-4 M10 8l-4 4 4 4 M6 12h10",
    menu: "M4 7h16M4 12h16M4 17h16",
    chart: "M4 20V10 M10 20V4 M16 20v-7 M21 20H3",
    edit: "M4 20h4L19 9l-4-4L4 16z M13.5 6.5l4 4",
    bell: "M6 16V11a6 6 0 0 1 12 0v5l2 2H4z M10 20a2 2 0 0 0 4 0",
    heart: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
    inbox: "M3 13l3-8h12l3 8v6H3z M3 13h5l1 3h6l1-3h5",
    flag: "M5 21V4 M5 4h11l-2 4 2 4H5",
    trash: "M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13",
    users: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M2 21v-1a6 6 0 0 1 12 0v1 M16 3.5a4 4 0 0 1 0 7.5 M22 21v-1a6 6 0 0 0-4-5.6",
    gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7 7 0 0 1-1.7 1l-.3 2h-4l-.3-2a7 7 0 0 1-1.7-1l-1.9.7-2-3.4 1.6-1.2a7 7 0 0 1 0-2L3 10.3l2-3.4 1.9.7a7 7 0 0 1 1.7-1l.3-2h4l.3 2a7 7 0 0 1 1.7 1l1.9-.7 2 3.4-1.6 1.2a7 7 0 0 1 0 2z",
  };

  function icon(name) {
    const NS = "http://www.w3.org/2000/svg";
    const s = document.createElementNS(NS, "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("class", "ico");
    s.setAttribute("aria-hidden", "true");
    s.setAttribute("fill", "none");
    s.setAttribute("stroke", "currentColor");
    s.setAttribute("stroke-width", "2.1");
    s.setAttribute("stroke-linecap", "round");
    s.setAttribute("stroke-linejoin", "round");
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", ICONS[name] || "");
    s.append(p);
    return s;
  }

  L.dom = { $, el, icon };
})(window.Liga);
