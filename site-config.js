// Nastavení MalenorWiki, které se mění jen výjimečně.

// ID účtů vypravěčů (správců). Musí být shodné se seznamem ve firestore.rules.
export const ADMIN_UIDS = [];

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
  { key: "ostatni", name: "Ostatní", desc: "Všechno, co se jinam nevešlo" }
];
