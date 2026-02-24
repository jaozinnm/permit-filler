# app/svc.py
import os
import json
import datetime
import platform
from typing import Any, Dict, List, Optional, Tuple
import shutil
import uuid

from app.pdf_engine import _render_template_to_pdf
from app.config_store import resolve_form_files

APP_DIR = os.path.abspath(os.path.dirname(__file__))
ROOT_DIR = os.path.abspath(os.path.join(APP_DIR, ".."))

DATA_DIR = os.path.join(ROOT_DIR, "data")
OVERRIDES_DIR = os.path.join(DATA_DIR, "overrides")
OUTPUT_DIR = os.path.join(APP_DIR, "output", "generated")

PROJECTS_FILE = os.path.join(DATA_DIR, "projects.json")
COMPANIES_FILE = os.path.join(DATA_DIR, "companies.json")
JOBS_FILE = os.path.join(DATA_DIR, "jobs.json")
OWNERS_FILE = os.path.join(DATA_DIR, "owners.json")
ROOFS_FILE = os.path.join(DATA_DIR, "roofs.json")
FORMS_CATALOG_FILE = os.path.join(DATA_DIR, "forms_catalog.json")


def _load_json(path: str):
    if not os.path.exists(path):
        return {}
    with open(path, "r", encoding="utf-8") as f:
        txt = f.read().strip()
        return json.loads(txt) if txt else {}


def _write_json(path: str, data: Any):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def save_override_payload(payload: Dict[str, Any]):
    company_key = payload["company_key"]
    city = payload["city"]
    form_key = payload["form_key"]

    dest_dir = os.path.join(OVERRIDES_DIR, company_key, city, form_key)

    fields_path = os.path.join(dest_dir, "fields.json")
    layers_path = os.path.join(dest_dir, "layers.json")
    meta_path = os.path.join(dest_dir, "meta.json")

    _write_json(fields_path, payload.get("fields", {}))
    _write_json(layers_path, payload.get("layers", []))
    _write_json(
        meta_path,
        payload.get("meta")
        or {
            "saved_at": datetime.datetime.now().isoformat(),
            "company_key": company_key,
            "city": city,
            "form_key": form_key,
        },
    )

    return {
        "dest_dir": dest_dir,
        "fields": fields_path,
        "layers": layers_path,
        "meta": meta_path,
    }


def generate_packet_by_project(project_key: str):
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    projects = _load_json(PROJECTS_FILE)
    companies = _load_json(COMPANIES_FILE)
    jobs = _load_json(JOBS_FILE)
    owners = _load_json(OWNERS_FILE)
    roofs = _load_json(ROOFS_FILE)
    catalog = _load_json(FORMS_CATALOG_FILE)

    project = projects.get(project_key)
    if not isinstance(project, dict):
        raise ValueError(f"Projeto não encontrado: {project_key}")

    company_key = project.get("company_key") or ""
    values = {
        "company": companies.get(company_key, {}),
        "job": jobs.get(project.get("job_key") or "", {}),
        "owner": owners.get(project.get("owner_key") or "", {}),
        "roof": roofs.get(project.get("roof_key") or "", {}),
    }

    forms = project.get("forms", [])
    if not forms:
        return {"out_folder": None, "generated": [], "warning": "Projeto sem forms."}

    out_folder = os.path.join(
        OUTPUT_DIR,
        f"{project_key}_{datetime.datetime.now():%Y%m%d_%H%M%S}",
    )
    os.makedirs(out_folder, exist_ok=True)

    generated: List[str] = []

    for item in forms:
        city = item.get("city")
        form_key = item.get("form_key")
        if not city or not form_key:
            continue

        form_meta = (catalog.get(city) or {}).get(form_key)
        if not form_meta:
            continue

        template_dir = os.path.join(ROOT_DIR, form_meta["template_dir"])

        blank_pdf, fields_path, layers_path = resolve_form_files(
            template_dir=template_dir,
            company_key=company_key if company_key else None,
            city=city,
            form_key=form_key,
        )

        if not os.path.exists(blank_pdf):
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

    return {"out_folder": out_folder, "generated": generated}


def zip_folder(folder_path: str) -> str:
    abs_folder = os.path.abspath(folder_path)
    abs_out = os.path.abspath(OUTPUT_DIR)

    # segurança: só permite zip dentro do OUTPUT_DIR
    if not abs_folder.startswith(abs_out):
        raise ValueError("Caminho fora do output permitido para zip.")

    zip_dir = os.path.join(OUTPUT_DIR, "_zips")
    os.makedirs(zip_dir, exist_ok=True)

    base_name = os.path.basename(abs_folder)
    zip_base = os.path.join(zip_dir, f"{base_name}_{uuid.uuid4().hex[:8]}")

    # shutil.make_archive cria .zip
    zip_path = shutil.make_archive(zip_base, "zip", abs_folder)
    return zip_path


def generate_and_zip_project(project_key: str) -> dict:
    result = generate_packet_by_project(project_key)
    out_folder = result.get("out_folder")
    if not out_folder:
        return {"out_folder": None, "zip_path": None, "generated": result.get("generated", [])}

    zip_path = zip_folder(out_folder)
    return {"out_folder": out_folder, "zip_path": zip_path, "generated": result.get("generated", [])}



def generate_and_zip_company(
    company_key: str,
    city: str,
    form_keys: List[str],
    job_key: Optional[str] = None,
    owner_key: Optional[str] = None,
    roof_key: Optional[str] = None,
) -> dict:
    result = generate_packet_for_company(
        company_key=company_key,
        city=city,
        form_keys=form_keys,
        job_key=job_key,
        owner_key=owner_key,
        roof_key=roof_key,
    )

    # ✅ LOG FORTE (vai aparecer no terminal do backend)
    print("[DEBUG] svc.py =", __file__)
    print("[DEBUG] generate_packet_for_company type =", type(result))
    print("[DEBUG] generate_packet_for_company preview =", repr(result)[:300])

    # ✅ Se por algum motivo vier string, não deixa explodir em .get()
    if isinstance(result, str):
        result = {"out_folder": result, "generated": []}

    if not isinstance(result, dict):
        raise TypeError(
            f"generate_packet_for_company retornou {type(result)}: {repr(result)[:300]}"
        )

    out_folder = result.get("out_folder")
    if not out_folder:
        return {
            "out_folder": None,
            "zip_path": None,
            "generated": result.get("generated", []),
        }

    zip_path = zip_folder(out_folder)
    return {
        "out_folder": out_folder,
        "zip_path": zip_path,
        "generated": result.get("generated", []),
    }





def list_projects():
    projects = _load_json(PROJECTS_FILE)
    out = []
    for k, p in projects.items():
        if not isinstance(p, dict):
            continue
        out.append(
            {
                "key": k,
                "name": p.get("name") or k,
                "company_key": p.get("company_key"),
                "forms_count": len(p.get("forms", []) or []),
            }
        )
    out.sort(key=lambda x: (x["name"] or "").lower())
    return out


def open_folder(path: str):
    abs_path = os.path.abspath(path)
    abs_out = os.path.abspath(OUTPUT_DIR)
    if not abs_path.startswith(abs_out):
        raise ValueError("Caminho fora do output permitido.")

    if platform.system() == "Windows":
        os.startfile(abs_path)  # type: ignore
    elif platform.system() == "Darwin":
        os.system(f'open "{abs_path}"')
    else:
        os.system(f'xdg-open "{abs_path}"')


# ============================
# Company + Catalog
# ============================

def get_catalog() -> Dict[str, Any]:
    return _load_json(FORMS_CATALOG_FILE)


def list_cities() -> List[str]:
    cat = get_catalog()
    return sorted([k for k in cat.keys() if isinstance(cat.get(k), dict)])


def list_forms_for_city(city: str) -> List[Dict[str, Any]]:
    cat = get_catalog()
    forms = cat.get(city) or {}
    out: List[Dict[str, Any]] = []
    if not isinstance(forms, dict):
        return out
    for form_key, meta in forms.items():
        if not isinstance(meta, dict):
            continue
        out.append(
            {
                "city": city,
                "form_key": form_key,
                "name": meta.get("name") or form_key,
                "template_dir": meta.get("template_dir"),
            }
        )
    out.sort(key=lambda x: (x["name"] or "").lower())
    return out


def list_companies() -> List[Dict[str, Any]]:
    companies = _load_json(COMPANIES_FILE)
    out: List[Dict[str, Any]] = []
    if not isinstance(companies, dict):
        return out
    for k, v in companies.items():
        if not isinstance(v, dict):
            continue
        out.append({"company_key": k, **v})
    out.sort(key=lambda x: (str(x.get("name") or x.get("company_key") or "")).lower())
    return out


def upsert_company(company_key: str, company_data: Dict[str, Any]) -> Dict[str, Any]:
    companies = _load_json(COMPANIES_FILE)
    if not isinstance(companies, dict):
        companies = {}

    base = companies.get(company_key)
    if not isinstance(base, dict):
        base = {}

    merged = {**base, **company_data}
    merged["updated_at"] = datetime.datetime.now().isoformat()

    companies[company_key] = merged
    _write_json(COMPANIES_FILE, companies)

    return {"company_key": company_key, **merged}


def get_company(company_key: str) -> Dict[str, Any]:
    companies = _load_json(COMPANIES_FILE)
    v = companies.get(company_key) if isinstance(companies, dict) else None
    if not isinstance(v, dict):
        raise ValueError(f"Company não encontrada: {company_key}")
    return {"company_key": company_key, **v}


# ============================
# Generate por City/Forms
# ============================

def generate_packet_for_company(
    company_key: str,
    city: str,
    form_keys: List[str],
    job_key: Optional[str] = None,
    owner_key: Optional[str] = None,
    roof_key: Optional[str] = None,
) -> Dict[str, Any]:
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    companies = _load_json(COMPANIES_FILE)
    jobs = _load_json(JOBS_FILE)
    owners = _load_json(OWNERS_FILE)
    roofs = _load_json(ROOFS_FILE)
    catalog = _load_json(FORMS_CATALOG_FILE)

    company_obj = companies.get(company_key) if isinstance(companies, dict) else None
    if not isinstance(company_obj, dict):
        raise ValueError(f"Company não encontrada: {company_key}")

    values = {
        "company": company_obj,
        "job": jobs.get(job_key or "", {}) if isinstance(jobs, dict) else {},
        "owner": owners.get(owner_key or "", {}) if isinstance(owners, dict) else {},
        "roof": roofs.get(roof_key or "", {}) if isinstance(roofs, dict) else {},
    }

    out_folder = os.path.join(
        OUTPUT_DIR,
        f"{company_key}_{city}_{datetime.datetime.now():%Y%m%d_%H%M%S}",
    )
    os.makedirs(out_folder, exist_ok=True)

    generated: List[str] = []

    for form_key in form_keys:
        form_meta = (catalog.get(city) or {}).get(form_key)
        if not isinstance(form_meta, dict):
            continue

        template_dir = os.path.join(ROOT_DIR, str(form_meta.get("template_dir", "")))

        blank_pdf, fields_path, layers_path = resolve_form_files(
            template_dir=template_dir,
            company_key=company_key,
            city=city,
            form_key=form_key,
        )

        if not os.path.exists(blank_pdf):
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

    # ✅ PATCH CORRETO (definitivo)
    return {
        "out_folder": out_folder,
        "generated": generated
    }


# ============================
# ✅ DATA API HELPERS (Front -> Backend)
# ============================

def get_data_file_path(name: str) -> str:
    name = (name or "").lower().strip()

    mapping = {
        "projects": PROJECTS_FILE,
        "companies": COMPANIES_FILE,
        "jobs": JOBS_FILE,
        "owners": OWNERS_FILE,
        "roofs": ROOFS_FILE,
        "forms_catalog": FORMS_CATALOG_FILE,
        "catalog": FORMS_CATALOG_FILE,
    }

    if name not in mapping:
        raise ValueError(f"Data inválida: {name}")

    return mapping[name]


def load_data(name: str):
    path = get_data_file_path(name)
    return _load_json(path)


# ============================
# ✅ TEMPLATE PATH HELPERS (Front -> Backend)
# ============================

def _get_template_dir_from_catalog(city: str, form_key: str) -> str:
    cat = get_catalog()
    meta = (cat.get(city) or {}).get(form_key)
    if not isinstance(meta, dict):
        raise ValueError(f"Template não encontrado no catálogo: {city}/{form_key}")
    tdir = meta.get("template_dir")
    if not tdir:
        raise ValueError(f"template_dir vazio no catálogo: {city}/{form_key}")
    return os.path.join(ROOT_DIR, str(tdir))


def get_blank_pdf_path(city: str, form_key: str) -> str:
    template_dir = _get_template_dir_from_catalog(city, form_key)
    blank_pdf, _, _ = resolve_form_files(
        template_dir=template_dir,
        company_key=None,  # blank é sempre o original
        city=city,
        form_key=form_key,
    )
    if not os.path.exists(blank_pdf):
        raise ValueError(f"blank.pdf não encontrado: {blank_pdf}")
    return blank_pdf


def get_fields_json_path(city: str, form_key: str, company_key: Optional[str] = None) -> str:
    template_dir = _get_template_dir_from_catalog(city, form_key)
    _, fields_path, _ = resolve_form_files(
        template_dir=template_dir,
        company_key=company_key,
        city=city,
        form_key=form_key,
    )
    if not os.path.exists(fields_path):
        raise ValueError(f"fields.json não encontrado: {fields_path}")
    return fields_path


def get_layers_json_path(city: str, form_key: str, company_key: Optional[str] = None) -> str:
    template_dir = _get_template_dir_from_catalog(city, form_key)
    _, _, layers_path = resolve_form_files(
        template_dir=template_dir,
        company_key=company_key,
        city=city,
        form_key=form_key,
    )
    if not os.path.exists(layers_path):
        raise ValueError(f"layers.json não encontrado: {layers_path}")
    return layers_path
