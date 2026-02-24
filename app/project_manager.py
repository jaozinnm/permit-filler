import os
import json
import shutil

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_DIR = os.path.join(BASE_DIR, "data")
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")

PROJECTS_FILE = os.path.join(DATA_DIR, "projects.json")
COMPANIES_FILE = os.path.join(DATA_DIR, "companies.json")
JOBS_FILE = os.path.join(DATA_DIR, "jobs.json")
OWNERS_FILE = os.path.join(DATA_DIR, "owners.json")
ROOFS_FILE = os.path.join(DATA_DIR, "roofs.json")
FORMS_CATALOG_FILE = os.path.join(DATA_DIR, "forms_catalog.json")


def ensure_files():
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(TEMPLATES_DIR, exist_ok=True)

    for path in [
        PROJECTS_FILE,
        COMPANIES_FILE,
        JOBS_FILE,
        OWNERS_FILE,
        ROOFS_FILE,
        FORMS_CATALOG_FILE
    ]:
        if not os.path.exists(path):
            with open(path, "w", encoding="utf-8") as f:
                json.dump({}, f, indent=2, ensure_ascii=False)


def load_json(path: str):
    ensure_files()
    try:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read().strip()
            if not content:
                return {}
            return json.loads(content)
    except (json.JSONDecodeError, OSError):
        with open(path, "w", encoding="utf-8") as f:
            json.dump({}, f, indent=2, ensure_ascii=False)
        return {}


def save_json(path: str, data: dict):
    ensure_files()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def load_projects():
    return load_json(PROJECTS_FILE)


def load_companies():
    return load_json(COMPANIES_FILE)


def load_jobs():
    return load_json(JOBS_FILE)


def load_owners():
    return load_json(OWNERS_FILE)


def load_roofs():
    return load_json(ROOFS_FILE)


def load_forms_catalog():
    return load_json(FORMS_CATALOG_FILE)


def _choose_from_dict(title: str, data: dict):
    if not data:
        print(f"\n⚠️ Nenhum {title} cadastrado.")
        return None

    print(f"\n--- {title} ---")
    keys = list(data.keys())
    for i, k in enumerate(keys, start=1):
        name = data[k].get("name") if isinstance(data[k], dict) else ""
        if name:
            print(f"{i} - {k} ({name})")
        else:
            print(f"{i} - {k}")

    choice = input("Escolha: ").strip()
    if not choice.isdigit() or int(choice) < 1 or int(choice) > len(keys):
        print("Opção inválida.")
        return None

    return keys[int(choice) - 1]


def _choose_city_and_form():
    catalog = load_forms_catalog()
    if not catalog:
        print("\n⚠️ forms_catalog.json está vazio. Cadastre forms primeiro.")
        return None

    print("\n--- Escolher City ---")
    cities = list(catalog.keys())
    for i, c in enumerate(cities, start=1):
        print(f"{i} - {c}")

    cidx = input("City: ").strip()
    if not cidx.isdigit() or int(cidx) < 1 or int(cidx) > len(cities):
        print("Opção inválida.")
        return None

    city = cities[int(cidx) - 1]
    forms = catalog.get(city, {})
    if not forms:
        print("Essa city não tem forms cadastrados.")
        return None

    print(f"\n--- Forms de {city} ---")
    fkeys = list(forms.keys())
    for i, fk in enumerate(fkeys, start=1):
        print(f"{i} - {fk} ({forms[fk].get('name')})")

    fidx = input("Form: ").strip()
    if not fidx.isdigit() or int(fidx) < 1 or int(fidx) > len(fkeys):
        print("Opção inválida.")
        return None

    form_key = fkeys[int(fidx) - 1]
    return {"city": city, "form_key": form_key}


def create_project():
    projects = load_projects()

    print("\n--- Criar Projeto (PACKET) ---")
    project_key = input("ID do projeto (ex: job_123_miami): ").strip().lower().replace(" ", "_")
    if not project_key:
        print("ID inválido.")
        return

    if project_key in projects:
        print("Já existe um projeto com esse ID.")
        return

    project_name = input("Nome do projeto: ").strip()

    forms = []
    while True:
        print("\nAdicionar form ao packet?")
        print("1 - Sim")
        print("2 - Não (finalizar)")
        opt = input("Escolha: ").strip()

        if opt == "1":
            choice = _choose_city_and_form()
            if choice:
                forms.append(choice)
                print(f"✅ Adicionado: {choice['city']} / {choice['form_key']}")
        elif opt == "2":
            break
        else:
            print("Opção inválida.")

    if not forms:
        print("\n⚠️ Você precisa adicionar pelo menos 1 form no packet.")
        return

    projects[project_key] = {
        "name": project_name,
        "company_key": None,
        "job_key": None,
        "owner_key": None,
        "roof_key": None,
        "forms": forms
    }
    save_json(PROJECTS_FILE, projects)
    print("\n✅ Projeto PACKET criado com sucesso.")


# ✅ FUNÇÃO CORRIGIDA
def list_projects():
    projects = load_projects()
    print("\n--- Projetos ---")
    if not projects:
        print("Nenhum projeto cadastrado.")
        return

    # ✅ Segurança: ignora entradas fora do formato esperado (dict)
    for k, v in projects.items():
        if not isinstance(v, dict):
            continue

        forms = v.get("forms", [])
        if not isinstance(forms, list):
            forms = []

        print(
            f"- {k} | {v.get('name')} | forms: {len(forms)} | "
            f"company: {v.get('company_key')} | job: {v.get('job_key')} | "
            f"owner: {v.get('owner_key')} | roof: {v.get('roof_key')}"
        )


def set_project_company():
    projects = load_projects()
    companies = load_companies()

    project_key = _choose_from_dict("Projetos", projects)
    if not project_key:
        return

    company_key = _choose_from_dict("Empresas", companies)
    if not company_key:
        return

    projects[project_key]["company_key"] = company_key
    save_json(PROJECTS_FILE, projects)
    print("✅ Empresa vinculada ao projeto.")


def set_project_job():
    projects = load_projects()
    jobs = load_jobs()

    project_key = _choose_from_dict("Projetos", projects)
    if not project_key:
        return

    job_key = _choose_from_dict("Jobs", jobs)
    if not job_key:
        return

    projects[project_key]["job_key"] = job_key
    save_json(PROJECTS_FILE, projects)
    print("✅ Job vinculado ao projeto.")


def set_project_owner():
    projects = load_projects()
    owners = load_owners()

    project_key = _choose_from_dict("Projetos", projects)
    if not project_key:
        return

    owner_key = _choose_from_dict("Owners", owners)
    if not owner_key:
        return

    projects[project_key]["owner_key"] = owner_key
    save_json(PROJECTS_FILE, projects)
    print("✅ Owner vinculado ao projeto.")


def set_project_roof():
    projects = load_projects()
    roofs = load_roofs()

    project_key = _choose_from_dict("Projetos", projects)
    if not project_key:
        return

    roof_key = _choose_from_dict("Roof presets", roofs)
    if not roof_key:
        return

    projects[project_key]["roof_key"] = roof_key
    save_json(PROJECTS_FILE, projects)
    print("✅ Roof preset vinculado ao projeto.")


def create_company():
    companies = load_companies()

    print("\n--- Criar Empresa ---")
    key = input("ID da empresa (ex: jp_construction): ").strip().lower().replace(" ", "_")
    if not key:
        print("ID inválido.")
        return

    if key in companies:
        print("Essa empresa já existe.")
        return

    name = input("Nome da empresa: ").strip()
    license_no = input("License: ").strip()
    address = input("Endereço: ").strip()
    phone = input("Telefone: ").strip()
    email = input("Email: ").strip()

    companies[key] = {
        "name": name,
        "license": license_no,
        "address": address,
        "phone": phone,
        "email": email
    }

    save_json(COMPANIES_FILE, companies)
    print("✅ Empresa criada com sucesso.")
