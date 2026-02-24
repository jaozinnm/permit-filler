# app/pdf_engine.py
import os
import json
import datetime
import platform

from reportlab.pdfgen import canvas
from pypdf import PdfReader, PdfWriter

from app.config_store import resolve_form_files  # ✅ NOVO
from app.doctor_utils import validate_fields, validate_layers  # 🧩 PASSO 2

APP_DIR = os.path.abspath(os.path.dirname(__file__))                 # C:\permit-filler\app
ROOT_DIR = os.path.abspath(os.path.join(APP_DIR, ".."))              # C:\permit-filler

# 🔥 prioridade: data na raiz (se existir), senão cai no app/data (compatibilidade)
DATA_DIR = os.path.join(ROOT_DIR, "data") if os.path.exists(os.path.join(ROOT_DIR, "data")) else os.path.join(APP_DIR, "data")

# output: mantém dentro do app pra não bagunçar seu projeto atual
OUTPUT_DIR = os.path.join(APP_DIR, "output", "generated")

PROJECTS_FILE = os.path.join(DATA_DIR, "projects.json")
COMPANIES_FILE = os.path.join(DATA_DIR, "companies.json")
JOBS_FILE = os.path.join(DATA_DIR, "jobs.json")
OWNERS_FILE = os.path.join(DATA_DIR, "owners.json")
ROOFS_FILE = os.path.join(DATA_DIR, "roofs.json")
FORMS_CATALOG_FILE = os.path.join(DATA_DIR, "forms_catalog.json")


def _open_file(path: str):
    if platform.system() == "Windows":
        os.startfile(path)  # type: ignore
    elif platform.system() == "Darwin":
        os.system(f'open "{path}"')
    else:
        os.system(f'xdg-open "{path}"')


def _load_json(path: str):
    if not os.path.exists(path):
        return {}
    with open(path, "r", encoding="utf-8") as f:
        content = f.read().strip()
        if not content:
            return {}
        return json.loads(content)


def _get_value(values: dict, key: str) -> str:
    if "." not in key:
        return ""
    section, field = key.split(".", 1)
    section_obj = values.get(section, {})
    if not isinstance(section_obj, dict):
        return ""
    return str(section_obj.get(field, ""))


def _draw_layers(c: canvas.Canvas, layers: list):
    for layer in layers:
        t = layer.get("type")
        page = layer.get("page", "?")

        if t == "line":
            print(f"[LAYER] line (p={page})")
            c.setLineWidth(layer.get("width", 1))
            c.line(layer["x1"], layer["y1"], layer["x2"], layer["y2"])

        elif t == "check":
            print(f"[LAYER] check (p={page})")
            if not layer.get("checked", True):
                continue
            c.setFont("Helvetica-Bold", layer.get("size", 12))
            c.drawString(layer["x"], layer["y"], "✓")

        elif t == "text":
            print(f"[LAYER] text '{layer.get('value')}' (p={page})")
            c.setFont("Helvetica", layer.get("font_size", 10))
            c.drawString(layer["x"], layer["y"], layer.get("value", ""))


    for layer in layers:
        t = layer.get("type")
        page = layer.get("page", "?")

        if t == "line":
            print(f"[LAYER] line (p={page})")
            c.setLineWidth(layer.get("width", 1))
            c.line(layer["x1"], layer["y1"], layer["x2"], layer["y2"])

        elif t == "check":
            print(f"[LAYER] check (p={page})")
            c.setFont("Helvetica-Bold", layer.get("size", 12))
            c.drawString(layer["x"], layer["y"], "✓")

        elif t == "text":
            print(f"[LAYER] text '{layer.get('value')}' (p={page})")
            c.setFont("Helvetica", layer.get("font_size", 10))
            c.drawString(layer["x"], layer["y"], layer.get("value", ""))


def _render_template_to_pdf(blank_pdf, fields_path, layers_path, values, out_path):
    reader = PdfReader(blank_pdf)
    writer = PdfWriter()

    fields = _load_json(fields_path)
    if not isinstance(fields, dict):
        print(f"⚠️ fields.json inválido (esperado dict). type={type(fields)}")
        fields = {}

    layers = _load_json(layers_path)

    # --- SANITY CHECK ---
    validate_fields(fields, values)
    validate_layers(layers, total_pages=len(reader.pages))

    layers_by_page = {}
    for ly in layers:
        pg = int(ly.get("page", 1))
        layers_by_page.setdefault(pg, []).append(ly)

    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    for page_index, page in enumerate(reader.pages, start=1):
        overlay_path = f"{out_path}_overlay_{page_index}.pdf"

        c = canvas.Canvas(
            overlay_path,
            pagesize=(float(page.mediabox.width), float(page.mediabox.height)),
        )

        for key, cfg in (fields.items() if isinstance(fields, dict) else []):
            # ✅ PATCH: se cfg não é dict, seu fields.json está no formato errado
            if not isinstance(cfg, dict):
                print(f"⚠️ [FIELDS] cfg inválido (não-dict) para key='{key}': {repr(cfg)[:120]}")
                continue

            if int(cfg.get("page", 1)) != page_index:
                continue

            value = _get_value(values, key)
            if value == "":
                print(f"⚠️  Valor vazio para field: {key}")

            print(f"[FIELD] {key} → '{value}' (p={page_index})")

            c.setFont("Helvetica", int(cfg.get("font_size", 10)))
            c.drawString(
                float(cfg["x"]),
                float(cfg["y"]),
                value,
            )

        _draw_layers(c, layers_by_page.get(page_index, []))
        c.save()

        overlay = PdfReader(overlay_path)

        # ✅ FIX: overlay pode não ter páginas
        if overlay.pages:
            page.merge_page(overlay.pages[0])

        writer.add_page(page)

        try:
            os.remove(overlay_path)
        except PermissionError:
            pass

    with open(out_path, "wb") as f:
        writer.write(f)


def generate_pdf_for_project():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    projects = _load_json(PROJECTS_FILE)

    companies = _load_json(COMPANIES_FILE)
    jobs = _load_json(JOBS_FILE)
    owners = _load_json(OWNERS_FILE)
    roofs = _load_json(ROOFS_FILE)
    catalog = _load_json(FORMS_CATALOG_FILE)

    print("\n--- Gerar PACKET ---")

    pkeys = list(projects.keys())
    valid_keys = []
    for pk in pkeys:
        p = projects.get(pk)
        if isinstance(p, dict):
            valid_keys.append(pk)

    if not valid_keys:
        print("Nenhum projeto válido (formato novo) encontrado.")
        return

    for i, pk in enumerate(valid_keys, start=1):
        print(f"{i} - {pk} ({projects[pk].get('name')})")

    idx = input("Escolha: ").strip()

    if not idx.isdigit() or int(idx) < 1 or int(idx) > len(valid_keys):
        print("Opção inválida.")
        return

    project_key = valid_keys[int(idx) - 1]
    project = projects[project_key]

    company_key = project.get("company_key") or ""

    values = {
        "company": companies.get(company_key, {}),
        "job": jobs.get(project.get("job_key") or "", {}),
        "owner": owners.get(project.get("owner_key") or "", {}),
        "roof": roofs.get(project.get("roof_key") or "", {}),
    }

    forms = project.get("forms", [])
    if not forms:
        print("⚠️ Esse projeto não tem forms no packet.")
        return

    out_folder = os.path.join(
        OUTPUT_DIR,
        f"{project_key}_{datetime.datetime.now():%Y%m%d_%H%M%S}",
    )
    os.makedirs(out_folder, exist_ok=True)

    generated = []

    for item in forms:
        city = item.get("city")
        form_key = item.get("form_key")
        if not city or not form_key:
            continue

        form_meta = (catalog.get(city) or {}).get(form_key)
        if not form_meta:
            print(f"⚠️ Form não encontrado no catálogo: {city}/{form_key}")
            continue

        template_dir = os.path.join(ROOT_DIR, form_meta["template_dir"])

        blank_pdf, fields_path, layers_path = resolve_form_files(
            template_dir=template_dir,
            company_key=company_key if company_key else None,
            city=city,
            form_key=form_key,
        )

        if not os.path.exists(blank_pdf):
            print(f"⚠️ blank.pdf não encontrado para {city}/{form_key}")
            continue

        out_path = os.path.join(out_folder, f"{city}__{form_key}.pdf")

        _render_template_to_pdf(
            blank_pdf,
            fields_path,
            layers_path,
            values,
            out_path,
        )

        generated.append(out_path)
        print(f"✅ Gerado: {os.path.basename(out_path)}")

    if generated:
        print(f"\n✅ PACKET gerado em: {out_folder}")
        _open_file(generated[0])
    else:
        print("\n⚠️ Nenhum PDF foi gerado.")


if __name__ == "__main__":
    generate_pdf_for_project()
