import os
import sys
import json
import datetime

SCRIPT_DIR = os.path.abspath(os.path.dirname(__file__))
APP_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))
ROOT_DIR = os.path.abspath(os.path.join(APP_DIR, ".."))

# ✅ manter coerente com o doctor/pdf_engine:
# se existir /data na raiz, usa; senão app/data
DATA_DIR = os.path.join(ROOT_DIR, "data") if os.path.exists(os.path.join(ROOT_DIR, "data")) else os.path.join(APP_DIR, "data")

OVERRIDES_DIR = os.path.join(DATA_DIR, "overrides")


def die(msg: str, code: int = 1):
    print(f"\n❌ {msg}")
    sys.exit(code)


def load_json(path: str):
    if not os.path.exists(path):
        die(f"Arquivo não encontrado: {path}")
    with open(path, "r", encoding="utf-8") as f:
        txt = f.read().strip()
        if not txt:
            die("override.json está vazio.")
        return json.loads(txt)


def ensure_dir(path: str):
    os.makedirs(path, exist_ok=True)


def write_json(path: str, data):
    ensure_dir(os.path.dirname(path))
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def main():
    if len(sys.argv) < 2:
        die("Uso: python app\\scripts\\import_override.py caminho\\override.json", 2)

    override_path = os.path.abspath(sys.argv[1])
    payload = load_json(override_path)

    # validações básicas
    company_key = (payload.get("company_key") or "").strip()
    city = (payload.get("city") or "").strip()
    form_key = (payload.get("form_key") or "").strip()
    fields = payload.get("fields")
    layers = payload.get("layers")
    meta = payload.get("meta")

    if not company_key:
        die("Faltando 'company_key' no override.json")
    if not city:
        die("Faltando 'city' no override.json")
    if not form_key:
        die("Faltando 'form_key' no override.json")
    if not isinstance(fields, dict):
        die("'fields' deve ser um objeto (dict) no override.json")
    if not isinstance(layers, list):
        die("'layers' deve ser uma lista (array) no override.json")

    # destino
    dest_dir = os.path.join(OVERRIDES_DIR, company_key, city, form_key)

    fields_path = os.path.join(dest_dir, "fields.json")
    layers_path = os.path.join(dest_dir, "layers.json")
    meta_path = os.path.join(dest_dir, "meta.json")

    # meta default
    now = datetime.datetime.now().isoformat(timespec="seconds")
    if not isinstance(meta, dict):
        meta = {}

    meta.setdefault("imported_at", now)
    meta.setdefault("source_file", os.path.basename(override_path))

    # grava
    write_json(fields_path, fields)
    write_json(layers_path, layers)
    write_json(meta_path, meta)

    print("\n✅ Override importado com sucesso!")
    print(f"DATA_DIR      : {DATA_DIR}")
    print(f"OVERRIDES_DIR : {OVERRIDES_DIR}")
    print(f"DESTINO       : {dest_dir}")
    print(f"FIELDS        : {fields_path}")
    print(f"LAYERS        : {layers_path}")
    print(f"META          : {meta_path}")



if __name__ == "__main__":
    main()
