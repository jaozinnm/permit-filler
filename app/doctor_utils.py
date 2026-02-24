# app/doctor_utils.py
from typing import Dict, List


def flatten_keys(data: Dict, prefix="") -> set:
    keys = set()
    for k, v in data.items():
        full = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            keys |= flatten_keys(v, full)
        else:
            keys.add(full)
    return keys


def validate_fields(fields: Dict, values: Dict):
    print("\n[CHECK] Fields")
    all_keys = flatten_keys(values)

    warnings = 0
    for field_key in fields.keys():
        if field_key not in all_keys:
            print(f"⚠️  Field inexistente nos dados: {field_key}")
            warnings += 1

    if warnings == 0:
        print("✅ Todos os fields são válidos.")


def validate_layers(layers: List, total_pages: int):
    print("\n[CHECK] Layers")
    warnings = 0

    for i, layer in enumerate(layers, start=1):
        page = int(layer.get("page", 1))
        ltype = layer.get("type")

        if page < 1 or page > total_pages:
            print(f"⚠️  Layer #{i} aponta para página inválida: {page}")
            warnings += 1

        if ltype not in ("text", "check", "line"):
            print(f"⚠️  Layer #{i} tem tipo inválido: {ltype}")
            warnings += 1

    if warnings == 0:
        print("✅ Todas as layers são válidas.")
