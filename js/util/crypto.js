/* crypto.js — senha com PBKDF2 e códigos TOTP (aplicativo autenticador).
   Usado pelas contas do modo local. No modo Firebase quem cuida disso é o próprio Firebase. */
window.Liga = window.Liga || {};
(function (L) {
  "use strict";

  const subtle = () => {
    if (!window.crypto || !window.crypto.subtle) throw Object.assign(new Error("sem crypto"), { code: "no_crypto" });
    return window.crypto.subtle;
  };
  const enc = new TextEncoder();
  const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));

  async function hashPassword(password, saltB64) {
    const salt = saltB64 ? fromB64(saltB64) : randomBytes(16);
    const key = await subtle().importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await subtle().deriveBits({ name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256" }, key, 256);
    return { salt: toB64(salt), hash: toB64(bits) };
  }
  async function checkPassword(password, salt, hash) {
    const r = await hashPassword(password, salt);
    return r.hash === hash;
  }

  /* ---------- TOTP (RFC 6238, 6 dígitos, 30 s) ---------- */
  const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  function b32encode(bytes) {
    let bits = 0, value = 0, out = "";
    for (const b of bytes) {
      value = (value << 8) | b; bits += 8;
      while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
    }
    if (bits > 0) out += B32[(value << (5 - bits)) & 31];
    return out;
  }
  function b32decode(s) {
    const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, "");
    let bits = 0, value = 0;
    const out = [];
    for (const c of clean) {
      value = (value << 5) | B32.indexOf(c); bits += 5;
      if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
    }
    return new Uint8Array(out);
  }
  async function hotp(keyBytes, counter) {
    const key = await subtle().importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
    const buf = new ArrayBuffer(8);
    const view = new DataView(buf);
    view.setUint32(0, Math.floor(counter / 2 ** 32));
    view.setUint32(4, counter >>> 0);
    const h = new Uint8Array(await subtle().sign("HMAC", key, buf));
    const o = h[h.length - 1] & 15;
    const code = (((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6;
    return String(code).padStart(6, "0");
  }
  const newTotpSecret = () => b32encode(randomBytes(20));
  async function totpNow(secret, offset) {
    return hotp(b32decode(secret), Math.floor(Date.now() / 30000) + (offset || 0));
  }
  async function verifyTotp(secret, code) {
    code = String(code || "").replace(/\s/g, "");
    if (!/^\d{6}$/.test(code)) return false;
    for (const d of [-1, 0, 1]) if ((await totpNow(secret, d)) === code) return true;
    return false;
  }
  const totpUri = (account, secret) =>
    "otpauth://totp/" + encodeURIComponent("Liga das Tarefas:" + account) + "?secret=" + secret + "&issuer=" + encodeURIComponent("Liga das Tarefas");

  L.crypto = { hashPassword, checkPassword, newTotpSecret, verifyTotp, totpNow, totpUri };
})(window.Liga);
