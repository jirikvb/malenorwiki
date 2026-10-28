// Homebrew Malenoru pro deníky postav. Texty jsou převzaté z dokumentu Beor.

const T_BERSERKR = "Pokud se váš počet životů sníží na 0, ale nezahynete okamžitě, můžete se rozhodnout zůstat při vědomí až do konce svého příštího tahu. Dokud takto zůstáváte při vědomí, můžete jednat normálně, neztratíte vědomí v důsledku toho, že máte 0 životů, a neprovádíte záchranné hody proti smrti. Pokud utrpíte v tomto kole poškození zatím co máte 0 životů, bere se to jako jeden neúspěšný hod v záchraně proti smrti. Pokud máte na konci svého dalšího tahu stále 0 životů, upadáte do bezvědomí a začnete provádět záchranné hody proti smrti jako obvykle.\n\nJakmile tuto vlastnost použiješ, nemůžeš ji použít znovu, dokud nedokončíš dlouhý odpočinek.";

// Schopnosti, které se nahrají do knihovny a přidávají se postavám při výběru rasy a rodu.
export const HOMEBREW_FEATURES = [
  { name: "Vidění ve tmě (Beor)", source: "Beor", summary: "Za šera vidí na 12 sáhů jako za dne, ve tmě jako za šera. Nevidí barvy, jen odstíny šedé.",
    text: "Za šera vidí na 12 sáhů jako za dne a v noci vidí jako za šera. Nevidí barvy, jen odstíny šedé." },
  { name: "Dotek berserkra", source: "Beor", uses: { max: 1, reset: "dlouhy" },
    summary: "Při poklesu na 0 životů můžeš zůstat při vědomí a jednat až do konce příštího tahu. Jednou za dlouhý odpočinek.",
    text: T_BERSERKR },
  { name: "Odolání chladu", source: "Beor", summary: "Odolnost vůči zranění chladem a výhoda na hody proti extrémnímu chladu a vánicím.",
    text: "Máš odolnost vůči zranění chladem a výhodu na hody proti účinkům extrémního chladu, vánic a podobných klimatických jevů." },
  { name: "Tuhý sever", source: "Beor", summary: "Zdatnost v dovednosti Přežití.",
    text: "Díky nepříznivému podnebí, na nějž si zvykl, máš zdatnost v dovednosti Přežití." },
  { name: "Ledoštít", source: "Beor – Ledorození", uses: { max: 1, reset: "kratky" },
    summary: "Když jsi cílem útoku, přidáš si k OČ zdatnostní bonus do začátku svého dalšího kola. Jednou za krátký odpočinek.",
    text: "Jednou mezi krátkými odpočinky, pokud jsi cílem útoku, si můžeš přidat bonus k OČ rovný tvému zdatnostnímu bonusu do začátku tvého dalšího kola." },
  { name: "Pach krve", source: "Beor – Krvorození",
    summary: "Po zabití nepřítele se okamžitě přesuneš o polovinu svého pohybu bez příležitostných útoků.",
    text: "Umožňuje ti se po zabití nepřítele okamžitě přesunout o polovinu svého pohybu (i kdyby ses už v daném kole pohnul). Tento pohyb nevyvolává příležitostné útoky." },
  { name: "Mořské nohy", source: "Beor – Mořerození",
    summary: "Výhoda na všechna sražení a rychlost šplhání rovná polovině rychlosti.",
    text: "Díky letům stráveným na palubě lodi máš výhodu na všechna sražení a rychlost šplhání rovnou polovině své rychlosti." },
  { name: "Dotek předků", source: "Beor – Stínorození", uses: { max: 1, reset: "dlouhy" },
    summary: "Přehodíš jeden neúspěšný záchranný hod sobě nebo spojenci na dohled. Jednou za dlouhý odpočinek.",
    text: "Umožňuje ti přehodit jeden neúspěšný záchranný hod. Tuto schopnost můžeš použít jednou mezi dlouhými odpočinky a udělit ji sobě nebo jednomu spojenci, kterého máš na dohled. Pokud je použita, počítá se nový hod.\n\nJako stínorozený ovládáš jeden trik dle své volby ze seznamu kouzel druida nebo klerika. Tvá sesílací vlastnost pro toto kouzlo je Moudrost." },
  { name: "Do vřavy", source: "Beor – Skálorození", uses: { max: 1, reset: "kratky" },
    summary: "Za bonusovou akci skočíš až o polovinu základní rychlosti k viditelnému nepříteli, další útok proti němu má výhodu. Jednou za krátký odpočinek.",
    text: "Jednou mezi krátkými odpočinky můžeš za bonusovou akci skočit až o polovinu své základní rychlosti k viditelnému nepříteli. Tvůj další útok proti němu má výhodu." }
];

// Rasy s předvolbami. Bonus rodu nahrazuje základní bonus rasy (domácí pravidlo).
export const RACES = [
  {
    key: "beor", name: "Beor", speed: 6, bonus: { odol: 2 },
    traits: ["Vidění ve tmě (Beor)", "Dotek berserkra", "Odolání chladu", "Tuhý sever"],
    skills: ["preziti"], languages: "Beorština, obecná řeč",
    lineages: [
      { key: "ledorozeni", name: "Ledorození", bonus: { odol: 2, sila: 1 }, traits: ["Ledoštít"] },
      { key: "krvorozeni", name: "Krvorození", bonus: { sila: 2, odol: 1 }, traits: ["Pach krve"] },
      { key: "morerozeni", name: "Mořerození", bonus: { odol: 2, obr: 1 }, traits: ["Mořské nohy"] },
      { key: "stinorozeni", name: "Stínorození", bonus: { mou: 2, odol: 1 }, traits: ["Dotek předků"] },
      { key: "skalorozeni", name: "Skálorození", bonus: { sila: 2, odol: 1 }, traits: ["Do vřavy"] }
    ]
  }
];
