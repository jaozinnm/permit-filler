import os

from app.project_manager import (
    create_project,
    list_projects,
    set_project_company,
    set_project_job,
    set_project_owner,
    set_project_roof,
    create_company
)

from app.pdf_engine import generate_pdf_for_project


def clear():
    os.system("cls" if os.name == "nt" else "clear")


def run_menu():
    while True:
        clear()
        print("=== PERMIT FILLER (MVP) ===")
        print("1  - Criar projeto (PACKET)")
        print("2  - Listar projetos")
        print("3  - Definir empresa do projeto")
        print("4  - Gerar PACKET (PDFs)")
        print("5  - Sair")
        print("6  - Criar empresa")
        print("----------------------------")
        print("10 - Definir job do projeto")
        print("11 - Definir owner do projeto")
        print("12 - Definir roof preset do projeto")

        choice = input("\nEscolha: ").strip()

        if choice == "1":
            create_project()
            input("\nEnter para continuar...")

        elif choice == "2":
            list_projects()
            input("\nEnter para continuar...")

        elif choice == "3":
            set_project_company()
            input("\nEnter para continuar...")

        elif choice == "4":
            generate_pdf_for_project()
            input("\nEnter para continuar...")

        elif choice == "6":
            create_company()
            input("\nEnter para continuar...")

        elif choice == "10":
            set_project_job()
            input("\nEnter para continuar...")

        elif choice == "11":
            set_project_owner()
            input("\nEnter para continuar...")

        elif choice == "12":
            set_project_roof()
            input("\nEnter para continuar...")

        elif choice == "5":
            break

        else:
            print("\nOpção inválida.")
            input("\nEnter para continuar...")
