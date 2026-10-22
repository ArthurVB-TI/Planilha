/* =========================================================
   config.js — ÚNICO arquivo que você precisa editar.

   Sem Firebase (firebase: null) o site roda em MODO LOCAL:
   tudo fica salvo só neste navegador. Serve para testar.

   Com a configuração abaixo o site usa o Firebase (projeto "listrats"):
   contas e dados online, compartilhados entre você e seus amigos.
   Esses valores não são senha — quem protege os dados são as regras
   do arquivo firestore.rules (já publicadas no Firebase).
   ========================================================= */

window.LIGA_CONFIG = {
  firebase: {
    apiKey: "AIzaSyCJu6OKN5TzdfWa9TR8CUh-VKNoAiH4-4k",
    authDomain: "listrats.firebaseapp.com",
    projectId: "listrats",
    storageBucket: "listrats.firebasestorage.app",
    messagingSenderId: "502821293139",
    appId: "1:502821293139:web:f5c18acd4585c7e296caa6",
  },
};
