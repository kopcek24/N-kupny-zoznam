#!/usr/bin/env python3
"""Týždenné prehľadanie letákov. Bez AI, bez platených služieb.

Výstup: web/data/katalog.json
  {"generated": "...", "stores": {"kaufland": {"current": {...}, "next": {...}|null,
   "items": [{n, s, p, op, u, c, k, f, t}], "updated": "YYYY-MM-DD"}, ...}}

Každý obchod je samostatná funkcia. Keď jeden zlyhá, ostatné bežia ďalej
a pre zlyhaný obchod ostanú dáta z minulého behu.
"""
import datetime as dt
import json
import os
import re
import subprocess
import sys
import tempfile
import traceback
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "web", "data", "katalog.json")
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"
TODAY = dt.date.today().isoformat()


def get(url, binary=False, timeout=120):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "sk-SK,sk;q=0.9"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        data = r.read()
    return data if binary else data.decode("utf-8", "replace")


def num(x):
    try:
        return float(str(x).replace(",", ".").strip())
    except (TypeError, ValueError):
        return None


def money(v):
    return f"{v:.2f}".replace(".", ",")


def pdf_text(pdf_bytes, first=None, last=None):
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
        f.write(pdf_bytes)
        path = f.name
    try:
        args = ["pdftotext"]
        if first:
            args += ["-f", str(first)]
        if last:
            args += ["-l", str(last)]
        return subprocess.run(args + [path, "-"], capture_output=True, text=True, check=True).stdout
    finally:
        os.unlink(path)


def pdf_pages(pdf_bytes):
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
        f.write(pdf_bytes)
        path = f.name
    try:
        info = subprocess.run(["pdfinfo", path], capture_output=True, text=True).stdout
        m = re.search(r"Pages:\s+(\d+)", info)
        n = int(m.group(1)) if m else 0
        pages = [subprocess.run(["pdftotext", "-f", str(i), "-l", str(i), path, "-"],
                                capture_output=True, text=True).stdout for i in range(1, n + 1)]
        return pages
    finally:
        os.unlink(path)


def dedupe(items):
    seen, out = set(), []
    for it in items:
        key = (it["n"], it.get("s"), it.get("p"), it.get("f"))
        if key in seen or not it["n"]:
            continue
        seen.add(key)
        for k in [k for k, v in it.items() if v in ("", None)]:
            del it[k]
        out.append(it)
    return out


# --------------------------------------------------------------------------- Kaufland
def kaufland():
    """Kaufland má ponuku na webe ako JSON. Aktuálny aj budúci týždeň."""
    pages = ["https://predajne.kaufland.sk/aktualna-ponuka/letak.html",
             "https://predajne.kaufland.sk/aktualna-ponuka/buduci-tyzden.html",
             "https://predajne.kaufland.sk/aktualna-ponuka/prehlad.html"]
    offers = {}
    dec = json.JSONDecoder()
    for url in pages:
        try:
            s = get(url)
        except Exception as e:  # noqa: BLE001
            print("  kaufland: nedá sa načítať", url, e)
            continue
        for m in re.finditer(r'\{"offerId":', s):
            try:
                o, _ = dec.raw_decode(s, m.start())
                offers[o["offerId"]] = o
            except ValueError:
                pass
    items, ranges = [], {}
    for o in offers.values():
        title = o.get("title") or (o.get("detailTitle") or "").split("\n")[-1]
        if not title or o.get("dateTo", "") < TODAY:
            continue
        old, loy = num(o.get("formattedOldPrice")), num(o.get("loyaltyFormattedPrice"))
        if not old and not loy and not o.get("discount"):
            continue
        conds = []
        if loy:
            conds.append(f"s Kaufland Card {o['loyaltyFormattedPrice']} €")
        first = (o.get("detailTitle") or "").split("\n")[0].strip()
        if o.get("bonusbuy") and first and first.lower() != title.lower() and not loy:
            conds.append(first)
        bp = (o.get("formattedBasePrice") or o.get("basePrice") or "").strip("() ")
        unit = re.sub(r"^=?\s*(.*?)\s+([0-9,.]+)$", r"\1 = \2 €", bp) if bp else ""
        it = {"n": re.sub(r"\s+", " ", title).strip(), "s": o.get("unit") or "", "p": o.get("price"),
              "op": old, "u": unit, "c": "; ".join(conds),
              "k": re.sub(r"\s+", " ", o.get("subtitle") or "").strip()[:60],
              "f": o["dateFrom"], "t": o["dateTo"]}
        items.append(it)
        ranges[(o["dateFrom"], o["dateTo"])] = ranges.get((o["dateFrom"], o["dateTo"]), 0) + 1
    if not items:
        raise RuntimeError("Kaufland: žiadne ponuky")
    weekly = sorted([r for r, c in ranges.items() if c > 50 and 5 <= (dt.date.fromisoformat(r[1]) - dt.date.fromisoformat(r[0])).days <= 8])
    cur = next((r for r in weekly if r[0] <= TODAY <= r[1]), weekly[0] if weekly else None)
    nxt = next((r for r in weekly if r[0] > TODAY), None)
    return {
        "current": {"url": "https://predajne.kaufland.sk/aktualna-ponuka/letak.html", "from": cur[0], "to": cur[1]} if cur else {"url": pages[0]},
        "next": {"url": "https://predajne.kaufland.sk/aktualna-ponuka/buduci-tyzden.html", "from": nxt[0], "to": nxt[1]} if nxt else None,
        "items": dedupe(items),
    }


# --------------------------------------------------------------------------- Tesco
TESCO_PAGE = "https://www.tesco.sk/akciove-ponuky/letaky-a-katalogy"


def tesco():
    """Tesco zverejňuje leták ako PDF; čítame z neho text (nie OCR)."""
    s = get(TESCO_PAGE)
    leaflets = []
    for m in re.finditer(r'"Leaflet:\d+":\{"__typename":"Leaflet"(.*?)"pages"', s):
        body = m.group(1)
        url = re.search(r'"leafletUrl":"([^"]+\.pdf)"', body)
        vf = re.search(r'"validFrom":"(\d{4}-\d\d-\d\d)', body)
        vt = re.search(r'"validTo":"(\d{4}-\d\d-\d\d)', body)
        typ = re.search(r'"type":"(\w+)"', body)
        if url and vf and vt:
            leaflets.append({"url": url.group(1), "from": vf.group(1), "to": vt.group(1), "type": typ.group(1) if typ else ""})
    if not leaflets:
        raise RuntimeError("Tesco: leták sa nenašiel")
    leaflets.sort(key=lambda x: (x["type"] != "HM", x["from"]))  # hypermarket má najširšiu ponuku
    items, used = [], []
    for lf in leaflets:
        if lf["to"] < TODAY or any(u["from"] == lf["from"] for u in used):
            continue
        used.append(lf)
        text = pdf_text(get(lf["url"], binary=True, timeout=300))
        for it in parse_tesco(text):
            it["f"], it["t"] = lf["from"], lf["to"]
            items.append(it)
    cur = next((u for u in used if u["from"] <= TODAY), used[0])
    nxt = next((u for u in used if u["from"] > TODAY), None)
    return {"current": {"url": TESCO_PAGE, "from": cur["from"], "to": cur["to"]},
            "next": {"url": TESCO_PAGE, "from": nxt["from"], "to": nxt["to"]} if nxt else None,
            "items": dedupe(items)}


def parse_tesco(text):
    L = [l.strip() for l in text.replace("\f", "\n").split("\n")]
    P = r"(\d+,\d{2})"
    size_re = re.compile(r"(\d[\d,]*\s?(g|kg|ml|l|ks|cl)\b|cena za|balenie|\d+\s?[×x]\s?\d)", re.I)
    out = []
    for i, l in enumerate(L):
        if not l.startswith("Bežná cena:"):
            continue
        rest = l[len("Bežná cena:"):].strip() or (L[i + 1] if i + 1 < len(L) else "")
        m = re.match(P + r"(?:\s*\((.+?)\s*=\s*" + P + r"\))?", rest)
        if not m:
            continue
        reg, uname = num(m.group(1)), m.group(2)
        ureg = num(m.group(3)) if m.group(3) else None
        nm, j = [], i - 1
        while j >= 0 and L[j] and not re.fullmatch(r"[−\-]?\d+[,%]?\d*%?|Bežná|cena|Clubcard", L[j]) and len(nm) < 5:
            nm.insert(0, L[j])
            j -= 1
        if not nm:
            continue
        tail = " ".join(L[i + 1:i + 6])
        cc, cond = None, []
        mc = re.search(r"S Clubcard:\s*(?:" + P + r"(?!\s*\))|(.+?)=\s*" + P + ")", tail)
        if mc:
            if mc.group(1):
                cc = num(mc.group(1))
            elif ureg:
                cc = round(reg * num(mc.group(3)) / ureg, 2)
        mk = re.search(r"S kupónom:\s*(?:" + P + r"|(.+?)=\s*" + P + ")", tail)
        if mk:
            kp = num(mk.group(1)) if mk.group(1) else (round(reg * num(mk.group(3)) / ureg, 2) if ureg else None)
            if kp:
                cond.append(f"s kupónom v aplikácii Clubcard {money(kp)} €")
        if not cc and not cond:
            continue
        size = nm.pop() if size_re.search(nm[-1]) and len(nm) > 1 else ""
        name = re.sub(r"^(\d{1,2}\.\s?\d{1,2}\.\s?[–-]\s?\d{1,2}\.\s?\d{1,2}\.\s?\d{4}\s*)", "", " ".join(nm).replace("*", "")).strip(" ,")
        it = {"n": name, "s": size, "p": cc or reg}
        if cc:
            it["op"] = reg
            cond.insert(0, "s Clubcard")
        if ureg and uname:
            it["u"] = f"{uname} = {money(ureg * (cc or reg) / reg)} €"
        it["c"] = "; ".join(cond)
        out.append(it)
    return out


# --------------------------------------------------------------------------- Lidl
LIDL_PAGE = "https://www.lidl.sk/c/online-letak/s10008489"


def lidl():
    """Lidl: leták nájdeme cez ich prehliadač letákov, z PDF čítame text."""
    s = get(LIDL_PAGE)
    ids = sorted(set(re.findall(r"/l/sk/letak/(online-letak-platny-od-[0-9-]+)/", s)))
    if not ids:
        raise RuntimeError("Lidl: leták sa nenašiel")
    flyers = []
    for fid in ids:
        try:
            d = json.loads(get(f"https://endpoints.leaflets.schwarz/v4/flyer?flyer_identifier={fid}&region_id=0"))["flyer"]
            flyers.append({"id": fid, "pdf": d["pdfUrl"], "from": d.get("offerStartDate") or d["startDate"],
                           "to": d.get("offerEndDate") or d["endDate"]})
        except Exception as e:  # noqa: BLE001
            print("  lidl: flyer", fid, e)
    flyers = [f for f in flyers if f["to"] >= TODAY]
    if not flyers:
        raise RuntimeError("Lidl: žiadny platný leták")
    flyers.sort(key=lambda f: f["from"])
    items = []
    for f in flyers[:2]:
        for it in parse_lidl(pdf_pages(get(f["pdf"], binary=True, timeout=600)), f["from"], f["to"]):
            items.append(it)
    cur = next((f for f in flyers if f["from"] <= TODAY), flyers[0])
    nxt = next((f for f in flyers if f["from"] > TODAY), None)
    url = lambda f: f"https://www.lidl.sk/l/sk/letak/{f['id']}/ar/0"
    return {"current": {"url": url(cur), "from": cur["from"], "to": cur["to"]},
            "next": {"url": url(nxt), "from": nxt["from"], "to": nxt["to"]} if nxt else None,
            "items": dedupe(items)}


def parse_lidl(pages, dfrom, dto):
    UNIT = re.compile(r"^\((\d+[,.]?\d*)\s*(g|kg|ml|l|ks|m|pár|PD)\s*=\s*(\d+[,.]\d+)\)")
    SIZE = re.compile(r"^(?:(\d+)\s?[x×]\s?)?(\d+[,.]?\d*)\s*(g|kg|ml|l|ks)\b", re.I)
    STOP = re.compile(r"﹪|^\(|\d+\.\d{2}\s*$")

    def base(q, u):
        u = u.lower()
        return (q * 1000 if u in ("kg", "l") else q), ("g" if u in ("g", "kg") else "ml" if u in ("ml", "l") else u)

    out = []
    for t in pages:
        L = [l.strip() for l in t.split("\n")]
        prices = [num(x) for x in re.findall(r"(?<![\d,])(\d{1,3}\.\d{2})(?!\d)", t)]
        disc = [(int(a), num(b)) for a, b in re.findall(r"-(\d{1,2})﹪\s*(\d{1,3}\.\d{2})", t)]
        for i, l in enumerate(L):
            m = UNIT.match(l)
            if not m:
                continue
            bq, bu, up = num(m.group(1)), m.group(2), num(m.group(3))
            j, blk = i - 1, []
            while j >= 0 and L[j] and len(blk) < 7 and not STOP.search(L[j]):
                blk.insert(0, L[j])
                j -= 1
            if blk and blk[0][:1].islower() and j >= 1 and not L[j] and L[j - 1] and not STOP.search(L[j - 1]):
                k = j - 1
                while k >= 0 and L[k] and len(blk) < 9 and not STOP.search(L[k]):
                    blk.insert(0, L[k])
                    k -= 1
            # názov rozdelený cez stĺpec: "Supercena Kokosovo-" ... "čokoládová / tyčinka"
            if blk and blk[0][:1].islower():
                for k in range(j - 1, max(j - 6, -1), -1):
                    if L[k].endswith("-") and not STOP.search(L[k]):
                        blk.insert(0, re.sub(r"^(Supercena|Výhodné|Novinka)\s+", "", L[k]))
                        break
            si = next((k for k, x in enumerate(blk) if SIZE.match(x)), None)
            if not si:
                continue
            size = blk[si]
            nm = [x for x in blk[:si] if not re.fullmatch(r"Výhodné|S Lidl Plus|kus|[A-ZÁČĎÉÍĽĹŇÓÔŔŠŤÚÝŽ ]{2,}®?", x) or x == blk[0]]
            sm = SIZE.match(size)
            q, u = base(num(sm.group(2)), sm.group(3))
            b, bu2 = base(bq, bu)
            if not nm or bu2 != u:
                continue
            est = up * q * int(sm.group(1) or 1) / b
            cand = [p for p in prices if abs(p - est) <= max(0.03 * est, 0.02)]
            if not cand:
                continue
            p = min(cand, key=lambda x: abs(x - est))
            name = re.sub(r"(\w)- (\w)", r"\1-\2", re.sub(r"\s*/\s*", "/", " ".join(nm))).strip()
            name = re.sub(r"^(Supercena|Výhodné|Novinka)\s+", "", name)
            mdate = re.match(r"od pondelka (\d+)\. (\d+)\. do (\d+)\. (\d+)\.\s*", name)
            f, tt = dfrom, dto
            if mdate:
                year = dfrom[:4]
                tt = f"{year}-{int(mdate.group(4)):02d}-{int(mdate.group(3)):02d}"
                f = f"{year}-{int(mdate.group(2)):02d}-{int(mdate.group(1)):02d}"
                name = name[mdate.end():]
            if re.search(r"^\*|Úspora|zistených|Ponuka tovaru", name) or tt < TODAY:
                continue
            it = {"n": name, "s": size, "k": " ".join(blk[si + 1:])[:60], "p": p,
                  "u": f"{m.group(1)} {bu} = {m.group(3).replace('.', ',')} €", "f": f, "t": tt}
            od = [o for d_, o in disc if abs(o * (1 - d_ / 100) - p) <= 0.02 * o + 0.02]
            if od:
                it["op"] = od[0]
            out.append(it)
    return out


# --------------------------------------------------------------------------- beh
STORES = {"kaufland": kaufland, "tesco": tesco, "lidl": lidl}


def main(only=None):
    old = {}
    if os.path.exists(OUT):
        try:
            old = json.load(open(OUT, encoding="utf-8")).get("stores", {})
        except ValueError:
            pass
    stores, failed = dict(old), []
    for key, fn in STORES.items():
        if only and key not in only:
            continue
        print(f"== {key}")
        try:
            data = fn()
            data["updated"] = TODAY
            stores[key] = data
            print(f"  {len(data['items'])} produktov")
        except Exception:  # noqa: BLE001
            failed.append(key)
            traceback.print_exc()
            print(f"  {key}: ponechávam staré dáta")
    # vyhoď vypršané položky aj zo starých dát
    for d in stores.values():
        d["items"] = [i for i in d.get("items", []) if not i.get("t") or i["t"] >= TODAY]
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({"generated": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "stores": stores},
                  f, ensure_ascii=False, separators=(",", ":"))
    print("Hotovo.", "Zlyhalo:", ", ".join(failed) if failed else "nič")
    return 0 if len(failed) < len(STORES) else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:] or None))
