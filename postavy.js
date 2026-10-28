// MalenorWiki – deníky postav, výbava, zápisky a knihovna kouzel a schopností (pravidla JaD).
import { HOMEBREW_FEATURES, RACES } from "./homebrew.js?v=8";

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
    S.dataSubs.push(onSnapshot(collection(db, "library"), snap => {
      S.library.clear(); snap.forEach(d => S.library.set(d.id, { id: d.id, ...d.data() })); S.loaded.library = true; changed();
    }, err => { console.error("library", err); S.loaded.library = true; }));
  }
  let chTimer = null, onChange = () => {};
  function changed(){ clearTimeout(chTimer); chTimer = setTimeout(() => onChange(), 40); }
  function reset(){ S.chars.clear(); S.library.clear(); charParts = {}; }

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
  const libSorted = type => [...S.library.values()].filter(x => !type || x.type === type).sort((a, b) => (a.type === "kouzlo" && b.type === "kouzlo" ? num(a.level) - num(b.level) : 0) || (a.name || "").localeCompare(b.name || "", "cs"));
  const lvlName = l => num(l) === 0 ? "trik" : `${num(l)}. stupeň`;
  const canEditLib = e => S.admin || (e && e.createdBy === S.user.uid);
  function libMeta(e){
    if (e.type !== "kouzlo") return [e.source, e.uses && e.uses.max ? `${e.uses.max}× za ${e.uses.reset === "kratky" ? "krátký" : "dlouhý"} odpočinek` : ""].filter(Boolean).join(" · ");
    return [lvlName(e.level) + (e.school ? `, ${e.school.toLowerCase()}` : ""), e.ritual ? "rituál" : "", e.conc ? "soustředění" : ""].filter(Boolean).join(" · ");
  }
  function libCardHTML(e){
    const rows = e.type === "kouzlo"
      ? [["Doba seslání", e.cast], ["Dosah", e.range], ["Složky", e.comp], ["Trvání", (e.conc ? "soustředění, " : "") + (e.dur || "")], ["Povolání", e.classes], ["Zdroj", e.source]]
      : [["Původ", e.source], ["Použití", e.uses && e.uses.max ? `${e.uses.max}× za ${e.uses.reset === "kratky" ? "krátký" : "dlouhý"} odpočinek` : ""]];
    const link = e.url || (e.type === "kouzlo" && e.srd !== false ? srdUrl(e.name) : "");
    return `<p class="lib-meta">${esc(libMeta(e))}</p>
      ${e.summary ? `<p class="lib-sum">${esc(e.summary)}</p>` : ""}
      <dl class="lib-dl">${rows.filter(r => r[1]).map(r => `<div><dt>${r[0]}</dt><dd>${esc(r[1])}</dd></div>`).join("")}</dl>
      ${e.text ? `<div class="md lib-text">${renderMd(e.text)}</div>` : ""}
      ${link ? `<p><a class="btn" href="${esc(link)}" target="_blank" rel="noopener">Plné znění</a></p>` : ""}`;
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
      const dup = [...S.library.values()].find(x => norm(x.name) === norm(name) && (!e || x.id !== e.id));
      if (dup) return toast(`„${dup.name}“ už v knihovně je.`, "err");
      const data = { type, name, summary: v("#lfSum"), source: v("#lfSource"), url: v("#lfUrl"), text: box.querySelector("#lfText").value };
      if (type === "kouzlo") Object.assign(data, { level: num(v("#lfLvl")), school: v("#lfSchool"), cast: v("#lfCast"), range: v("#lfRange"), comp: v("#lfComp"), dur: v("#lfDur"), conc: box.querySelector("#lfConc").checked, ritual: box.querySelector("#lfRit").checked, classes: v("#lfClasses") });
      else { const u = num(v("#lfUses")); data.uses = u > 0 ? { max: u, reset: v("#lfReset") } : null; }
      try {
        const ref = e && e.id ? doc(db, "library", e.id) : doc(collection(db, "library"));
        await setDoc(ref, { ...data, createdBy: e && e.createdBy ? e.createdBy : S.user.uid, createdByName: e && e.createdByName ? e.createdByName : myName(), updatedAt: serverTimestamp() });
        toast("Uloženo do knihovny."); onSaved && onSaved({ id: ref.id, ...data });
      } catch (er){ toast(errText(er), "err"); }
    };
  }
  function openLibCard(e, extra){
    const box = openOvl(e.name, libCardHTML(e) + (extra ? extra.html : "") + (canEditLib(e) ? `<p><button type="button" id="lcEdit" class="ghost">Upravit v knihovně</button></p>` : ""));
    if (extra && extra.bind) extra.bind(box);
    const ed = box.querySelector("#lcEdit");
    if (ed) ed.onclick = () => { const b = openOvl("Upravit: " + e.name, libFormHTML(e)); bindLibForm(b, e, () => closeOvl()); };
  }
  function openLibForm(prefill, onSaved){ const b = openOvl("Přidat do knihovny", libFormHTML(prefill)); bindLibForm(b, prefill, x => { closeOvl(); onSaved && onSaved(x); }); }

  function libraryView(v){
    S.editing = false;
    const q = (S._libQ || ""), ty = S._libT || "";
    v.innerHTML = `<div class="head"><span class="eyebrow"><a href="#/deniky">deníky</a></span><h1>Knihovna</h1>
        <p class="lede">Kouzla a schopnosti, které používáte. Každý člen může přidávat. U kouzel stačí krátký popis, plné znění se otevře v SRD JaD.</p></div>
      <div class="row"><input type="search" id="libQ" placeholder="Hledat kouzlo nebo schopnost…" value="${esc(q)}" style="flex:1 1 220px">
        <div class="seg" role="group" aria-label="Filtr">${[["", "Vše"], ["kouzlo", "Kouzla"], ["schopnost", "Schopnosti"]].map(([k, l]) => `<button type="button" data-lt="${k}" aria-pressed="${ty === k}">${l}</button>`).join("")}</div>
        <button type="button" class="primary" id="libAdd">Přidat</button>
        ${S.admin && !HOMEBREW_FEATURES.every(h => [...S.library.values()].some(x => norm(x.name) === norm(h.name))) ? `<button type="button" id="libSeed">Nahrát homebrew Beorů</button>` : ""}</div>
      <ul class="list" id="libList"></ul>`;
    const draw = () => {
      const qq = norm($("#libQ").value); S._libQ = $("#libQ").value;
      const items = libSorted(S._libT || "").filter(e => !qq || norm(e.name).includes(qq) || norm(e.summary).includes(qq) || norm(e.classes).includes(qq));
      $("#libList").innerHTML = items.length ? items.map(e => `<li><button type="button" class="item ghost lib-row" data-id="${esc(e.id)}"><strong>${esc(e.name)}</strong><small>${e.type === "kouzlo" ? "kouzlo" : "schopnost"} · ${esc(libMeta(e))}</small>${e.summary ? `<span class="ex">${esc(e.summary)}</span>` : ""}</button></li>`).join("")
        : `<li class="muted" style="padding:10px 0">Nic nenalezeno.</li>`;
      $("#libList").querySelectorAll("[data-id]").forEach(b => b.onclick = () => openLibCard(S.library.get(b.dataset.id)));
    };
    $("#libQ").addEventListener("input", draw);
    v.querySelectorAll("[data-lt]").forEach(b => b.onclick = () => { S._libT = b.dataset.lt; v.querySelectorAll("[data-lt]").forEach(x => x.setAttribute("aria-pressed", x === b ? "true" : "false")); draw(); });
    $("#libAdd").onclick = () => openLibForm({ type: S._libT === "schopnost" ? "schopnost" : "kouzlo", name: $("#libQ").value.trim() });
    const sb = $("#libSeed");
    if (sb) sb.onclick = async () => {
      sb.disabled = true;
      try {
        const b = writeBatch(db); let n = 0;
        for (const h of HOMEBREW_FEATURES){
          if ([...S.library.values()].some(x => norm(x.name) === norm(h.name))) continue;
          b.set(doc(collection(db, "library")), { type: "schopnost", name: h.name, summary: h.summary || "", text: h.text || "", source: h.source || "homebrew", url: "", uses: h.uses || null, createdBy: S.user.uid, createdByName: myName(), updatedAt: serverTimestamp() }); n++;
        }
        await b.commit(); toast(`Nahráno ${n} schopností.`);
      } catch (er){ toast(errText(er), "err"); sb.disabled = false; }
    };
    draw();
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
        <div class="spread"><h1>Deníky postav</h1><div class="row"><a class="btn" href="#/knihovna">Knihovna kouzel</a><button type="button" class="primary" id="newChar">Nová postava</button></div></div>
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
        ${fld("", "Rasa", `<div class="row nowrap">${inp("race", 'maxlength="60"')}<button type="button" id="racePick" title="Vybrat homebrew rasu">Vybrat</button></div>`)}
        ${fld("", "Rod", inp("lineage", 'maxlength="60"'))}
        ${fld("", "Zázemí", inp("background", 'maxlength="60"'))}
        ${fld("", "Přesvědčení", inp("alignment", 'maxlength="40"'))}
      </div>
      <div class="cls-list">${(C.classes || []).map((c, i) => `<div class="cls-row">
          <div class="field"><label>Povolání</label><input type="text" list="clsList" data-p="classes.${i}.name" data-cls="${i}" value="${esc(c.name || "")}"></div>
          <div class="field sm"><label>Úroveň</label><input type="number" inputmode="numeric" min="1" max="20" data-p="classes.${i}.level" data-num value="${num(c.level, 1)}"${S.admin ? "" : " readonly title=\"Úroveň zvyšuje vypravěč přes postup\""}></div>
          <div class="field sm"><label>Kostka</label><select data-p="classes.${i}.hd" data-num>${[6, 8, 10, 12].map(d => `<option value="${d}"${num(c.hd) === d ? " selected" : ""}>k${d}</option>`).join("")}</select></div>
          <div class="field"><label>Sesílání</label><select data-p="classes.${i}.caster">${Object.entries(CASTER).map(([k, l]) => `<option value="${k}"${c.caster === k ? " selected" : ""}>${l}</option>`).join("")}</select></div>
          ${i > 0 && S.admin ? `<button type="button" class="ghost" data-rmcls="${i}" aria-label="Odebrat povolání">×</button>` : ""}
        </div>`).join("")}</div>
      <datalist id="clsList">${CLASSES.map(c => `<option value="${c[0]}">`).join("")}</datalist>
      <div class="row"><label class="chk"><input type="checkbox" data-p="public"${C.public ? " checked" : ""}${isOwner() ? "" : " disabled"}> Zpřístupnit deník družině</label></div>
    </section>

    <section class="card wide"><h2>Vlastnosti</h2>
      <div class="abil-grid">${ABIL.map(([k, n]) => `<div class="abil">
        <div class="abil-roll"><span>${n}</span><strong data-d="mod.${k}">${sgn(am(C, k))}</strong></div>
        <div class="abil-in"><input type="number" inputmode="numeric" data-p="base.${k}" data-num value="${num(C.base && C.base[k], 10)}" aria-label="${n} – základ">${num(C.raceBonus && C.raceBonus[k]) ? `<span class="hint" title="bonus rasy">${sgn(num(C.raceBonus[k]))}</span>` : ""}<span class="abil-score" data-d="score.${k}">${score(C, k)}</span></div>
      </div>`).join("")}</div>
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
      </div>
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
      <div class="row"><button type="button" id="addWp">Přidat zbraň</button><span class="lbl">Zdatnost:</span>${chk("weaponProf.jednoduche", "jednoduché")}${chk("weaponProf.valecne", "válečné")}</div>
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

    <section class="card"><h2>Poznámky k hraní postavy</h2><textarea data-p="playNotes" rows="4" style="min-height:6em">${esc(C.playNotes || "")}</textarea></section>`;
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
    const structural = /^(classes\.\d+\.(caster|hd|level)|armor\.type|armor\.shield|armorProf\.|cast\.ability|backpack|weapons\.\d+\.(abil|prof|dmg|extra|name)|items\.\d+\.slots|base\.|exhaustion)/;
    sheet.querySelectorAll("[data-p]").forEach(el => {
      const ev = el.type === "checkbox" || el.tagName === "SELECT" ? "change" : "input";
      el.addEventListener(ev, () => {
        const p = el.dataset.p;
        let val = el.type === "checkbox" ? el.checked : el.value;
        if ("num" in el.dataset) val = num(val, 0);
        setP(C, p, val);
        if (/^classes\.\d+\.name$/.test(p)){ const i = +p.split(".")[1], k = CLASSES.find(c => norm(c[0]) === norm(val)); if (k){ C.classes[i].hd = k[1]; C.classes[i].caster = k[2]; save(); return later(v); } }
        save(); refresh();
        if (structural.test(p) && ev === "change") later(v);
      });
      if (ev === "input" && structural.test(el.dataset.p)) el.addEventListener("change", () => later(v));
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
    on("#lvlStart", () => levelUp(v));
  }
  const featFromLib = e => ({ libId: e.id, name: e.name, summary: e.summary || "", uses: e.uses && num(e.uses.max) ? { max: num(e.uses.max), used: 0, reset: e.uses.reset || "dlouhy" } : null });
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
  function racePicker(v){
    const box = openOvl("Homebrew rasy", RACES.map(r => `<h3 class="skl-h">${esc(r.name)}</h3><div class="row">${r.lineages.map(l => `<button type="button" data-race="${r.key}" data-lin="${l.key}">${esc(l.name)}</button>`).join("")}</div>`).join("")
      + `<p class="hint">Vybráním se doplní rasa, rod, bonusy k vlastnostem (bonus rodu nahrazuje základní bonus), rychlost, jazyky, zdatnost v Přežití a rasové schopnosti z knihovny. Bonusy se dají kdykoli přepsat ručně.</p>`);
    box.querySelectorAll("[data-race]").forEach(b => b.onclick = () => {
      const r = RACES.find(x => x.key === b.dataset.race), l = r.lineages.find(x => x.key === b.dataset.lin);
      C.race = r.name; C.raceKey = r.key; C.lineage = l.name; C.raceBonus = { ...(l.bonus || r.bonus) }; C.speed = r.speed;
      C.skills = C.skills || {}; (r.skills || []).forEach(k => { C.skills[k] = Math.max(1, num(C.skills[k])); });
      if (r.languages && !norm(C.languages).includes(norm(r.languages.split(",")[0]))) C.languages = [C.languages, r.languages].filter(Boolean).join(", ");
      C.features = C.features || [];
      [...r.traits, ...(l.traits || [])].forEach(tn => {
        if (C.features.some(f => norm(f.name) === norm(tn))) return;
        const lib = [...S.library.values()].find(x => norm(x.name) === norm(tn));
        if (lib) C.features.push(featFromLib(lib));
        else { const h = HOMEBREW_FEATURES.find(x => norm(x.name) === norm(tn)); if (h) C.features.push({ name: h.name, summary: h.summary || "", text: h.text || "", uses: h.uses ? { max: h.uses.max, used: 0, reset: h.uses.reset } : null }); }
      });
      save(); closeOvl(); draw(v); toast(`${r.name}: ${l.name}.`);
    });
  }
  function levelUp(v){
    const om = am(C, "odol");
    const box = openOvl(`Postup na úroveň ${level(C) + 1}`, `
      <div class="field"><label for="luCls">Které povolání zvyšuješ</label><select id="luCls">${(C.classes || []).map((c, i) => `<option value="${i}">${esc(c.name || "povolání " + (i + 1))} ${num(c.level)} → ${num(c.level) + 1}</option>`).join("")}<option value="new">Nové povolání (víc povolání)</option></select></div>
      <div id="luNew" hidden class="sh-grid"><div class="field"><label for="luName">Název</label><input type="text" id="luName" list="clsList2"><datalist id="clsList2">${CLASSES.map(c => `<option value="${c[0]}">`).join("")}</datalist></div></div>
      <p>Přírůstek BV: hoď kostkou povolání a zapiš, co padlo, nebo vezmi průměr. Přičte se oprava Odolnosti (${sgn(om)}).</p>
      <div class="row"><input type="number" inputmode="numeric" min="1" id="luVal" placeholder="padlo" style="width:5.5em" aria-label="Hod na kostku povolání"><button type="button" id="luRoll">Použít hod</button><button type="button" id="luAvg">Průměr</button><strong id="luBv"></strong></div>
      <p class="hint" id="luAsi"></p>
      <div class="row"><button type="button" class="primary" id="luDo" disabled>Postoupit</button></div>`);
    let gain = null;
    const cur = () => { const val = box.querySelector("#luCls").value; if (val === "new"){ const k = CLASSES.find(c => norm(c[0]) === norm(box.querySelector("#luName").value)); return { hd: k ? k[1] : 8, newLevel: 1, name: box.querySelector("#luName").value }; } const c = C.classes[+val]; return { hd: num(c.hd, 8), newLevel: num(c.level) + 1, name: c.name }; };
    const upd = () => { const c = cur(); box.querySelector("#luNew").hidden = box.querySelector("#luCls").value !== "new"; box.querySelector("#luAsi").textContent = ASI.includes(c.newLevel) ? `Na ${c.newLevel}. úrovni povolání ${c.name || ""} si obvykle zvyšuješ vlastnosti nebo bereš odbornost. Uprav hodnoty v deníku.` : ""; };
    box.querySelector("#luCls").onchange = () => { gain = null; box.querySelector("#luBv").textContent = ""; box.querySelector("#luDo").disabled = true; upd(); };
    box.querySelector("#luName").oninput = upd;
    const setGain = (g, txt) => { gain = Math.max(1, g + om); box.querySelector("#luBv").textContent = `${txt} ${sgn(om)} = +${gain} BV`; box.querySelector("#luDo").disabled = false; };
    box.querySelector("#luRoll").onclick = () => { const d = cur().hd, r = num(box.querySelector("#luVal").value, 0); if (r < 1 || r > d) return toast(`Zadej, co padlo na k${d} (1–${d}).`, "err"); setGain(r, `k${d}: ${r}`); };
    box.querySelector("#luAvg").onclick = () => { const d = cur().hd, a = d / 2 + 1; setGain(a, `průměr k${d}: ${a}`); };
    box.querySelector("#luDo").onclick = () => {
      const val = box.querySelector("#luCls").value;
      if (val === "new"){ const nm = box.querySelector("#luName").value.trim(); if (!nm) return toast("Doplň název povolání.", "err"); const k = CLASSES.find(c => norm(c[0]) === norm(nm)); C.classes.push({ name: nm, level: 1, hd: k ? k[1] : 8, caster: k ? k[2] : "none" }); }
      else C.classes[+val].level = num(C.classes[+val].level) + 1;
      C.bv.max = num(C.bv.max) + gain; C.bv.cur = num(C.bv.cur) + gain;
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
    listen, reset, charsView, charView, libraryView,
    setOnChange: fn => { onChange = fn; }
  };
}
