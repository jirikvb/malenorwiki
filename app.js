// MalenorWiki – hlavní aplikace.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp, arrayUnion, query, where
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js?v=10";
import { ADMIN_UIDS, SECTIONS, AGES, CURRENT_YEAR, MONTHS, BOOK } from "./site-config.js?v=10";
import { initChars } from "./postavy.js?v=10";

// ---------- Firebase ----------
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
let db;
try { db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }); }
catch (e) { db = initializeFirestore(app, {}); }

// ---------- stav ----------
const S = {
  user: null, admin: false, status: "loading", error: null,
  articles: new Map(), proposals: new Map(), requests: new Map(), members: new Map(),
  loaded: {}, titleIndex: new Map(),
  authSubs: [], dataSubs: [], routeSub: null, routeData: null,
  editing: false, dirty: false, pendingHash: null
};

// ---------- pomocníci ----------
const $ = sel => document.querySelector(sel);
const view = () => $("#view");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const enc = s => encodeURIComponent(s);
const sectionOf = key => SECTIONS.find(s => s.key === key) || { key: key || "ostatni", name: key ? key : "Bez sekce", desc: "" };
const tsDate = t => (t && typeof t.toDate === "function") ? t.toDate() : (t instanceof Date ? t : null);
const tsMs = t => { const d = tsDate(t); return d ? d.getTime() : 0; };
function fmtWhen(t){
  const d = tsDate(t); if (!d) return "právě teď";
  return d.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" }) + " " + d.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" });
}
const myName = () => (S.user && (S.user.displayName || S.user.email)) || "Bez jména";
const byTitle = (a, b) => (a.title || "").localeCompare(b.title || "", "cs");
const parseTags = s => [...new Set(String(s || "").split(",").map(t => t.trim()).filter(Boolean))];
function excerpt(body, n = 170){
  const t = String(body || "").replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2").replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[#>*_`~|-]+/g, " ").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n).replace(/\s\S*$/, "") + "…" : t;
}
let toastTimer;
function toast(msg, kind){
  const el = $("#toast"); el.textContent = msg; el.className = "toast" + (kind ? " " + kind : ""); el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, kind === "err" ? 6000 : 3000);
}
function errText(e){
  const c = e && e.code || "";
  if (c.includes("permission-denied")) return "Na tuto akci nemáš oprávnění.";
  if (c.includes("unavailable")) return "Nejsi připojený k internetu. Zkus to za chvíli.";
  if (c.includes("popup-closed") || c.includes("cancelled-popup")) return "Přihlášení bylo zrušeno.";
  if (c.includes("popup-blocked")) return "Prohlížeč zablokoval přihlašovací okno. Povol vyskakovací okna a zkus to znovu.";
  if (c.includes("unauthorized-domain")) return "Tato adresa není ve Firebase povolená (Authorized domains).";
  return "Něco se nepovedlo" + (c ? ` (${c})` : "") + ".";
}
async function copyText(text, btn){
  try { await navigator.clipboard.writeText(text); toast("Zkopírováno."); }
  catch (e) { const r = document.createRange(); const code = btn && btn.previousElementSibling; if (code){ r.selectNodeContents(code); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } toast("Označeno, zkopíruj ručně."); }
}
function rebuildIndex(){
  S.titleIndex.clear();
  for (const a of S.articles.values()) if (a.title) S.titleIndex.set(norm(a.title), a.id);
}

// ---------- Markdown ----------
const WIKI = /\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]/g;
function renderMd(src){
  const withLinks = String(src || "").replace(WIKI, (m, title, label) => {
    const id = S.titleIndex.get(norm(title)); const text = esc((label || title).trim());
    return id ? `<a href="#/clanek/${enc(id)}">${text}</a>` : `<a class="missing" href="#/novy/_/${enc(title.trim())}" title="Článek zatím neexistuje">${text}</a>`;
  });
  let html;
  try { html = window.marked ? window.marked.parse(withLinks, { gfm: true, breaks: true }) : `<p>${esc(withLinks)}</p>`; }
  catch (e) { html = `<p>${esc(withLinks)}</p>`; }
  const clean = window.DOMPurify ? window.DOMPurify.sanitize(html) : esc(html);
  const box = document.createElement("div"); box.innerHTML = clean;
  box.querySelectorAll("img").forEach(img => {
    const m = (img.getAttribute("src") || "").match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]{10,})/);
    if (m) img.src = `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1600`;
    img.loading = "lazy";
  });
  box.querySelectorAll("a[href]").forEach(a => { if (/^https?:/i.test(a.getAttribute("href"))){ a.target = "_blank"; a.rel = "noopener"; } });
  return box.innerHTML;
}
function linksIn(body){ const out = new Set(); String(body || "").replace(WIKI, (m, t) => { out.add(norm(t)); return m; }); return out; }

// ---------- přihlášení a data ----------
function stopSubs(list){ while (list.length) { try { list.pop()(); } catch (e) {} } }
function stopRoute(){ if (S.routeSub){ try { S.routeSub(); } catch (e) {} S.routeSub = null; } S.routeData = null; }

const CH = initChars({ db, S, $, esc, enc, norm, toast, errText, renderMd, go: h => { location.hash = h; }, route: () => route(), myName, fmtWhen, tsMs,
  fs: { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, query, where, serverTimestamp, writeBatch } });
CH.setOnChange(() => dataChanged());

onAuthStateChanged(auth, user => {
  stopSubs(S.authSubs); stopSubs(S.dataSubs); stopRoute(); CH.reset();
  for (const k of ["articles", "proposals", "requests", "members"]) S[k].clear();
  S.loaded = {}; S.titleIndex.clear(); S.editing = false; S.dirty = false;
  S.user = user; S.admin = !!user && ADMIN_UIDS.includes(user.uid); S.error = null; S.requested = false;
  if (!user){ S.status = "out"; render(); return; }
  if (S.admin){ becomeMember(); return; }
  S.status = "loading"; render();
  S.authSubs.push(onSnapshot(doc(db, "members", user.uid), snap => {
    if (snap.exists()){ if (S.status !== "member") becomeMember(); }
    else {
      if (S.status === "member"){ stopSubs(S.dataSubs); stopRoute(); }
      const was = S.status; S.status = "pending";
      if (!S.requested){ S.requested = true; requestAccess(); }
      if (was !== "pending") render();
    }
  }, err => { S.status = "error"; S.error = err; render(); }));
});

function requestAccess(){
  const u = S.user;
  setDoc(doc(db, "requests", u.uid), { name: myName(), email: u.email || "", photo: u.photoURL || "", createdAt: serverTimestamp() }, { merge: true })
    .catch(err => { if (!S.error){ S.error = err; render(); } });
}
function becomeMember(){
  S.status = "member";
  setDoc(doc(db, "users", S.user.uid), { name: myName(), photo: S.user.photoURL || "", updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
  listen("articles", S.articles, rebuildIndex);
  listen("proposals", S.proposals);
  if (S.admin){ listen("requests", S.requests); listen("members", S.members); }
  CH.listen();
  render();
}
function listen(name, map, after){
  S.dataSubs.push(onSnapshot(collection(db, name), snap => {
    map.clear(); snap.forEach(d => map.set(d.id, { id: d.id, ...d.data() }));
    S.loaded[name] = true; if (after) after(); dataChanged();
  }, err => { console.error(name, err); S.loaded[name] = true; toast("Nepodařilo se načíst data. " + errText(err), "err"); dataChanged(); }));
}
let dataTimer = null;
function dataChanged(){
  clearTimeout(dataTimer);
  dataTimer = setTimeout(() => { renderChrome(); if (!S.editing) renderMain(); }, 30);
}
async function login(){
  try { await signInWithPopup(auth, new GoogleAuthProvider()); }
  catch (e) { toast(errText(e), "err"); }
}
async function logout(){ if (S.dirty) return toast("Nejdřív ulož nebo zahoď rozepsaný text.", "err"); await signOut(auth); location.hash = "#/"; }

// ---------- směrování ----------
function route(){
  const raw = location.hash.replace(/^#\/?/, "");
  return raw ? raw.split("/").map(p => { try { return decodeURIComponent(p); } catch (e) { return p; } }) : [];
}
let lastHash = location.hash;
window.addEventListener("hashchange", () => {
  if (S.dirty && location.hash !== lastHash){
    S.pendingHash = location.hash;
    history.replaceState(null, "", lastHash || "#/");
    showLeaveBar(); return;
  }
  lastHash = location.hash; S.editing = false; S.dirty = false; stopRoute(); closeDrawer(); render();
  const r = route(); if (r[0] === "osa" && r[1]) { const el = document.getElementById("age-" + r[1]); if (el) el.scrollIntoView({ block: "start" }); } else window.scrollTo(0, 0);
});
window.addEventListener("beforeunload", e => { if (S.dirty){ e.preventDefault(); e.returnValue = ""; } });
function showLeaveBar(){
  let bar = $("#leaveBar");
  if (!bar){ bar = document.createElement("div"); bar.id = "leaveBar"; bar.className = "notice warn"; view().prepend(bar); }
  bar.innerHTML = `Máš neuložené změny. <span class="row" style="margin-top:6px"><button type="button" id="leaveGo" class="danger">Zahodit a odejít</button><button type="button" id="leaveStay">Zůstat</button></span>`;
  bar.scrollIntoView({ block: "center" });
  $("#leaveGo").onclick = () => { S.dirty = false; clearDraft(); const h = S.pendingHash; S.pendingHash = null; location.hash = h; };
  $("#leaveStay").onclick = () => { S.pendingHash = null; bar.remove(); };
}
const go = h => { location.hash = h; };

// ---------- vykreslení ----------
function render(){ renderChrome(); renderMain(); }

function renderChrome(){
  const who = $("#who"), nav = $("#nav"), form = $("#searchForm");
  if (!S.user || S.status !== "member") hideTimelineChrome();
  if (!S.user){ who.innerHTML = ""; nav.hidden = true; form.hidden = true; return; }
  who.innerHTML = `${S.user.photoURL ? `<img class="avatar" src="${esc(S.user.photoURL)}" alt="" referrerpolicy="no-referrer">` : ""}<button type="button" class="ghost" id="logoutBtn" title="Odhlásit ${esc(myName())}">Odhlásit</button>`;
  $("#logoutBtn").onclick = logout;
  if (S.status !== "member"){ nav.hidden = true; form.hidden = true; return; }
  form.hidden = false; nav.hidden = false;
  const r = route(), cur = r[0] || "";
  const curSec = cur === "sekce" ? r[1] : (cur === "clanek" ? (S.articles.get(r[1]) || {}).section : null);
  const open = [...S.proposals.values()].filter(p => p.status === "open").length;
  const reqs = S.requests.size;
  const link = (href, label, on, badge) => `<a href="${href}"${on ? ' aria-current="page"' : ""}>${label}${badge ? `<span class="badge">${badge}</span>` : ""}</a>`;
  nav.innerHTML = [
    link("#/", "Domů", cur === ""),
    ...SECTIONS.map(s => link(`#/sekce/${s.key}`, esc(s.name), curSec === s.key)),
    link("#/osa", "Osa", cur === "osa"),
    link("#/kniha", "Kniha", cur === "kniha"),
    link("#/deniky", "Deníky", cur === "deniky" || cur === "denik" || cur === "knihovna" || cur === "seznamy"),
    link("#/navrhy", "Návrhy", cur === "navrhy" || cur === "navrh", open),
    link("#/kalendar", "Kalendář", cur === "kalendar"),
    S.admin ? link("#/clenove", "Členové", cur === "clenove", reqs) : ""
  ].join("");
  if (S.loaded.articles) renderTimelineChrome();
}

function renderMain(){
  const v = view();
  S.editing = false;
  if (S.status === "out") return gateOut(v);
  if (S.status === "loading") { v.innerHTML = `<p class="muted">Načítám…</p>`; return; }
  if (S.status === "pending" || S.status === "error") return gatePending(v);
  if (!S.loaded.articles){ v.innerHTML = `<p class="muted">Načítám články…</p>`; return; }
  const r = route();
  S.editing = false;
  switch (r[0] || ""){
    case "": return home(v);
    case "sekce": return sectionView(v, r[1]);
    case "clanek": return articleView(v, r[1]);
    case "upravit": return editorView(v, { kind: "article", id: r[1] });
    case "novy": return editorView(v, { kind: "new", section: r[1] && r[1] !== "_" ? r[1] : "", title: r[2] || "" });
    case "navrhy": return proposalsView(v);
    case "navrh": return r[2] === "upravit" ? editorView(v, { kind: "proposal", id: r[1] }) : (r[2] === "schvalit" ? editorView(v, { kind: "approve", id: r[1] }) : proposalView(v, r[1]));
    case "hledat": return searchView(v, r.slice(1).join("/"));
    case "historie": return historyView(v, r[1]);
    case "osa": return timelineView(v, r[1]);
    case "kalendar": return calendarView(v);
    case "kniha": return bookView(v, r[1]);
    case "deniky": return CH.charsView(v);
    case "denik": return CH.charView(v, r[1], r[2]);
    case "knihovna": return CH.libraryView(v);
    case "seznamy": return CH.listsView(v);
    case "clenove": return S.admin ? membersView(v) : notFound(v);
    default: return notFound(v);
  }
}
function notFound(v, msg){ v.innerHTML = `<div class="head"><h1>Tady nic není</h1><p class="lede">${esc(msg || "Tahle stránka neexistuje.")}</p></div><p><a class="btn" href="#/">Zpět na úvod</a></p>`; }

// --- brána ---
function gateOut(v){
  v.innerHTML = `<div class="gate">
    <span class="eyebrow">společná kronika světa</span>
    <h1>MalenorWiki</h1>
    <p class="lede">Bohové, rasy, frakce a místa Malenoru na jednom místě. Čti, piš a navrhuj úpravy. Vypravěč návrhy schvaluje.</p>
    <p><button type="button" class="primary" id="loginBtn">Přihlásit přes Google</button></p>
    <p class="hint">Po prvním přihlášení počkáš, až tě vypravěč pustí dovnitř.</p>
  </div>`;
  $("#loginBtn").onclick = login;
}
function gatePending(v){
  const noRules = S.error && String(S.error.code || "").includes("permission-denied");
  const noAdmin = ADMIN_UIDS.length === 0;
  v.innerHTML = `<div class="gate">
    <h1>${noAdmin ? "Wiki ještě nemá vypravěče" : "Čekáš na schválení"}</h1>
    <p class="lede">${noAdmin
      ? "Pošli toto ID Claudovi. Doplní tě jako vypravěče a připraví pravidla databáze."
      : (S.status === "error" ? (noRules ? "Databáze zatím nemá nastavená pravidla, nebo k ní nemáš přístup." : "Databázi se nepodařilo otevřít.") : "Vypravěč tvou žádost uvidí v sekci Členové. Jakmile tě schválí, wiki se ti otevře sama.")}</p>
    <div class="field"><span class="lbl">Tvoje ID</span>
      <div class="uid"><code id="uidCode">${esc(S.user.uid)}</code><button type="button" id="copyUid">Kopírovat</button></div></div>
    <p class="hint">Přihlášen jako ${esc(myName())}${S.user.email ? ` (${esc(S.user.email)})` : ""}.</p>
    ${S.error && !noAdmin ? `<p class="hint">${esc(errText(S.error))}</p>` : ""}
  </div>`;
  $("#copyUid").onclick = e => copyText(S.user.uid, e.currentTarget);
}

// --- úvod ---
function home(v){
  const arts = [...S.articles.values()];
  const counts = {}; arts.forEach(a => { counts[a.section] = (counts[a.section] || 0) + 1; });
  const recent = arts.slice().sort((a, b) => tsMs(b.updatedAt) - tsMs(a.updatedAt)).slice(0, 8);
  const open = [...S.proposals.values()].filter(p => p.status === "open");
  const mine = open.filter(p => p.author === S.user.uid).length;
  v.innerHTML = `
    <div class="head">
      <span class="eyebrow">společná kronika světa</span>
      <h1>MalenorWiki</h1>
      <p class="lede">Vítej, ${esc((myName()).split(" ")[0])}. ${S.admin
        ? (open.length ? `Čeká na tebe ${open.length} ${plural(open.length, "návrh", "návrhy", "návrhů")}.` : "Žádné návrhy nečekají.")
        : (mine ? `Máš ${mine} ${plural(mine, "otevřený návrh", "otevřené návrhy", "otevřených návrhů")}.` : "Najdi článek, nebo navrhni nový.")}</p>
    </div>
    ${S.admin && S.requests.size ? `<p class="notice"><a href="#/clenove">${S.requests.size} ${plural(S.requests.size, "člověk čeká", "lidé čekají", "lidí čeká")} na schválení</a></p>` : ""}
    ${clockHTML()}
    <div class="sections">
      ${SECTIONS.map(s => `<a class="sec" href="#/sekce/${s.key}"><strong>${esc(s.name)}</strong><span>${esc(s.desc)}</span><em>${counts[s.key] || 0} ${plural(counts[s.key] || 0, "článek", "články", "článků")}</em></a>`).join("")}
    </div>
    <section class="head">
      <div class="spread"><h2>Naposledy upraveno</h2><a class="btn" href="#/novy">${S.admin ? "Nový článek" : "Navrhnout článek"}</a></div>
      ${recent.length ? `<ul class="list">${recent.map(a => `<li><a class="item" href="#/clanek/${enc(a.id)}"><strong>${esc(a.title)}</strong><small>${esc(sectionOf(a.section).name)} · ${fmtWhen(a.updatedAt)}${a.updatedByName ? " · " + esc(a.updatedByName) : ""}</small></a></li>`).join("")}</ul>`
        : `<p class="muted">Wiki je zatím prázdná. ${S.admin ? "Založ první článek tlačítkem vpravo." : "Navrhni první článek."}</p>`}
    </section>`;
  tickClock();
}

// --- Časinka na úvodu ---
// Den = 30 kroků, krok = 100 dechů, dech = 30 tepů. Pozemská půlnoc = malenorská půlnoc, poledne = Pál (krok 15).
const TEP_DAY = 90000, TEP_KROK = 3000, TEP_DECH = 30;
const DAY_PARTS = [["Stín / Noc", 0, 6], ["Záhlav", 6, 8], ["Vzestup", 8, 14], ["Pál", 14, 16], ["Sklon", 16, 22], ["Soumrak", 22, 25], ["Stín / Noc", 25, 30]];
const PART_COLORS = ["var(--pd-night)", "var(--pd-dawn)", "var(--pd-morn)", "var(--pd-noon)", "var(--pd-aft)", "var(--pd-dusk)", "var(--pd-night)"];
const pad2 = n => String(n).padStart(2, "0");
function pol(r, deg){ const a = (deg - 90) * Math.PI / 180; return [(50 + r * Math.cos(a)).toFixed(2), (50 + r * Math.sin(a)).toFixed(2)]; }
function arc(r0, r1, d0, d1){
  const [a, b] = pol(r1, d0), [c, d] = pol(r1, d1), [e, f] = pol(r0, d1), [g, h] = pol(r0, d0), big = d1 - d0 > 180 ? 1 : 0;
  return `M${a} ${b}A${r1} ${r1} 0 ${big} 1 ${c} ${d}L${e} ${f}A${r0} ${r0} 0 ${big} 0 ${g} ${h}Z`;
}
let clockFaces = null;
function faces(){
  if (clockFaces) return clockFaces;
  let e = `<circle cx="50" cy="50" r="47" fill="var(--surface)" stroke="var(--rule)"/>`;
  for (let i = 0; i < 60; i += 5){ const [x1, y1] = pol(44, i * 6), [x2, y2] = pol(i % 15 ? 41 : 38, i * 6); e += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--muted)" stroke-width="${i % 15 ? .7 : 1.4}"/>`; }
  let m = `<circle cx="50" cy="50" r="47" fill="var(--surface)" stroke="var(--rule)"/>`;
  DAY_PARTS.forEach((p, i) => { m += `<path d="${arc(42, 47, p[1] * 12, p[2] * 12)}" fill="${PART_COLORS[i]}" opacity=".85"/>`; });
  for (let k = 0; k < 30; k += 3){ const [x1, y1] = pol(41, k * 12), [x2, y2] = pol(k % 15 ? 38 : 35, k * 12); m += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--muted)" stroke-width="${k % 15 ? .8 : 1.6}"/>`; }
  const hands = (p, accent) => `<line id="${p}1" x1="50" y1="50" x2="50" y2="27" stroke="var(--ink)" stroke-width="3.2" stroke-linecap="round"/><line id="${p}2" x1="50" y1="50" x2="50" y2="15" stroke="var(--ink)" stroke-width="1.8" stroke-linecap="round"/><line id="${p}3" x1="50" y1="56" x2="50" y2="11" stroke="${accent}" stroke-width=".9"/><circle cx="50" cy="50" r="2.2" fill="${accent}"/>`;
  clockFaces = { earth: e + hands("hcE", "var(--accent)"), mal: m + hands("hcM", "var(--accent)") };
  return clockFaces;
}
function clockHTML(){
  const f = faces();
  return `<section class="clockbar" aria-label="Časinka">
    <div class="clk"><svg viewBox="0 0 100 100" aria-hidden="true">${f.earth}</svg><div><span class="lbl">Země</span><strong id="hcEt">--:--:--</strong></div></div>
    <div class="clk"><svg viewBox="0 0 100 100" aria-hidden="true">${f.mal}</svg><div><span class="lbl">Malenor</span><strong id="hcMt">--:--:--</strong><span class="part" id="hcMp"></span></div></div>
  </section>`;
}
function setRot(id, deg){ const el = document.getElementById(id); if (el) el.setAttribute("transform", `rotate(${deg.toFixed(2)} 50 50)`); }
function tickClock(){
  if (!document.getElementById("hcEt")) return;
  const n = new Date(), sec = n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds() + n.getMilliseconds() / 1000;
  const teps = sec / 86400 * TEP_DAY;
  setRot("hcE1", sec / 43200 * 360); setRot("hcE2", (sec % 3600) / 3600 * 360); setRot("hcE3", Math.floor(sec % 60) * 6);
  setRot("hcM1", teps / TEP_DAY * 360); setRot("hcM2", (teps % TEP_KROK) / TEP_KROK * 360); setRot("hcM3", Math.floor(teps % TEP_DECH) * 12);
  const t = Math.floor(teps), k = Math.floor(t / TEP_KROK), d = Math.floor((t % TEP_KROK) / TEP_DECH), tp = t % TEP_DECH;
  document.getElementById("hcEt").textContent = `${pad2(n.getHours())}:${pad2(n.getMinutes())}:${pad2(n.getSeconds())}`;
  document.getElementById("hcMt").textContent = `${pad2(k)}:${pad2(d)}:${pad2(tp)}`;
  const part = DAY_PARTS.find(p => teps / TEP_KROK >= p[1] && teps / TEP_KROK < p[2]);
  document.getElementById("hcMp").textContent = part ? part[0] : "";
}
setInterval(tickClock, 250);
function plural(n, one, few, many){ return n === 1 ? one : (n >= 2 && n <= 4 ? few : many); }

// --- sekce ---
function sectionView(v, key){
  const sec = sectionOf(key);
  const arts = [...S.articles.values()].filter(a => a.section === key).sort(key === "kampan" ? byChapter : byTitle);
  v.innerHTML = `
    <div class="head">
      <span class="eyebrow"><a href="#/">MalenorWiki</a> · sekce</span>
      <div class="spread"><h1>${esc(sec.name)}</h1><a class="btn" href="#/novy/${enc(key)}">${S.admin ? "Nový článek" : "Navrhnout článek"}</a></div>
      ${sec.desc ? `<p class="lede">${esc(sec.desc)}</p>` : ""}
      ${key === "cas" ? `<p><a class="btn" href="#/kalendar">Otevřít převodník kalendáře a Časinku</a></p>` : ""}
      ${key === "kampan" ? `<p><a class="btn primary" href="#/kniha">Otevřít knihu</a></p>` : ""}
    </div>
    ${arts.length ? `<ul class="list">${arts.map(a => `<li><a class="item" href="#/clanek/${enc(a.id)}"><strong>${a.session && a.session.no != null ? `<span class="muted">${a.session.no}.</span> ` : ""}${esc(a.title)}</strong>${a.session ? `<small>${esc(sessionMeta(a.session))}</small>` : ""}${a.body ? `<span class="ex">${esc(excerpt(a.body))}</span>` : ""}</a></li>`).join("")}</ul>`
      : `<p class="muted">V této sekci zatím nejsou žádné články.</p>`}`;
}

// --- článek ---
function articleView(v, id){
  const a = S.articles.get(id);
  if (!a) return notFound(v, "Tento článek neexistuje, nebo byl smazán.");
  const sec = sectionOf(a.section);
  const myTitle = norm(a.title);
  const backlinks = [...S.articles.values()].filter(x => x.id !== id && linksIn(x.body).has(myTitle)).sort(byTitle);
  const props = [...S.proposals.values()].filter(p => p.status === "open" && p.articleId === id);
  const contributors = (a.contributors || []).length;
  v.innerHTML = `
    <div class="head">
      <span class="eyebrow"><a href="#/sekce/${enc(sec.key)}">${esc(sec.name)}</a></span>
      <h1>${esc(a.title)}</h1>
      ${a.when && eventAge(a.when) ? `<p class="when-line"><a href="#/osa/${enc(eventAge(a.when).key)}">${esc(eventAge(a.when).name)}</a> · ${esc(fmtEvent(a.when))}</p>` : ""}
      ${(a.tags || []).length ? `<div class="tags">${a.tags.map(t => `<a class="tag" href="#/hledat/${enc(t)}">${esc(t)}</a>`).join("")}</div>` : ""}
      ${a.session ? `<p class="when-line">${esc(sessionMeta(a.session, true))}</p>` : ""}
    </div>
    ${a.session && a.session.image ? `<figure class="scene"><img src="${esc(imgUrl(a.session.image))}" alt="${esc(a.session.caption || a.title)}" referrerpolicy="no-referrer">${a.session.caption ? `<figcaption>${esc(a.session.caption)}</figcaption>` : ""}</figure>` : ""}
    ${props.length ? `<p class="notice">K tomuto článku ${props.length === 1 ? "je otevřený" : "jsou otevřené"} ${props.length} ${plural(props.length, "návrh", "návrhy", "návrhů")}: ${props.map(p => `<a href="#/navrh/${enc(p.id)}">${esc(p.authorName || "návrh")}</a>`).join(", ")}</p>` : ""}
    <div class="layout">
      <article class="md">${a.body ? renderMd(a.body) : `<p class="muted">Článek zatím nemá text.</p>`}</article>
      <aside class="aside">
        <div class="row">
          <a class="btn primary" href="#/upravit/${enc(id)}">${S.admin ? "Upravit" : "Navrhnout úpravu"}</a>
          <a class="btn" href="#/historie/${enc(id)}">Historie</a>
          ${a.section === "kampan" ? `<a class="btn" href="#/kniha/${enc(id)}">Číst v knize</a>` : ""}
        </div>
        <div><h3>Naposledy upraveno</h3>${fmtWhen(a.updatedAt)}${a.updatedByName ? `<br>${esc(a.updatedByName)}` : ""}${contributors > 1 ? `<br><span class="muted">${contributors} přispěvatelé</span>` : ""}</div>
        ${backlinks.length ? `<div><h3>Odkazuje sem</h3><ul>${backlinks.map(b => `<li><a href="#/clanek/${enc(b.id)}">${esc(b.title)}</a></li>`).join("")}</ul></div>` : ""}
        ${S.admin ? `<div id="delBox"><button type="button" class="danger" id="delBtn">Smazat článek</button></div>` : ""}
      </aside>
    </div>`;
  if (S.admin) $("#delBtn").onclick = () => {
    $("#delBox").innerHTML = `<p class="hint">Opravdu smazat „${esc(a.title)}“? Starší verze zůstanou uložené.</p><div class="row"><button type="button" class="danger" id="delYes">Smazat</button><button type="button" id="delNo">Ponechat</button></div>`;
    $("#delNo").onclick = () => articleView(v, id);
    $("#delYes").onclick = async () => {
      try { const b = writeBatch(db); b.set(doc(collection(db, "articles", id, "revisions")), revisionOf(a, "smazáno")); b.delete(doc(db, "articles", id)); await b.commit(); toast("Článek smazán."); go(`#/sekce/${a.section}`); }
      catch (e) { toast(errText(e), "err"); }
    };
  };
}

// --- historie ---
function historyView(v, id){
  S.editing = true;
  const a = S.articles.get(id);
  v.innerHTML = `<div class="head"><span class="eyebrow">${a ? `<a href="#/clanek/${enc(id)}">${esc(a.title)}</a>` : "smazaný článek"} · historie</span><h1>Starší verze</h1>
    <p class="lede">Při každé změně se předchozí znění uloží sem.</p></div><div id="revs"><p class="muted">Načítám…</p></div>`;
  stopRoute();
  S.routeSub = onSnapshot(collection(db, "articles", id, "revisions"), snap => {
    const revs = []; snap.forEach(d => revs.push({ id: d.id, ...d.data() }));
    revs.sort((x, y) => tsMs(y.archivedAt) - tsMs(x.archivedAt));
    S.routeData = revs;
    const box = $("#revs"); if (!box) return;
    if (!revs.length){ box.innerHTML = `<p class="muted">Tento článek zatím nemá žádné starší verze.</p>`; return; }
    box.innerHTML = `<ul class="list">${revs.map((r, i) => `<li><button type="button" class="item ghost" data-i="${i}" style="width:100%;text-align:left;white-space:normal"><strong>${esc(r.title)}</strong><small>platilo do ${fmtWhen(r.archivedAt)}${r.byName ? " · napsal " + esc(r.byName) : ""}${r.reason ? " · " + esc(r.reason) : ""}</small></button></li>`).join("")}</ul><div id="revShow"></div>`;
    box.querySelectorAll("[data-i]").forEach(b => b.onclick = () => showRevision(id, revs[+b.dataset.i]));
  }, err => { const box = $("#revs"); if (box) box.innerHTML = `<p class="muted">${esc(errText(err))}</p>`; });
}
function showRevision(id, r){
  const box = $("#revShow"); const cur = S.articles.get(id);
  const diff = cur && window.Diff ? diffHtml(r.body || "", cur.body || "") : "";
  box.innerHTML = `<section class="head" style="margin-top:20px"><div class="spread"><h2>${esc(r.title)}</h2>${S.admin ? `<button type="button" id="restore">Obnovit tuto verzi</button>` : ""}</div>
    <div class="tabs" role="tablist"><button type="button" role="tab" aria-selected="true" data-t="text">Text</button>${diff ? `<button type="button" role="tab" aria-selected="false" data-t="diff">Rozdíl proti dnešku</button>` : ""}</div>
    <div id="revBody" class="md">${renderMd(r.body)}</div></section>`;
  box.querySelectorAll("[data-t]").forEach(t => t.onclick = () => {
    box.querySelectorAll("[data-t]").forEach(x => x.setAttribute("aria-selected", x === t ? "true" : "false"));
    $("#revBody").className = t.dataset.t === "diff" ? "diff" : "md";
    $("#revBody").innerHTML = t.dataset.t === "diff" ? diff : renderMd(r.body);
  });
  box.scrollIntoView({ block: "start" });
  if (S.admin) $("#restore").onclick = async () => {
    try { await saveArticle(cur ? id : null, { title: r.title, section: r.section || "ostatni", tags: r.tags || [], body: r.body || "", when: r.when || null, session: r.session || null }, "obnoveno ze starší verze", cur ? null : id); toast("Verze obnovena."); go(`#/clanek/${enc(id)}`); }
    catch (e) { toast(errText(e), "err"); }
  };
}

// --- ukládání ---
function revisionOf(a, reason){
  return { title: a.title || "", section: a.section || "", tags: a.tags || [], body: a.body || "", when: a.when || null, session: a.session || null, savedAt: a.updatedAt || null,
    by: a.updatedBy || null, byName: a.updatedByName || "", archivedAt: serverTimestamp(), reason: reason || "" };
}
async function saveArticle(id, data, reason, forceId){
  const ts = serverTimestamp(), uid = S.user.uid, name = myName();
  if (!id){
    const ref = forceId ? doc(db, "articles", forceId) : doc(collection(db, "articles"));
    await setDoc(ref, { ...data, createdAt: ts, createdBy: uid, createdByName: name, updatedAt: ts, updatedBy: uid, updatedByName: name, contributors: [uid] });
    return ref.id;
  }
  const cur = S.articles.get(id);
  const b = writeBatch(db);
  if (cur) b.set(doc(collection(db, "articles", id, "revisions")), revisionOf(cur, reason));
  b.update(doc(db, "articles", id), { ...data, updatedAt: ts, updatedBy: uid, updatedByName: name, contributors: arrayUnion(uid) });
  await b.commit();
  return id;
}
async function applyProposal(p, data){
  const ts = serverTimestamp(), b = writeBatch(db);
  let artId = p.articleId;
  if (p.type === "new" || !artId || !S.articles.has(artId)){
    const ref = doc(collection(db, "articles")); artId = ref.id;
    b.set(ref, { ...data, createdAt: ts, createdBy: p.author, createdByName: p.authorName || "", updatedAt: ts, updatedBy: p.author, updatedByName: p.authorName || "",
      approvedBy: S.user.uid, contributors: [p.author] });
  } else {
    const cur = S.articles.get(artId);
    b.set(doc(collection(db, "articles", artId, "revisions")), revisionOf(cur, "schválený návrh"));
    b.update(doc(db, "articles", artId), { ...data, updatedAt: ts, updatedBy: p.author, updatedByName: p.authorName || "", approvedBy: S.user.uid, contributors: arrayUnion(p.author) });
  }
  b.update(doc(db, "proposals", p.id), { status: "approved", decidedAt: ts, decidedBy: S.user.uid, articleId: artId, appliedTitle: data.title });
  await b.commit();
  return artId;
}

// --- koncepty v prohlížeči ---
let draftKey = null;
function saveDraft(data){ if (!draftKey) return; try { localStorage.setItem(draftKey, JSON.stringify({ ...data, at: Date.now() })); } catch (e) {} }
function loadDraft(){ try { return JSON.parse(localStorage.getItem(draftKey) || "null"); } catch (e) { return null; } }
function clearDraft(){ if (!draftKey) return; try { localStorage.removeItem(draftKey); } catch (e) {} }

// --- editor ---
function editorView(v, mode){
  let base = { title: mode.title || "", section: mode.section || "", tags: [], body: "", when: null, session: null }, heading, submitLabel, eyebrow = "";
  let article = null, proposal = null;
  if (mode.kind === "article"){
    article = S.articles.get(mode.id);
    if (!article) return notFound(v, "Článek k úpravě neexistuje.");
    base = { title: article.title, section: article.section, tags: article.tags || [], body: article.body || "", when: cleanWhen(article.when), session: cleanSession(article.session) };
    heading = S.admin ? "Úprava článku" : "Návrh úpravy";
    submitLabel = S.admin ? "Uložit" : "Odeslat návrh";
    eyebrow = `<a href="#/clanek/${enc(article.id)}">${esc(article.title)}</a>`;
  } else if (mode.kind === "new"){
    heading = S.admin ? "Nový článek" : "Návrh nového článku";
    submitLabel = S.admin ? "Založit článek" : "Odeslat návrh";
  } else {
    proposal = S.proposals.get(mode.id);
    if (!proposal) return notFound(v, "Tento návrh neexistuje.");
    if (mode.kind === "proposal" && !(proposal.author === S.user.uid && proposal.status === "open")) return notFound(v, "Tento návrh už upravit nejde.");
    if (mode.kind === "approve" && !(S.admin && proposal.status === "open")) return notFound(v, "Tento návrh už nejde schválit.");
    base = { title: proposal.title, section: proposal.section, tags: proposal.tags || [], body: proposal.body || "", when: cleanWhen(proposal.when), session: cleanSession(proposal.session) };
    heading = mode.kind === "approve" ? "Upravit a schválit" : "Úprava návrhu";
    submitLabel = mode.kind === "approve" ? "Schválit s úpravami" : "Uložit návrh";
    eyebrow = `<a href="#/navrh/${enc(proposal.id)}">návrh od ${esc(proposal.authorName || "?")}</a>`;
  }
  if (!base.section) base.section = SECTIONS[0].key;
  draftKey = `malenorwiki:koncept:${S.user.uid}:${mode.kind}:${mode.id || mode.section || "_"}:${mode.title || ""}`;
  const draft = loadDraft();
  const restored = draft && (draft.body !== base.body || draft.title !== base.title || whenKey(draft.when) !== whenKey(base.when) || sessionKey(draft.session) !== sessionKey(base.session));
  const start = restored ? { title: draft.title, section: draft.section || base.section, tags: draft.tags || base.tags, body: draft.body, when: draft.when === undefined ? base.when : cleanWhen(draft.when), session: draft.session === undefined ? base.session : cleanSession(draft.session) } : base;
  const needNote = !S.admin && (mode.kind === "article" || mode.kind === "new" || mode.kind === "proposal");

  S.editing = true;
  v.innerHTML = `
    <div class="head">
      ${eyebrow ? `<span class="eyebrow">${eyebrow}</span>` : ""}
      <h1>${heading}</h1>
      ${!S.admin && mode.kind !== "proposal" ? `<p class="lede">Návrh uvidí vypravěč. Po schválení se objeví ve wiki.</p>` : ""}
    </div>
    ${restored ? `<p class="notice" id="draftNote">Obnovil jsem neuložený koncept z ${new Date(draft.at).toLocaleString("cs-CZ")}. <button type="button" class="ghost" id="dropDraft">Zahodit koncept</button></p>` : ""}
    <form class="editor" id="edForm" autocomplete="off">
      <div class="ed-grid">
        <div class="field"><label for="edTitle">Název</label><input type="text" id="edTitle" required maxlength="140" value="${esc(start.title)}"></div>
        <div class="field"><label for="edSection">Sekce</label><select id="edSection">${SECTIONS.map(s => `<option value="${s.key}"${s.key === start.section ? " selected" : ""}>${esc(s.name)}</option>`).join("")}</select></div>
      </div>
      <div class="field"><label for="edTags">Štítky, oddělené čárkou</label><input type="text" id="edTags" value="${esc((start.tags || []).join(", "))}" placeholder="např. Triarchát, Velká válka"></div>
      <p class="hint" id="dupHint" hidden></p>
      ${sessionFieldsHTML(start.session, start.section)}
      ${whenFieldsHTML(start.when)}
      <div class="tabs" role="tablist">
        <button type="button" role="tab" aria-selected="true" id="tabWrite">Psát</button>
        <button type="button" role="tab" aria-selected="false" id="tabPreview">Náhled</button>
      </div>
      <div id="writePane" class="field">
        <div class="toolbar" aria-label="Formátování">
          <button type="button" data-md="b" title="Tučně"><b>B</b></button>
          <button type="button" data-md="i" title="Kurzíva"><i>I</i></button>
          <button type="button" data-md="h2" title="Nadpis">Nadpis</button>
          <button type="button" data-md="ul" title="Odrážka">• Odrážka</button>
          <button type="button" data-md="q" title="Citace">„Citace“</button>
          <button type="button" data-md="wiki" title="Odkaz na článek">[[Článek]]</button>
          <button type="button" data-md="link" title="Odkaz na web nebo Disk">Odkaz</button>
          <button type="button" data-md="img" title="Obrázek z odkazu">Obrázek</button>
        </div>
        <label class="sr" for="edBody">Text článku</label>
        <textarea id="edBody" spellcheck="true">${esc(start.body)}</textarea>
        <p class="hint">Odkaz na jiný článek: <code>[[Název článku]]</code>. Obrázek z Disku: sdílej ho „kdokoli s odkazem“ a vlož odkaz tlačítkem Obrázek.</p>
      </div>
      <div id="previewPane" class="preview md" hidden></div>
      ${needNote ? `<div class="field"><label for="edNote">Poznámka pro vypravěče (nepovinné)</label><input type="text" id="edNote" maxlength="400" value="${esc(proposal && proposal.note || "")}" placeholder="Proč tuhle změnu navrhuješ?"></div>` : ""}
      <div class="sticky-actions">
        <button type="submit" class="primary" id="edSave">${submitLabel}</button>
        <button type="button" id="edCancel">Zrušit</button>
        <span class="hint" id="edStatus"></span>
      </div>
    </form>`;

  const title = $("#edTitle"), section = $("#edSection"), tags = $("#edTags"), body = $("#edBody");
  const current = () => ({ title: title.value.trim(), section: section.value, tags: parseTags(tags.value), body: body.value, when: readWhen(), session: section.value === "kampan" ? readSession() : null });
  const isChanged = () => { const c = current(); return c.title !== base.title || c.section !== base.section || c.body !== base.body || c.tags.join("|") !== (base.tags || []).join("|") || whenKey(c.when) !== whenKey(base.when) || sessionKey(c.session) !== sessionKey(base.session); };
  const onInput = () => { S.dirty = isChanged(); saveDraft(current()); checkDup(); updateWhenUI(); };
  [title, section, tags, body].forEach(el => el.addEventListener("input", onInput));
  v.querySelectorAll("#whenBox input, #whenBox select, #sessBox input").forEach(el => { el.addEventListener("input", onInput); el.addEventListener("change", onInput); });
  section.addEventListener("change", () => { $("#sessBox").hidden = section.value !== "kampan"; onInput(); });
  $("#wOn").addEventListener("change", () => { const s = section.value === "kampan" ? readSession() : null; if ($("#wOn").checked && s && s.year != null && !$("#wYear").value){ $("#wYear").value = s.year; $("#wEra").value = "1"; if (s.m != null) $("#wM").value = s.m; if (s.d != null) $("#wD").value = s.d; onInput(); } });
  updateWhenUI();
  S.dirty = restored ? true : false;
  function checkDup(){
    const id = S.titleIndex.get(norm(title.value));
    const own = article ? article.id : (proposal && proposal.articleId);
    const h = $("#dupHint");
    if (id && id !== own){ h.hidden = false; h.innerHTML = `Článek s tímto názvem už existuje: <a href="#/clanek/${enc(id)}">${esc(S.articles.get(id).title)}</a>.`; }
    else h.hidden = true;
  }
  checkDup();
  if (restored) $("#dropDraft").onclick = () => { clearDraft(); S.dirty = false; editorView(v, mode); };

  $("#tabWrite").onclick = () => { $("#tabWrite").setAttribute("aria-selected", "true"); $("#tabPreview").setAttribute("aria-selected", "false"); $("#writePane").hidden = false; $("#previewPane").hidden = true; };
  $("#tabPreview").onclick = () => { $("#tabWrite").setAttribute("aria-selected", "false"); $("#tabPreview").setAttribute("aria-selected", "true"); $("#writePane").hidden = true; const p = $("#previewPane"); p.hidden = false; p.innerHTML = body.value.trim() ? renderMd(body.value) : `<p class="muted">Zatím tu nic není.</p>`; };

  v.querySelectorAll("[data-md]").forEach(b => b.onclick = () => { mdAction(body, b.dataset.md); onInput(); });
  $("#edCancel").onclick = () => { S.dirty = false; clearDraft(); history.length > 1 ? history.back() : go("#/"); };

  $("#edForm").onsubmit = async e => {
    e.preventDefault();
    const data = current();
    if (!data.title){ title.focus(); return toast("Doplň název.", "err"); }
    if ($("#wOn").checked && !data.when){ return toast("Na ose musí mít událost rok, nebo aspoň vybraný věk.", "err"); }
    const btn = $("#edSave"); btn.disabled = true; $("#edStatus").textContent = "Ukládám…";
    const note = $("#edNote") ? $("#edNote").value.trim() : "";
    try {
      let dest;
      if (mode.kind === "approve"){
        const artId = await applyProposal(proposal, data); toast("Návrh schválen."); dest = `#/clanek/${enc(artId)}`;
      } else if (mode.kind === "proposal"){
        await updateDoc(doc(db, "proposals", proposal.id), { ...data, note, updatedAt: serverTimestamp() }); toast("Návrh uložen."); dest = `#/navrh/${enc(proposal.id)}`;
      } else if (S.admin){
        const id = await saveArticle(article ? article.id : null, data); toast(article ? "Uloženo." : "Článek založen."); dest = `#/clanek/${enc(id)}`;
      } else {
        const ref = doc(collection(db, "proposals"));
        await setDoc(ref, { ...data, type: article ? "edit" : "new", articleId: article ? article.id : null,
          baseTitle: article ? article.title : "", baseSection: article ? article.section : "", baseTags: article ? (article.tags || []) : [], baseBody: article ? (article.body || "") : "", baseWhen: article ? (article.when || null) : null, baseSession: article ? (article.session || null) : null,
          baseUpdatedMs: article ? tsMs(article.updatedAt) : 0, note, author: S.user.uid, authorName: myName(), status: "open", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        toast("Návrh odeslán vypravěči."); dest = `#/navrh/${enc(ref.id)}`;
      }
      S.dirty = false; clearDraft(); go(dest);
    } catch (err){ console.error(err); toast(errText(err), "err"); btn.disabled = false; $("#edStatus").textContent = "Neuloženo. Text zůstává v konceptu."; }
  };
}
function mdAction(ta, kind){
  const s = ta.selectionStart, e = ta.selectionEnd, sel = ta.value.slice(s, e), val = ta.value;
  let ins, cs, ce;
  const wrap = (a, b, ph) => { const t = sel || ph; ins = a + t + b; cs = s + a.length; ce = cs + t.length; };
  const line = pre => { const ls = val.lastIndexOf("\n", s - 1) + 1; ta.setRangeText(pre, ls, ls, "end"); ta.focus(); };
  switch (kind){
    case "b": wrap("**", "**", "tučný text"); break;
    case "i": wrap("_", "_", "kurzíva"); break;
    case "wiki": wrap("[[", "]]", "Název článku"); break;
    case "link": wrap("[", "](https://)", "text odkazu"); break;
    case "img": wrap("![", "](vlož odkaz na obrázek)", "popis"); break;
    case "h2": return line("## ");
    case "ul": return line("- ");
    case "q": return line("> ");
  }
  ta.setRangeText(ins, s, e, "end"); ta.setSelectionRange(cs, ce); ta.focus();
}

// --- rozdíly ---
function diffHtml(a, b){
  if (!window.Diff) return `<p class="muted">Rozdíly se nepodařilo načíst.</p>`;
  return window.Diff.diffWordsWithSpace(a, b).map(p => p.added ? `<ins>${esc(p.value)}</ins>` : p.removed ? `<del>${esc(p.value)}</del>` : esc(p.value)).join("");
}

// --- návrhy ---
function proposalsView(v){
  const all = [...S.proposals.values()].sort((a, b) => tsMs(b.createdAt) - tsMs(a.createdAt));
  const open = all.filter(p => p.status === "open"), done = all.filter(p => p.status !== "open").slice(0, 40);
  const item = p => {
    const art = p.articleId && S.articles.get(p.articleId);
    return `<li><a class="item" href="#/navrh/${enc(p.id)}"><strong>${esc(p.type === "new" ? p.title : (art ? art.title : p.baseTitle || p.title))} <span class="pill ${p.status}">${statusName(p)}</span></strong>
      <small>${p.type === "new" ? "nový článek" : "úprava"} · ${esc(p.authorName || "?")}${p.author === S.user.uid ? " (ty)" : ""} · ${fmtWhen(p.createdAt)}</small>${p.note ? `<span class="ex">${esc(p.note)}</span>` : ""}</a></li>`;
  };
  v.innerHTML = `
    <div class="head"><span class="eyebrow"><a href="#/">MalenorWiki</a></span><h1>Návrhy</h1>
      <p class="lede">${S.admin ? "Projdi návrhy hráčů. Schválený návrh se hned propíše do článku." : "Tvoje a ostatní návrhy úprav. Upravit nebo stáhnout můžeš svůj návrh, dokud ho vypravěč nevyřídí."}</p></div>
    <section class="head"><h2>Čekají na vyřízení</h2>${open.length ? `<ul class="list">${open.map(item).join("")}</ul>` : `<p class="muted">Žádný návrh nečeká.</p>`}</section>
    ${done.length ? `<section class="head"><h2>Vyřízené</h2><ul class="list">${done.map(item).join("")}</ul></section>` : ""}`;
}
const statusName = p => ({ open: "čeká", approved: "schváleno", rejected: "zamítnuto" }[p.status] || p.status);

function proposalView(v, id){
  const p = S.proposals.get(id);
  if (!p) return notFound(v, "Tento návrh neexistuje, nebo byl stažen.");
  const art = p.articleId && S.articles.get(p.articleId);
  const isEdit = p.type === "edit";
  const changedSince = isEdit && art && p.baseUpdatedMs && tsMs(art.updatedAt) > p.baseUpdatedMs + 1000;
  const cmpBody = isEdit ? (art ? art.body || "" : p.baseBody || "") : "";
  const meta = [];
  if (isEdit){
    const oldTitle = art ? art.title : p.baseTitle;
    if (p.title !== oldTitle) meta.push(`Název: <del>${esc(oldTitle)}</del> → <ins>${esc(p.title)}</ins>`);
    const oldSec = art ? art.section : p.baseSection;
    if (p.section !== oldSec) meta.push(`Sekce: ${esc(sectionOf(oldSec).name)} → ${esc(sectionOf(p.section).name)}`);
    const oldTags = (art ? art.tags : p.baseTags) || [];
    if ((p.tags || []).join("|") !== oldTags.join("|")) meta.push(`Štítky: ${esc(oldTags.join(", ") || "žádné")} → ${esc((p.tags || []).join(", ") || "žádné")}`);
    const oldWhen = art ? art.when : p.baseWhen;
    if (whenKey(oldWhen) !== whenKey(p.when)) meta.push(`Na ose: ${esc(whenSummary(oldWhen))} → ${esc(whenSummary(p.when))}`);
    const oldSess = art ? art.session : p.baseSession;
    if (sessionKey(oldSess) !== sessionKey(p.session)) meta.push(`Údaje sezení: ${esc(oldSess ? sessionMeta(cleanSession(oldSess), true) : "žádné")} → ${esc(p.session ? sessionMeta(cleanSession(p.session), true) : "žádné")}${(cleanSession(p.session) || {}).image !== (cleanSession(oldSess) || {}).image ? " · změněný obrázek" : ""}`);
  } else if (p.when) meta.push(`Na ose: ${esc(whenSummary(p.when))}`);
  const mine = p.author === S.user.uid;
  v.innerHTML = `
    <div class="head">
      <span class="eyebrow"><a href="#/navrhy">návrhy</a>${art ? ` · <a href="#/clanek/${enc(art.id)}">${esc(art.title)}</a>` : ""}</span>
      <h1>${isEdit ? "Úprava: " : "Nový článek: "}${esc(p.title)}</h1>
      <p class="lede"><span class="pill ${p.status}">${statusName(p)}</span> Navrhl ${esc(p.authorName || "?")}${mine ? " (ty)" : ""}, ${fmtWhen(p.createdAt)}. Sekce ${esc(sectionOf(p.section).name)}.</p>
    </div>
    ${p.note ? `<p class="notice"><strong>Poznámka:</strong> ${esc(p.note)}</p>` : ""}
    ${p.status === "rejected" && p.decisionNote ? `<p class="notice warn"><strong>Vypravěč:</strong> ${esc(p.decisionNote)}</p>` : ""}
    ${p.status === "approved" && p.articleId ? `<p class="notice">Schváleno. <a href="#/clanek/${enc(p.articleId)}">Zobrazit článek</a></p>` : ""}
    ${changedSince && p.status === "open" ? `<p class="notice warn">Článek se od odeslání návrhu změnil. Rozdíly níže se počítají proti dnešnímu znění, takže schválením by se mohly přepsat novější úpravy. V takovém případě použij Upravit a schválit.</p>` : ""}
    ${isEdit && !art && p.status === "open" ? `<p class="notice warn">Původní článek už neexistuje. Schválením vznikne znovu.</p>` : ""}
    ${meta.length ? `<div class="changes">${meta.map(m => `<div class="diff" style="padding:6px 10px">${m}</div>`).join("")}</div>` : ""}
    ${isEdit ? `<div class="tabs" role="tablist"><button type="button" role="tab" aria-selected="true" data-t="diff">Rozdíly</button><button type="button" role="tab" aria-selected="false" data-t="prev">Náhled</button></div>` : ""}
    <div id="propBody" class="${isEdit ? "diff" : "md"}">${isEdit ? diffHtml(cmpBody, p.body || "") : renderMd(p.body)}</div>
    <div id="propActions" class="row"></div>`;
  if (isEdit) v.querySelectorAll("[data-t]").forEach(t => t.onclick = () => {
    v.querySelectorAll("[data-t]").forEach(x => x.setAttribute("aria-selected", x === t ? "true" : "false"));
    const b = $("#propBody"); b.className = t.dataset.t === "diff" ? "diff" : "md";
    b.innerHTML = t.dataset.t === "diff" ? diffHtml(cmpBody, p.body || "") : renderMd(p.body);
  });
  const acts = $("#propActions");
  if (p.status !== "open") return;
  if (S.admin){
    acts.innerHTML = `<button type="button" class="primary" id="pApprove">Schválit</button><a class="btn" href="#/navrh/${enc(id)}/schvalit">Upravit a schválit</a><button type="button" class="danger" id="pReject">Zamítnout</button>`;
    $("#pApprove").onclick = async e => {
      e.currentTarget.disabled = true;
      try { const artId = await applyProposal(p, { title: p.title, section: p.section, tags: p.tags || [], body: p.body || "", when: cleanWhen(p.when), session: cleanSession(p.session) }); toast("Návrh schválen."); go(`#/clanek/${enc(artId)}`); }
      catch (err){ toast(errText(err), "err"); e.currentTarget.disabled = false; }
    };
    $("#pReject").onclick = () => {
      S.editing = true;
      acts.innerHTML = `<div class="field" style="flex:1 1 280px"><label for="rejNote">Důvod pro autora (nepovinné)</label><input type="text" id="rejNote" maxlength="400"></div><div class="row" style="align-self:flex-end"><button type="button" class="danger" id="rejYes">Zamítnout</button><button type="button" id="rejNo">Zpět</button></div>`;
      $("#rejNo").onclick = () => { S.editing = false; proposalView(v, id); };
      $("#rejYes").onclick = async () => {
        try { await updateDoc(doc(db, "proposals", id), { status: "rejected", decidedAt: serverTimestamp(), decidedBy: S.user.uid, decisionNote: $("#rejNote").value.trim() }); toast("Návrh zamítnut."); S.editing = false; proposalView(v, id); }
        catch (err){ toast(errText(err), "err"); }
      };
    };
  } else if (mine){
    acts.innerHTML = `<a class="btn" href="#/navrh/${enc(id)}/upravit">Upravit návrh</a><button type="button" class="danger" id="pWithdraw">Stáhnout návrh</button>`;
    $("#pWithdraw").onclick = () => {
      acts.innerHTML = `<span class="hint">Opravdu stáhnout? Návrh se smaže.</span><button type="button" class="danger" id="wYes">Stáhnout</button><button type="button" id="wNo">Ponechat</button>`;
      $("#wNo").onclick = () => proposalView(v, id);
      $("#wYes").onclick = async () => { try { await deleteDoc(doc(db, "proposals", id)); toast("Návrh stažen."); go("#/navrhy"); } catch (err){ toast(errText(err), "err"); } };
    };
  }
}

// --- vyhledávání ---
const searchInput = $("#searchInput");
$("#searchForm").addEventListener("submit", e => { e.preventDefault(); const q = searchInput.value.trim(); if (q) go(`#/hledat/${enc(q)}`); });
function search(q){
  const terms = norm(q).split(" ").filter(Boolean); if (!terms.length) return [];
  const out = [];
  for (const a of S.articles.values()){
    const t = norm(a.title), g = norm((a.tags || []).join(" ")), b = norm(a.body);
    let score = 0, ok = true;
    for (const term of terms){
      const s = (t.includes(term) ? 6 : 0) + (g.includes(term) ? 3 : 0) + (b.includes(term) ? 1 : 0);
      if (!s){ ok = false; break; } score += s;
    }
    if (t === norm(q)) score += 20;
    if (ok) out.push({ a, score });
  }
  return out.sort((x, y) => y.score - x.score || byTitle(x.a, y.a)).map(x => x.a);
}
function snippet(body, q){
  const plain = excerpt(body, 100000), n = norm(plain), term = norm(q).split(" ")[0] || "";
  const i = term ? n.indexOf(term) : -1;
  if (i < 0) return esc(excerpt(body));
  const s = Math.max(0, i - 60), e = Math.min(plain.length, i + term.length + 100);
  return (s ? "…" : "") + esc(plain.slice(s, i)) + "<mark>" + esc(plain.slice(i, i + term.length)) + "</mark>" + esc(plain.slice(i + term.length, e)) + (e < plain.length ? "…" : "");
}
function searchView(v, q){
  searchInput.value = q;
  const res = search(q);
  v.innerHTML = `<div class="head"><span class="eyebrow">hledání</span><h1>${esc(q)}</h1><p class="lede">${res.length ? `${res.length} ${plural(res.length, "výsledek", "výsledky", "výsledků")}` : "Nic nenalezeno."}</p></div>
    ${res.length ? `<ul class="list">${res.map(a => `<li><a class="item" href="#/clanek/${enc(a.id)}"><strong>${esc(a.title)}</strong><small>${esc(sectionOf(a.section).name)}</small><span class="ex">${snippet(a.body, q)}</span></a></li>`).join("")}</ul>` : ""}
    <p><a class="btn" href="#/novy/_/${enc(q)}">${S.admin ? "Založit" : "Navrhnout"} článek „${esc(q)}“</a></p>`;
}

// --- členové ---
function membersView(v){
  const reqs = [...S.requests.values()].sort((a, b) => tsMs(a.createdAt) - tsMs(b.createdAt));
  const mems = [...S.members.values()].sort((a, b) => (a.name || "").localeCompare(b.name || "", "cs"));
  v.innerHTML = `
    <div class="head"><span class="eyebrow"><a href="#/">MalenorWiki</a></span><h1>Členové</h1>
      <p class="lede">Kdo se přihlásí poprvé, objeví se tu jako žádost. Schválení členové mohou číst wiki a posílat návrhy.</p></div>
    <section class="head"><h2>Žádosti</h2>
      ${reqs.length ? `<ul class="list">${reqs.map(r => `<li><div class="item"><strong>${esc(r.name)}</strong><small>${esc(r.email)} · ${fmtWhen(r.createdAt)}</small>
        <span class="row" style="margin-top:6px"><button type="button" class="primary" data-ok="${esc(r.id)}">Schválit</button><button type="button" data-no="${esc(r.id)}">Odmítnout</button></span></div></li>`).join("")}</ul>`
        : `<p class="muted">Nikdo nečeká.</p>`}
    </section>
    <section class="head"><h2>Schválení členové</h2>
      ${mems.length ? `<ul class="list">${mems.map(m => `<li><div class="item"><strong>${esc(m.name || m.id)}</strong><small>od ${fmtWhen(m.approvedAt)}</small>
        <span class="row" style="margin-top:6px" id="m-${esc(m.id)}"><button type="button" class="ghost" data-rm="${esc(m.id)}">Odebrat</button></span></div></li>`).join("")}</ul>`
        : `<p class="muted">Zatím nikdo. Vypravěč má přístup vždy.</p>`}
    </section>`;
  v.querySelectorAll("[data-ok]").forEach(b => b.onclick = async () => {
    const r = S.requests.get(b.dataset.ok); b.disabled = true;
    try { const bt = writeBatch(db); bt.set(doc(db, "members", r.id), { name: r.name || "", approvedAt: serverTimestamp(), approvedBy: S.user.uid }); bt.delete(doc(db, "requests", r.id)); await bt.commit(); toast(`${r.name} schválen.`); }
    catch (e){ toast(errText(e), "err"); b.disabled = false; }
  });
  v.querySelectorAll("[data-no]").forEach(b => b.onclick = async () => {
    try { await deleteDoc(doc(db, "requests", b.dataset.no)); toast("Žádost odmítnuta."); } catch (e){ toast(errText(e), "err"); }
  });
  v.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => {
    const id = b.dataset.rm, box = $(`#m-${CSS.escape(id)}`);
    box.innerHTML = `<span class="hint">Odebrat přístup?</span><button type="button" class="danger" data-rmy="${esc(id)}">Odebrat</button><button type="button" data-rmn>Ponechat</button>`;
    box.querySelector("[data-rmn]").onclick = () => membersView(v);
    box.querySelector("[data-rmy]").onclick = async () => { try { await deleteDoc(doc(db, "members", id)); toast("Přístup odebrán."); } catch (e){ toast(errText(e), "err"); } };
  });
}

// ---------- historická osa ----------
const AGE_IX = Object.fromEntries(AGES.map((g, i) => [g.key, i]));
const ROMAN = ["I.", "II.", "III.", "IV.", "V.", "VI.", "VII."];
const fmtNum = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
const fmtYearM = y => (y < 0 ? fmtNum(-y) + "\u00a0př.v.v." : fmtNum(y) + "\u00a0p.v.v.");
const ageTo = g => (g.to == null ? CURRENT_YEAR : g.to);
function ageOfYear(y){ for (let i = AGES.length - 1; i >= 0; i--) if (y >= AGES[i].from) return AGES[i]; return AGES[0]; }
function eventAge(w){ if (!w) return null; if (w.age && AGE_IX[w.age] !== undefined) return AGES[AGE_IX[w.age]]; return w.year != null ? ageOfYear(w.year) : null; }
function cleanWhen(w){
  if (!w || typeof w !== "object") return null;
  const num = v => (v === "" || v == null || !Number.isFinite(+v)) ? null : Math.trunc(+v);
  const out = { age: w.age && AGE_IX[w.age] !== undefined ? w.age : null, year: num(w.year), end: num(w.end), approx: !!w.approx,
    m: num(w.m), d: num(w.d), order: num(w.order), label: String(w.label || "").trim().slice(0, 80) };
  if (out.m != null && (out.m < 0 || out.m > 11)) out.m = null;
  if (out.d != null && (out.d < 1 || out.d > 30)) out.d = null;
  if (out.m == null) out.d = null;
  if (out.year == null){ out.end = null; out.m = null; out.d = null; }
  if (out.year == null && !out.age) return null;
  return out;
}
const whenKey = w => JSON.stringify(cleanWhen(w));
function fmtEvent(w){
  w = cleanWhen(w); if (!w) return "";
  if (w.year == null) return "bez přesného data";
  let s = w.approx ? "cca " : "";
  if (w.m != null) s += (w.d ? w.d + ". " : "") + MONTHS[w.m] + " ";
  s += fmtYearM(w.year);
  if (w.end != null && w.end !== w.year) s += " – " + fmtYearM(w.end);
  return s;
}
function whenSummary(w){ w = cleanWhen(w); if (!w) return "není"; const g = eventAge(w); return (g ? g.name + ", " : "") + fmtEvent(w) + (w.label ? ` („${w.label}“)` : ""); }
function ageRange(g){
  const to = g.to;
  if (to == null) return `${fmtYearM(g.from).replace("\u00a0p.v.v.", "")} – dnes (${fmtYearM(CURRENT_YEAR)})`;
  const a = to === 0 ? fmtNum(-g.from) + "\u00a0př.v.v. – 0" : (g.from < 0 && to < 0 ? fmtNum(-g.from) + " – " + fmtYearM(to) : fmtYearM(g.from) + " – " + fmtYearM(to));
  return (g.approx ? "cca " : "") + a;
}

function timelineModel(){
  const ages = AGES.map((g, i) => ({ ...g, i, items: [] }));
  for (const a of S.articles.values()){
    const w = cleanWhen(a.when); if (!w) continue;
    const g = eventAge(w); if (!g) continue;
    ages[AGE_IX[g.key]].items.push({ a, w });
  }
  for (const g of ages){
    const from = g.from, to = ageTo(g), span = (to - from) || 1;
    const undated = g.items.filter(x => x.w.year == null).sort((x, y) => (x.w.order ?? 9999) - (y.w.order ?? 9999) || byTitle(x.a, y.a));
    undated.forEach((x, k) => { x.key = from + (k + 1) / (undated.length + 1) * span; });
    g.items.forEach(x => { if (x.w.year != null) x.key = x.w.year + ((x.w.m ?? 0) * 30 + (x.w.d ?? 0)) / 361; });
    g.items.sort((x, y) => x.key - y.key || byTitle(x.a, y.a));
    const n = g.items.length;
    g.items.forEach((x, k) => { x.pos = (k + 1) / (n + 1); });
    const anchors = [[from, 0], ...g.items.map(x => [x.key, x.pos]), [to, 1]].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    g.map = y => {
      if (y <= anchors[0][0]) return 0;
      for (let k = 1; k < anchors.length; k++){ const [y0, p0] = anchors[k - 1], [y1, p1] = anchors[k]; if (y <= y1) return y1 === y0 ? p1 : p0 + (p1 - p0) * (y - y0) / (y1 - y0); }
      return 1;
    };
  }
  const G = (i, pos) => (i + pos) / ages.length;
  for (const g of ages) for (const x of g.items){
    x.g = G(g.i, x.pos);
    if (x.w.year != null && x.w.end != null && x.w.end > x.w.year){
      const eg = ages[AGE_IX[ageOfYear(x.w.end).key]];
      x.endG = Math.max(x.g, eg.i === g.i ? G(g.i, g.map(x.w.end)) : G(eg.i, eg.map(x.w.end)));
      x.startG = G(g.i, g.map(x.w.year));
    }
  }
  const now = ages[ages.length - 1];
  return { ages, nowG: G(now.i, now.map(CURRENT_YEAR)), count: ages.reduce((s, g) => s + g.items.length, 0) };
}
function relatedSet(){
  const r = route();
  if (r[0] === "sekce") return { set: new Set([...S.articles.values()].filter(a => a.section === r[1]).map(a => a.id)), cur: null };
  if (r[0] === "clanek" || r[0] === "historie"){
    const a = S.articles.get(r[1]); if (!a) return null;
    const set = new Set([a.id]), t = norm(a.title);
    for (const tl of linksIn(a.body)){ const id = S.titleIndex.get(tl); if (id) set.add(id); }
    for (const x of S.articles.values()) if (linksIn(x.body).has(t)) set.add(x.id);
    return { set, cur: a.id };
  }
  return null;
}
const relClass = (rel, id) => !rel ? "" : (rel.cur === id ? " cur" : rel.set.has(id) ? " rel" : " dim");
const evLabel = x => x.w.label || x.a.title;
const pct = v => (v * 100).toFixed(3) + "%";

function hideTimelineChrome(){ ["#band", "#rail"].forEach(sel => { const el = $(sel); if (el) el.hidden = true; }); document.body.classList.remove("has-rail"); closeDrawer(); }
function renderTimelineChrome(){
  const band = $("#band"), rail = $("#rail");
  const M = timelineModel(), rel = relatedSet();
  const anyRel = rel && M.ages.some(g => g.items.some(x => rel.set.has(x.a.id)));
  const R = anyRel ? rel : null;
  band.hidden = false; rail.hidden = false; document.body.classList.add("has-rail");
  const n = M.ages.length;
  // vodorovný pás (počítač)
  band.innerHTML = `<div class="band-inner">
    <div class="band-track">
      ${M.ages.map(g => `<a class="band-age" href="#/osa/${g.key}" style="left:${pct(g.i / n)};width:${pct(1 / n)}" title="${esc(g.name)} · ${esc(ageRange(g))}"><span>${ROMAN[g.i]} ${esc(g.name)}</span></a>`).join("")}
      <div class="band-line"></div>
      ${M.ages.flatMap(g => g.items).filter(x => x.endG).map(x => `<span class="band-span${relClass(R, x.a.id)}" style="left:${pct(x.startG)};width:${pct(Math.max(.002, x.endG - x.startG))}"></span>`).join("")}
      ${M.ages.flatMap(g => g.items).map(x => `<a class="band-dot${relClass(R, x.a.id)}" href="#/clanek/${enc(x.a.id)}" style="left:${pct(x.g)}" data-label="${esc(evLabel(x))}${x.w.year != null ? " · " + esc(fmtEvent(x.w)) : ""}" aria-label="${esc(evLabel(x))}, ${esc(fmtEvent(x.w))}"></a>`).join("")}
      <span class="band-now" style="left:${pct(M.nowG)}" title="Dnes: ${esc(fmtYearM(CURRENT_YEAR))}"></span>
    </div>
    <a class="band-all" href="#/osa">Celá osa</a>
  </div>`;
  // svislý pruh (telefon)
  rail.innerHTML = `${M.ages.map(g => `<span class="rail-age" style="top:${pct(g.i / n)};height:${pct(1 / n)}"><b>${g.key}</b></span>`).join("")}
    ${M.ages.flatMap(g => g.items).map(x => `<i class="rail-dot${relClass(R, x.a.id)}" style="top:${pct(x.g)}"></i>`).join("")}
    <i class="rail-now" style="top:${pct(M.nowG)}"></i>`;
  if (!$("#drawer").hidden) fillDrawer();
}

function verticalTimeline(M, R, idPrefix){
  return `<ol class="vt">${M.ages.map(g => `
    <li class="vt-age" id="${idPrefix}${g.key}">
      <div class="vt-age-head"><span class="vt-roman">${ROMAN[g.i]}</span><div><strong>${esc(g.name)}</strong><small>${esc(ageRange(g))}</small></div></div>
      <ol class="vt-items">${g.items.length ? g.items.map(x => `
        <li class="vt-item${relClass(R, x.a.id)}${x.endG ? " span" : ""}"><a href="#/clanek/${enc(x.a.id)}">
          ${x.w.year != null ? `<small class="vt-date">${esc(fmtEvent(x.w))}</small>` : ""}<strong>${esc(evLabel(x))}</strong>${x.a.body ? `<span class="ex">${esc(excerpt(x.a.body, 120))}</span>` : ""}</a></li>`).join("")
        : `<li class="vt-empty">Zatím žádné události.</li>`}
        ${g.to == null ? `<li class="vt-item now"><span><small class="vt-date">${esc(fmtYearM(CURRENT_YEAR))}</small><strong>Dnes</strong></span></li>` : ""}
      </ol>
    </li>`).join("")}</ol>`;
}
function horizontalTimeline(M, R){
  const n = M.ages.length, avail = Math.max(320, (view().clientWidth || 1000) - 2), W = Math.max(avail, n * 250);
  const CARD = 176, LANE = 74;
  const items = M.ages.flatMap(g => g.items).map(x => ({ x, px: x.g * W }));
  const lastEnd = []; let maxLane = -1;
  items.forEach(it => {
    let lane = 0;
    while (lastEnd[lane] !== undefined && it.px < lastEnd[lane] + 10) lane++;
    lastEnd[lane] = it.px + CARD; it.lane = lane; maxLane = Math.max(maxLane, lane);
  });
  const above = Math.ceil((maxLane + 1) / 2), below = Math.floor((maxLane + 1) / 2);
  const axisY = 76 + Math.max(1, above) * LANE, H = axisY + 24 + Math.max(1, below) * LANE + 10;
  return `<div class="ht" style="height:${H}px"><div class="ht-inner" style="width:${W}px;height:${H}px">
    ${M.ages.map(g => `<a class="ht-age" id="hage-${g.key}" href="#/osa/${g.key}" style="left:${g.i / n * W}px;width:${W / n}px"><span class="vt-roman">${ROMAN[g.i]}</span> <strong>${esc(g.name)}</strong><small>${esc(ageRange(g))}</small></a>`).join("")}
    <div class="ht-axis" style="top:${axisY}px"></div>
    ${items.filter(it => it.x.endG).map(it => `<span class="ht-span${relClass(R, it.x.a.id)}" style="top:${axisY - 4}px;left:${it.x.startG * W}px;width:${Math.max(3, (it.x.endG - it.x.startG) * W)}px"></span>`).join("")}
    ${items.map(it => {
      const up = it.lane % 2 === 0, k = Math.floor(it.lane / 2);
      const top = up ? axisY - 14 - (k + 1) * LANE + 10 : axisY + 24 + k * LANE;
      const stem = up ? `top:${top + LANE - 18}px;height:${axisY - (top + LANE - 18)}px` : `top:${axisY}px;height:${top - axisY}px`;
      return `<span class="ht-stem${relClass(R, it.x.a.id)}" style="left:${it.px}px;${stem}"></span><i class="ht-dot${relClass(R, it.x.a.id)}" style="left:${it.px}px;top:${axisY}px"></i>
        <a class="ht-card${relClass(R, it.x.a.id)}" href="#/clanek/${enc(it.x.a.id)}" style="left:${it.px - 8}px;top:${top}px;width:${CARD}px">${it.x.w.year != null ? `<small>${esc(fmtEvent(it.x.w))}</small>` : ""}<strong>${esc(evLabel(it.x))}</strong></a>`;
    }).join("")}
    <span class="ht-now" style="left:${M.nowG * W}px;top:${axisY - 16}px" title="Dnes"></span>
  </div></div>`;
}
function timelineView(v, ageKey){
  const M = timelineModel(), R = null;
  v.innerHTML = `
    <div class="head"><span class="eyebrow"><a href="#/">MalenorWiki</a></span><h1>Historická osa</h1>
      <p class="lede">Události se na osu dostanou z článků, které mají vyplněné datum. Klepnutím na událost otevřeš článek.</p></div>
    ${M.count === 0 ? `<p class="notice">Na ose zatím nic není.${S.admin ? ` Můžeš nahrát ${SEED_EVENTS.length} událostí z dokumentu Historická osa Malenoru jako články v sekci Dějiny. <span class="row" style="margin-top:8px"><button type="button" class="primary" id="seedBtn">Nahrát události</button></span>` : " Datum přidáš v editoru článku."}</p>` : ""}
    <div class="ht-wrap">${horizontalTimeline(M, R)}</div>
    <div class="vt-wrap">${verticalTimeline(M, R, "age-")}</div>`;
  if (ageKey){ const el = document.getElementById(window.matchMedia("(min-width: 900px)").matches ? "hage-" + ageKey : "age-" + ageKey); if (el) el.scrollIntoView({ block: "nearest", inline: "start" }); }
  const sb = $("#seedBtn"); if (sb) sb.onclick = seedTimeline;
}

// kalendář a Časinka uvnitř wiki
function calendarView(v){
  S.editing = true; // nepřekreslovat, jinak by se kalendář načítal znovu
  v.innerHTML = `<div class="head"><span class="eyebrow"><a href="#/">MalenorWiki</a></span><h1>Kalendář a Časinka</h1>
    <p class="lede">Převod data, tváře, svátky, fáze dvojčat a malenorský čas.</p></div>
    <iframe class="cal-frame" id="calFrame" src="kalendar.html?embed=1&amp;v=5" title="Kalendář Malenoru"></iframe>`;
  const f = $("#calFrame");
  const fit = () => { try { const d = f.contentDocument; if (d && d.documentElement) f.style.height = d.documentElement.scrollHeight + "px"; } catch (e) {} };
  f.addEventListener("load", () => {
    fit();
    try { new ResizeObserver(fit).observe(f.contentDocument.body); } catch (e) {}
    try { f.contentDocument.querySelectorAll('a[href^="./"]').forEach(a => { a.target = "_top"; }); } catch (e) {}
  });
}

// mobilní vysouvací osa
function openDrawer(){ fillDrawer(); $("#drawer").hidden = false; $("#scrim").hidden = false; $("#rail").setAttribute("aria-expanded", "true");
  const c = $("#drawerBody .vt-item.cur") || $("#drawerBody .vt-item.rel"); if (c) c.scrollIntoView({ block: "center" }); }
function closeDrawer(){ const d = $("#drawer"); if (!d || d.hidden) return; d.hidden = true; $("#scrim").hidden = true; $("#rail").setAttribute("aria-expanded", "false"); }
function fillDrawer(){ const M = timelineModel(), rel = relatedSet(); $("#drawerBody").innerHTML = verticalTimeline(M, rel, "dage-"); }
$("#rail").addEventListener("click", openDrawer);
$("#drawerClose").addEventListener("click", closeDrawer);
$("#scrim").addEventListener("click", closeDrawer);
document.addEventListener("keydown", e => { if (e.key === "Escape") closeDrawer(); });
new ResizeObserver(() => document.documentElement.style.setProperty("--hdr", $(".top").offsetHeight + "px")).observe($(".top"));
let wideMq = window.matchMedia("(min-width: 900px)");
wideMq.addEventListener("change", () => { if (route()[0] === "osa" && !S.editing) renderMain(); });

// editor: datum na ose
function whenFieldsHTML(w){
  w = cleanWhen(w);
  const on = !!w, y = w && w.year != null ? w.year : null, e = w && w.end != null ? w.end : null;
  const era = v => v != null && v < 0 ? "-1" : "1";
  const eraSel = (id, v) => `<select id="${id}" aria-label="Letopočet"><option value="-1"${era(v) === "-1" ? " selected" : ""}>př.v.v.</option><option value="1"${era(v) === "1" ? " selected" : ""}>p.v.v.</option></select>`;
  return `<fieldset class="whenbox" id="whenBox">
    <legend>Na historické ose</legend>
    <label class="chk"><input type="checkbox" id="wOn"${on ? " checked" : ""}> Zobrazit na ose</label>
    <div class="when-grid" id="wFields"${on ? "" : " hidden"}>
      <div class="field"><label for="wYear">Rok</label><div class="row nowrap"><input type="number" id="wYear" min="0" inputmode="numeric" value="${y != null ? Math.abs(y) : ""}">${eraSel("wEra", y)}</div></div>
      <div class="field"><label for="wEnd">Trvalo do roku</label><div class="row nowrap"><input type="number" id="wEnd" min="0" inputmode="numeric" value="${e != null ? Math.abs(e) : ""}">${eraSel("wEndEra", e)}</div></div>
      <div class="field"><label for="wM">Tvář</label><select id="wM"><option value="">—</option>${MONTHS.map((m, i) => `<option value="${i}"${w && w.m === i ? " selected" : ""}>${i + 1}. ${m}</option>`).join("")}</select></div>
      <div class="field"><label for="wD">Den</label><input type="number" id="wD" min="1" max="30" inputmode="numeric" value="${w && w.d != null ? w.d : ""}"></div>
      <div class="field"><label for="wAge">Věk</label><select id="wAge"><option value="">Podle roku</option>${AGES.map(g => `<option value="${g.key}"${w && w.age === g.key ? " selected" : ""}>${ROMAN[AGE_IX[g.key]]} ${esc(g.name)}</option>`).join("")}</select></div>
      <div class="field"><label for="wOrder">Pořadí ve věku</label><input type="number" id="wOrder" inputmode="numeric" value="${w && w.order != null ? w.order : ""}" placeholder="jen bez roku"></div>
      <label class="chk"><input type="checkbox" id="wApprox"${w && w.approx ? " checked" : ""}> přibližně (cca)</label>
      <div class="field wide"><label for="wLabel">Popisek na ose</label><input type="text" id="wLabel" maxlength="80" value="${esc(w && w.label || "")}" placeholder="nepovinné, jinak se použije název článku"></div>
    </div>
    <p class="hint" id="wPreview"></p>
  </fieldset>`;
}
function readWhen(){
  if (!$("#wOn") || !$("#wOn").checked) return null;
  const val = id => $(id).value.trim();
  const yr = (id, eraId) => { const v = val(id); if (v === "" || !Number.isFinite(+v)) return null; return Math.abs(Math.trunc(+v)) * (+$(eraId).value < 0 ? -1 : 1); };
  return cleanWhen({ year: yr("#wYear", "#wEra"), end: yr("#wEnd", "#wEndEra"), m: val("#wM"), d: val("#wD"), age: val("#wAge") || null,
    order: val("#wOrder"), approx: $("#wApprox").checked, label: val("#wLabel") });
}
function updateWhenUI(){
  const on = $("#wOn"); if (!on) return;
  $("#wFields").hidden = !on.checked;
  const w = readWhen(), p = $("#wPreview");
  if (!on.checked){ p.textContent = ""; return; }
  if (!w){ p.textContent = "Zadej rok, nebo aspoň vyber věk."; return; }
  const g = eventAge(w);
  p.textContent = `Na ose: ${g ? g.name + " · " : ""}${fmtEvent(w)}`;
}

// ---------- deník kampaně: údaje sezení ----------
function imgUrl(u){
  u = String(u || "").trim();
  if (!/^(https?:\/\/|img\/)/i.test(u)) return "";
  const m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]{10,})/);
  return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1600` : u;
}
function cleanSession(x){
  if (!x || typeof x !== "object") return null;
  const num = v => (v === "" || v == null || !Number.isFinite(+v)) ? null : Math.trunc(+v);
  const str = (v, n) => String(v || "").trim().slice(0, n);
  const chars = Array.isArray(x.characters) ? x.characters : String(x.characters || "").split(",");
  const out = { adventure: str(x.adventure, 80), no: num(x.no), played: /^\d{4}-\d{2}-\d{2}$/.test(x.played || "") ? x.played : "",
    year: num(x.year), m: num(x.m), d: num(x.d), place: str(x.place, 100),
    characters: [...new Set(chars.map(c => String(c).trim()).filter(Boolean))].slice(0, 20),
    image: imgUrl(x.image) ? str(x.image, 500) : "", caption: str(x.caption, 160) };
  if (out.m != null && (out.m < 0 || out.m > 11)) out.m = null;
  if (out.d != null && (out.d < 1 || out.d > 30)) out.d = null;
  if (out.year == null){ out.m = null; out.d = null; }
  if (out.m == null) out.d = null;
  const empty = !out.adventure && out.no == null && !out.played && out.year == null && !out.place && !out.characters.length && !out.image && !out.caption;
  return empty ? null : out;
}
const sessionKey = x => JSON.stringify(cleanSession(x));
function fmtGameDate(s){ if (!s || s.year == null) return ""; return (s.m != null ? (s.d ? s.d + ". " : "") + MONTHS[s.m] + " " : "") + fmtYearM(s.year); }
function fmtPlayed(iso){ const [y, m, d] = String(iso).split("-"); return y ? `${+d}. ${+m}. ${y}` : ""; }
function sessionMeta(s, long){
  s = cleanSession(s); if (!s) return "";
  const parts = [];
  if (s.adventure) parts.push(s.adventure);
  if (s.no != null) parts.push(`sezení ${s.no}`);
  if (s.year != null) parts.push(fmtGameDate(s));
  if (s.place) parts.push(s.place);
  if (long && s.played) parts.push(`hráno ${fmtPlayed(s.played)}`);
  if (long && s.characters.length) parts.push(s.characters.join(", "));
  return parts.join(" · ");
}
function byChapter(a, b){
  const sa = cleanSession(a.session) || {}, sb = cleanSession(b.session) || {};
  const na = sa.no ?? 1e9, nb = sb.no ?? 1e9;
  if (na !== nb) return na - nb;
  const ga = sa.year != null ? sa.year * 400 + (sa.m ?? 0) * 31 + (sa.d ?? 0) : 1e12, gb = sb.year != null ? sb.year * 400 + (sb.m ?? 0) * 31 + (sb.d ?? 0) : 1e12;
  if (ga !== gb) return ga - gb;
  return tsMs(a.createdAt) - tsMs(b.createdAt) || byTitle(a, b);
}
function sessionFieldsHTML(x, sec){
  const s = cleanSession(x) || {};
  const advs = [...new Set([...S.articles.values()].map(a => a.session && a.session.adventure).filter(Boolean))].sort((p, q) => p.localeCompare(q, "cs"));
  const nextNo = 1 + Math.max(0, ...[...S.articles.values()].map(a => (a.session && Number.isFinite(+a.session.no)) ? +a.session.no : 0));
  return `<fieldset class="whenbox" id="sessBox"${sec === "kampan" ? "" : " hidden"}>
    <legend>Údaje sezení</legend>
    <div class="when-grid">
      <div class="field"><label for="sAdv">Dobrodružství</label><input type="text" id="sAdv" list="advList" maxlength="80" value="${esc(s.adventure || "")}" placeholder="např. Vranov"></div>
      <div class="field"><label for="sNo">Číslo sezení</label><input type="number" id="sNo" min="0" inputmode="numeric" value="${s.no != null ? s.no : ""}" placeholder="${nextNo}"></div>
      <div class="field"><label for="sPlayed">Datum hraní</label><input type="date" id="sPlayed" value="${esc(s.played || "")}"></div>
      <div class="field"><label for="sYear">Herní rok (p.v.v.)</label><input type="number" id="sYear" min="0" inputmode="numeric" value="${s.year != null ? s.year : ""}" placeholder="${CURRENT_YEAR}"></div>
      <div class="field"><label for="sM">Tvář</label><select id="sM"><option value="">—</option>${MONTHS.map((m, i) => `<option value="${i}"${s.m === i ? " selected" : ""}>${i + 1}. ${m}</option>`).join("")}</select></div>
      <div class="field"><label for="sD">Den</label><input type="number" id="sD" min="1" max="30" inputmode="numeric" value="${s.d != null ? s.d : ""}"></div>
      <div class="field wide"><label for="sPlace">Místo děje</label><input type="text" id="sPlace" maxlength="100" value="${esc(s.place || "")}" placeholder="např. Vranov, Taverna u Say'jaxe"></div>
      <div class="field wide"><label for="sChars">Postavy, oddělené čárkou</label><input type="text" id="sChars" maxlength="400" value="${esc((s.characters || []).join(", "))}"></div>
      <div class="field wide"><label for="sImg">Obrázek scény (odkaz)</label><input type="text" id="sImg" maxlength="500" value="${esc(s.image || "")}" placeholder="odkaz na obrázek, třeba z Google Disku"></div>
      <div class="field wide"><label for="sCap">Popisek obrázku</label><input type="text" id="sCap" maxlength="160" value="${esc(s.caption || "")}"></div>
    </div>
    <datalist id="advList">${advs.map(a => `<option value="${esc(a)}">`).join("")}</datalist>
    <p class="hint">Sezení se na historickou osu nedostane samo. Pokud změnilo dějiny, zaškrtni níže „Zobrazit na ose“. Herní datum se předvyplní.</p>
  </fieldset>`;
}
function readSession(){
  if (!$("#sessBox")) return null;
  const v = id => $(id).value.trim();
  return cleanSession({ adventure: v("#sAdv"), no: v("#sNo"), played: v("#sPlayed"), year: v("#sYear"), m: v("#sM"), d: v("#sD"),
    place: v("#sPlace"), characters: v("#sChars"), image: v("#sImg"), caption: v("#sCap") });
}

// ---------- kniha kampaně ----------
const BK = { pages: [], idx: 0, wide: false, busy: false, chapterStart: new Map(), resizeT: null };
const ORN = `<svg class="orn" viewBox="0 0 200 16" aria-hidden="true"><path d="M8 8H82M118 8H192" stroke="currentColor" stroke-width="1"/><path d="M100 1.5 107 8 100 14.5 93 8Z" fill="currentColor"/><circle cx="87" cy="8" r="2" fill="currentColor"/><circle cx="113" cy="8" r="2" fill="currentColor"/></svg>`;
const CORNER = `<svg viewBox="0 0 60 60" aria-hidden="true"><path d="M4 58V22Q4 4 22 4H58" fill="none" stroke="currentColor" stroke-width="2"/><path d="M11 58V27Q11 11 27 11H58" fill="none" stroke="currentColor" stroke-width="1"/><circle cx="22" cy="22" r="3.6" fill="currentColor"/><path d="M13 22a9 9 0 0 1 9-9" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M22 31a9 9 0 0 1-9-9" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>`;
const bookChapters = () => [...S.articles.values()].filter(a => a.section === "kampan").sort(byChapter);
const pageAt = i => (BK.pages[i] ? BK.pages[i].html : `<div class="pg blank"></div>`);
const bookmarkKey = () => `malenorwiki:kniha:${S.user ? S.user.uid : "_"}`;

function bookView(v, startId){
  S.editing = true;
  v.innerHTML = `<div class="book-wrap" id="bookWrap">
      <div class="book-stage" id="bookStage"><p class="muted">Otevírám knihu…</p></div>
      <div class="book-bar">
        <button type="button" id="bkPrev" aria-label="Předchozí strana">‹ Zpět</button>
        <label class="sr" for="bkToc">Přejít na kapitolu</label><select id="bkToc"></select>
        <span class="bk-pg" id="bkPg"></span>
        <a class="btn" id="bkArt" hidden>Otevřít jako článek</a>
        <button type="button" id="bkNext" aria-label="Další strana">Dál ›</button>
      </div>
      <div class="pg measure" id="bkMeasure" aria-hidden="true"><div class="pg-head">&nbsp;</div><div class="pg-body"></div><div class="pg-foot">&nbsp;</div></div>
    </div>`;
  $("#bkPrev").onclick = () => turn(-1);
  $("#bkNext").onclick = () => turn(1);
  $("#bkToc").onchange = e => jump(+e.target.value);
  const stage = $("#bookStage");
  stage.addEventListener("click", e => {
    if (e.target.closest("a, button, select, input")){ const g = e.target.closest("[data-goto]"); if (g){ e.preventDefault(); jump(+g.dataset.goto); } return; }
    const r = stage.querySelector(".book").getBoundingClientRect();
    turn(e.clientX < r.left + r.width / 2 ? -1 : 1);
  });
  let tx = null, ty = null;
  stage.addEventListener("touchstart", e => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
  stage.addEventListener("touchend", e => {
    if (tx == null) return;
    const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty; tx = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4){ e.preventDefault(); turn(dx < 0 ? 1 : -1); }
  });
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => layoutBook(startId ? { chapter: startId, offset: 0 } : loadBookmark()));
}
function loadBookmark(){ try { return JSON.parse(localStorage.getItem(bookmarkKey()) || "null"); } catch (e) { return null; } }
function saveBookmark(){ const p = BK.pages[BK.idx]; if (!p) return; const c = p.chapter; const off = c ? BK.idx - (BK.chapterStart.get(c) || 0) : 0; try { localStorage.setItem(bookmarkKey(), JSON.stringify({ chapter: c || null, page: BK.idx, offset: off })); } catch (e) {} }

function layoutBook(pos){
  const stage = $("#bookStage"), wrap = $("#bookWrap"); if (!stage) return;
  const hdr = $(".top").offsetHeight, stageW = stage.clientWidth;
  const availH = Math.max(440, window.innerHeight - hdr - 64 - 36);
  BK.wide = window.innerWidth >= 900 && stageW >= 760;
  let pw, ph;
  if (BK.wide){ pw = Math.floor(Math.min((stageW - 8) / 2, 500)); ph = Math.floor(Math.min(availH, pw * 1.48)); if (ph < pw * 1.2) pw = Math.floor(ph / 1.2); }
  else { pw = Math.floor(Math.min(stageW, 560)); ph = Math.floor(Math.min(availH, pw * 1.75)); }
  wrap.style.setProperty("--pw", pw + "px"); wrap.style.setProperty("--ph", ph + "px");
  wrap.style.setProperty("--bfs", (BK.wide ? Math.max(14, Math.min(16.5, pw / 30)) : Math.max(15, Math.min(17, pw / 23))).toFixed(1) + "px");
  BK.pw = pw; BK.ph = ph;
  buildPages();
  // pozice
  let idx = 0;
  if (pos && pos.chapter && BK.chapterStart.has(pos.chapter)) idx = BK.chapterStart.get(pos.chapter) + Math.max(0, pos.offset || 0);
  else if (pos && Number.isFinite(pos.page)) idx = pos.page;
  BK.idx = Math.max(0, Math.min(BK.pages.length - 1, idx));
  if (BK.wide) BK.idx = 2 * Math.ceil(BK.idx / 2);
  stage.innerHTML = BK.wide
    ? `<div class="book wide" id="book"><div class="half left" id="bL"></div><div class="half right" id="bR"></div><div class="leaf" id="leaf" hidden><div class="face front"></div><div class="face back"></div></div></div>`
    : `<div class="book single" id="book"><div class="half right" id="bR"></div><div class="leaf single" id="leaf" hidden><div class="face front"></div><div class="face back"></div></div></div>`;
  $("#bkToc").innerHTML = `<option value="0">Obálka</option>${BK.tocStart != null ? `<option value="${BK.tocStart}">Obsah</option>` : ""}` +
    bookChapters().map(a => BK.chapterStart.has(a.id) ? `<option value="${BK.chapterStart.get(a.id)}">${a.session && a.session.no != null ? a.session.no + ". " : ""}${esc(a.title)}</option>` : "").join("");
  showStatic();
}

function buildPages(){
  const m = $("#bkMeasure"), body = m.querySelector(".pg-body");
  const H = body.clientHeight;
  if (H < 120){ BK.pages = [{ chapter: null, cover: true, html: coverHTML() }]; BK.chapterStart = new Map(); BK.tocStart = null; return; }
  const fits = () => body.scrollHeight <= H + 1;
  const pages = []; let meta = null;
  const start = mt => { body.innerHTML = ""; meta = mt; };
  const finish = () => { if (meta) pages.push({ ...meta, body: body.innerHTML }); meta = null; body.innerHTML = ""; };
  function splitToFit(node){
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT), bounds = []; let t;
    while ((t = walker.nextNode())){ const re = /\S+/g; let mm; while ((mm = re.exec(t.data))) bounds.push([t, mm.index + mm[0].length]); }
    if (bounds.length < 2) return [null, node];
    const part = k => { const r = document.createRange(); r.setStart(node, 0); r.setEnd(bounds[k][0], bounds[k][1]); const el = node.cloneNode(false); el.appendChild(r.cloneContents()); return el; };
    let lo = 0, hi = bounds.length - 2, best = -1;
    while (lo <= hi){ const mid = (lo + hi) >> 1, el = part(mid); body.appendChild(el); const ok = fits(); body.removeChild(el); if (ok){ best = mid; lo = mid + 1; } else hi = mid - 1; }
    if (best < 1 && bounds.length > 6) return [null, node];
    if (best < 0) return [null, node];
    const first = part(best);
    const r2 = document.createRange(); r2.setStart(bounds[best][0], bounds[best][1]); r2.setEnd(node, node.childNodes.length);
    const rest = node.cloneNode(false); rest.appendChild(r2.cloneContents()); rest.classList.add("cont"); rest.classList.remove("dropcap");
    return [first, rest.textContent.trim() ? rest : null];
  }
  function add(node, guard = 0){
    body.appendChild(node);
    if (fits() || guard > 60) return;
    body.removeChild(node);
    const empty = !body.children.length;
    const solid = /^H[1-6]$/.test(node.tagName) || node.classList.contains("nosplit") || node.tagName === "FIGURE" || node.tagName === "HR" || node.tagName === "TABLE" || node.querySelector("img");
    if (solid){
      if (empty){ body.appendChild(node); return; }
      const carry = keepWithNext(); const mt = meta; finish(); start(mt); carry.forEach(c => body.appendChild(c)); add(node, guard + 1); return;
    }
    const [a, b] = splitToFit(node);
    let carry = [];
    if (a) body.appendChild(a); else carry = keepWithNext();
    const mt = meta; finish(); start(mt); carry.forEach(c => body.appendChild(c));
    if (b) add(b, guard + 1);
  }
  function keepWithNext(){
    const last = body.lastElementChild;
    if (last && body.children.length > 1 && (/^H[1-6]$/.test(last.tagName) || last.classList.contains("ch-head"))){ body.removeChild(last); return [last]; }
    return [];
  }
  const chs = bookChapters();
  const imgH = Math.round(Math.min(H * 0.42, BK.pw * 0.62));
  // kapitoly (nejdřív bez obsahu, abychom znali čísla stran)
  const chapterPages = [];
  for (const a of chs){
    const s = cleanSession(a.session) || {};
    start({ chapter: a.id, head: a.title });
    const first = pages.length;
    const head = document.createElement("div"); head.className = "ch-head nosplit";
    head.innerHTML = `<small>${esc([s.adventure, s.no != null ? "Sezení " + s.no : ""].filter(Boolean).join(" · "))}</small><h2>${esc(a.title)}</h2>
      ${s.year != null || s.place ? `<div class="ch-date">${esc([fmtGameDate(s), s.place].filter(Boolean).join(" · "))}</div>` : ""}
      ${s.characters && s.characters.length ? `<div class="ch-chars">${esc(s.characters.join(", "))}</div>` : ""}${ORN}`;
    add(head);
    if (s.image){
      const fig = document.createElement("figure"); fig.className = "scene-pg nosplit";
      fig.innerHTML = `<img src="${esc(imgUrl(s.image))}" alt="${esc(s.caption || a.title)}" style="height:${imgH}px" referrerpolicy="no-referrer">${s.caption ? `<figcaption>${esc(s.caption)}</figcaption>` : ""}`;
      add(fig);
    }
    const tmp = document.createElement("div"); tmp.innerHTML = a.body ? renderMd(a.body) : `<p class="muted">Kapitola zatím nemá text.</p>`;
    tmp.querySelectorAll("img").forEach(im => { im.style.height = Math.round(H * 0.36) + "px"; im.style.objectFit = "contain"; im.style.width = "100%"; });
    let firstP = true;
    [...tmp.children].forEach(el => { if (firstP && el.tagName === "P"){ el.classList.add("dropcap"); firstP = false; } add(el); });
    finish();
    chapterPages.push([a.id, first]);
  }
  const chPages = pages.splice(0);
  // závěrečná strana
  start({ chapter: null, head: "" });
  body.innerHTML = `<div class="end-pg">${ORN}<p>${chs.length ? "Příběh pokračuje…" : "Kniha zatím nemá žádnou kapitolu."}</p>${!chs.length ? `<p><a href="#/novy/kampan">${S.admin ? "Napsat první kapitolu" : "Navrhnout první kapitolu"}</a></p>` : ""}</div>`;
  finish();
  const endPage = pages.splice(0);
  // obsah
  const tocHTML = (offset) => {
    let lastAdv = null, rows = "";
    for (const [id, idx] of chapterPages){
      const a = S.articles.get(id), s = cleanSession(a.session) || {};
      if (s.adventure && s.adventure !== lastAdv){ rows += `<div class="toc-adv">${esc(s.adventure)}</div>`; lastAdv = s.adventure; }
      rows += `<a class="toc-row" href="#/kniha/${enc(id)}" data-goto="${offset + idx}"><span class="toc-t">${s.no != null ? `<b>${s.no}.</b> ` : ""}${esc(a.title)}${s.year != null ? `<small>${esc(fmtGameDate(s))}</small>` : ""}</span><span class="toc-p">${offset + idx}</span></a>`;
    }
    return rows;
  };
  const tocPaginate = (offset) => {
    start({ chapter: null, head: "Obsah", toc: true });
    const h = document.createElement("h2"); h.className = "toc-h"; h.textContent = "Obsah"; add(h);
    const tmp = document.createElement("div"); tmp.innerHTML = tocHTML(offset) || `<p class="muted">Zatím žádné kapitoly.</p>`;
    [...tmp.children].forEach(el => { el.classList.add("nosplit"); add(el); });
    finish();
    return pages.splice(0);
  };
  let toc = tocPaginate(1 + 1);
  toc = tocPaginate(1 + toc.length);
  const all = [{ chapter: null, cover: true }, ...toc, ...chPages, ...endPage];
  BK.tocStart = 1;
  BK.chapterStart = new Map(chapterPages.map(([id, i]) => [id, 1 + toc.length + i]));
  BK.pages = all.map((p, i) => ({ ...p, html: p.cover ? coverHTML() : `<div class="pg${i % 2 ? " verso" : " recto"}"><div class="pg-head">${esc(p.head || BOOK.title)}</div><div class="pg-body">${p.body}</div><div class="pg-foot">${i}</div></div>` }));
  body.innerHTML = "";
}
function coverHTML(){
  return `<div class="pg cover"><div class="cover-frame">${["tl", "tr", "bl", "br"].map(c => `<span class="corner ${c}">${CORNER}</span>`).join("")}
    <div class="cover-title"><small>${esc(BOOK.subtitle)}</small><h1>${esc(BOOK.title)}</h1>${ORN}<span class="cover-hint">Klepni na pravou stranu a otevři knihu</span></div></div></div>`;
}
function showStatic(){
  const n = BK.pages.length, L = $("#bL"), R = $("#bR"), book = $("#book"); if (!R) return;
  if (BK.wide){
    const s = BK.idx / 2;
    book.classList.toggle("closed", s === 0);
    L.innerHTML = s === 0 ? "" : pageAt(2 * s - 1); R.innerHTML = pageAt(2 * s);
    $("#bkPg").textContent = s === 0 ? `obálka · ${n - 1} stran` : `strany ${2 * s - 1}–${Math.min(2 * s, n - 1)} z ${n - 1}`;
    $("#bkPrev").disabled = s === 0; $("#bkNext").disabled = 2 * s >= n - 1;
  } else {
    R.innerHTML = pageAt(BK.idx);
    $("#bkPg").textContent = BK.idx === 0 ? `obálka · ${n - 1} stran` : `strana ${BK.idx} z ${n - 1}`;
    $("#bkPrev").disabled = BK.idx === 0; $("#bkNext").disabled = BK.idx >= n - 1;
  }
  const visible = BK.wide ? [BK.idx - 1, BK.idx] : [BK.idx];
  const ch = visible.map(i => BK.pages[i] && BK.pages[i].chapter).filter(Boolean).pop();
  const art = $("#bkArt");
  if (ch){ art.hidden = false; art.href = `#/clanek/${enc(ch)}`; } else art.hidden = true;
  const sel = $("#bkToc"); let best = "0";
  [...sel.options].forEach(o => { if (+o.value <= Math.max(...visible)) best = o.value; });
  sel.value = best;
  saveBookmark();
}
function jump(i){ if (BK.busy) return; BK.idx = Math.max(0, Math.min(BK.pages.length - 1, i)); if (BK.wide) BK.idx = 2 * Math.ceil(BK.idx / 2); showStatic(); }
function turn(dir){
  if (BK.busy || !$("#book")) return;
  const n = BK.pages.length, leaf = $("#leaf"), f = leaf.querySelector(".front"), b = leaf.querySelector(".back");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const run = (from, to, done) => {
    BK.busy = true; leaf.hidden = false;
    leaf.style.transition = "none"; leaf.style.transform = `rotateY(${from}deg)`;
    void leaf.offsetWidth;
    leaf.style.transition = ""; leaf.style.transform = `rotateY(${to}deg)`;
    let fin = false; const end = () => { if (fin) return; fin = true; leaf.hidden = true; BK.busy = false; done(); };
    leaf.addEventListener("transitionend", end, { once: true }); setTimeout(end, 1100);
  };
  if (BK.wide){
    const s = BK.idx / 2, maxS = Math.ceil((n - 1) / 2);
    if ((dir > 0 && s >= maxS) || (dir < 0 && s <= 0)) return;
    if (reduce){ BK.idx += dir * 2; return showStatic(); }
    const L = $("#bL"), R = $("#bR");
    if (dir > 0){ leaf.className = "leaf right"; f.innerHTML = pageAt(2 * s); b.innerHTML = pageAt(2 * s + 1); R.innerHTML = pageAt(2 * s + 2); run(0, -180, () => { BK.idx += 2; showStatic(); }); }
    else { leaf.className = "leaf left"; f.innerHTML = pageAt(2 * s - 1); b.innerHTML = pageAt(2 * s - 2); L.innerHTML = s - 1 === 0 ? "" : pageAt(2 * s - 3); if (s - 1 === 0) $("#book").classList.add("closing"); run(0, 180, () => { $("#book").classList.remove("closing"); BK.idx -= 2; showStatic(); }); }
  } else {
    if ((dir > 0 && BK.idx >= n - 1) || (dir < 0 && BK.idx <= 0)) return;
    if (reduce){ BK.idx += dir; return showStatic(); }
    const R = $("#bR"); leaf.className = "leaf single"; b.innerHTML = `<div class="pg blank back-of"></div>`;
    if (dir > 0){ f.innerHTML = pageAt(BK.idx); R.innerHTML = pageAt(BK.idx + 1); run(0, -180, () => { BK.idx += 1; showStatic(); }); }
    else { f.innerHTML = pageAt(BK.idx - 1); run(-180, 0, () => { BK.idx -= 1; showStatic(); }); }
  }
}
document.addEventListener("keydown", e => {
  if (route()[0] !== "kniha" || !$("#book") || e.target.closest("input, textarea, select")) return;
  if (e.key === "ArrowRight" || e.key === "PageDown"){ e.preventDefault(); turn(1); }
  if (e.key === "ArrowLeft" || e.key === "PageUp"){ e.preventDefault(); turn(-1); }
});
window.addEventListener("resize", () => {
  if (route()[0] !== "kniha" || !$("#book")) return;
  clearTimeout(BK.resizeT);
  BK.resizeT = setTimeout(() => { const p = BK.pages[BK.idx]; const c = p && p.chapter; layoutBook(c ? { chapter: c, offset: BK.idx - BK.chapterStart.get(c) } : { page: BK.idx }); }, 250);
});

// import událostí z dokumentu Historická osa Malenoru
const SEED_EVENTS = [
  ["I", "Dopad Korinského impaktoru"], ["I", "Doba ledová"], ["I", "Vymírání ras / zánik prvního světa"],
  ["II", "Zachycení Garusu na oběžné dráze Malenoru", { year: -52002 }], ["II", "Vystavění létajícího města Sartixikathum"], ["II", "První vpád ze Stínozemí"], ["II", "Prokletí drow"], ["II", "Runové války a zničení světotvorných run"],
  ["III", "Otevření průrvy a příchod lidí"], ["III", "Vznik nových říší"], ["III", "Stavba dračího města na Rigusu"], ["III", "Válka Křídel a Pěstí"], ["III", "Zasazení sporu elfů a trpaslíků"],
  ["IV", "Ďábelsko-démonický vpád na Korin"], ["IV", "Odchod tieflingů na Talju"], ["IV", "Vznik technomagických věží"], ["IV", "Vrchol lidských říší a technomagického věku"], ["IV", "Velká válka", { year: -593, end: 0 }],
  ["V", "Konec Velké války", { year: 0 }], ["V", "Založení Korinského Triarchátu"], ["V", "Ustanovení Preatorů jako soudní a výkonné moci"], ["V", "Ustanovení správcovských měst a jmenování správců"], ["V", "Současné napětí a návrat starých hrozeb"]
];
async function seedTimeline(e){
  const btn = e.currentTarget; btn.disabled = true;
  try {
    const ts = serverTimestamp(), uid = S.user.uid, name = myName(), b = writeBatch(db);
    const order = {};
    let created = 0;
    for (const [age, title, extra] of SEED_EVENTS){
      order[age] = (order[age] || 0) + 1;
      const existing = S.titleIndex.get(norm(title));
      const when = cleanWhen({ age, order: order[age], ...(extra || {}) });
      if (existing){ if (!S.articles.get(existing).when) b.update(doc(db, "articles", existing), { when }); continue; }
      b.set(doc(collection(db, "articles")), { title, section: "dejiny", tags: [], body: "", when,
        createdAt: ts, createdBy: uid, createdByName: name, updatedAt: ts, updatedBy: uid, updatedByName: name, contributors: [uid] });
      created++;
    }
    await b.commit();
    toast(`Nahráno ${created} událostí.`);
  } catch (err){ toast(errText(err), "err"); btn.disabled = false; }
}

render();
