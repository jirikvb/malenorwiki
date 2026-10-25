// Nastavení MalenorWiki, které se mění jen výjimečně.

// ID účtů vypravěčů (správců). Musí být shodné se seznamem ve firestore.rules.
export const ADMIN_UIDS = ["XTzKUDtsVRR6LBmcMUsC5F8b4iO2"];

// Sekce wiki. Klíč (key) se ukládá k článkům, proto ho po založení článků neměň.
// Název a popis měnit můžeš kdykoli.
export const SECTIONS = [
  { key: "panteon", name: "Panteon", desc: "Bohové a božské mocnosti" },
  { key: "rasy", name: "Rasy", desc: "Národy a rody Malenoru" },
  { key: "frakce", name: "Frakce", desc: "Řády, státy a společenstva" },
  { key: "mista", name: "Místa", desc: "Země, města a památná místa" },
  { key: "postavy", name: "Postavy", desc: "Osobnosti, které stojí za zmínku" },
  { key: "jazyky", name: "Jazyky", desc: "Řeči, písma a slovníky" },
  { key: "cas", name: "Kalendář a čas", desc: "Tváře, svátky, časinky a dvojčata" },
  { key: "dejiny", name: "Dějiny", desc: "Události, války a věky Malenoru" },
  { key: "ostatni", name: "Ostatní", desc: "Všechno, co se jinam nevešlo" }
];

// Věky Malenoru na historické ose. Roky př.v.v. jsou záporné, rok 0 je konec Velké války.
// "to: null" znamená současnost (CURRENT_YEAR).
export const AGES = [
  { key: "I", name: "Věk ztracených říší", from: -66000, to: -52000, approx: true },
  { key: "II", name: "Věk zázraků", from: -52000, to: -27000, approx: true },
  { key: "III", name: "Věk příchodu", from: -27000, to: -15000, approx: true },
  { key: "IV", name: "Věk vzdoru", from: -15000, to: 0, approx: true },
  { key: "V", name: "Věk rovnosti", from: 0, to: null, approx: false }
];

// Současný rok v kampani (p.v.v.).
export const CURRENT_YEAR = 422;

// Tváře (měsíce) korinského kalendáře.
export const MONTHS = ["Jas", "Nýnna", "Juron", "Tegal", "Nuros", "Věž", "Kala", "Rigis", "Regis", "Jukton", "Deela", "Stařec"];
