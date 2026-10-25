# MalenorWiki

Společná wiki světa Malenor pro vypravěče a hráče. Běží na GitHub Pages, data a přihlašování zajišťuje Firebase.

## Stránky

- `index.html` – samotná wiki (články, sekce, návrhy úprav, členové)
- `kalendar.html` – převodník kalendáře, Časinka a model Garu a Rigu

## Jak wiki funguje

- Přihlášení je přes Google. Kdo se přihlásí poprvé, čeká, až ho vypravěč schválí v sekci **Členové**.
- Vypravěč upravuje články přímo. Hráči posílají **návrhy**, které vypravěč schválí, upraví a schválí, nebo zamítne.
- Při každé změně se předchozí znění článku uloží do **Historie**.
- Odkaz na jiný článek se píše `[[Název článku]]`, s vlastním textem `[[Název článku|text]]`.
- Obrázek z Google Disku: sdílet „kdokoli s odkazem“ a vložit `![popis](odkaz)`.

## Soubory

- `site-config.js` – seznam vypravěčů (ADMIN_UIDS) a sekcí
- `firebase-config.js` – veřejná konfigurace Firebase
- `firestore.rules` – pravidla databáze; po každé změně je potřeba je vložit do Firebase konzole (Firestore → Rules → Publish)
- `app.js`, `styles.css` – aplikace a vzhled
