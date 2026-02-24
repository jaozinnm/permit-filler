# app/config_store.py
import os

APP_DIR = os.path.abspath(os.path.dirname(__file__))
ROOT_DIR = os.path.abspath(os.path.join(APP_DIR, ".."))

# 🔥 DATA_DIR ÚNICO E OFICIAL
DATA_DIR = os.path.join(ROOT_DIR, "data")
OVERRIDES_DIR = os.path.join(DATA_DIR, "overrides")


def _abs_dir(template_dir: str) -> str:
    """Garante que template_dir vira caminho absoluto."""
    if os.path.isabs(template_dir):
        return template_dir
    return os.path.abspath(os.path.join(ROOT_DIR, template_dir))


def _find_first(root_dir: str, filename: str) -> str | None:
    """Procura filename dentro de root_dir (inclusive subpastas) e retorna o primeiro achado."""
    for base, _, files in os.walk(root_dir):
        if filename in files:
            return os.path.join(base, filename)
    return None


def resolve_form_files(
    template_dir: str,
    company_key: str | None,
    city: str,
    form_key: str,
):
    """
    Retorna (blank_pdf, fields_path, layers_path)
    Prioridade:
    1) override da empresa
    2) template base
    """

    template_dir = _abs_dir(template_dir)

    # template base (raiz)
    blank_pdf = os.path.join(template_dir, "blank.pdf")
    base_fields = os.path.join(template_dir, "fields.json")
    base_layers = os.path.join(template_dir, "layers.json")

    # ✅ Se HVHZ estiver “aninhado” (subpasta), acha automaticamente
    if not os.path.exists(blank_pdf):
        found = _find_first(template_dir, "blank.pdf")
        if found:
            blank_pdf = found

    if not os.path.exists(base_fields):
        found = _find_first(template_dir, "fields.json")
        if found:
            base_fields = found

    if not os.path.exists(base_layers):
        found = _find_first(template_dir, "layers.json")
        if found:
            base_layers = found

    # override
    if company_key:
        override_dir = os.path.join(OVERRIDES_DIR, company_key, city, form_key)
        override_fields = os.path.join(override_dir, "fields.json")
        override_layers = os.path.join(override_dir, "layers.json")

        if os.path.exists(override_fields) and os.path.exists(override_layers):
            print(f"[OVERRIDE] usando override para {company_key}/{city}/{form_key}")
            return blank_pdf, override_fields, override_layers

    print(f"[TEMPLATE] usando template base para {city}/{form_key}")
    return blank_pdf, base_fields, base_layers
