// MalenorWiki – deníky postav, výbava, zápisky a knihovna kouzel a schopností (pravidla JaD).
import { HOMEBREW_FEATURES, RACES } from "./homebrew.js?v=15";

export function initChars(ctx){
  const { db, S, $, esc, enc, norm, toast, errText, renderMd, go, route, myName, fmtWhen, tsMs, fs } = ctx;
  const { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, query, where, serverTimestamp, writeBatch } = fs;

  // ---------- pravidla ----------
  const ABIL = [["sila", "Síla"], ["obr", "Obratnost"], ["odol", "Odolnost"], ["int", "Inteligence"], ["mou", "Moudrost"], ["cha", "Charisma"]];
  const ABN = Object.fromEntries(ABIL);
  const SKILLS = [["atletika", "Atletika", "sila"], ["akrobacie", "Akrobacie", "obr"], ["cachry", "Čachry", "obr"], ["nenapadnost", "Nenápadnost", "obr"],
    ["historie", "Historie", "int"], ["mystika", "Mystika", "int"], ["nabozenstvi", "Náboženství", "int"], ["patrani", "Pátrání", "int"], ["priroda", "Příroda", "int"],
    ["lekarstvi", "Lékařství", "mou"], ["ovladani", "Ovládání zvířat", "mou"], ["preziti", "Přežití", "mou"], ["vhled", "Vhled", "mou"], ["vnimani", "Vnímání", "mou"],
    ["klamani", "Klamání", "cha"], ["presvedcovani", "Přesvědčování", "cha"], ["vystupovani", "Vystupování", "cha"], ["zastrasovani", "Zastrašování", "cha"]];
  const PASSIVE = ["atletika", "akrobacie", "nenapadnost", "vhled", "vnimani"];
  const CLASSES = [["Alchymista", 8, "none"], ["Barbar", 12, "none"], ["Bard", 8, "full"], ["Bojovník", 10, "none"], ["Čaroděj", 6, "full"], ["Černokněžník", 8, "pact"],
    ["Druid", 8, "full"], ["Hraničář", 10, "half"], ["Klerik", 8, "full"], ["Kouzelník", 6, "full"], ["Lovec netvorů", 10, "none"], ["Mnich", 8, "none"], ["Paladin", 10, "half"], ["Tulák", 8, "none"]];
  const CASTER = { none: "nesesílá", full: "plný sesilatel", half: "poloviční", third: "třetinový", pact: "magie paktu" };
  const SCHOOLS = ["Iluze", "Nekromancie", "Očarování", "Transmutace", "Věštění", "Vymítání", "Vyvolávání", "Zaklínání"];
  const FULL = [[], [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1],
    [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1]];
  const PACT = lv => lv < 1 ? null : { n: lv === 1 ? 1 : lv < 11 ? 2 : lv < 17 ? 3 : 4, lvl: lv < 3 ? 1 : lv < 5 ? 2 : lv < 7 ? 3 : lv < 9 ? 4 : 5 };
  const ASI = [4, 8, 12, 16, 19];
  const ALIGN = ["Zákonné dobro", "Neutrální dobro", "Chaotické dobro", "Zákonná neutralita", "Čistá neutralita", "Chaotická neutralita", "Zákonné zlo", "Neutrální zlo", "Chaotické zlo", "Bez přesvědčení"];
  const CASTER_WORD = { plny: "full", "plný": "full", polovicni: "half", "poloviční": "half", tretinovy: "third", "třetinový": "third", pakt: "pact", zadne: "none", "žádné": "none", nesesila: "none" };
  const DEFAULT_LISTS = {
    races: [
      { name: "Člověk", lineages: ["Vznešené rody", "Seveřané", "Lesní národy", "Kočovníci"] },
      { name: "Trpaslík", lineages: ["Podzemní trpaslíci", "Skalní trpaslíci", "Světlí trpaslíci"] },
      ...RACES.map(r => ({ name: r.name, lineages: r.lineages.map(l => l.name) }))
    ],
    backgrounds: [],
    classes: CLASSES.map(([n, hd, c]) => ({ name: n, hd, caster: c }))
  };
  const lists = () => {
    const c = S.config || {};
    return { races: Array.isArray(c.races) && c.races.length ? c.races : DEFAULT_LISTS.races, backgrounds: Array.isArray(c.backgrounds) ? c.backgrounds : [],
      classes: Array.isArray(c.classes) && c.classes.length ? c.classes : DEFAULT_LISTS.classes };
  };
  const classInfo = name => lists().classes.find(c => norm(c.name) === norm(name));

  const num = (v, d = 0) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };
  const sgn = n => (n >= 0 ? "+" : "−") + Math.abs(n);
  const mod = v => Math.floor((num(v, 10) - 10) / 2);
  const level = C => (C.classes || []).reduce((s, c) => s + Math.max(0, num(c.level)), 0) || 1;
  const prof = C => 2 + Math.floor((level(C) - 1) / 4);
  const score = (C, a) => num(C.base && C.base[a], 10) + num(C.raceBonus && C.raceBonus[a], 0);
  const am = (C, a) => mod(score(C, a));
  const saveB = (C, a) => am(C, a) + (C.saves && C.saves[a] ? prof(C) : 0);
  const skillB = (C, k) => { const s = SKILLS.find(x => x[0] === k); return am(C, s[2]) + num(C.skills && C.skills[k], 0) * prof(C); };
  function acOf(C, type){
    const a = C.armor || {}, o = am(C, "obr"), base = num(a.base, 10);
    let v = type === "lehka" ? base + o : type === "stredni" ? base + Math.min(2, o) : type === "tezka" ? base : 10 + o;
    return v + (a.shield ? 2 : 0) + num(a.other, 0);
  }
  function slotsOf(C){
    if (C.cast && Array.isArray(C.cast.slotsOverride) && C.cast.slotsOverride.some(x => x > 0)) return C.cast.slotsOverride.map(x => num(x));
    const cl = (C.classes || []).filter(c => num(c.level) > 0);
    const casters = cl.filter(c => ["full", "half", "third"].includes(c.caster));
    let L = 0;
    if (casters.length === 1){ const c = casters[0], lv = num(c.level); L = c.caster === "full" ? lv : c.caster === "half" ? (lv >= 2 ? Math.ceil(lv / 2) : 0) : (lv >= 3 ? Math.ceil(lv / 3) : 0); }
    else casters.forEach(c => { const lv = num(c.level); L += c.caster === "full" ? lv : c.caster === "half" ? Math.floor(lv / 2) : Math.floor(lv / 3); });
    const row = FULL[Math.min(20, L)] || [];
    return Array.from({ length: 9 }, (_, i) => row[i] || 0);
  }
  const pactOf = C => { const c = (C.classes || []).find(x => x.caster === "pact"); return c ? PACT(num(c.level)) : null; };
  const chestMax = C => { const c = (C.classes || []).find(x => norm(x.name) === "alchymista"); return c ? num(c.level) : 0; };
  function load(C){
    const a = C.armor || {};
    const armorSlots = ({ lehka: 1, stredni: 2, tezka: 3 }[a.type] || 0) + (a.shield ? 1 : 0);
    const items = (C.items || []).reduce((s, it) => s + Math.max(0, parseFloat(String(it.slots).replace(",", ".")) || 0), 0);
    const used = Math.ceil(items + armorSlots - 1e-9), m = am(C, "sila");
    const L = 5 + m, M = 10 + m, H = 15 + m, max = C.backpack ? H : M;
    const st = used <= L ? ["Lehké", 0] : used <= M ? ["Střední", 1] : used <= H ? ["Těžké", 3] : ["Přetíženo", 99];
    return { used, L, M, H, max, label: st[0], pen: st[1], over: used > max };
  }
  const speed = C => { const l = load(C); return l.pen === 99 ? 1 : Math.max(0, num(C.speed, 6) - l.pen); };
  const SHORT = { sila: "Sil", obr: "Obr", odol: "Odl", int: "Int", mou: "Mdr", cha: "Cha" };
  const parts = arr => arr.filter(x => x && (x[2] || x[1] !== 0)).map(([l, v, keep, raw]) => raw ? `${l} ${v}` : `${l} ${sgn(v)}`).join(" · ");
  const saveParts = (C, a) => [[SHORT[a], am(C, a), true], C.saves && C.saves[a] ? ["zdatnost", prof(C)] : null];
  const skillParts = (C, k) => { const s = SKILLS.find(x => x[0] === k), n = num(C.skills && C.skills[k], 0); return [[SHORT[s[2]], am(C, s[2]), true], n ? [n === 2 ? "kvalifikace" : "zdatnost", n * prof(C)] : null]; };
  function acParts(C, type){
    const a = C.armor || {}, o = am(C, "obr"), base = num(a.base, 10), out = [];
    if (type === "lehka"){ out.push(["zbroj", base, true, true], ["Obr", o, true]); }
    else if (type === "stredni"){ out.push(["zbroj", base, true, true], ["Obr", Math.min(2, o), true]); }
    else if (type === "tezka") out.push(["zbroj", base, true, true]);
    else out.push(["základ", 10, true, true], ["Obr", o, true]);
    if (a.shield) out.push(["štít", 2]);
    if (num(a.other)) out.push(["jiné", num(a.other)]);
    return out;
  }
  const hdPool = C => { const p = {}; (C.classes || []).forEach(c => { const d = num(c.hd, 8); p[d] = (p[d] || 0) + num(c.level); }); return p; };

  // ---------- data ----------
  S.chars = S.chars || new Map(); S.library = S.library || new Map();
  let charParts = {};
  function listen(){
    charParts = {};
    const sub = (tag, q) => S.dataSubs.push(onSnapshot(q, snap => {
      const m = new Map(); snap.forEach(d => m.set(d.id, { id: d.id, ...d.data() }));
      charParts[tag] = m; S.chars.clear();
      Object.values(charParts).forEach(p => p.forEach((v, k) => S.chars.set(k, v)));
      S.loaded.chars = true; changed();
    }, err => { console.error("characters", err); S.loaded.chars = true; changed(); }));
    if (S.admin) sub("all", collection(db, "characters"));
    else { sub("own", query(collection(db, "characters"), where("owner", "==", S.user.uid))); sub("pub", query(collection(db, "characters"), where("public", "==", true))); }
    S.dataSubs.push(onSnapshot(doc(db, "config", "lists"), snap => { S.config = snap.exists() ? snap.data() : null; changed(); }, () => {}));
    S.dataSubs.push(onSnapshot(doc(db, "config", "rules"), snap => { S.rules = snap.exists() ? snap.data() : null; changed(); }, () => {}));
    S.dataSubs.push(onSnapshot(collection(db, "library"), snap => {
      S.library.clear(); snap.forEach(d => S.library.set(d.id, { id: d.id, ...d.data() })); S.loaded.library = true; changed();
    }, err => { console.error("library", err); S.loaded.library = true; }));
  }
  let chTimer = null, onChange = () => {};
  function changed(){ clearTimeout(chTimer); chTimer = setTimeout(() => onChange(), 40); }
  function reset(){ S.chars.clear(); S.library.clear(); charParts = {}; S.rules = null; }
  const R = () => S.rules || {};
  const ruleClass = name => (R().classes || []).find(c => norm(c.name) === norm(name));
  const ruleBg = name => (R().backgrounds || []).find(b => norm(b.name) === norm(name));
  const asiOf = name => { const c = ruleClass(name); return c && Array.isArray(c.asi) ? c.asi : ASI; };
  const libFind = (name, pred) => [...S.library.values()].find(x => norm(x.name) === norm(name) && (!pred || pred(x)));

  // ---------- společné prvky: panel a hod kostkou ----------
  const ovl = document.createElement("div");
  ovl.className = "ovl"; ovl.hidden = true;
  ovl.innerHTML = `<div class="ovl-panel" role="dialog" aria-modal="true" aria-labelledby="ovlTitle"><div class="ovl-head"><h2 id="ovlTitle"></h2><button type="button" class="ghost" id="ovlClose">Zavřít</button></div><div class="ovl-body" id="ovlBody"></div></div>`;
  document.body.appendChild(ovl);
  const closeOvl = () => { ovl.hidden = true; $("#ovlBody").innerHTML = ""; };
  ovl.addEventListener("click", e => { if (e.target === ovl) closeOvl(); });
  $("#ovlClose").onclick = closeOvl;
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !ovl.hidden) closeOvl(); });
  window.addEventListener("hashchange", closeOvl);
  function openOvl(title, html){ $("#ovlTitle").textContent = title; $("#ovlBody").innerHTML = html; ovl.hidden = false; $("#ovlBody").scrollTop = 0; return $("#ovlBody"); }

  // ---------- knihovna ----------
  const slug = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-");
  const srdUrl = name => `https://dnd5esrd.d20.cz/grimoar/grimoar-jmen.html#${slug(name)}`;
  const libSorted = type => [...S.library.values()].filter(x => !type || x.type === type).sort((a, b) => (a.type === "kouzlo" && b.type === "kouzlo" ? num(a.level) - num(b.level)
    : a.type === "schopnost" && b.type === "schopnost" ? String(a.classes || a.race || "~").localeCompare(String(b.classes || b.race || "~"), "cs") || num(a.level) - num(b.level) : 0) || (a.name || "").localeCompare(b.name || "", "cs"));
  const lvlName = l => num(l) === 0 ? "trik" : `${num(l)}. stupeň`;
  const canEditLib = e => S.admin || (e && e.createdBy === S.user.uid);
  const usesTxt = u => u && u.max ? `${u.max === "prof" ? "zdatnostní bonus" : u.max === "half" ? "polovina úrovně" : u.max}× za ${u.reset === "kratky" ? "krátký" : "dlouhý"} odpočinek` : "";
  const srcTxt = e => [e.source, e.page ? `str. ${e.page}` : ""].filter(Boolean).join(", ");
  const origin = e => e.classes ? [e.classes, e.subclass].filter(Boolean).join(" – ") : e.race ? e.race : e.bg ? "zázemí " + e.bg : "";
  function libMeta(e){
    if (e.type !== "kouzlo") return [origin(e), e.group && e.group !== "Rasová schopnost" && e.group !== "Schopnost zázemí" ? e.group : "", e.levels ? `úr. ${e.levels}` : "", usesTxt(e.uses), e.classes || e.race || e.bg ? "" : e.source].filter(Boolean).join(" · ");
    return [lvlName(e.level) + (e.school ? `, ${e.school.toLowerCase()}` : ""), e.ritual ? "rituál" : "", e.conc ? "soustředění" : ""].filter(Boolean).join(" · ");
  }
  function libCardHTML(e){
    const rows = e.type === "kouzlo"
      ? [["Doba seslání", e.cast], ["Dosah", e.range], ["Složky", e.comp], ["Trvání", e.dur && /soustředění/i.test(e.dur) ? e.dur : (e.conc ? "soustředění, " : "") + (e.dur || "")], ["Povolání", e.classes], ["Zdroj", srcTxt(e)]]
      : [["Povolání", e.classes], ["Obor", e.subclass], ["Rasa", e.race], ["Zázemí", e.bg], ["Volba z", e.group && !/Rasová|zázemí/.test(e.group) ? e.group + (e.category ? ` (${e.category})` : "") : ""], ["Úroveň", e.levels], ["Předpoklad", e.prereq], ["Kdy", e.usage], ["Použití", usesTxt(e.uses)], ["Zdroj", srcTxt(e)]];
    const link = e.url || (e.type === "kouzlo" && e.srd !== false ? srdUrl(e.name) : "");
    const sumEdit = !canEditLib(e) && e.id;
    return `<p class="lib-meta">${esc(libMeta(e))}</p>
      ${e.summary ? `<p class="lib-sum">${esc(e.summary)}</p>${e.summaryByName ? `<p class="hint">Popis: ${esc(e.summaryByName)}</p>` : ""}` : `<p class="hint">Krátký popis zatím chybí.${e.page ? ` Plné znění je v pravidlech JaD na straně ${esc(e.page)}.` : ""}</p>`}
      ${sumEdit ? `<details class="sl-ovr" id="sumBox"><summary>${e.summary ? "Upravit krátký popis" : "Doplnit krátký popis"}</summary><div class="field"><label for="sumTxt">Vlastními slovy, pár vět</label><textarea id="sumTxt" rows="3" maxlength="400" style="min-height:5em">${esc(e.summary || "")}</textarea></div><button type="button" class="primary" id="sumSave">Uložit popis</button></details>` : ""}
      <dl class="lib-dl">${rows.filter(r => r[1]).map(r => `<div><dt>${r[0]}</dt><dd>${esc(r[1])}</dd></div>`).join("")}</dl>
      ${e.text ? `<div class="md lib-text">${renderMd(e.text)}</div>` : ""}
      ${link ? `<p><a class="btn" href="${esc(link)}" target="_blank" rel="noopener">Plné znění v SRD</a></p>` : ""}`;
  }
  function bindSum(box, e){
    const b = box.querySelector("#sumSave"); if (!b) return;
    b.onclick = async () => {
      const t = box.querySelector("#sumTxt").value.trim();
      try { await updateDoc(doc(db, "library", e.id), { summary: t, summaryBy: S.user.uid, summaryByName: myName(), updatedAt: serverTimestamp() }); toast("Popis uložen."); closeOvl(); }
      catch (er){ toast(errText(er), "err"); }
    };
  }
  function libFormHTML(e){
    e = e || {};
    const isK = (e.type || "kouzlo") === "kouzlo";
    return `<form class="lib-form" id="libForm" autocomplete="off">
      <div class="seg" role="group" aria-label="Typ"><button type="button" data-ty="kouzlo" aria-pressed="${isK}">Kouzlo</button><button type="button" data-ty="schopnost" aria-pressed="${!isK}">Schopnost</button></div>
      <div class="field"><label for="lfName">Název</label><input type="text" id="lfName" required maxlength="100" value="${esc(e.name || "")}"></div>
      <div class="field"><label for="lfSum">Krátký popis (vlastními slovy)</label><textarea id="lfSum" rows="2" maxlength="400" style="min-height:4.5em">${esc(e.summary || "")}</textarea></div>
      <div class="when-grid" data-for="kouzlo"${isK ? "" : " hidden"}>
        <div class="field"><label for="lfLvl">Stupeň</label><select id="lfLvl">${Array.from({ length: 10 }, (_, i) => `<option value="${i}"${num(e.level) === i ? " selected" : ""}>${i === 0 ? "trik" : i + "."}</option>`).join("")}</select></div>
        <div class="field"><label for="lfSchool">Škola</label><select id="lfSchool"><option value="">—</option>${SCHOOLS.map(s => `<option${e.school === s ? " selected" : ""}>${s}</option>`).join("")}</select></div>
        <div class="field"><label for="lfCast">Doba seslání</label><input type="text" id="lfCast" maxlength="60" value="${esc(e.cast || "")}" placeholder="1 akce"></div>
        <div class="field"><label for="lfRange">Dosah</label><input type="text" id="lfRange" maxlength="60" value="${esc(e.range || "")}" placeholder="12 sáhů"></div>
        <div class="field"><label for="lfComp">Složky</label><input type="text" id="lfComp" maxlength="120" value="${esc(e.comp || "")}" placeholder="V, P, S"></div>
        <div class="field"><label for="lfDur">Trvání</label><input type="text" id="lfDur" maxlength="60" value="${esc(e.dur || "")}" placeholder="1 minuta"></div>
        <label class="chk"><input type="checkbox" id="lfConc"${e.conc ? " checked" : ""}> soustředění</label>
        <label class="chk"><input type="checkbox" id="lfRit"${e.ritual ? " checked" : ""}> rituál</label>
        <div class="field wide"><label for="lfClasses">Povolání</label><input type="text" id="lfClasses" maxlength="160" value="${esc(e.classes || "")}" placeholder="Bard, Kouzelník"></div>
      </div>
      <div class="when-grid" data-for="schopnost"${isK ? " hidden" : ""}>
        <div class="field"><label for="lfUses">Počet použití</label><input type="number" id="lfUses" min="0" value="${e.uses && e.uses.max ? e.uses.max : ""}" placeholder="bez omezení"></div>
        <div class="field"><label for="lfReset">Obnovuje</label><select id="lfReset"><option value="dlouhy"${e.uses && e.uses.reset === "dlouhy" ? " selected" : ""}>dlouhý odpočinek</option><option value="kratky"${e.uses && e.uses.reset === "kratky" ? " selected" : ""}>krátký odpočinek</option></select></div>
      </div>
      <div class="field"><label for="lfSource">Zdroj</label><input type="text" id="lfSource" maxlength="80" value="${esc(e.source || "")}" placeholder="JaD, homebrew, Beor…"></div>
      <div class="field"><label for="lfUrl">Odkaz na plné znění</label><input type="text" id="lfUrl" maxlength="400" value="${esc(e.url || "")}" placeholder="u kouzel se doplní odkaz do SRD JaD sám"></div>
      <div class="field"><label for="lfText">Celý text (jen vlastní a homebrew)</label><textarea id="lfText" style="min-height:8em">${esc(e.text || "")}</textarea></div>
      <div class="row"><button type="submit" class="primary">Uložit do knihovny</button>${e.id && canEditLib(e) ? `<button type="button" class="danger" id="lfDel">Smazat</button>` : ""}</div>
    </form>`;
  }
  function bindLibForm(box, e, onSaved){
    let type = (e && e.type) || "kouzlo";
    box.querySelectorAll("[data-ty]").forEach(b => b.onclick = () => {
      type = b.dataset.ty; box.querySelectorAll("[data-ty]").forEach(x => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
      box.querySelectorAll("[data-for]").forEach(g => { g.hidden = g.dataset.for !== type; });
    });
    const del = box.querySelector("#lfDel");
    if (del) del.onclick = () => { del.outerHTML = `<span class="hint">Smazat z knihovny?</span> <button type="button" class="danger" id="lfDelY">Smazat</button>`; box.querySelector("#lfDelY").onclick = async () => { try { await deleteDoc(doc(db, "library", e.id)); toast("Smazáno."); closeOvl(); } catch (er){ toast(errText(er), "err"); } }; };
    box.querySelector("#libForm").onsubmit = async ev => {
      ev.preventDefault();
      const v = id => box.querySelector(id).value.trim();
      const name = v("#lfName"); if (!name) return toast("Doplň název.", "err");
      const dup = [...S.library.values()].find(x => norm(x.name) === norm(name) && x.type === type && (type === "kouzlo" || (norm(x.classes) === norm(e && e.classes) && norm(x.subclass) === norm(e && e.subclass))) && (!e || x.id !== e.id));
      if (dup) return toast(`„${dup.name}“ už v knihovně je.`, "err");
      const data = { type, name, summary: v("#lfSum"), source: v("#lfSource"), url: v("#lfUrl"), text: box.querySelector("#lfText").value };
      if (type === "kouzlo") Object.assign(data, { level: num(v("#lfLvl")), school: v("#lfSchool"), cast: v("#lfCast"), range: v("#lfRange"), comp: v("#lfComp"), dur: v("#lfDur"), conc: box.querySelector("#lfConc").checked, ritual: box.querySelector("#lfRit").checked, classes: v("#lfClasses") });
      else { const u = num(v("#lfUses")); data.uses = u > 0 ? { max: u, reset: v("#lfReset") } : null; }
      try {
        const ref = e && e.id ? doc(db, "library", e.id) : doc(collection(db, "library"));
        await setDoc(ref, { ...data, createdBy: e && e.createdBy ? e.createdBy : S.user.uid, createdByName: e && e.createdByName ? e.createdByName : myName(), updatedAt: serverTimestamp() }, { merge: true });
        toast("Uloženo do knihovny."); onSaved && onSaved({ id: ref.id, ...data });
      } catch (er){ toast(errText(er), "err"); }
    };
  }
  function openLibCard(e, extra){
    const box = openOvl(e.name, libCardHTML(e) + (extra ? extra.html : "") + (canEditLib(e) ? `<p><button type="button" id="lcEdit" class="ghost">Upravit v knihovně</button></p>` : ""));
    bindSum(box, e);
    if (extra && extra.bind) extra.bind(box);
    const ed = box.querySelector("#lcEdit");
    if (ed) ed.onclick = () => { const b = openOvl("Upravit: " + e.name, libFormHTML(e)); bindLibForm(b, e, () => closeOvl()); };
  }
  function openLibForm(prefill, onSaved){ const b = openOvl("Přidat do knihovny", libFormHTML(prefill)); bindLibForm(b, prefill, x => { closeOvl(); onSaved && onSaved(x); }); }

  // homebrew schopnosti, které v knihovně chybí nebo mají starší znění (stejný název z jiného zdroje, např. JaD, se nechá být)
  function hbPending(){
    const out = [];
    HOMEBREW_FEATURES.forEach(h => {
      const same = [...S.library.values()].filter(x => norm(x.name) === norm(h.name));
      const mine = same.find(x => x.source === (h.source || "homebrew"));
      if (!same.length) out.push([h, null]);
      else if (mine && (mine.text !== (h.text || "") || mine.summary !== (h.summary || "") || JSON.stringify(mine.uses || null) !== JSON.stringify(h.uses || null))) out.push([h, mine]);
    });
    return out;
  }
  function libraryView(v){
    S.editing = false;
    const q = (S._libQ || ""), ty = S._libT || "";
    const clsNames = [...new Set([...lists().classes.map(c => c.name), ...[...S.library.values()].flatMap(e => String(e.classes || "").split(",").map(x => x.trim()))].filter(Boolean))].sort((a, b) => a.localeCompare(b, "cs"));
    v.innerHTML = `<div class="head"><span class="eyebrow"><a href="#/deniky">deníky</a></span><h1>Knihovna</h1>
        <p class="lede">Kouzla a schopnosti, které používáte. Každý člen může přidávat a doplňovat krátké popisy. Plné znění kouzel se otevře v SRD JaD, u položek z pravidel je uvedena strana.</p></div>
      <div class="row"><input type="search" id="libQ" placeholder="Hledat kouzlo nebo schopnost…" value="${esc(q)}" style="flex:1 1 220px">
        <div class="seg" role="group" aria-label="Filtr">${[["", "Vše"], ["kouzlo", "Kouzla"], ["schopnost", "Schopnosti"]].map(([k, l]) => `<button type="button" data-lt="${k}" aria-pressed="${ty === k}">${l}</button>`).join("")}</div>
        <select id="libC" aria-label="Povolání"><option value="">všechna povolání</option>${clsNames.map(n => `<option${S._libC === n ? " selected" : ""}>${esc(n)}</option>`).join("")}<option value="_rasa"${S._libC === "_rasa" ? " selected" : ""}>rasové schopnosti</option><option value="_bez"${S._libC === "_bez" ? " selected" : ""}>bez krátkého popisu</option></select>
        <button type="button" class="primary" id="libAdd">Přidat</button>
        ${S.admin && hbPending().length ? `<button type="button" id="libSeed">Nahrát homebrew Malenoru (${hbPending().length})</button>` : ""}
        ${S.admin ? `<button type="button" id="libImp">Importovat</button>` : ""}</div>
      <p class="hint" id="libCount"></p>
      <ul class="list" id="libList"></ul>`;
    const draw = () => {
      const qq = norm($("#libQ").value); S._libQ = $("#libQ").value; const fc = S._libC || "";
      const items = libSorted(S._libT || "").filter(e => (!qq || [e.name, e.summary, e.classes, e.subclass, e.group, e.race, e.bg].some(x => norm(x).includes(qq)))
        && (!fc || (fc === "_rasa" ? !!e.race : fc === "_bez" ? !e.summary : String(e.classes || "").split(",").some(x => norm(x) === norm(fc)))));
      const shown = items.slice(0, 300);
      $("#libCount").textContent = items.length > shown.length ? `Zobrazeno ${shown.length} z ${items.length}. Upřesni hledání.` : `${items.length} položek`;
      $("#libList").innerHTML = shown.length ? shown.map(e => `<li><button type="button" class="item ghost lib-row" data-id="${esc(e.id)}"><strong>${esc(e.name)}</strong><small>${e.type === "kouzlo" ? "kouzlo" : "schopnost"} · ${esc(libMeta(e))}${e.page ? ` · str. ${esc(e.page)}` : ""}</small>${e.summary ? `<span class="ex">${esc(e.summary)}</span>` : ""}</button></li>`).join("")
        : `<li class="muted" style="padding:10px 0">Nic nenalezeno.</li>`;
      $("#libList").querySelectorAll("[data-id]").forEach(b => b.onclick = () => openLibCard(S.library.get(b.dataset.id)));
    };
    $("#libQ").addEventListener("input", draw);
    $("#libC").onchange = () => { S._libC = $("#libC").value; draw(); };
    v.querySelectorAll("[data-lt]").forEach(b => b.onclick = () => { S._libT = b.dataset.lt; v.querySelectorAll("[data-lt]").forEach(x => x.setAttribute("aria-pressed", x === b ? "true" : "false")); draw(); });
    const ib = $("#libImp"); if (ib) ib.onclick = importDialog;
    $("#libAdd").onclick = () => openLibForm({ type: S._libT === "schopnost" ? "schopnost" : "kouzlo", name: $("#libQ").value.trim() });
    const sb = $("#libSeed");
    if (sb) sb.onclick = async () => {
      sb.disabled = true;
      try {
        const b = writeBatch(db); let n = 0;
        for (const [h, ex] of hbPending()){
          const data = { type: "schopnost", name: h.name, summary: h.summary || "", text: h.text || "", source: h.source || "homebrew", url: "", uses: h.uses || null, updatedAt: serverTimestamp() };
          if (ex) b.set(doc(db, "library", ex.id), data, { merge: true });
          else b.set(doc(collection(db, "library")), { ...data, createdBy: S.user.uid, createdByName: myName() });
          n++;
        }
        await b.commit(); toast(`Nahráno nebo aktualizováno ${n} schopností.`);
      } catch (er){ toast(errText(er), "err"); sb.disabled = false; }
    };
    draw();
  }

  // ---------- import rejstříku (vypravěč) ----------
  const impId = e => "imp-" + slug([e.source || "x", e.type, e.classes, e.subclass, e.group, e.race, e.bg, e.name].filter(Boolean).join(" ")).slice(0, 180);
  function importDialog(){
    const box = openOvl("Import do knihovny", `<p>Nahraj soubor rejstříku (JSON). Data se uloží jen do databáze wiki, kam mají přístup schválení členové.</p>
      <div class="field"><label for="impFile">Soubor</label><input type="file" id="impFile" accept=".json,application/json"></div>
      <div id="impInfo" class="hint"></div>
      <div id="impOpts" hidden>
        <label class="chk"><input type="checkbox" id="impLib" checked> Kouzla a schopnosti do knihovny (krátké popisy, které už jste napsali, zůstanou, prázdné se doplní ze souboru)</label>
        <label class="chk"><input type="checkbox" id="impRules" checked> Údaje o rasách, zázemích, povoláních, zbraních a zbrojích pro předvolby v denících</label>
        <label class="chk"><input type="checkbox" id="impLists" checked> Doplnit chybějící rasy, rody, zázemí a povolání do seznamů pro deníky</label>
        <div class="row"><button type="button" class="primary" id="impGo">Importovat</button></div>
      </div>
      <p class="hint" id="impLog"></p>`);
    let data = null;
    box.querySelector("#impFile").onchange = async ev => {
      const f = ev.target.files[0]; if (!f) return;
      try { data = JSON.parse(await f.text()); } catch { data = null; }
      if (!data || data.format !== "malenorwiki-import" || !Array.isArray(data.library)){ box.querySelector("#impInfo").textContent = "Tohle není soubor rejstříku pro MalenorWiki."; box.querySelector("#impOpts").hidden = true; return; }
      const k = data.library.filter(e => e.type === "kouzlo").length, s = data.library.length - k, r = data.rules || {};
      box.querySelector("#impInfo").textContent = `Zdroj: ${data.source || "?"}. Kouzel ${k}, schopností ${s}. Ras ${(r.races || []).length}, zázemí ${(r.backgrounds || []).length}, povolání ${(r.classes || []).length}, zbraní ${(r.weapons || []).length}, zbrojí ${(r.armor || []).length}.`;
      box.querySelector("#impOpts").hidden = false;
    };
    box.querySelector("#impGo").onclick = async () => {
      const btn = box.querySelector("#impGo"), log = box.querySelector("#impLog"); btn.disabled = true;
      try {
        let added = 0, updated = 0, skipped = 0;
        if (box.querySelector("#impLib").checked){
          const byName = new Map(); S.library.forEach(x => { const key = x.type + "|" + norm(x.name) + "|" + norm(x.classes) + "|" + norm(x.subclass); byName.set(key, x); });
          const ops = [];
          for (const e of data.library){
            if (!e || !e.name || !["kouzlo", "schopnost"].includes(e.type)) continue;
            const id = impId(e);
            const other = byName.get(e.type + "|" + norm(e.name) + "|" + norm(e.type === "kouzlo" ? "" : e.classes) + "|" + norm(e.type === "kouzlo" ? "" : e.subclass))
              || (e.type === "kouzlo" ? [...S.library.values()].find(x => x.type === "kouzlo" && norm(x.name) === norm(e.name)) : null);
            if (other && other.id !== id){ skipped++; continue; }
            const clean = { ...e }; delete clean.text;
            const ex = S.library.get(id);
            if (!e.summary || (ex && ex.summary)) delete clean.summary; else clean.summaryByName = e.summaryByName || "Claude podle pravidel " + (data.source || "");
            ops.push([id, { ...clean, createdBy: S.user.uid, createdByName: myName(), importedAt: serverTimestamp() }]);
            S.library.has(id) ? updated++ : added++;
          }
          for (let i = 0; i < ops.length; i += 400){
            const b = writeBatch(db);
            ops.slice(i, i + 400).forEach(([id, d]) => b.set(doc(db, "library", id), d, { merge: true }));
            log.textContent = `Ukládám knihovnu… ${Math.min(i + 400, ops.length)} / ${ops.length}`;
            await b.commit();
          }
        }
        if (box.querySelector("#impRules").checked && data.rules) await setDoc(doc(db, "config", "rules"), { ...data.rules, source: data.source || "", updatedAt: serverTimestamp() });
        if (box.querySelector("#impLists").checked && data.rules){
          const L = lists(), r = data.rules;
          const races = L.races.map(x => ({ name: x.name, lineages: [...(x.lineages || [])] }));
          (r.races || []).forEach(x => { const ex = races.find(y => norm(y.name) === norm(x.name)); const lin = (x.lineages || []).map(l => l.name);
            if (!ex) races.push({ name: x.name, lineages: lin }); else lin.forEach(l => { if (!ex.lineages.some(y => norm(y) === norm(l))) ex.lineages.push(l); }); });
          const bgs = [...L.backgrounds]; (r.backgrounds || []).forEach(b => { if (!bgs.some(y => norm(y) === norm(b.name))) bgs.push(b.name); });
          const cls = L.classes.map(c => ({ ...c })); (r.classes || []).forEach(c => { const ex = cls.find(y => norm(y.name) === norm(c.name)); if (ex){ ex.hd = c.hd; ex.caster = c.caster; } else cls.push({ name: c.name, hd: c.hd, caster: c.caster }); });
          await setDoc(doc(db, "config", "lists"), { races, backgrounds: bgs, classes: cls, updatedAt: serverTimestamp() });
        }
        log.textContent = `Hotovo. Nové: ${added}, aktualizované: ${updated}${skipped ? `, přeskočené (stejný název už v knihovně je): ${skipped}` : ""}.`;
        toast("Import dokončen.");
      } catch (er){ log.textContent = errText(er); toast(errText(er), "err"); btn.disabled = false; }
    };
  }

  // ---------- seznamy pro deníky (vypravěč) ----------
  function listsView(v){
    S.editing = false;
    if (!S.admin){ v.innerHTML = `<p class="muted">Seznamy spravuje vypravěč.</p>`; return; }
    S.editing = true;
    const L = lists();
    const casterOut = { full: "plný", half: "poloviční", third: "třetinový", pact: "pakt", none: "žádné" };
    v.innerHTML = `<div class="head"><span class="eyebrow"><a href="#/deniky">deníky</a></span><h1>Seznamy pro deníky</h1>
        <p class="lede">Z těchto seznamů se hráčům nabízejí hodnoty v deníku. Co v seznamu není, deník označí „mimo seznam“. Malenor má vlastní rasy a rody, takže seznam nemusí odpovídat knize JaD.</p></div>
      <form class="editor" id="lsForm">
        <div class="field"><label for="lsRaces">Rasy a rody: na řádek jedna rasa, za dvojtečku rody oddělené čárkou</label><textarea id="lsRaces" style="min-height:12em">${esc(L.races.map(r => r.name + (r.lineages && r.lineages.length ? ": " + r.lineages.join(", ") : "")).join("\n"))}</textarea></div>
        <div class="row"><button type="button" id="lsHb">Doplnit rasy Malenoru</button><span class="hint">Přidá Beory a elfy Malenoru s jejich rody. Rody, které v Malenoru neplatí, smaž ručně.</span></div>
        <div class="field"><label for="lsBg">Zázemí: na řádek jedno</label><textarea id="lsBg" style="min-height:8em">${esc(L.backgrounds.join("\n"))}</textarea></div>
        <div class="field"><label for="lsCls">Povolání: název, kostka obnovy, sesílání (plný, poloviční, třetinový, pakt, žádné)</label><textarea id="lsCls" style="min-height:12em">${esc(L.classes.map(c => `${c.name}, k${num(c.hd, 8)}, ${casterOut[c.caster] || "žádné"}`).join("\n"))}</textarea></div>
        <div class="sticky-actions"><button type="submit" class="primary">Uložit seznamy</button><span class="hint" id="lsStatus"></span></div>
      </form>`;
    $("#lsHb").onclick = () => {
      const ta = $("#lsRaces"), rows = ta.value.split("\n").map(x => x.trim()).filter(Boolean).map(l => { const [n, rest] = l.split(":"); return { name: n.trim(), lin: rest ? rest.split(",").map(x => x.trim()).filter(Boolean) : [] }; });
      RACES.forEach(r => { let row = rows.find(x => norm(x.name) === norm(r.name)); if (!row){ row = { name: r.name, lin: [] }; rows.push(row); } r.lineages.forEach(l => { if (!row.lin.some(x => norm(x) === norm(l.name))) row.lin.push(l.name); }); });
      ta.value = rows.map(r => r.name + (r.lin.length ? ": " + r.lin.join(", ") : "")).join("\n");
      toast("Doplněno. Ulož seznamy.");
    };
    $("#lsForm").onsubmit = async e => {
      e.preventDefault();
      const lines = id => $(id).value.split("\n").map(x => x.trim()).filter(Boolean);
      const races = lines("#lsRaces").map(l => { const [n, rest] = l.split(":"); return { name: n.trim(), lineages: rest ? rest.split(",").map(x => x.trim()).filter(Boolean) : [] }; });
      const classes = lines("#lsCls").map(l => { const [n, d, c] = l.split(",").map(x => (x || "").trim()); return { name: n, hd: num(String(d || "").replace(/\D/g, ""), 8) || 8, caster: CASTER_WORD[norm(c || "")] || CASTER_WORD[c] || "none" }; });
      try { await setDoc(doc(db, "config", "lists"), { races, backgrounds: lines("#lsBg"), classes, updatedAt: serverTimestamp() }); S.editing = false; toast("Seznamy uloženy."); go("#/deniky"); }
      catch (er){ toast(errText(er), "err"); }
    };
  }

  // ---------- seznam deníků ----------
  function charsView(v){
    S.editing = false;
    const all = [...S.chars.values()].sort((a, b) => (a.name || "").localeCompare(b.name || "", "cs"));
    const mine = all.filter(c => c.owner === S.user.uid), others = all.filter(c => c.owner !== S.user.uid);
    const row = c => `<li class="ch-row">${S.admin && c.owner !== S.user.uid ? `<input type="checkbox" class="lvl-pick" data-id="${esc(c.id)}" aria-label="Vybrat ${esc(c.name)}">` : ""}
      <a class="item" href="#/denik/${enc(c.id)}"><strong>${esc(c.name || "Bezejmenný")}${c.levelUps > 0 ? ` <span class="pill open">postup čeká</span>` : ""}</strong>
      <small>${esc([c.race + (c.lineage ? " (" + c.lineage + ")" : ""), (c.classes || []).filter(x => x.name).map(x => `${x.name} ${num(x.level)}`).join(" / "), c.ownerName && c.owner !== S.user.uid ? "hráč: " + c.ownerName : ""].filter(Boolean).join(" · "))}</small>
      <small>BV ${num(c.bv && c.bv.cur)}/${num(c.bv && c.bv.max)} · OČ ${acOf(c, (c.armor || {}).type)}${c.public ? " · viditelný družině" : ""}</small></a></li>`;
    v.innerHTML = `<div class="head"><span class="eyebrow"><a href="#/">MalenorWiki</a></span>
        <div class="spread"><h1>Deníky postav</h1><div class="row"><a class="btn" href="#/knihovna">Knihovna kouzel</a>${S.admin ? `<a class="btn" href="#/seznamy">Seznamy pro deníky</a>` : ""}<button type="button" class="primary" id="newChar">Nová postava</button></div></div>
        <p class="lede">Deník se ukládá průběžně a funguje i během hry. Vypravěč vidí všechny deníky, ostatní hráči jen ty, které jim zpřístupníš.</p></div>
      <section class="head"><h2>Moje postavy</h2>${mine.length ? `<ul class="list">${mine.map(row).join("")}</ul>` : `<p class="muted">Zatím nemáš žádnou postavu.</p>`}</section>
      ${others.length ? `<section class="head"><h2>${S.admin ? "Postavy hráčů" : "Postavy družiny"}</h2><ul class="list">${others.map(row).join("")}</ul>
        ${S.admin ? `<div class="row"><button type="button" id="lvlGive">Udělit postup úrovně vybraným</button><span class="hint">Příběhový milník: hráč pak v deníku dokončí postup.</span></div>` : ""}</section>` : ""}`;
    $("#newChar").onclick = async () => {
      try { const ref = doc(collection(db, "characters")); await setDoc(ref, blankChar()); go(`#/denik/${enc(ref.id)}`); }
      catch (e){ toast(errText(e), "err"); }
    };
    const lg = $("#lvlGive");
    if (lg) lg.onclick = async () => {
      const ids = [...v.querySelectorAll(".lvl-pick:checked")].map(x => x.dataset.id);
      if (!ids.length) return toast("Nejdřív zaškrtni postavy.", "err");
      try { const b = writeBatch(db); ids.forEach(id => b.update(doc(db, "characters", id), { levelUps: num(S.chars.get(id).levelUps) + 1 })); await b.commit(); toast(`Postup udělen (${ids.length}).`); }
      catch (e){ toast(errText(e), "err"); }
    };
  }
  function blankChar(){
    return { owner: S.user.uid, ownerName: myName(), public: false, name: "", race: "", raceKey: "", lineage: "", background: "", alignment: "",
      classes: [{ name: "", level: 1, hd: 8, caster: "none" }], base: { sila: 10, obr: 10, odol: 10, int: 10, mou: 10, cha: 10 }, raceBonus: {},
      saves: {}, skills: {}, initBonus: 0, speed: 6, inspiration: false,
      armor: { type: "zadna", base: 10, shield: false, other: 0 }, armorProf: {}, weaponProf: {}, tools: "", languages: "",
      bv: { max: 0, cur: 0, temp: 0 }, hdUsed: {}, death: { s: 0, f: 0 }, exhaustion: 0, conditions: "", concentration: "",
      cast: { ability: "", slotsOverride: null, used: {}, pactUsed: 0, arcana: {} }, chest: { used: 0 },
      weapons: [], features: [], spells: [], playNotes: "",
      items: [], backpack: true, money: "", looks: {}, relations: [], titles: "", story: "",
      levelUps: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  }

  // ---------- deník ----------
  let C = null, CID = null, saveT = null, saving = false, tab = "denik", notesUnsub = null, docUnsub = null, drawing = false;
  const openWp = new Set();
  const canEdit = () => C && (C.owner === S.user.uid || S.admin);
  const isOwner = () => C && C.owner === S.user.uid;
  function getP(o, p){ return p.split(".").reduce((x, k) => (x == null ? undefined : x[k]), o); }
  function setP(o, p, val){ const ks = p.split("."); let x = o; ks.slice(0, -1).forEach(k => { if (x[k] == null || typeof x[k] !== "object") x[k] = /^\d+$/.test(k) ? [] : {}; x = x[k]; }); x[ks[ks.length - 1]] = val; }
  function save(){
    if (!canEdit()) return;
    clearTimeout(saveT); saving = true; status("Ukládám…");
    saveT = setTimeout(async () => {
      const data = JSON.parse(JSON.stringify(C)); delete data.id; delete data.createdAt; data.updatedAt = serverTimestamp();
      try { await setDoc(doc(db, "characters", CID), data, { merge: true }); status("Uloženo"); }
      catch (e){ status("Neuloženo"); toast(errText(e), "err"); }
      saving = false;
    }, 500);
  }
  const status = t => { const el = $("#chStatus"); if (el) el.textContent = t; };

  function charView(v, id, t){
    tab = t || "denik";
    const c = S.chars.get(id);
    if (!c && S.loaded.chars){ S.editing = false; v.innerHTML = `<div class="head"><h1>Deník nenalezen</h1><p class="lede">Postava neexistuje, nebo ti ji majitel nezpřístupnil.</p></div><p><a class="btn" href="#/deniky">Zpět na deníky</a></p>`; return; }
    if (!c){ S.editing = false; v.innerHTML = `<p class="muted">Načítám deník…</p>`; return; }
    S.editing = true;
    if (CID !== id) openWp.clear();
    C = (CID === id && C && saving) ? C : JSON.parse(JSON.stringify(c));
    CID = id;
    // živé změny z jiného zařízení
    S.routeSub && S.routeSub();
    if (notesUnsub){ notesUnsub(); notesUnsub = null; }
    S.routeSub = () => { docUnsub && docUnsub(); docUnsub = null; if (notesUnsub){ notesUnsub(); notesUnsub = null; } };
    docUnsub = onSnapshot(doc(db, "characters", id), snap => {
      if (!snap.exists() || saving) return;
      const d = { id, ...snap.data() };
      const focused = document.activeElement && document.activeElement.closest && document.activeElement.closest("#sheet") && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
      const strip = o => { const x = { ...o }; delete x.updatedAt; delete x.createdAt; return JSON.stringify(x); };
      if (strip(d) === strip(C) || focused) return;
      C = JSON.parse(JSON.stringify(d)); draw(v);
    }, () => {});
    draw(v);
  }
  function later(v){ setTimeout(() => { if ($("#sheet") && route()[0] === "denik") draw(v); }, 0); }
  function draw(v){
    if (drawing) return;
    drawing = true;
    try { drawInner(v); } finally { drawing = false; }
  }
  function drawInner(v){
    const sy = window.scrollY;
    v.innerHTML = `<div class="sheet" id="sheet">
      <div class="sh-top">
        <div><span class="eyebrow"><a href="#/deniky">deníky</a>${C.ownerName ? " · " + esc(C.ownerName) : ""}</span>
          <h1>${esc(C.name || "Bezejmenná postava")}</h1>
          <p class="sh-sub">${esc([C.race + (C.lineage ? " (" + C.lineage + ")" : ""), (C.classes || []).filter(x => x.name).map(x => `${x.name} ${num(x.level)}`).join(" / ")].filter(Boolean).join(" · ")) || "Vyplň rasu a povolání"} · úroveň ${level(C)}</p></div>
        <span class="hint" id="chStatus">${canEdit() ? "" : "Jen pro čtení"}</span>
      </div>
      ${C.levelUps > 0 && isOwner() ? `<p class="notice"><strong>Vypravěč ti udělil postup na úroveň ${level(C) + 1}.</strong> <button type="button" class="primary" id="lvlStart">Postoupit</button></p>` : ""}
      ${C.levelUps > 0 && !isOwner() ? `<p class="notice">Postava má udělený postup úrovně, čeká na hráče.</p>` : ""}
      <div class="tabs sh-tabs" role="tablist">${[["denik", "Deník"], ["vybava", "Výbava a postava"], ["zapisky", "Zápisky"]].map(([k, l]) => `<a role="tab" href="#/denik/${enc(CID)}/${k}" aria-selected="${tab === k}">${l}</a>`).join("")}</div>
      <fieldset class="sh-body" ${canEdit() ? "" : "disabled"}>${tab === "vybava" ? gearHTML() : tab === "zapisky" ? `<div id="notesBox"><p class="muted">Načítám zápisky…</p></div>` : sheetHTML()}</fieldset>
    </div>`;
    bind(v);
    window.scrollTo(0, sy);
  }

  // --- HTML částí ---
  const inp = (p, attrs = "") => `<input type="text" data-p="${p}" value="${esc(getP(C, p) ?? "")}" ${attrs}>`;
  const nin = (p, attrs = "") => `<input type="number" inputmode="numeric" data-p="${p}" data-num value="${esc(getP(C, p) ?? "")}" ${attrs}>`;
  const chk = (p, label, cls = "") => `<label class="chk ${cls}"><input type="checkbox" data-p="${p}"${getP(C, p) ? " checked" : ""}> ${label}</label>`;
  const fld = (id, label, html, cls = "") => `<div class="field ${cls}"><label>${label}</label>${html}</div>`;
  function sheetHTML(){
    const pb = prof(C), sl = slotsOf(C), pact = pactOf(C), cm = chestMax(C), castAb = C.cast && C.cast.ability;
    const ld = load(C), pool = hdPool(C);
    return `
    <section class="card"><h2>Postava</h2>
      <div class="sh-grid">
        ${fld("", "Jméno postavy", inp("name", 'maxlength="80"'))}
        ${fld("", "Rasa" + off(C.race, raceNames()), `<div class="row nowrap">${inp("race", 'maxlength="60" list="raceList"')}${allRaces().length ? `<button type="button" id="racePick" title="Vybrat rasu s předvolbou bonusů">Předvolba</button>` : ""}</div>`)}
        ${fld("", "Rod" + off(C.lineage, lineageNames(C.race)), inp("lineage", 'maxlength="60" list="linList"'))}
        ${fld("", "Zázemí" + off(C.background, lists().backgrounds), `<div class="row nowrap">${inp("background", 'maxlength="60" list="bgList"')}<button type="button" id="bgPick" title="Vybrat zázemí s předvolbou">Předvolba</button></div>`)}
        ${fld("", "Přesvědčení" + off(C.alignment, ALIGN), inp("alignment", 'maxlength="40" list="alList"'))}
      </div>
      ${C.raceNote ? `<p class="hint">${esc(C.raceNote)}</p>` : ""}${bgNote()}
      <datalist id="raceList">${raceNames().map(n => `<option value="${esc(n)}">`).join("")}</datalist>
      <datalist id="linList">${lineageNames(C.race).map(n => `<option value="${esc(n)}">`).join("")}</datalist>
      <datalist id="bgList">${lists().backgrounds.map(n => `<option value="${esc(n)}">`).join("")}</datalist>
      <datalist id="alList">${ALIGN.map(n => `<option value="${esc(n)}">`).join("")}</datalist>
      <div class="cls-list">${(C.classes || []).map((c, i) => `<div class="cls-row">
          <div class="field"><label>Povolání${off(c.name, lists().classes.map(x => x.name))}</label><input type="text" list="clsList" data-p="classes.${i}.name" data-cls="${i}" value="${esc(c.name || "")}"></div>
          <div class="field"><label>Obor povolání</label><input type="text" list="subList${i}" data-p="classes.${i}.sub" value="${esc(c.sub || "")}" placeholder="${(ruleClass(c.name) || {}).subclasses ? "od 2.–3. úrovně" : ""}"><datalist id="subList${i}">${((ruleClass(c.name) || {}).subclasses || []).map(n => `<option value="${esc(n)}">`).join("")}</datalist></div>
          <div class="field sm"><label>Úroveň</label><input type="number" inputmode="numeric" min="1" max="20" data-p="classes.${i}.level" data-num value="${num(c.level, 1)}"${S.admin ? "" : " readonly title=\"Úroveň zvyšuje vypravěč přes postup\""}></div>
          <div class="field sm"><label>Kostka</label><select data-p="classes.${i}.hd" data-num>${[6, 8, 10, 12].map(d => `<option value="${d}"${num(c.hd) === d ? " selected" : ""}>k${d}</option>`).join("")}</select></div>
          <div class="field"><label>Sesílání</label><select data-p="classes.${i}.caster">${Object.entries(CASTER).map(([k, l]) => `<option value="${k}"${c.caster === k ? " selected" : ""}>${l}</option>`).join("")}</select></div>
          ${i > 0 && S.admin ? `<button type="button" class="ghost" data-rmcls="${i}" aria-label="Odebrat povolání">×</button>` : ""}
        </div>`).join("")}</div>
      <datalist id="clsList">${lists().classes.map(c => `<option value="${esc(c.name)}">`).join("")}</datalist>
      <p class="hint">Návrhy se nabízejí ze seznamů, které spravuje vypravěč. Hodnota mimo seznam je označená, aby ji vypravěč mohl zkontrolovat.</p>
      <div class="row"><label class="chk"><input type="checkbox" data-p="public"${C.public ? " checked" : ""}${isOwner() ? "" : " disabled"}> Zpřístupnit deník družině</label></div>
    </section>

    <section class="card wide"><h2>Vlastnosti</h2>
      <div class="abil-grid">${ABIL.map(([k, n]) => `<div class="abil">
        <div class="abil-roll"><span>${n}</span><strong data-d="mod.${k}">${sgn(am(C, k))}</strong></div>
        <div class="abil-in"><input type="number" inputmode="numeric" data-p="base.${k}" data-num value="${num(C.base && C.base[k], 10)}" aria-label="${n} – základ">${num(C.raceBonus && C.raceBonus[k]) ? `<span class="hint" title="bonus rasy">${sgn(num(C.raceBonus[k]))}</span>` : ""}<span class="abil-score" data-d="score.${k}">${score(C, k)}</span></div>
      </div>`).join("")}</div>
      <details class="sl-ovr"><summary>Bonusy z rasy a rodu</summary><div class="when-grid">${ABIL.map(([k, n]) => `<div class="field sm"><label>${SHORT[k]}</label><input type="number" inputmode="numeric" data-p="raceBonus.${k}" data-num value="${num(C.raceBonus && C.raceBonus[k])}"></div>`).join("")}</div></details>
      <div class="stat-row">
        <div class="stat"><span>Zdatnostní bonus</span><strong data-d="prof">${sgn(pb)}</strong></div>
        <div class="stat"><span>Iniciativa</span><strong data-d="init">${sgn(am(C, "obr") + num(C.initBonus))}</strong><small class="bk" data-d="bk.init">${parts([["Obr", am(C, "obr"), true], ["bonus", num(C.initBonus)]])}</small></div>
        <div class="stat"><span>Rychlost</span><strong data-d="speed">${speed(C)} sáhů</strong><small class="bk">${ld.pen ? `${num(C.speed, 6)} − ${ld.pen === 99 ? "přetížení" : ld.pen + " (" + ld.label.toLowerCase() + " naložení)"}` : "bez postihu"}</small></div>
        <div class="stat"><span>Bonus k iniciativě</span><input type="number" inputmode="numeric" data-p="initBonus" data-num value="${num(C.initBonus)}" style="width:4.5em;text-align:center"></div>
        <label class="stat chk-stat"><input type="checkbox" data-p="inspiration"${C.inspiration ? " checked" : ""}><span>Inspirace</span></label>
      </div>
    </section>

    <section class="card"><h2>Výdrž a smrt</h2>
      <div class="bv">
        <div class="bv-main"><span>Body výdrže</span><strong><span data-d="bvcur">${num(C.bv.cur)}</span> / <span data-d="bvmax">${num(C.bv.max)}</span></strong>${num(C.bv.temp) ? `<small>+ ${num(C.bv.temp)} dočasných</small>` : ""}
          <div class="bv-bar"><i style="width:${Math.max(0, Math.min(100, num(C.bv.cur) / Math.max(1, num(C.bv.max)) * 100))}%"></i></div></div>
        <div class="row nowrap bv-ctl"><input type="number" inputmode="numeric" id="bvAmt" min="1" value="1" aria-label="Počet bodů"><button type="button" class="danger" id="bvDmg">Zásah</button><button type="button" class="primary" id="bvHeal">Léčení</button></div>
      </div>
      <div class="sh-grid">
        ${fld("", "Max. BV", nin("bv.max", 'min="0"'))}
        ${fld("", "Aktuální BV", nin("bv.cur", 'min="0"'))}
        ${fld("", "Dočasné BV", nin("bv.temp", 'min="0"'))}
        ${fld("", "Vyčerpání", `<select data-p="exhaustion" data-num>${[0, 1, 2, 3, 4, 5, 6].map(n => `<option${num(C.exhaustion) === n ? " selected" : ""}>${n}</option>`).join("")}</select>`)}
      </div>
      <div class="row death"><span class="lbl">Smrt</span>
        <span class="dots" aria-label="Úspěchy">${[1, 2, 3].map(i => `<button type="button" class="dot ok${num(C.death.s) >= i ? " on" : ""}" data-death="s" data-i="${i}" aria-label="úspěch ${i}">♥</button>`).join("")}</span>
        <span class="dots" aria-label="Neúspěchy">${[1, 2, 3].map(i => `<button type="button" class="dot bad${num(C.death.f) >= i ? " on" : ""}" data-death="f" data-i="${i}" aria-label="neúspěch ${i}">✕</button>`).join("")}</span>
</div>
      <p class="hint">Záchrana proti smrti: hoď k20. 10 a víc úspěch, 1 znamená dva neúspěchy, 20 = postava se probere s 1 BV.</p>
      <div class="row hd"><span class="lbl">Kostky obnovy</span>${Object.entries(pool).map(([d, n]) => `<span class="pill">k${d}: ${Math.max(0, n - num(C.hdUsed && C.hdUsed[d]))} z ${n}</span>`).join("")}<span class="hint">každá: k + Odl ${sgn(am(C, "odol"))}</span></div>
      <div class="sh-grid">${fld("", "Stavy", inp("conditions", 'placeholder="např. otrávený"'), "wide")}${fld("", "Soustředění na", inp("concentration"), "wide")}</div>
      <div class="row"><button type="button" id="restShort">Krátký odpočinek</button><button type="button" id="restLong">Dlouhý odpočinek</button></div>
    </section>

    <section class="card"><h2>Obranné číslo</h2>
      <div class="stat-row">
        <div class="stat big"><span>OČ</span><strong data-d="ac">${acOf(C, C.armor.type)}</strong><small class="bk" data-d="bk.ac">${parts(acParts(C, C.armor.type))}</small></div>
        <div class="stat"><span>Beze zbroje</span><strong data-d="ac0">${acOf(C, "zadna")}</strong><small class="bk" data-d="bk.ac0">${parts(acParts(C, "zadna"))}</small></div>
      </div>
      <div class="sh-grid">
        ${fld("", "Zbroj", `<select data-p="armor.type">${[["zadna", "žádná"], ["lehka", "lehká"], ["stredni", "střední (Obr max +2)"], ["tezka", "těžká"]].map(([k, l]) => `<option value="${k}"${C.armor.type === k ? " selected" : ""}>${l}</option>`).join("")}</select>`)}
        ${fld("", "Hodnota zbroje", nin("armor.base", 'min="0"'))}
        ${fld("", "Jiné (kouzla, předměty)", nin("armor.other"))}
        ${(R().armor || []).length ? fld("", "Zbroj z tabulky", `<select id="armT"><option value="">vybrat…</option>${R().armor.filter(a => a.cat !== "štít").map(a => `<option value="${esc(a.name)}"${norm(C.armor.name) === norm(a.name) ? " selected" : ""}>${esc(a.name)} (${esc(a.ac)})</option>`).join("")}</select>`) : ""}
      </div>${C.armor.name ? `<p class="hint">${esc(C.armor.name)}${(() => { const a = (R().armor || []).find(x => norm(x.name) === norm(C.armor.name)); return a ? esc([a.stealth ? "nevýhoda na Nenápadnost" : "", a.str ? "vyžaduje " + a.str.replace("SIL", "Sílu") : "", a.page ? "str. " + a.page : ""].filter(Boolean).map(x => " · " + x).join("")) : ""; })()}</p>` : ""}
      <div class="row">${chk("armor.shield", "Štít (+2)")}<span class="lbl">Zdatnost:</span>${chk("armorProf.lehke", "lehké")}${chk("armorProf.stredni", "střední")}${chk("armorProf.tezke", "těžké")}${chk("armorProf.stity", "štíty")}</div>
      ${armorWarn()}
    </section>

    <section class="card"><h2>Záchranné hody</h2>
      <ul class="skl">${ABIL.map(([k, n]) => `<li><button type="button" class="star${C.saves && C.saves[k] ? " on" : ""}" data-save="${k}" aria-label="zdatnost ${n}">★</button><span class="skl-name">${n}<small class="bk" data-d="bk.save.${k}">${parts(saveParts(C, k))}</small></span><strong data-d="save.${k}">${sgn(saveB(C, k))}</strong></li>`).join("")}</ul>
    </section>

    <section class="card"><h2>Dovednosti</h2>
      <p class="hint">Hvězdička: jednou zdatnost, dvakrát kvalifikace (dvojnásobný bonus).</p>
      ${ABIL.map(([a, an]) => { const sk = SKILLS.filter(s => s[2] === a); return sk.length ? `<h3 class="skl-h">${an}</h3><ul class="skl">${sk.map(([k, n]) => `<li><button type="button" class="star s${num(C.skills && C.skills[k])}" data-skill="${k}" aria-label="zdatnost ${n}">★</button><span class="skl-name">${n}<small class="bk" data-d="bk.skill.${k}">${parts(skillParts(C, k))}</small></span><strong data-d="skill.${k}">${sgn(skillB(C, k))}</strong></li>`).join("")}</ul>` : ""; }).join("")}
      <h3 class="skl-h">Pasivní</h3>
      <ul class="skl">${PASSIVE.map(k => `<li><span></span><span class="skl-name">${SKILLS.find(s => s[0] === k)[1]}<small class="bk" data-d="bk.pas.${k}">10 ${sgn(skillB(C, k))}</small></span><strong data-d="pas.${k}">${10 + skillB(C, k)}</strong></li>`).join("")}</ul>
    </section>

    <section class="card"><h2>Zbraně</h2>
      <ul class="wp-list">${(C.weapons || []).map((w, i) => { const b = wpBonus(w); return `<li class="wp">
        <div class="wp-head"><div class="wp-roll"><strong>${esc(w.name || "Zbraň")}</strong><span>útok ${sgn(b)}</span><small class="bk">${parts(wpParts(w))}</small></div>
          <div class="wp-dmg"><span>zásah</span><strong>${esc(wpDmg(w) || "—")}</strong>${w.dmg ? `<small class="bk">${esc(String(w.dmg).replace(/d/gi, "k"))} + ${SHORT[wpAbKey(w)]} ${sgn(wpAb(w))}</small>` : ""}</div>
          <button type="button" class="ghost" data-wpedit="${i}" aria-expanded="${openWp.has(i)}">${openWp.has(i) ? "Hotovo" : "Upravit"}</button></div>
        <div class="wp-edit" id="wpe${i}"${openWp.has(i) ? "" : " hidden"}><div class="sh-grid">
          ${fld("", "Název", inp(`weapons.${i}.name`))}
          ${fld("", "Vlastnost", `<select data-p="weapons.${i}.abil">${[["sila", "Síla"], ["obr", "Obratnost"], ["vytr", "vytříbená (vyšší)"]].map(([k, l]) => `<option value="${k}"${w.abil === k ? " selected" : ""}>${l}</option>`).join("")}</select>`)}
          ${fld("", "Zásah", inp(`weapons.${i}.dmg`, 'placeholder="1d8"'))}
          ${fld("", "Typ", inp(`weapons.${i}.type`, 'placeholder="sečné"'))}
          ${fld("", "Dosah", inp(`weapons.${i}.range`))}
          ${fld("", "Bonus navíc", nin(`weapons.${i}.extra`))}
          ${fld("", "Vlastnosti a poznámka", inp(`weapons.${i}.note`), "wide")}
        </div><div class="row">${chk(`weapons.${i}.prof`, "zdatnost")}<button type="button" class="danger" data-rmwp="${i}">Odebrat zbraň</button></div></div>
        ${w.type || w.range || w.note ? `<small class="muted">${esc([w.type, w.range, w.note].filter(Boolean).join(" · "))}</small>` : ""}</li>`; }).join("")}</ul>
      <div class="row"><button type="button" id="addWp">Přidat zbraň</button>${(R().weapons || []).length ? `<select id="addWpT" aria-label="Zbraň z tabulky"><option value="">z tabulky…</option>${["jednoduché", "válečné"].map(cat => `<optgroup label="${cat}">${R().weapons.map((w, k) => w.cat === cat ? `<option value="${k}">${esc(w.name)} (${esc(w.dmg || "—")})</option>` : "").join("")}</optgroup>`).join("")}</select>` : ""}<span class="lbl">Zdatnost:</span>${chk("weaponProf.jednoduche", "jednoduché")}${chk("weaponProf.valecne", "válečné")}</div>
      <div class="sh-grid">${fld("", "Pomůcky", inp("tools"), "wide")}${fld("", "Jazyky", inp("languages"), "wide")}</div>
    </section>

    <section class="card"><h2>Schopnosti</h2>
      <ul class="ft-list">${(C.features || []).map((f, i) => { const u = f.uses && num(f.uses.max) > 0 ? f.uses : null; return `<li class="ft">
        <button type="button" class="ft-name" data-ft="${i}"><strong>${esc(f.name)}</strong>${f.summary ? `<span class="ex">${esc(f.summary)}</span>` : ""}</button>
        ${u ? `<span class="uses" aria-label="použití">${Array.from({ length: num(u.max) }, (_, k) => `<button type="button" class="use${k < num(u.used) ? " spent" : ""}" data-use="${i}" data-k="${k}" aria-label="použití ${k + 1}"></button>`).join("")}<small>${u.reset === "kratky" ? "KO" : "DO"}</small></span>` : ""}</li>`; }).join("")}</ul>
      ${pickerHTML("ftPick", "Přidat schopnost z knihovny…")}
    </section>

    <section class="card"><h2>Kouzla${cm ? " a alchymistická truhla" : ""}</h2>
      <div class="sh-grid">
        ${fld("", "Sesílací vlastnost", `<select data-p="cast.ability"><option value="">—</option>${ABIL.map(([k, n]) => `<option value="${k}"${castAb === k ? " selected" : ""}>${n}</option>`).join("")}</select>`)}
        <div class="stat"><span>SO záchrany</span><strong data-d="dc">${castAb ? 8 + pb + am(C, castAb) : "—"}</strong><small class="bk" data-d="bk.dc">${castAb ? `8 · zdatnost ${sgn(pb)} · ${SHORT[castAb]} ${sgn(am(C, castAb))}` : ""}</small></div>
        <div class="stat"><span>Útočný bonus</span><strong data-d="satk">${castAb ? sgn(pb + am(C, castAb)) : "—"}</strong><small class="bk" data-d="bk.satk">${castAb ? `zdatnost ${sgn(pb)} · ${SHORT[castAb]} ${sgn(am(C, castAb))}` : ""}</small></div>
      </div>
      ${sl.some(x => x) ? `<div class="slots">${sl.map((n, i) => n ? `<div class="slot-row"><span class="lbl">${i + 1}. stupeň</span>${Array.from({ length: n }, (_, k) => `<button type="button" class="use${k < num(C.cast.used && C.cast.used[i + 1]) ? " spent" : ""}" data-slot="${i + 1}" data-k="${k}" aria-label="pozice ${i + 1}. stupně"></button>`).join("")}</div>` : "").join("")}</div>` : `<p class="hint">Pozice kouzel se objeví, až nastavíš sesílající povolání.</p>`}
      ${pact ? `<div class="slot-row"><span class="lbl">Pakt (${pact.lvl}. st.)</span>${Array.from({ length: pact.n }, (_, k) => `<button type="button" class="use${k < num(C.cast.pactUsed) ? " spent" : ""}" data-pact="${k}" aria-label="pozice paktu"></button>`).join("")}<small class="hint">obnoví krátký odpočinek</small></div>` : ""}
      ${cm ? `<div class="slot-row"><span class="lbl">Truhla</span>${Array.from({ length: cm }, (_, k) => `<button type="button" class="use${k < num(C.chest.used) ? " spent" : ""}" data-chest="${k}" aria-label="použití truhly"></button>`).join("")}<small class="hint">${cm}× · dlouhý odpočinek</small></div>` : ""}
      <details class="sl-ovr"><summary>Upravit počty pozic ručně</summary><div class="when-grid">${Array.from({ length: 9 }, (_, i) => `<div class="field sm"><label>${i + 1}.</label><input type="number" inputmode="numeric" min="0" data-ovr="${i}" value="${C.cast.slotsOverride ? num(C.cast.slotsOverride[i]) : sl[i]}"></div>`).join("")}</div><button type="button" class="ghost" id="ovrReset">Počítat automaticky</button></details>
      ${spellsHTML()}
      ${pickerHTML("spPick", "Přidat kouzlo z knihovny…")}
    </section>

    <section class="card"><h2>Poznámky k hraní postavy</h2><textarea data-p="playNotes" rows="4" style="min-height:6em">${esc(C.playNotes || "")}</textarea></section>
    ${isOwner() || S.admin ? `<section class="card wide" id="delCard"><h2>Smazat deník</h2><p class="hint">Smaže postavu i tvoje zápisky k ní. Nejde vrátit.</p><div class="row"><button type="button" class="danger" id="chDel">Smazat deník</button></div></section>` : ""}`;
  }
  function armorWarn(){
    const t = C.armor.type, p = C.armorProf || {};
    const need = t === "lehka" ? p.lehke : t === "stredni" ? p.stredni : t === "tezka" ? p.tezke : true;
    return (!need || (C.armor.shield && !p.stity)) ? `<p class="notice warn">Bez zdatnosti v této zbroji nejde sesílat kouzla a hody na Sílu a Obratnost mají nevýhodu.</p>` : "";
  }
  const wpAbKey = w => w.abil === "obr" ? "obr" : w.abil === "vytr" ? (am(C, "obr") > am(C, "sila") ? "obr" : "sila") : "sila";
  const wpAb = w => am(C, wpAbKey(w));
  const wpBonus = w => wpAb(w) + (w.prof !== false ? prof(C) : 0) + num(w.extra);
  const wpParts = w => [[SHORT[wpAbKey(w)], wpAb(w), true], w.prof !== false ? ["zdatnost", prof(C)] : null, num(w.extra) ? ["navíc", num(w.extra)] : null];
  const wpDmg = w => w.dmg ? `${String(w.dmg).replace(/d/gi, "k")}${wpAb(w) ? (wpAb(w) > 0 ? "+" : "") + wpAb(w) : ""}` : "";
  function spellsHTML(){
    const sp = (C.spells || []).map((s, i) => ({ ...s, i, lib: s.libId && S.library.get(s.libId) }));
    if (!sp.length) return "";
    const groups = {};
    sp.forEach(s => { const l = s.lib ? num(s.lib.level) : -1; (groups[l] = groups[l] || []).push(s); });
    return Object.keys(groups).sort((a, b) => a - b).map(l => `<h3 class="skl-h">${l < 0 ? "Mimo knihovnu" : lvlName(l)}</h3><ul class="ft-list">${groups[l].sort((a, b) => (a.name || "").localeCompare(b.name || "", "cs")).map(s => `<li class="ft">
      <label class="chk prep" title="připraveno"><input type="checkbox" data-prep="${s.i}"${s.prepared ? " checked" : ""}><span class="sr">připraveno</span></label>
      <button type="button" class="ft-name" data-sp="${s.i}"><strong>${esc(s.lib ? s.lib.name : s.name)}</strong>${s.lib && s.lib.summary ? `<span class="ex">${esc(s.lib.summary)}</span>` : s.lib ? `<span class="ex">${esc(libMeta(s.lib))}</span>` : ""}</button></li>`).join("")}</ul>`).join("");
  }
  const SKN = Object.fromEntries(SKILLS.map(s => [s[0], s[1]]));
  function bgNote(){
    const b = ruleBg(C.background); if (!b) return "";
    return `<p class="hint">Zázemí ${esc(b.name)}: ${esc([(b.skills || []).map(k => SKN[k] || k).join(", "), b.other, b.feature ? "schopnost " + b.feature : "", b.page ? "str. " + b.page : ""].filter(Boolean).join(" · "))}</p>`;
  }
  function applyBg(){
    const b = ruleBg(C.background); if (!b) return false;
    C.skills = C.skills || {}; (b.skills || []).forEach(k => { C.skills[k] = Math.max(1, num(C.skills[k])); });
    C.features = (C.features || []).filter(f => !f.fromBg);
    if (b.feature && !C.features.some(f => norm(f.name) === norm(b.feature))){ const lib = libFind(b.feature, x => x.type === "schopnost"); C.features.push(lib ? { ...featFromLib(lib), fromBg: true } : { name: b.feature, summary: "", text: "", uses: null, fromBg: true }); }
    toast(`Zázemí ${b.name}: ${(b.skills || []).map(k => SKN[k] || k).join(", ")}${b.feature ? ", " + b.feature : ""}. Ostatní zdatnosti (${b.other}) zapiš ručně.`);
    return true;
  }
  // první povolání: záchrany, zdatnosti se zbrojí a zbraněmi a schopnosti 1. úrovně
  function applyClassStart(i){
    const c = C.classes[i], rc = ruleClass(c.name); if (!rc) return;
    c.hd = num(rc.hd, c.hd); c.caster = rc.caster || c.caster;
    const first = i === 0 && !Object.values(C.saves || {}).some(Boolean);
    if (first){
      C.saves = {}; (rc.saves || []).forEach(a => { C.saves[a] = true; });
      C.armorProf = C.armorProf || {}; (rc.armorProf || []).forEach(k => { C.armorProf[k] = true; });
      C.weaponProf = C.weaponProf || {}; (rc.weaponProf || []).forEach(k => { C.weaponProf[k] = true; });
    }
    const got = classFeatures(c.name, "", num(c.level, 1), true);
    got.forEach(e => { if (!C.features.some(f => f.libId === e.id)) C.features.push({ ...featFromLib(e), fromClass: c.name }); });
    toast(`${rc.name}: ${first ? "záchrany a zdatnosti se zbrojí a zbraněmi nastaveny, " : ""}${got.length ? "schopnosti 1. úrovně přidány. " : ""}Dovednosti: ${rc.skills}.`);
  }
  // schopnosti povolání z knihovny pro danou úroveň (upTo = všechny do této úrovně)
  function classFeatures(cls, sub, lvl, upTo){
    return [...S.library.values()].filter(e => e.type === "schopnost" && !e.group && norm(e.classes) === norm(cls) && (!e.subclass || (sub && norm(e.subclass) === norm(sub)))
      && String(e.levels || e.level || "").split(",").map(x => num(x)).some(n => upTo ? n <= lvl : n === lvl))
      .sort((a, b) => num(a.level) - num(b.level) || (a.name || "").localeCompare(b.name || "", "cs"));
  }
  const raceNames = () => lists().races.map(r => r.name);
  const lineageNames = race => { const r = lists().races.find(x => norm(x.name) === norm(race)); return r ? (r.lineages || []) : lists().races.flatMap(x => x.lineages || []); };
  const off = (val, list) => val && list.length && !list.some(x => norm(x) === norm(val)) ? ` <span class="pill rejected" title="Není v seznamu vypravěče">mimo seznam</span>` : "";
  const pickerHTML = (id, ph) => `<div class="picker"><input type="search" id="${id}" placeholder="${ph}" autocomplete="off"><ul class="pick-list" id="${id}L" hidden></ul></div>`;

  function gearHTML(){
    const ld = load(C), L = C.looks || {};
    return `
    <section class="card"><h2>Výbava</h2>
      <div class="load ${ld.over ? "over" : ""}"><div class="load-bar">${Array.from({ length: Math.max(ld.max, ld.used) }, (_, k) => `<i class="${k < ld.used ? "on" : ""} ${k === ld.L - 1 || k === ld.M - 1 ? "mark" : ""}"></i>`).join("")}</div>
        <p><strong>${ld.used} z ${ld.max} řádků</strong> · ${ld.label}${ld.pen && ld.pen !== 99 ? ` (rychlost −${ld.pen})` : ""}${ld.over ? " · víc, než uneseš" : ""}<br><span class="hint">Lehké do ${ld.L}, střední do ${ld.M}, těžké do ${ld.H} řádků${C.backpack ? "" : " (těžké jen s batohem)"}. Zbroj a štít se počítají samy.</span></p></div>
      <div class="row">${chk("backpack", "Mám batoh (+5 řádků)")}</div>
      <ul class="it-list">${(C.items || []).map((it, i) => `<li class="it">
        <input type="text" data-p="items.${i}.name" value="${esc(it.name || "")}" placeholder="předmět" aria-label="Předmět">
        <input type="number" inputmode="numeric" data-p="items.${i}.qty" data-num value="${num(it.qty, 1)}" aria-label="Počet" title="počet">
        <input type="text" inputmode="decimal" data-p="items.${i}.slots" value="${esc(it.slots ?? 1)}" aria-label="Řádků" title="řádků (drobnosti 0,33)">
        <button type="button" class="ghost" data-rmit="${i}" aria-label="Odebrat">×</button></li>`).join("")}</ul>
      <div class="row"><button type="button" id="addIt">Přidat předmět</button><span class="hint">Sloupce: předmět, počet, řádků. Tři drobnosti se vejdou do jednoho řádku (0,33).</span></div>
      ${fld("", "Peníze", inp("money", 'placeholder="např. 12 zl, 30 st"'), "wide")}
    </section>
    <section class="card"><h2>Vzhled</h2><div class="sh-grid">
      ${[["vek", "Věk"], ["vyska", "Výška"], ["vaha", "Váha"], ["plet", "Pleť"], ["vlasy", "Vlasy"], ["oci", "Oči"]].map(([k, l]) => fld("", l, `<input type="text" data-p="looks.${k}" value="${esc(L[k] || "")}">`)).join("")}
      ${[["postava", "Postava"], ["obleceni", "Oblečení a vzezření"], ["dojem", "Dojem a vystupování"]].map(([k, l]) => fld("", l, `<input type="text" data-p="looks.${k}" value="${esc(L[k] || "")}">`, "wide")).join("")}
    </div></section>
    <section class="card"><h2>Vztahy</h2>
      <ul class="it-list">${(C.relations || []).map((r, i) => `<li class="it rel"><input type="text" data-p="relations.${i}.who" value="${esc(r.who || "")}" placeholder="postava" aria-label="Postava"><input type="text" data-p="relations.${i}.what" value="${esc(r.what || "")}" placeholder="vztah" aria-label="Vztah"><button type="button" class="ghost" data-rmrel="${i}" aria-label="Odebrat">×</button></li>`).join("")}</ul>
      <button type="button" id="addRel">Přidat vztah</button>
    </section>
    <section class="card"><h2>Tituly, hodnosti, řády</h2><textarea data-p="titles" rows="2" style="min-height:4em">${esc(C.titles || "")}</textarea></section>
    <section class="card"><h2>Další poznámky</h2><p class="hint">Historie, poklady, organizace…</p><textarea data-p="story" rows="6" style="min-height:9em">${esc(C.story || "")}</textarea></section>`;
  }

  // --- obsluha ---
  function refresh(){
    const pb = prof(C), cab = C.cast && C.cast.ability;
    const set = (k, val) => document.querySelectorAll(`[data-d="${k}"]`).forEach(el => { el.textContent = val; });
    ABIL.forEach(([k]) => { set("mod." + k, sgn(am(C, k))); set("score." + k, score(C, k)); set("save." + k, sgn(saveB(C, k))); });
    SKILLS.forEach(([k]) => set("skill." + k, sgn(skillB(C, k))));
    PASSIVE.forEach(k => set("pas." + k, 10 + skillB(C, k)));
    set("prof", sgn(pb)); set("init", sgn(am(C, "obr") + num(C.initBonus))); set("speed", speed(C) + " sáhů");
    set("ac", acOf(C, C.armor.type)); set("ac0", acOf(C, "zadna"));
    set("dc", cab ? 8 + pb + am(C, cab) : "—"); set("satk", cab ? sgn(pb + am(C, cab)) : "—");
    set("bvcur", num(C.bv.cur)); set("bvmax", num(C.bv.max));
    ABIL.forEach(([k]) => set("bk.save." + k, parts(saveParts(C, k))));
    SKILLS.forEach(([k]) => set("bk.skill." + k, parts(skillParts(C, k))));
    PASSIVE.forEach(k => set("bk.pas." + k, `10 ${sgn(skillB(C, k))}`));
    set("bk.init", parts([["Obr", am(C, "obr"), true], ["bonus", num(C.initBonus)]]));
    set("bk.ac", parts(acParts(C, C.armor.type))); set("bk.ac0", parts(acParts(C, "zadna")));
    set("bk.dc", cab ? `8 · zdatnost ${sgn(pb)} · ${SHORT[cab]} ${sgn(am(C, cab))}` : ""); set("bk.satk", cab ? `zdatnost ${sgn(pb)} · ${SHORT[cab]} ${sgn(am(C, cab))}` : "");
  }
  function bind(v){
    const sheet = $("#sheet");
    if (tab === "zapisky") return notesTab();
    const structural = /^(race$|lineage$|background$|alignment$|classes\.\d+\.(caster|hd|level|name)|raceBonus\.|armor\.type|armor\.shield|armorProf\.|cast\.ability|backpack|weapons\.\d+\.(abil|prof|dmg|extra|name)|items\.\d+\.slots|base\.|exhaustion)/;
    sheet.querySelectorAll("[data-p]").forEach(el => {
      const ev = el.type === "checkbox" || el.tagName === "SELECT" ? "change" : "input";
      el.addEventListener(ev, () => {
        const p = el.dataset.p;
        let val = el.type === "checkbox" ? el.checked : el.value;
        if ("num" in el.dataset) val = num(val, 0);
        setP(C, p, val);
        if (p === "armor.type" && val === "zadna") C.armor.name = "";
        if (/^classes\.\d+\.name$/.test(p)){ const i = +p.split(".")[1], k = classInfo(val); if (k){ C.classes[i].hd = num(k.hd, 8); C.classes[i].caster = k.caster || "none";
          if (ruleClass(val) && !(C.features || []).some(f => f.fromClass && norm(f.fromClass) === norm(val))) applyClassStart(i);
          save(); return later(v); } }
        save(); refresh();
        if (structural.test(p) && ev === "change") later(v);
      });
      if (ev === "input" && structural.test(el.dataset.p)) el.addEventListener("change", () => {
        const p = el.dataset.p;
        if (p === "background" && canEdit()){ if (applyBg()) save(); }
        later(v);
      });
    });
    if (!canEdit()) return;
    // zdatnosti
    sheet.querySelectorAll("[data-save]").forEach(b => b.onclick = () => { C.saves = C.saves || {}; C.saves[b.dataset.save] = !C.saves[b.dataset.save]; b.classList.toggle("on"); save(); refresh(); });
    sheet.querySelectorAll("[data-skill]").forEach(b => b.onclick = () => { C.skills = C.skills || {}; const k = b.dataset.skill, n = (num(C.skills[k]) + 1) % 3; C.skills[k] = n; b.className = `star s${n}`; save(); refresh(); });
    // výdrž
    const amt = () => Math.max(0, num($("#bvAmt") && $("#bvAmt").value, 0));
    const bvd = $("#bvDmg"); if (bvd) bvd.onclick = () => { let a = amt(); const t = Math.min(num(C.bv.temp), a); C.bv.temp = num(C.bv.temp) - t; a -= t; C.bv.cur = Math.max(0, num(C.bv.cur) - a); save(); draw(v); };
    const bvh = $("#bvHeal"); if (bvh) bvh.onclick = () => { C.bv.cur = Math.min(num(C.bv.max), num(C.bv.cur) + amt()); if (C.bv.cur > 0) C.death = { s: 0, f: 0 }; save(); draw(v); };
    sheet.querySelectorAll("[data-death]").forEach(b => b.onclick = () => { const k = b.dataset.death, i = +b.dataset.i; C.death[k] = num(C.death[k]) >= i ? i - 1 : i; save(); draw(v); });
    // počítadla
    const toggleUse = (get, setv, k) => { const u = num(get()); setv(k < u ? k : k + 1); save(); draw(v); };
    sheet.querySelectorAll("[data-use]").forEach(b => b.onclick = () => { const f = C.features[+b.dataset.use]; toggleUse(() => f.uses.used, x => { f.uses.used = x; }, +b.dataset.k); });
    sheet.querySelectorAll("[data-slot]").forEach(b => b.onclick = () => { const l = b.dataset.slot; C.cast.used = C.cast.used || {}; toggleUse(() => C.cast.used[l], x => { C.cast.used[l] = x; }, +b.dataset.k); });
    sheet.querySelectorAll("[data-pact]").forEach(b => b.onclick = () => toggleUse(() => C.cast.pactUsed, x => { C.cast.pactUsed = x; }, +b.dataset.pact));
    sheet.querySelectorAll("[data-chest]").forEach(b => b.onclick = () => toggleUse(() => C.chest.used, x => { C.chest.used = x; }, +b.dataset.chest));
    sheet.querySelectorAll("[data-ovr]").forEach(el => el.addEventListener("change", () => { const cur = slotsOf(C); C.cast.slotsOverride = C.cast.slotsOverride || cur.slice(); C.cast.slotsOverride[+el.dataset.ovr] = num(el.value); save(); draw(v); }));
    const orr = $("#ovrReset"); if (orr) orr.onclick = () => { C.cast.slotsOverride = null; save(); draw(v); };
    // seznamy
    const on = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
    const wt = $("#addWpT"); if (wt) wt.onchange = () => {
      const w = R().weapons[+wt.value]; if (!w) return;
      const pr = norm(w.props), ranged = /dálku|palné/.test(w.kind || "");
      C.weapons = C.weapons || [];
      const byClass = (C.classes || []).some(c => { const rc = ruleClass(c.name); return rc && (norm(rc.weapons).includes(norm(w.name)) || norm(rc.weapons).startsWith("vsechny")); });
      C.weapons.push({ name: w.name, abil: /vytriben/.test(pr) ? "vytr" : ranged ? "obr" : "sila", prof: byClass || !!(C.weaponProf && C.weaponProf[w.cat === "válečné" ? "valecne" : "jednoduche"]), extra: 0, dmg: w.dmg || "", type: w.dtype || "", range: w.range ? w.range + " sáhů" : "", note: w.props || "" });
      save(); draw(v);
    };
    const at = $("#armT"); if (at) at.onchange = () => {
      const a = (R().armor || []).find(x => x.name === at.value); if (!a) return;
      C.armor.name = a.name; C.armor.type = a.cat === "lehká" ? "lehka" : a.cat === "střední" ? "stredni" : "tezka"; C.armor.base = num(a.base, 10);
      save(); draw(v);
    };
    on("#addWp", () => { C.weapons = C.weapons || []; C.weapons.push({ name: "", abil: "sila", prof: true, extra: 0, dmg: "1d6", type: "", range: "", note: "" }); openWp.add(C.weapons.length - 1); save(); draw(v); const e = $("#wpe" + (C.weapons.length - 1)); if (e) e.querySelector("input").focus(); });
    sheet.querySelectorAll("[data-wpedit]").forEach(b => b.onclick = () => { const i = +b.dataset.wpedit; openWp.has(i) ? openWp.delete(i) : openWp.add(i); draw(v); });
    sheet.querySelectorAll("[data-rmwp]").forEach(b => b.onclick = () => { C.weapons.splice(+b.dataset.rmwp, 1); openWp.clear(); save(); draw(v); });
    sheet.querySelectorAll("[data-rmcls]").forEach(b => b.onclick = () => { C.classes.splice(+b.dataset.rmcls, 1); save(); draw(v); });
    on("#addIt", () => { C.items = C.items || []; C.items.push({ name: "", qty: 1, slots: 1 }); save(); draw(v); const ins = sheet.querySelectorAll(".it-list .it input[type=text]"); });
    sheet.querySelectorAll("[data-rmit]").forEach(b => b.onclick = () => { C.items.splice(+b.dataset.rmit, 1); save(); draw(v); });
    on("#addRel", () => { C.relations = C.relations || []; C.relations.push({ who: "", what: "" }); save(); draw(v); });
    sheet.querySelectorAll("[data-rmrel]").forEach(b => b.onclick = () => { C.relations.splice(+b.dataset.rmrel, 1); save(); draw(v); });
    // schopnosti a kouzla
    sheet.querySelectorAll("[data-ft]").forEach(b => b.onclick = () => openFeature(v, +b.dataset.ft));
    sheet.querySelectorAll("[data-sp]").forEach(b => b.onclick = () => openSpell(v, +b.dataset.sp));
    sheet.querySelectorAll("[data-prep]").forEach(c => c.onchange = () => { C.spells[+c.dataset.prep].prepared = c.checked; save(); });
    picker(v, "ftPick", "schopnost", e => { C.features = C.features || []; C.features.push(featFromLib(e)); });
    picker(v, "spPick", "kouzlo", e => { C.spells = C.spells || []; if (!C.spells.some(s => s.libId === e.id)) C.spells.push({ libId: e.id, name: e.name, prepared: false }); });
    // odpočinky, rasa, postup
    on("#restShort", () => restShort(v));
    on("#restLong", () => restLong(v));
    on("#racePick", () => racePicker(v));
    on("#bgPick", () => bgPicker(v));
    on("#lvlStart", () => levelUp(v));
    on("#chDel", () => {
      const card = $("#delCard"); card.querySelector(".row").innerHTML = `<span class="hint">Opravdu smazat „${esc(C.name || "postavu")}“?</span><button type="button" class="danger" id="chDelY">Ano, smazat</button><button type="button" id="chDelN">Ponechat</button>`;
      $("#chDelN").onclick = () => draw(v);
      $("#chDelY").onclick = async () => {
        try {
          const col = collection(db, "characters", CID, "notes");
          if (isOwner()){ const own = await new Promise((res, rej) => { const u = onSnapshot(query(col, where("owner", "==", S.user.uid)), sn => { u(); const ids = []; sn.forEach(d => ids.push(d.id)); res(ids); }, rej); });
            const b = writeBatch(db); own.forEach(id => b.delete(doc(col, id))); b.delete(doc(db, "characters", CID)); S.routeSub && S.routeSub(); S.routeSub = null; await b.commit(); }
          else { S.routeSub && S.routeSub(); S.routeSub = null; await deleteDoc(doc(db, "characters", CID)); }
          toast("Deník smazán."); CID = null; C = null; go("#/deniky");
        } catch (e){ toast(errText(e), "err"); }
      };
    });
  }
  // počet použití: číslo, nebo "prof" = zdatnostní bonus (při postupu se přepočítá)
  const halfLvl = () => Math.ceil(level(C) / 2);
  const usesFrom = u => !u ? null : u.max === "prof" ? { max: prof(C), used: 0, reset: u.reset || "dlouhy", byProf: true }
    : u.max === "half" ? { max: halfLvl(), used: 0, reset: u.reset || "dlouhy", byHalf: true } : num(u.max) ? { max: num(u.max), used: 0, reset: u.reset || "dlouhy" } : null;
  const featFromLib = e => ({ libId: e.id, name: e.name, summary: e.summary || "", uses: usesFrom(e.uses) });
  function picker(v, id, type, add){
    const input = $("#" + id), list = $("#" + id + "L"); if (!input) return;
    const draw2 = () => {
      const q = norm(input.value);
      if (!q){ list.hidden = true; return; }
      const res = libSorted(type).filter(e => norm(e.name).includes(q)).slice(0, 8);
      list.innerHTML = res.map(e => `<li><button type="button" data-pk="${esc(e.id)}"><strong>${esc(e.name)}</strong><small>${esc(libMeta(e))}</small></button></li>`).join("")
        + `<li><button type="button" data-pnew><strong>+ ${type === "kouzlo" ? "Nové kouzlo" : "Nová schopnost"} „${esc(input.value.trim())}“</strong><small>přidat do knihovny${type === "schopnost" ? " nebo jen do deníku" : ""}</small></button></li>`;
      list.hidden = false;
      list.querySelectorAll("[data-pk]").forEach(b => b.onclick = () => { add(S.library.get(b.dataset.pk)); save(); draw(v); });
      list.querySelector("[data-pnew]").onclick = () => {
        const nm = input.value.trim();
        if (type === "schopnost"){
          const box = openOvl("Nová schopnost", `<p class="hint">Schopnost můžeš přidat jen do svého deníku, nebo rovnou do knihovny pro ostatní.</p><div class="row"><button type="button" class="primary" id="nfOwn">Jen do deníku</button><button type="button" id="nfLib">Do knihovny a deníku</button></div>`);
          box.querySelector("#nfOwn").onclick = () => { C.features = C.features || []; C.features.push({ name: nm, summary: "", text: "", uses: null }); closeOvl(); save(); draw(v); openFeature(v, C.features.length - 1); };
          box.querySelector("#nfLib").onclick = () => openLibForm({ type: "schopnost", name: nm }, e => { add(e); save(); draw(v); });
        } else openLibForm({ type: "kouzlo", name: nm }, e => { add(e); save(); draw(v); });
      };
    };
    input.addEventListener("input", draw2);
    input.addEventListener("keydown", e => { if (e.key === "Enter"){ e.preventDefault(); const f = list.querySelector("button"); if (f) f.click(); } });
  }
  function openFeature(v, i){
    const f = C.features[i], lib = f.libId && S.library.get(f.libId);
    const own = `<div class="ft-own"><h3 class="skl-h">V tomto deníku</h3>
      <div class="sh-grid">
        <div class="field"><label for="foName">Název</label><input type="text" id="foName" value="${esc(f.name || "")}"></div>
        <div class="field"><label for="foMax">Počet použití</label><input type="number" id="foMax" min="0" value="${f.uses ? num(f.uses.max) : ""}" placeholder="bez omezení"></div>
        <div class="field"><label for="foReset">Obnovuje</label><select id="foReset"><option value="dlouhy"${f.uses && f.uses.reset === "kratky" ? "" : " selected"}>dlouhý odpočinek</option><option value="kratky"${f.uses && f.uses.reset === "kratky" ? " selected" : ""}>krátký odpočinek</option></select></div>
        ${lib ? "" : `<div class="field wide"><label for="foText">Popis</label><textarea id="foText" style="min-height:6em">${esc(f.text || "")}</textarea></div>`}
      </div>
      ${canEdit() ? `<div class="row"><button type="button" class="primary" id="foSave">Uložit</button><button type="button" class="danger" id="foDel">Odebrat z deníku</button></div>` : ""}</div>`;
    const box = lib ? (openLibCard(lib, { html: own }), $("#ovlBody")) : openOvl(f.name || "Schopnost", (f.text ? `<div class="md">${renderMd(f.text)}</div>` : "") + own);
    const sv = box.querySelector("#foSave");
    if (sv) sv.onclick = () => { f.name = box.querySelector("#foName").value.trim() || f.name; const m = num(box.querySelector("#foMax").value); f.uses = m > 0 ? { max: m, used: Math.min(m, f.uses ? num(f.uses.used) : 0), reset: box.querySelector("#foReset").value } : null; const t = box.querySelector("#foText"); if (t) f.text = t.value; save(); closeOvl(); draw(v); };
    const dl = box.querySelector("#foDel");
    if (dl) dl.onclick = () => { C.features.splice(i, 1); save(); closeOvl(); draw(v); };
  }
  function openSpell(v, i){
    const s = C.spells[i], lib = s.libId && S.library.get(s.libId);
    const extra = { html: canEdit() ? `<div class="row"><button type="button" class="danger" id="spDel">Odebrat z deníku</button></div>` : "",
      bind: box => { const d = box.querySelector("#spDel"); if (d) d.onclick = () => { C.spells.splice(i, 1); save(); closeOvl(); draw(v); }; } };
    if (lib) openLibCard(lib, extra);
    else { const box = openOvl(s.name, `<p class="hint">Kouzlo už v knihovně není.</p>` + extra.html); extra.bind(box); }
  }
  function restShort(v){
    const pool = hdPool(C), om = am(C, "odol");
    const html = () => `<p>Během krátkého odpočinku můžeš utratit kostky obnovy. Hoď kostkou, zapiš, co padlo, a deník přičte opravu Odolnosti (${sgn(om)}).</p>
      <p><strong>BV: ${num(C.bv.cur)} / ${num(C.bv.max)}</strong></p>
      ${Object.entries(pool).map(([d, n]) => { const left = n - num(C.hdUsed[d]); return `<div class="row nowrap"><span class="lbl" style="min-width:7em">k${d}, zbývá ${left}</span><input type="number" inputmode="numeric" min="1" max="${d}" id="hdv${d}" placeholder="padlo" style="width:5.5em"${left > 0 ? "" : " disabled"} aria-label="Hod na k${d}"><button type="button" data-hd="${d}"${left > 0 ? "" : " disabled"}>Přičíst</button></div>`; }).join("")}
      <p class="hint" id="hdLog"></p>
      <div class="row"><button type="button" class="primary" id="srDone">Dokončit odpočinek</button></div>
      <p class="hint">Dokončení obnoví schopnosti s obnovou za krátký odpočinek a pozice paktu.</p>`;
    const box = openOvl("Krátký odpočinek", html());
    const bindHd = () => {
      box.querySelectorAll("[data-hd]").forEach(b => b.onclick = () => {
        const d = +b.dataset.hd, r = num(box.querySelector("#hdv" + d).value, 0);
        if (r < 1 || r > d) return toast(`Zadej, co padlo na k${d} (1–${d}).`, "err");
        const g = Math.max(0, r + om);
        C.hdUsed = C.hdUsed || {}; C.hdUsed[d] = num(C.hdUsed[d]) + 1;
        C.bv.cur = Math.min(num(C.bv.max), num(C.bv.cur) + g); save();
        const log = `k${d}: ${r} ${sgn(om)} = +${g} BV`;
        box.innerHTML = html(); box.querySelector("#hdLog").textContent = log; bindHd();
      });
      box.querySelector("#srDone").onclick = () => {
        (C.features || []).forEach(f => { if (f.uses && f.uses.reset === "kratky") f.uses.used = 0; });
        C.cast.pactUsed = 0; save(); closeOvl(); draw(v); toast("Krátký odpočinek dokončen.");
      };
    };
    bindHd();
  }
  function restLong(v){
    const box = openOvl("Dlouhý odpočinek", `<p>Dlouhý odpočinek obnoví všechny BV, polovinu kostek obnovy, pozice kouzel, truhlu a všechny schopnosti. Vyčerpání klesne o 1.</p><div class="row"><button type="button" class="primary" id="lrDo">Odpočinout si</button></div>`);
    box.querySelector("#lrDo").onclick = () => {
      C.bv.cur = num(C.bv.max); C.bv.temp = 0; C.death = { s: 0, f: 0 };
      const pool = hdPool(C); C.hdUsed = C.hdUsed || {};
      Object.entries(pool).forEach(([d, n]) => { C.hdUsed[d] = Math.max(0, num(C.hdUsed[d]) - Math.max(1, Math.floor(n / 2))); });
      C.cast.used = {}; C.cast.pactUsed = 0; C.chest.used = 0;
      (C.features || []).forEach(f => { if (f.uses) f.uses.used = 0; });
      C.exhaustion = Math.max(0, num(C.exhaustion) - 1);
      save(); closeOvl(); draw(v); toast("Dlouhý odpočinek dokončen.");
    };
  }
  const noRulesNote = what => (R().races || []).length ? "" : `<p class="notice warn">Údaje z pravidel JaD (${what}) ve wiki zatím nejsou. ${S.admin ? "Nahraj je v Knihovně tlačítkem Importovat." : "Vypravěč je musí nahrát v Knihovně."}</p>`;
  function bgPicker(v){
    const BG = R().backgrounds || [];
    const box = openOvl("Předvolba zázemí", noRulesNote("zázemí") + (BG.length ? `<ul class="pick-list static">${BG.map((b, i) => `<li><button type="button" data-bg="${i}"><strong>${esc(b.name)}</strong><small>${esc([(b.skills || []).map(k => SKN[k] || k).join(", "), b.other, b.feature ? "schopnost " + b.feature : "", b.page ? "str. " + b.page : ""].filter(Boolean).join(" · "))}</small></button></li>`).join("")}</ul>
      <p class="hint">Vybráním se doplní zázemí, zdatnosti v dovednostech a schopnost zázemí. Pomůcky a jazyky zapiš ručně. Předchozí schopnost zázemí se z deníku odebere.</p>` : ""));
    box.querySelectorAll("[data-bg]").forEach(b => b.onclick = () => { C.background = BG[+b.dataset.bg].name; applyBg(); save(); closeOvl(); draw(v); });
  }
  function allRaces(){
    const hbNames = new Set(RACES.map(r => norm(r.name)));
    const jad = (R().races || []).filter(r => !hbNames.has(norm(r.name))).map(r => ({ ...r, key: "r-" + slug(r.name), src: R().source || "JaD", allowNone: true,
      lineages: (r.lineages || []).map(l => ({ ...l, key: "l-" + slug(l.name) })) }));
    return [...RACES.map(r => ({ ...r, src: "Malenor", allowNone: false })), ...jad];
  }
  const bonusTxt = b => Object.entries(b || {}).filter(([, n]) => num(n)).map(([k, n]) => `${sgn(num(n))} ${SHORT[k]}`).join(", ");
  function racePicker(v){
    const RS = allRaces();
    const statLine = (r, l) => [bonusTxt(l && l.bonus || r.bonus) || (l && l.bonusNote) || r.bonusNote, `${(l && l.speed) || r.speed} sáhů`, (l && l.darkvision) || r.darkvision ? `vidění ve tmě ${(l && l.darkvision) || r.darkvision} sáhů` : "", l && l.bonusNote && bonusTxt(l.bonus) ? l.bonusNote : ""].filter(Boolean).join(" · ");
    const box = openOvl("Předvolba rasy a rodu", noRulesNote("rasy") + RS.map(r => `<h3 class="skl-h">${esc(r.name)} <small class="hint">${esc(r.src)}${r.page ? ", str. " + esc(r.page) : ""}</small></h3>
        <ul class="pick-list static">${r.allowNone || !r.lineages.length ? `<li><button type="button" data-race="${r.key}" data-lin=""><strong>${r.lineages.length ? "bez rodu" : esc(r.name)}</strong><small>${esc(statLine(r, null))}</small></button></li>` : ""}
        ${r.lineages.map(l => `<li><button type="button" data-race="${r.key}" data-lin="${l.key}"><strong>${esc(l.name)}</strong><small>${esc(statLine(r, l))}</small></button></li>`).join("")}</ul>`).join("")
      + `<p class="hint">Vybráním se doplní rasa, rod, bonusy k vlastnostem, rychlost, jazyky, rasové zdatnosti a rasové schopnosti. Předchozí rasové schopnosti se z deníku odeberou. Všechno jde potom přepsat ručně. U Beorů bonus rodu nahrazuje základní bonus, u elfů Malenoru se k +2 Obr přičítá.</p>`);
    box.querySelectorAll("[data-race]").forEach(b => b.onclick = () => {
      const r = RS.find(x => x.key === b.dataset.race), l = b.dataset.lin ? r.lineages.find(x => x.key === b.dataset.lin) : null;
      C.race = r.name; C.raceKey = r.key; C.lineage = l ? l.name : ""; C.raceBonus = { ...((l && l.bonus) || r.bonus || {}) }; C.speed = (l && l.speed) || r.speed || 6;
      C.skills = C.skills || {}; (r.skills || []).forEach(k => { C.skills[k] = Math.max(1, num(C.skills[k])); });
      if (r.languages && !norm(C.languages).includes(norm(r.languages.split(",")[0]))) C.languages = [C.languages, r.languages].filter(Boolean).join(", ");
      C.features = (C.features || []).filter(f => !f.fromRace);
      const names = [...(r.traits || []).filter(t => !(l && l.replaces && norm(l.replaces) === norm(t))), ...((l && l.traits) || [])];
      names.forEach(tn => {
        if (C.features.some(f => norm(f.name) === norm(tn))) return;
        const lib = libFind(tn, x => x.type === "schopnost" && !x.classes);
        if (lib) return C.features.push({ ...featFromLib(lib), fromRace: true });
        const h = HOMEBREW_FEATURES.find(x => norm(x.name) === norm(tn));
        C.features.push(h ? { name: h.name, summary: h.summary || "", text: h.text || "", uses: usesFrom(h.uses), fromRace: true } : { name: tn, summary: "", text: "", uses: null, fromRace: true });
      });
      const dv = (l && l.darkvision) || r.darkvision;
      C.raceNote = [!bonusTxt(C.raceBonus) && r.bonusNote ? "Doplň bonus: " + r.bonusNote : "", l && l.bonusNote ? "Doplň bonus: " + l.bonusNote : "", r.skillNote ? "Vyber " + r.skillNote : "", l && l.languagesExtra ? "Jazyky: " + l.languagesExtra : "", dv ? `Vidění ve tmě ${dv} sáhů` : "", l && l.hpPerLevel ? `+${l.hpPerLevel} BV za každou úroveň (připočti k maximu)` : "", r.size && r.size !== "Střední" ? "Velikost: " + r.size.toLowerCase() : ""].filter(Boolean).join(" · ");
      save(); closeOvl(); draw(v); toast(`${r.name}${l ? ": " + l.name : ""}.`);
    });
  }
  function levelUp(v){
    const om = am(C, "odol");
    const box = openOvl(`Postup na úroveň ${level(C) + 1}`, `
      <div class="field"><label for="luCls">Které povolání zvyšuješ</label><select id="luCls">${(C.classes || []).map((c, i) => `<option value="${i}">${esc(c.name || "povolání " + (i + 1))} ${num(c.level)} → ${num(c.level) + 1}</option>`).join("")}<option value="new">Nové povolání (víc povolání)</option></select></div>
      <div id="luNew" hidden class="sh-grid"><div class="field"><label for="luName">Název</label><input type="text" id="luName" list="clsList2"><datalist id="clsList2">${lists().classes.map(c => `<option value="${esc(c.name)}">`).join("")}</datalist></div></div>
      <p>Přírůstek BV: hoď kostkou povolání a zapiš, co padlo, nebo vezmi průměr. Přičte se oprava Odolnosti (${sgn(om)}).</p>
      <div class="row"><input type="number" inputmode="numeric" min="1" id="luVal" placeholder="padlo" style="width:5.5em" aria-label="Hod na kostku povolání"><button type="button" id="luRoll">Použít hod</button><button type="button" id="luAvg">Průměr</button><strong id="luBv"></strong></div>
      <p class="hint" id="luAsi"></p>
      <div id="luFeat"></div>
      <div class="row"><button type="button" class="primary" id="luDo" disabled>Postoupit</button></div>`);
    let gain = null;
    const cur = () => { const val = box.querySelector("#luCls").value; if (val === "new"){ const k = classInfo(box.querySelector("#luName").value); return { hd: k ? num(k.hd, 8) : 8, newLevel: 1, name: box.querySelector("#luName").value, sub: "" }; } const c = C.classes[+val]; return { hd: num(c.hd, 8), newLevel: num(c.level) + 1, name: c.name, sub: c.sub || "" }; };
    const upd = () => {
      const c = cur(); box.querySelector("#luNew").hidden = box.querySelector("#luCls").value !== "new";
      box.querySelector("#luAsi").textContent = asiOf(c.name).includes(c.newLevel) ? `Na ${c.newLevel}. úrovni povolání ${c.name || ""} si zvyšuješ hodnoty vlastností (nebo bereš odbornost). Uprav je v deníku.` : "";
      const fs2 = classFeatures(c.name, c.sub, c.newLevel, c.newLevel === 1);
      const own = new Set((C.features || []).map(f => f.libId).filter(Boolean));
      const rc = ruleClass(c.name), needSub = rc && (rc.subclasses || []).length && !c.sub && fs2.some(e => /archetyp|cesty|kolej|původ|patron|kruh|domén|tradice|řád|specializace/i.test(e.name));
      box.querySelector("#luFeat").innerHTML = fs2.length ? `<h3 class="skl-h">Schopnosti na ${c.newLevel}. úrovni</h3><p class="hint">Zaškrtnuté se přidají do deníku. Už získané schopnosti, které se na této úrovni zlepšují, jsou označené.</p>
        <ul class="lu-list">${fs2.map(e => `<li><label class="chk"><input type="checkbox" data-luf="${esc(e.id)}"${own.has(e.id) ? "" : " checked"}> ${esc(e.name)}</label><span class="hint">${esc([e.subclass, own.has(e.id) ? "zlepšení" : "", e.page ? "str. " + e.page : ""].filter(Boolean).join(" · "))}</span></li>`).join("")}</ul>
        ${needSub ? `<div class="field"><label for="luSub">Obor povolání</label><input type="text" id="luSub" list="luSubL"><datalist id="luSubL">${rc.subclasses.map(n => `<option value="${esc(n)}">`).join("")}</datalist></div><p class="hint">Po zvolení oboru se nabídnou i jeho schopnosti.</p>` : ""}` : "";
      const ls = box.querySelector("#luSub");
      if (ls) ls.onchange = () => { const val = box.querySelector("#luCls").value; if (val !== "new" && rc.subclasses.some(n => norm(n) === norm(ls.value))){ C.classes[+val].sub = rc.subclasses.find(n => norm(n) === norm(ls.value)); upd(); } };
    };
    box.querySelector("#luCls").onchange = () => { gain = null; box.querySelector("#luBv").textContent = ""; box.querySelector("#luDo").disabled = true; upd(); };
    box.querySelector("#luName").oninput = upd;
    const setGain = (g, txt) => { gain = Math.max(1, g + om); box.querySelector("#luBv").textContent = `${txt} ${sgn(om)} = +${gain} BV`; box.querySelector("#luDo").disabled = false; };
    box.querySelector("#luRoll").onclick = () => { const d = cur().hd, r = num(box.querySelector("#luVal").value, 0); if (r < 1 || r > d) return toast(`Zadej, co padlo na k${d} (1–${d}).`, "err"); setGain(r, `k${d}: ${r}`); };
    box.querySelector("#luAvg").onclick = () => { const d = cur().hd, a = d / 2 + 1; setGain(a, `průměr k${d}: ${a}`); };
    box.querySelector("#luDo").onclick = () => {
      const val = box.querySelector("#luCls").value;
      if (val === "new"){ const nm = box.querySelector("#luName").value.trim(); if (!nm) return toast("Doplň název povolání.", "err"); const k = classInfo(nm); C.classes.push({ name: nm, level: 1, hd: k ? num(k.hd, 8) : 8, caster: k ? (k.caster || "none") : "none" }); }
      else C.classes[+val].level = num(C.classes[+val].level) + 1;
      const fromCls = val === "new" ? C.classes[C.classes.length - 1].name : C.classes[+val].name;
      box.querySelectorAll("[data-luf]:checked").forEach(cb => { const e = S.library.get(cb.dataset.luf); if (e && !(C.features || []).some(f => f.libId === e.id)) C.features.push({ ...featFromLib(e), fromClass: fromCls }); });
      C.bv.max = num(C.bv.max) + gain; C.bv.cur = num(C.bv.cur) + gain;
      (C.features || []).forEach(f => { if (f.uses && f.uses.byProf) f.uses.max = prof(C); if (f.uses && f.uses.byHalf) f.uses.max = halfLvl(); });
      C.levelUps = Math.max(0, num(C.levelUps) - 1);
      save(); closeOvl(); draw(v); toast(`Úroveň ${level(C)}. Zdatnostní bonus ${sgn(prof(C))}.`);
    };
    upd();
  }

  // ---------- zápisky ----------
  function notesTab(){
    if (notesUnsub){ notesUnsub(); notesUnsub = null; }
    const box = $("#notesBox"), notes = new Map(), subs = [];
    const col = collection(db, "characters", CID, "notes");
    const drawN = () => {
      const list = [...notes.values()].sort((a, b) => tsMs(b.createdAt) - tsMs(a.createdAt));
      box.innerHTML = `${isOwner() ? `<section class="card"><h2>Nový zápisek</h2>
          <form id="nForm" class="editor" autocomplete="off"><div class="field"><label for="nTitle">Nadpis (nepovinné)</label><input type="text" id="nTitle" maxlength="120"></div>
          <div class="field"><label for="nBody">Text</label><textarea id="nBody" style="min-height:8em"></textarea></div>
          <div class="row"><label class="chk"><input type="checkbox" id="nPub"> Zveřejnit (uvidí družina i vypravěč)</label><button type="submit" class="primary">Uložit zápisek</button></div></form></section>` : `<p class="hint">Vidíš jen zveřejněné zápisky.</p>`}
        ${list.length ? list.map(n => `<section class="card note"><div class="spread"><h3>${esc(n.title || "Zápisek")}</h3><span class="hint">${fmtWhen(n.createdAt)} · ${n.public ? "veřejný" : "soukromý"}</span></div>
          <div class="md">${renderMd(n.body)}</div>
          ${isOwner() ? `<div class="row"><label class="chk"><input type="checkbox" data-npub="${esc(n.id)}"${n.public ? " checked" : ""}> veřejný</label><button type="button" class="ghost" data-ndel="${esc(n.id)}">Smazat</button></div>` : ""}</section>`).join("") : `<p class="muted">Zatím žádné zápisky.</p>`}`;
      const f = $("#nForm");
      if (f) f.onsubmit = async e => {
        e.preventDefault(); const body = $("#nBody").value.trim(); if (!body) return toast("Napiš text zápisku.", "err");
        try { await setDoc(doc(col), { owner: S.user.uid, title: $("#nTitle").value.trim(), body, public: $("#nPub").checked, createdAt: serverTimestamp() }); toast("Zápisek uložen."); }
        catch (er){ toast(errText(er), "err"); }
      };
      box.querySelectorAll("[data-npub]").forEach(c => c.onchange = async () => { try { await updateDoc(doc(col, c.dataset.npub), { public: c.checked }); } catch (er){ toast(errText(er), "err"); } });
      box.querySelectorAll("[data-ndel]").forEach(b => b.onclick = () => { b.outerHTML = `<button type="button" class="danger" data-ndy="${b.dataset.ndel}">Opravdu smazat</button>`; box.querySelector(`[data-ndy="${b.dataset.ndel}"]`).onclick = async () => { try { await deleteDoc(doc(col, b.dataset.ndel)); } catch (er){ toast(errText(er), "err"); } }; });
    };
    const part = {};
    const sub = (tag, q) => subs.push(onSnapshot(q, snap => { part[tag] = []; snap.forEach(d => part[tag].push({ id: d.id, ...d.data() })); notes.clear(); Object.values(part).flat().forEach(n => notes.set(n.id, n)); drawN(); }, err => { console.error("notes", err); drawN(); }));
    if (isOwner()) sub("own", query(col, where("owner", "==", S.user.uid)));
    sub("pub", query(col, where("public", "==", true)));
    notesUnsub = () => subs.forEach(u => u());
  }

  return {
    listen, reset, charsView, charView, libraryView, listsView,
    setOnChange: fn => { onChange = fn; }
  };
}
