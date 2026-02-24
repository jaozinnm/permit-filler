import os
import json

# Paths
SCRIPT_DIR = os.path.abspath(os.path.dirname(__file__))              # ...\app\scripts
APP_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))            # ...\app
ROOT_DIR = os.path.abspath(os.path.join(APP_DIR, ".."))              # ...\

# ✅ igual ao pdf_engine: se existir data na raiz, usa ela; senão usa app/data
DATA_DIR = os.path.join(ROOT_DIR, "data") if os.path.exists(os.path.join(ROOT_DIR, "data")) else os.path.join(APP_DIR, "data")
CATALOG_PATH = os.path.join(DATA_DIR, "forms_catalog.json")


def load_json(path: str):
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        txt = f.read().strip()
        return json.loads(txt) if txt else {}


def exists_file(path: str) -> bool:
    try:
        return os.path.isfile(path)
    except OSError:
        return False


def main():
    print("=== PERMIT-FILLER DOCTOR ===")
    print("ROOT_DIR   :", ROOT_DIR)
    print("APP_DIR    :", APP_DIR)
    print("DATA_DIR   :", DATA_DIR)
    print("CATALOG    :", CATALOG_PATH)

    catalog = load_json(CATALOG_PATH)
    if catalog is None:
        print("\n❌ forms_catalog.json não encontrado.")
        print("   Esperado em:", CATALOG_PATH)
        return

    if not isinstance(catalog, dict) or not catalog:
        print("\n❌ forms_catalog.json está vazio ou inválido.")
        return

    total = 0
    ok = 0
    missing = 0

    print("\n=== CHECK templates do catálogo ===")

    for city, forms in catalog.items():
        if not isinstance(forms, dict):
            continue

        for form_key, meta in forms.items():
            if not isinstance(meta, dict):
                continue

            total += 1
            rel = meta.get("template_dir", "")
            abs_dir = os.path.join(ROOT_DIR, rel)

            blank = os.path.join(abs_dir, "blank.pdf")
            fields = os.path.join(abs_dir, "fields.json")
            layers = os.path.join(abs_dir, "layers.json")

            ok_blank = exists_file(blank)
            ok_fields = exists_file(fields)
            ok_layers = exists_file(layers)

            status = "✅ OK" if (ok_blank and ok_fields and ok_layers) else "❌ MISSING"

            print(f"\n{status}  {city}/{form_key}")
            print("  template_dir:", rel)
            print("  abs_dir     :", abs_dir)
            print("  blank.pdf   :", "OK" if ok_blank else "MISSING")
            print("  fields.json :", "OK" if ok_fields else "MISSING")
            print("  layers.json :", "OK" if ok_layers else "MISSING")

            if status.startswith("✅"):
                ok += 1
            else:
                missing += 1
                print("  DICA: verifique se o template_dir bate com a pasta real.")
                print("        e se o arquivo se chama exatamente 'blank.pdf'.")

    print("\n=== RESULTADO ===")
    print("Total forms :", total)
    print("OK          :", ok)
    print("MISSING     :", missing)

    if missing == 0:
        print("\n✅ Tudo certo. Catálogo e templates estão consistentes.")
    else:
        print("\n⚠️ Existem itens faltando. Corrija os paths/arquivos acima antes de seguir.")


if __name__ == "__main__":
    main()
