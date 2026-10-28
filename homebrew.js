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
    text: "Jednou mezi krátkými odpočinky můžeš za bonusovou akci skočit až o polovinu své základní rychlosti k viditelnému nepříteli. Tvůj další útok proti němu má výhodu." },
  // Elfové Malenoru (text: článek Elfové Malenoru)
  { name: "Vidění ve tmě", source: "Elfové Malenoru", summary: "Do 12 sáhů vidíš za šera jako ve dne a ve tmě jako za šera, jen v odstínech šedi.",
    text: "Do vzdálenosti 12 sáhů vidíš v šeru, jako by bylo jasné světlo, a ve tmě, jako by bylo šero. Ve tmě nerozeznáváš barvy, jen odstíny šedi." },
  { name: "Bystré smysly", source: "Elfové Malenoru", summary: "Zdatnost ve Vnímání.", text: "Jsi zdatný v dovednosti Vnímání." },
  { name: "Předkové z Vílího světa", source: "Elfové Malenoru", summary: "Výhoda na záchrany proti zmámení, magie tě nemůže uspat.",
    text: "Máš výhodu na záchranné hody proti tomu, abys byl zmámený, a magie tě nemůže uspat." },
  { name: "Trans", source: "Elfové Malenoru", summary: "Nespíš; čtyři hodiny meditace nahradí osm hodin spánku.",
    text: "Elfové nespí. Místo toho čtyři hodiny hluboce meditují a získají tím stejný užitek, jaký člověku přinese osm hodin spánku." },
  { name: "Elfí kouzelnický trik", source: "Elfové Malenoru – sluneční a měsíční elfové", summary: "Umíš jeden kouzelnický trik dle volby.",
    text: "Umíš v základu jeden kouzelnický trik." },
  { name: "Hvězdný krok", source: "Elfové Malenoru – hvězdní elfové", uses: { max: "prof", reset: "dlouhy" },
    summary: "Bonusovou akcí se přeneseš až o 6 sáhů na volné místo, které vidíš. Počet = zdatnostní bonus.",
    text: "Bonusovou akcí se můžeš přenést až o šest sáhů na neobsazené místo, které vidíš. Tuto schopnost můžeš použít tolikrát, kolik činí tvůj zdatnostní bonus, a všechna použití obnovíš po dlouhém odpočinku." },
  { name: "Rychlý krok", source: "Elfové Malenoru – lesní elfové", summary: "Rychlost 7 sáhů.", text: "Tvoje rychlost je 7 sáhů." },
  { name: "Maska divočiny", source: "Elfové Malenoru – lesní elfové", summary: "Můžeš se skrýt i v lehkém přírodním zakrytí (listí, déšť, sníh, mlha).",
    text: "Můžeš se pokusit skrýt, i když jsi jen v lehkém zakrytí listím, hustým deštěm, padajícím sněhem, mlhou nebo jiným přírodním jevem." },
  { name: "Řeč zvířat", source: "Elfové Malenoru – divocí elfové", summary: "Zvuky a gesty sdělíš zvířatům jednoduché představy.",
    text: "Zvuky a gesty dokážeš sdělit jednoduché představy tvorům typu zvíře." },
  { name: "Úkryt v lese", source: "Elfové Malenoru – divocí elfové", summary: "V lese se můžeš skrýt bonusovou akcí.", text: "V lese se můžeš bonusovou akcí pokusit skrýt." },
  { name: "Vlčí podoba", source: "Elfové Malenoru – lythari", uses: { max: "half", reset: "dlouhy" },
    summary: "Akcí se proměníš ve vlka (OČ 12 + Obr, rychlost 8, kousnutí 1k8 + Sil se sražením). Cyklů = polovina úrovně, zaokrouhleno nahoru.",
    text: "**Použití.** Můžeš provést počet cyklů proměny rovný polovině své úrovně, zaokrouhleno nahoru (1. úroveň 1 cyklus, 3. úroveň 2, 5. úroveň 3 … 19. úroveň 10). Všechny spotřebované cykly obnovíš po dokončení dlouhého odpočinku. Jeden cyklus znamená proměnu do vlčí podoby a návrat do elfí podoby.\n\n**Proměna.** Proměna do vlčí podoby i návrat do elfí podoby stojí akci. Ve vlčí podobě jsi vlk Střední velikosti.\n\n**Konec proměny.** Vlčí podoba trvá, dokud se akcí nevrátíš do elfí podoby. Automaticky se do ní vrátíš, když klesneš na 0 životů, upadneš do bezvědomí nebo zemřeš. Trans ani přirozený spánek proměnu neukončí. Automatický návrat se počítá jako dokončený cyklus.\n\n**Herní statistiky.** Ve vlčí podobě si zachováváš své životy, hodnoty vlastností, zdatnosti a ostatní herní statistiky, pokud není uvedeno jinak. Obranné číslo: 12 + oprava Obratnosti. Rychlost: 8 sáhů.\n\n**Kousnutí.** Přirozená zbraň, se kterou jsi zdatný. Útok zbraní na blízko, při zásahu 1k8 + oprava Síly bodného zranění. V rámci akce Útok můžeš kousnutím útočit tolikrát, kolikrát ti akce Útok dovoluje. Kousnutí nemá vlastnost jemná, a proto s ním nelze použít Zákeřný útok.\n\n**Sražení.** Jednou za tah, když kousnutím zasáhneš tvora Střední nebo menší velikosti, musí cíl uspět v záchranném hodu na Sílu, jinak je sražen a získá stav ležící. SO = 8 + zdatnostní bonus + oprava Síly.\n\n**Smysly.** Zachováváš si vidění ve tmě a předky z Vílího světa. Máš výhodu na Moudrost (Přežití) a na Moudrost (Vnímání) založenou na sluchu nebo čichu.\n\n**Omezení.** Nemůžeš mluvit, sesílat kouzla ani používat předměty a nástroje. Máš zranitelnost vůči zranění od postříbřených zbraní.\n\n**Soustředění a probíhající účinky.** Proměna nepřeruší tvoje soustředění. Účinky, které na tebe působí, trvají, dokud neskončí nebo nejsou jinak přerušeny.\n\n**Výbava.** Výbava s tebou při proměně nesplyne. Předměty, které držíš, a zbroj spadnou na zem v tvém prostoru. Pokud se proměníš v oblečení nebo ve zbroji, utrpíš 1k6 drtivého zranění a oblečení se poškodí. Zbroj poškozená není." },
  { name: "Odolnost vůči ohni", source: "Elfové Malenoru – Sulatar", summary: "Odolnost vůči ohnivému zranění.", text: "Máš odolnost vůči ohnivému zranění." },
  { name: "Kovář", source: "Elfové Malenoru – Sulatar", summary: "Zdatnost s kovářským nářadím.", text: "Jsi zdatný s kovářským nářadím." }
];

// Rasy s předvolbami. U rodu se uvádí celkový bonus (u Beorů nahrazuje základ, u elfů je v něm základ +2 Obr už započtený).
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
    ]  },
  {
    key: "elf-malenor", name: "Elf", speed: 6, darkvision: 12, bonus: { obr: 2 }, additive: true,
    traits: ["Vidění ve tmě", "Bystré smysly", "Předkové z Vílího světa", "Trans"],
    skills: ["vnimani"], languages: "Obecná řeč, elfština",
    lineages: [
      { key: "slunecni", name: "Sluneční elfové", bonus: { obr: 2, int: 1 }, traits: ["Elfí kouzelnický trik"] },
      { key: "mesicni", name: "Měsíční elfové", bonus: { obr: 2, int: 1 }, traits: ["Elfí kouzelnický trik"] },
      { key: "hvezdni", name: "Hvězdní elfové", bonus: { obr: 2, int: 1 }, traits: ["Hvězdný krok"] },
      { key: "lesni", name: "Lesní elfové", bonus: { obr: 2, mou: 1 }, speed: 7, traits: ["Rychlý krok", "Maska divočiny"] },
      { key: "divoci", name: "Divocí elfové", bonus: { obr: 2, mou: 1 }, traits: ["Řeč zvířat", "Úkryt v lese"] },
      { key: "lythari", name: "Lythari", bonus: { obr: 2, sila: 1 }, traits: ["Vlčí podoba"] },
      { key: "sulatar", name: "Sulatar", bonus: { obr: 2, odol: 1 }, traits: ["Odolnost vůči ohni", "Kovář"] }
    ]
  }
];
