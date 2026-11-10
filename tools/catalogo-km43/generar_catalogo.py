"""
Genera el catálogo de KM43 a partir del Excel de la clienta y sus mockups.

    python -I generar_catalogo.py <excel.xlsx> <carpeta MOCKUPS MERCH> <km46/public> <catalogo.json> [<carpeta verificación>] [--extras extras.json]

Produce:
  - Fotos en WebP (mismo tamaño, con transparencia) en
    <km46/public>/productos/<coleccion>/<producto>/<color>-<n>.webp
    (en el orden de la columna ARCHIVO: 1 = frente, 2 = espalda, 3 = detalle)
  - <catalogo.json>: productos, variantes, stock, textos y fotos por color,
    listo para src/scripts/import-km43.ts del backend.
  - (opcional) una hoja de contacto PNG por colección para revisar que cada
    foto quedó con su producto y color.

Reglas:
  - "[POR CONFIRMAR]" nunca llega a la web: se quita el paréntesis que lo
    contiene o la línea completa si solo tenía ese dato.
  - Stock: 24 unidades por cada variante (cada talla × color × género).
  - Dos filas con el mismo producto y colección (ej. T-shirt Boxy Hombre /
    Mujer) se unen en un solo producto con la opción Género.
  - Un producto del Excel sin NINGUNA foto (ej. Toalla mediana, mockups
    pendientes) no se incluye; entra solo cuando lleguen sus fotos.
  - extras.json: productos que están en las carpetas pero no en el Excel. Si
    tienen "datos_de", copian precio/tallas/género/textos/categoría del
    producto del Excel con ese nombre; si no, van sin precio ni categoría.
"""
import json
import os
import re
import sys
import unicodedata
from datetime import date

import openpyxl
from PIL import Image, ImageDraw

STOCK_POR_VARIANTE = 24
PRODUCT_TYPE = "Merch"
YELLOW = "FFFFF2CC"
COLLECTION_FILLS = {"FFC9472B", "FF6E4C9E", "FF4A7C59"}
GROUP_FILL = "FFEFEFEF"
HEADER_FILL = "FF1E1E1E"

GROUP_TO_CATEGORY = {"RUNNING": ("ROPA", "RUNNING"), "POST-RUNNING": ("ROPA", "POST-RUNNING"), "ACCESORIOS": ("ACCESORIOS", None)}
NO_GENDER_VALUES = {"PARA EL CARRO"}
NO_COLLECTION_FOLDER = "colecciones-pasadas"


def nfc(s):
    return unicodedata.normalize("NFC", str(s or "")).strip()


def slug(s):
    s = unicodedata.normalize("NFD", nfc(s)).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def clean_por_confirmar(text):
    """Quita cualquier mención a [POR CONFIRMAR] sin dejar huecos."""
    lines = []
    for line in nfc(text).split("\n"):
        if "POR CONFIRMAR" not in line.upper():
            lines.append(line)
            continue
        line = re.sub(r"\s*\([^()]*POR CONFIRMAR[^()]*\)", "", line, flags=re.I)
        if "POR CONFIRMAR" in line.upper():
            continue
        lines.append(line)
    return "\n".join(lines).strip()


def bullets(text):
    """'• a\n• b' → 'a\nb' (mismo formato que el texto fijo que tenía la ficha)."""
    out = []
    for line in clean_por_confirmar(text).split("\n"):
        line = line.strip().lstrip("•·-").strip()
        if line:
            out.append(line)
    return "\n".join(out)


def read_sheet(path):
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb.worksheets[0]
    merged = {}
    for rng in ws.merged_cells.ranges:
        for r in range(rng.min_row, rng.max_row + 1):
            for c in range(rng.min_col, rng.max_col + 1):
                merged[(r, c)] = (rng.min_row, rng.min_col)
    rows = []
    for r in range(1, ws.max_row + 1):
        row = []
        for c in range(1, 11):
            anchor = merged.get((r, c), (r, c))
            cell = ws.cell(*anchor)
            fill = cell.fill.fgColor.rgb if cell.fill and cell.fill.fill_type == "solid" else None
            row.append({"v": cell.value, "fill": fill if isinstance(fill, str) else None, "anchor": anchor != (r, c)})
        rows.append(row)
    return rows


def parse_products(rows):
    collection = group = None
    products, current = [], None
    for i, row in enumerate(rows, 1):
        a = row[0]
        if a["fill"] in COLLECTION_FILLS and a["v"]:
            collection, group, current = nfc(a["v"]), None, None
            continue
        if a["fill"] == GROUP_FILL and a["v"]:
            group, current = nfc(a["v"]), None
            continue
        if collection is None or a["fill"] == HEADER_FILL or not row[7]["v"]:
            continue
        if not a["anchor"] and a["v"]:
            group_key = next((g for g in GROUP_TO_CATEGORY if (group or "").upper().startswith(g)), "ACCESORIOS")
            category, tag = GROUP_TO_CATEGORY[group_key]
            current = {
                "row": i,
                "collection": collection,
                "category": category,
                "tag": tag,
                "title": nfc(a["v"]),
                "gender": nfc(row[1]["v"]),
                "sizes": [nfc(s) for s in str(row[2]["v"]).split("·") if nfc(s)],
                "price": float(re.sub(r"[^0-9.]", "", str(row[3]["v"]))),
                "description": clean_por_confirmar(row[4]["v"]),
                "details": bullets(row[5]["v"]),
                "care": clean_por_confirmar(row[6]["v"]),
                "colors": [],
            }
            products.append(current)
        files = [nfc(n) for n in str(row[9]["v"] or "").split("\n") if nfc(n)]
        current["colors"].append({"name": nfc(row[7]["v"]), "files": files})
    return products


def index_mockups(mockups_dir):
    """Fotos de las colecciones actuales (las que nombra el Excel), por nombre de archivo."""
    files = {}
    for folder in os.listdir(mockups_dir):
        base = os.path.join(mockups_dir, folder)
        if folder.upper() == "COLECCIONES PASADAS" or not os.path.isdir(base):
            continue
        for name in os.listdir(base):
            full = os.path.join(base, name)
            if os.path.isfile(full) and name.lower().endswith(".png"):
                files[nfc(name).upper()] = full
    return files


def dominant_hex(path):
    """Color dominante de la prenda (ignora transparencia y el gris del fondo/etiqueta)."""
    img = Image.open(path).convert("RGBA")
    img.thumbnail((160, 160))
    pixels = [p[:3] for p in img.getdata() if p[3] > 200]
    if not pixels:
        return "#cccccc"
    sample = Image.new("RGB", (len(pixels), 1))
    sample.putdata(pixels)
    pal = sample.quantize(colors=6, method=Image.Quantize.MEDIANCUT)
    palette = pal.getpalette()
    counts = sorted(pal.getcolors(), reverse=True)
    for _, idx in counts:
        r, g, b = palette[idx * 3: idx * 3 + 3]
        if max(r, g, b) - min(r, g, b) < 12 and 150 < r < 245 and len(counts) > 1:
            continue
        return f"#{r:02x}{g:02x}{b:02x}"
    _, idx = counts[0]
    r, g, b = palette[idx * 3: idx * 3 + 3]
    return f"#{r:02x}{g:02x}{b:02x}"


def to_webp(src, public_dir, rel):
    """Convierte a WebP; si ya existe y es más nuevo que el PNG, no lo repite."""
    dst = os.path.join(public_dir, *rel.split("/"))
    if not (os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src)):
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        img = Image.open(src)
        if max(img.size) > 1200:  # algunas fotos de colecciones pasadas vienen enormes
            img.thumbnail((1200, 1200))
        img.save(dst, "WEBP", quality=85, method=4)
    return "/" + rel


def main():
    args = sys.argv[1:]
    extras_path = None
    if "--extras" in args:
        i = args.index("--extras")
        extras_path = args[i + 1]
        del args[i:i + 2]
    xlsx, mockups_dir, public_dir, out_json = args[:4]
    verify_dir = args[4] if len(args) > 4 else None

    sheet_products = parse_products(read_sheet(xlsx))
    mockups = index_mockups(mockups_dir)
    extras = json.load(open(extras_path, encoding="utf-8"))["productos"] if extras_path else []

    # Productos del Excel sin ninguna foto → fuera (entran cuando lleguen las fotos)
    omitted = []
    by_key = {}
    for p in sheet_products:
        by_key.setdefault((p["title"], p["collection"]), []).append(p)
    for key, rows in list(by_key.items()):
        if not any(c["files"] for r in rows for c in r["colors"]):
            omitted.append(f"{key[0]} ({key[1]}): sin fotos en el Excel")
            del by_key[key]

    # Títulos repetidos en varias colecciones → el handle lleva la colección
    collections_by_title = {}
    for (title, collection) in by_key:
        collections_by_title.setdefault(title, set()).add(collection)
    for e in extras:
        collections_by_title.setdefault(nfc(e["title"]), set()).add(e.get("collection") or NO_COLLECTION_FOLDER)

    def handle_for(title, collection):
        h = slug(title)
        if len(collections_by_title.get(title, ())) > 1:
            h = f"{h}-{slug(collection or NO_COLLECTION_FOLDER)}"
        return h

    sheet_by_title = {}
    for p in sheet_products:
        sheet_by_title.setdefault(slug(p["title"]), p)

    products, missing, verify_rows = [], [], {}

    def new_product(title, collection, src, has_gender, origen):
        return {
            "handle": handle_for(title, collection),
            "title": title,
            "collection": collection,
            "category": src["category"] if src else None,
            "tag": src["tag"] if src else None,
            "price": src["price"] if src else None,
            "description": src["description"] if src else "",
            "details": src["details"] if src else "",
            "care": src["care"] if src else "",
            "options": {"Color": [], **({"Género": []} if has_gender else {}), **({"Talla": []} if src else {})},
            "colors": {},
            "variants": [],
            "origen": origen,
        }

    def add_color(prod, color_name, image_srcs, sizes, gender, stock_each):
        images = []
        folder = slug(prod["collection"] or NO_COLLECTION_FOLDER)
        for idx, src in enumerate(image_srcs, 1):
            rel = f"productos/{folder}/{slug(prod['title'])}/{slug(color_name)}-{idx}.webp"
            images.append(to_webp(src, public_dir, rel))
        if color_name not in prod["options"]["Color"]:
            prod["options"]["Color"].append(color_name)
        if image_srcs and color_name not in prod["colors"]:
            prod["colors"][color_name] = dominant_hex(image_srcs[0])
        for size in sizes or [None]:
            opts = {"Color": color_name}
            if gender is not None:
                opts["Género"] = gender
            if size is not None:
                opts["Talla"] = size
            prod["variants"].append({"options": opts, "stock": stock_each, "images": images})
        verify_rows.setdefault(prod["collection"] or "COLECCIONES PASADAS · ACCESORIOS", []).append(
            (f"{prod['title']} · {gender or ''} · {color_name}", images, prod["colors"].get(color_name))
        )

    # 1) Productos del Excel
    for (title, collection), rows in by_key.items():
        first = rows[0]
        has_gender = first["gender"].upper() not in NO_GENDER_VALUES
        prod = new_product(title, collection, first, has_gender, "excel")
        for p in rows:
            stock_each = STOCK_POR_VARIANTE
            for color in p["colors"]:
                srcs = []
                for fname in color["files"]:
                    src = mockups.get(fname.upper())
                    if src:
                        srcs.append(src)
                    else:
                        missing.append(f"{title} / {color['name']}: {fname}")
                add_color(prod, color["name"], srcs, p["sizes"], p["gender"] if has_gender else None, stock_each)
            if has_gender and p["gender"] not in prod["options"]["Género"]:
                prod["options"]["Género"].append(p["gender"])
            for size in p["sizes"]:
                if size not in prod["options"]["Talla"]:
                    prod["options"]["Talla"].append(size)
        products.append(prod)

    # 2) Productos de las carpetas que no están en el Excel
    for e in extras:
        title = nfc(e["title"])
        collection = nfc(e["collection"]) if e.get("collection") else None
        src = sheet_by_title.get(slug(e["datos_de"])) if e.get("datos_de") else None
        if e.get("datos_de") and not src:
            raise SystemExit(f"'datos_de' no coincide con ningún producto del Excel: {e['datos_de']}")
        has_gender = bool(src) and src["gender"].upper() not in NO_GENDER_VALUES
        prod = new_product(title, collection, src, has_gender, "carpetas + datos del Excel" if src else "carpetas (sin datos)")
        sizes = src["sizes"] if src else []
        stock_each = STOCK_POR_VARIANTE
        for color_name, rels in e["colors"].items():
            srcs = []
            for rel in rels:
                full = os.path.join(mockups_dir, *rel.split("/"))
                if os.path.isfile(full):
                    srcs.append(full)
                else:
                    missing.append(f"{title} / {color_name}: {rel}")
            add_color(prod, nfc(color_name), srcs, sizes, src["gender"] if has_gender else None, stock_each)
        if has_gender:
            prod["options"]["Género"].append(src["gender"])
        if src:
            prod["options"]["Talla"] = list(sizes)
        products.append(prod)

    for prod in products:
        imgs = []
        for v in prod["variants"]:
            for s in v["images"]:
                if s not in imgs:
                    imgs.append(s)
        prod["images"] = imgs
        prod["thumbnail"] = imgs[0] if imgs else None

    handles = [p["handle"] for p in products]
    dupes = {h for h in handles if handles.count(h) > 1}
    if dupes:
        raise SystemExit(f"handles repetidos: {dupes}")

    catalog = {
        "fuente": os.path.basename(xlsx) + (" + " + os.path.basename(extras_path) if extras_path else ""),
        "generado": date.today().isoformat(),
        "stock_por_variante": STOCK_POR_VARIANTE,
        "tipo": PRODUCT_TYPE,
        "colecciones": [{"title": c, "handle": slug(c)} for c in dict.fromkeys(p["collection"] for p in products if p["collection"])],
        "productos": products,
    }
    os.makedirs(os.path.dirname(out_json), exist_ok=True)
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(catalog, f, ensure_ascii=False, indent=2)

    if verify_dir:
        build_contact_sheets(verify_rows, public_dir, verify_dir)

    print(f"productos: {len(products)} | variantes: {sum(len(p['variants']) for p in products)} | "
          f"fotos: {sum(len(p['images']) for p in products)} | faltantes: {len(missing)}")
    for p in products:
        price = f"${p['price']:g}" if p["price"] is not None else "sin precio"
        print(f"  - {p['title']} [{p['collection'] or '-'}] {price} · {p['category'] or 'sin categoría'} · "
              f"{len(p['variants'])} var · {len(p['images'])} fotos · {p['origen']}")
    for o in omitted:
        print("  OMITIDO:", o)
    for m in missing:
        print("  FALTA:", m)


def build_contact_sheets(by_collection, public_dir, verify_dir):
    """Una imagen por colección: cada fila = producto/color con sus fotos."""
    os.makedirs(verify_dir, exist_ok=True)
    thumb, pad, label_h = 180, 12, 34
    for collection, rows in by_collection.items():
        seen, uniq = set(), []
        for label, images, hex_color in rows:
            if label not in seen:
                seen.add(label)
                uniq.append((label, images, hex_color))
        cols = max(3, max(len(i) for _, i, _ in uniq))
        width = 420 + cols * (thumb + pad)
        height = len(uniq) * (thumb + label_h + pad) + pad
        sheet = Image.new("RGB", (width, height), "white")
        draw = ImageDraw.Draw(sheet)
        y = pad
        for label, images, hex_color in uniq:
            draw.text((pad, y + 8), label.replace(" ·  ·", " ·"), fill="black")
            if hex_color:
                draw.rectangle([pad, y + 30, pad + 40, y + 70], fill=hex_color, outline="black")
                draw.text((pad + 50, y + 44), hex_color, fill="black")
            if not images:
                draw.text((420, y + thumb // 2), "SIN FOTO (pendiente)", fill="red")
            for i, src in enumerate(images):
                im = Image.open(os.path.join(public_dir, *src.strip("/").split("/"))).convert("RGBA")
                im.thumbnail((thumb, thumb))
                bg = Image.new("RGBA", im.size, (240, 240, 240, 255))
                bg.alpha_composite(im)
                x = 420 + i * (thumb + pad)
                sheet.paste(bg.convert("RGB"), (x, y))
                draw.text((x, y + thumb + 4), src.split("/")[-1], fill="gray")
            y += thumb + label_h + pad
        sheet.save(os.path.join(verify_dir, f"verificacion-{slug(collection)}.png"))


if __name__ == "__main__":
    main()
