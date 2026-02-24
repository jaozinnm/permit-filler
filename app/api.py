# app/api.py
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Any, Dict, List, Optional


from app.svc import (
    save_override_payload,
    generate_packet_by_project,
    list_projects,
    open_folder,
    # company + catalog
    list_companies,
    upsert_company,
    get_company,
    list_cities,
    list_forms_for_city,
    generate_packet_for_company,
    # ✅ data + templates
    load_data,
    get_blank_pdf_path,
    get_fields_json_path,
    get_layers_json_path,
    # ✅ ZIP download
    generate_and_zip_project,
    generate_and_zip_company,  # ✅ PATCH
)

import app.svc as _svc_mod
print("[API] api.py =", __file__)
print("[API] svc.py loaded =", _svc_mod.__file__)


app = FastAPI(title="Permit-Filler Internal API")

# ✅ Mantém seu CORS normal (ok)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ FIX HVHZ: força os headers CORS nos endpoints que o PDF.js usa


def _cors_headers(req: Request) -> Dict[str, str]:
    origin = req.headers.get("origin")
    # se vier origin (normal no browser), devolve exatamente ele
    if origin:
        return {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
        }
    # fallback: não deveria acontecer no seu caso, mas não quebra
    return {"Access-Control-Allow-Origin": "*"}


# ============================
# Models
# ============================

class OverridePayload(BaseModel):
    company_key: str
    city: str
    form_key: str
    fields: Dict[str, Any]
    layers: List[Dict[str, Any]]
    meta: Optional[Dict[str, Any]] = None


class GeneratePayload(BaseModel):
    project_key: str


class DownloadProjectPayload(BaseModel):
    project_key: str


class DownloadCompanyPayload(BaseModel):  # ✅ PATCH
    company_key: str
    city: str
    form_keys: List[str]
    job_key: Optional[str] = None
    owner_key: Optional[str] = None
    roof_key: Optional[str] = None


class OpenFolderPayload(BaseModel):
    path: str


class CompanyUpsertPayload(BaseModel):
    company_key: str
    data: Dict[str, Any]


class GenerateCompanyPayload(BaseModel):
    company_key: str
    city: str
    form_keys: List[str]
    job_key: Optional[str] = None
    owner_key: Optional[str] = None
    roof_key: Optional[str] = None


# ============================
# Health
# ============================

@app.get("/api/health")
def health():
    return {"ok": True}

# ============================
# Core
# ============================


@app.post("/api/override")
def save_override(payload: OverridePayload):
    result = save_override_payload(payload.model_dump())
    return {"ok": True, **result}


@app.post("/api/generate")
def generate(payload: GeneratePayload):
    result = generate_packet_by_project(payload.project_key)
    return {"ok": True, **result}


@app.post("/api/download-project")
def download_project(request: Request, payload: DownloadProjectPayload):
    try:
        result = generate_and_zip_project(payload.project_key)
        zip_path = result.get("zip_path")
        if not zip_path:
            raise HTTPException(
                status_code=400,
                detail="Não foi possível gerar o ZIP.",
                headers=_cors_headers(request),
            )

        return FileResponse(
            zip_path,
            media_type="application/zip",
            filename=f"{payload.project_key}.zip",
            headers=_cors_headers(request),
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e),
            headers=_cors_headers(request),
        )


@app.post("/api/download-company")  # ✅ PATCH
def download_company(request: Request, payload: DownloadCompanyPayload):
    import traceback

    try:
        result = generate_and_zip_company(
            company_key=payload.company_key,
            city=payload.city,
            form_keys=payload.form_keys,
            job_key=payload.job_key,
            owner_key=payload.owner_key,
            roof_key=payload.roof_key,
        )

        # ✅ DEBUG: mostra no terminal o que voltou
        print("[DEBUG api] generate_and_zip_company type =", type(result))
        print("[DEBUG api] generate_and_zip_company preview =", repr(result)[:400])

        # ✅ GUARDA: não deixa explodir em .get()
        if not isinstance(result, dict):
            raise TypeError(
                f"generate_and_zip_company retornou {type(result)}: {repr(result)[:400]}"
            )

        zip_path = result.get("zip_path")
        if not zip_path:
            raise HTTPException(
                status_code=400,
                detail=f"Não foi possível gerar o ZIP. result={result}",
                headers=_cors_headers(request),
            )

        safe_name = payload.city or "packet"
        return FileResponse(
            zip_path,
            media_type="application/zip",
            filename=f"{safe_name}.zip",
            headers=_cors_headers(request),
        )

    except HTTPException:
        # mantém os 400/404 etc
        raise
    except Exception as e:
        # ✅ IMPRIME o traceback REAL no terminal
        print("\n[ERROR] /api/download-company exception:")
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=str(e),
            headers=_cors_headers(request),
        )


@app.get("/api/projects")
def projects():
    return {"ok": True, "projects": list_projects()}


@app.post("/api/open-folder")
def api_open_folder(payload: OpenFolderPayload):
    open_folder(payload.path)
    return {"ok": True}

# ============================
# Company + Catalog
# ============================


@app.get("/api/companies")
def api_companies():
    return {"ok": True, "companies": list_companies()}


@app.get("/api/companies/{company_key}")
def api_company(company_key: str):
    return {"ok": True, "company": get_company(company_key)}


@app.post("/api/companies/upsert")
def api_company_upsert(payload: CompanyUpsertPayload):
    c = upsert_company(payload.company_key, payload.data)
    return {"ok": True, "company": c}


@app.get("/api/catalog/cities")
def api_catalog_cities():
    return {"ok": True, "cities": list_cities()}


@app.get("/api/catalog/{city}/forms")
def api_catalog_forms(city: str):
    return {"ok": True, "forms": list_forms_for_city(city)}


# ============================
# Generate por company/city/forms
# ============================

@app.post("/api/generate-company")
def api_generate_company(payload: GenerateCompanyPayload):
    result = generate_packet_for_company(
        company_key=payload.company_key,
        city=payload.city,
        form_keys=payload.form_keys,
        job_key=payload.job_key,
        owner_key=payload.owner_key,
        roof_key=payload.roof_key,
    )
    return {"ok": True, **result}

# ============================
# DATA
# ============================


@app.get("/api/data/{name}")
def api_data(name: str):
    data = load_data(name)
    return {"ok": True, "data": data}

# ============================
# ✅ TEMPLATES (blank + fields + layers)
# ✅ FIX: adiciona headers CORS manualmente (resolve HVHZ)
# ============================


@app.get("/api/template/{city}/{form_key}/blank.pdf")
def api_template_blank(request: Request, city: str, form_key: str):
    try:
        path = get_blank_pdf_path(city, form_key)
        return FileResponse(
            path,
            media_type="application/pdf",
            filename="blank.pdf",
            headers=_cors_headers(request),
        )
    except Exception as e:
        raise HTTPException(
            status_code=404,
            detail=str(e),
            headers=_cors_headers(request),
        )


@app.get("/api/template/{city}/{form_key}/fields.json")
def api_template_fields(
    request: Request,
    city: str,
    form_key: str,
    company_key: str | None = None,
):
    try:
        path = get_fields_json_path(city, form_key, company_key=company_key)
        return FileResponse(
            path,
            media_type="application/json",
            filename="fields.json",
            headers=_cors_headers(request),
        )
    except Exception as e:
        raise HTTPException(
            status_code=404,
            detail=str(e),
            headers=_cors_headers(request),
        )


@app.get("/api/template/{city}/{form_key}/layers.json")
def api_template_layers(
    request: Request,
    city: str,
    form_key: str,
    company_key: str | None = None,
):
    try:
        path = get_layers_json_path(city, form_key, company_key=company_key)
        return FileResponse(
            path,
            media_type="application/json",
            filename="layers.json",
            headers=_cors_headers(request),
        )
    except Exception as e:
        raise HTTPException(
            status_code=404,
            detail=str(e),
            headers=_cors_headers(request),
        )
