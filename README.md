# Nákupy

Spoločný nákupný zoznam pre domácnosť s akciami z letákov. Beží zadarmo, bez AI a bez kreditov:

- **Aplikácia** je webová (PWA). Na iPhone aj Androide sa pridá na plochu a správa sa ako aplikácia. Z tej istej adresy sa dá vyrobiť aj APK.
- **Prihlásenie a spoločný zoznam:** Firebase od Google (bezplatný plán Spark). Prihlásenie cez Google účet, členov pridáš e-mailom.
- **Akcie z letákov:** GitHub Actions každý pondelok, stredu a štvrtok ráno stiahne letáky a uloží `web/data/katalog.json`. Bez AI, len čítanie textu z PDF a dát z webu.
- **Hosting:** GitHub Pages.

## Čo je kde

| Cesta | Čo to je |
|---|---|
| `web/` | celá aplikácia (HTML, CSS, JS, ikony, offline vrstva) |
| `web/data/katalog.json` | akcie z letákov, generuje ho skript |
| `scraper/scrape.py` | prehľadávanie letákov (Kaufland, Tesco, Lidl) |
| `firestore.rules` | kto smie čítať a meniť zoznam (len členovia domácnosti) |
| `.github/workflows/letaky.yml` | automatické prehľadávanie a nasadenie |

## Nastavenie (raz, asi 15 minút)

### 1. Firebase (prihlásenie a spoločný zoznam)
1. Otvor <https://console.firebase.google.com>, prihlás sa Google účtom a klikni **Vytvoriť projekt** (napr. `nakupy`). Google Analytics netreba.
2. **Build → Authentication → Get started → Sign-in method → Google → Enable**, vyber e-mail podpory a ulož.
3. **Build → Firestore Database → Create database**, lokalita `europe-west` (napr. `eur3`), režim **production**.
4. Vo Firestore otvor kartu **Rules**, vlož obsah súboru `firestore.rules` z tohto repozitára a klikni **Publish**.
5. **Project settings (ozubené koleso) → General → Your apps → ikona `</>` (Web)**, názov `nakupy`, Hosting nezaškrtávaj, **Register app**. Skopíruj objekt `firebaseConfig` a pošli ho Claudovi (alebo ho vlož do `web/firebase-config.js`). Tieto údaje nie sú tajné.
6. **Authentication → Settings → Authorized domains → Add domain:** `kopcek24.github.io`

### 2. GitHub Pages (kde aplikácia beží)
GitHub Pages zadarmo funguje pre **verejný** repozitár (pre súkromný treba GitHub Pro). Kód neobsahuje heslá ani tajomstvá a tvoje dáta sú vo Firebase, nie v repozitári.
1. **Settings → General → Danger Zone → Change visibility → Public.**
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. **Actions → Letáky a nasadenie → Run workflow.** Po pár minútach je aplikácia na `https://kopcek24.github.io/N-kupny-zoznam/`.

### 3. Do telefónu
- **iPhone:** otvor adresu v Safari → Zdieľať → **Pridať na plochu**.
- **Android:** otvor adresu v Chrome → ⋮ → **Inštalovať aplikáciu** (vytvorí skutočnú aplikáciu v zozname aplikácií).
- **APK súbor (voliteľné):** na <https://www.pwabuilder.com> zadaj adresu aplikácie → *Package for stores* → *Android* → stiahneš APK zadarmo.

## Členovia domácnosti
Vpravo hore ťukni na svoju fotku → zadaj e-mail Google účtu člena → **Pridať**. Člen otvorí aplikáciu, prihlási sa cez Google a vidí ten istý nákupný zoznam a kupóny. Zmeny sa zobrazujú naživo. **Obľúbené má každý používateľ vlastné**, viazané na jeho účet. Keď je niektorá obľúbená vec v zľave, upozornenie uvidia všetci členovia (s menom, komu patrí). Kto nemá pridaného člena, má zoznam len pre seba.

## Ručné spustenie prehľadávania
```bash
sudo apt-get install poppler-utils
python3 scraper/scrape.py            # všetky obchody
python3 scraper/scrape.py kaufland   # len jeden
```
