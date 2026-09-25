"""Ordo — o arquivo que você executa.

    python app.py

Na subida ele cria o banco no MySQL se não existir, garante a pasta de
uploads, aplica as migrações pendentes e insere os dados iniciais.
"""

import os

from flask import Flask, jsonify, request, send_from_directory
from flask_login import LoginManager
from sqlalchemy import inspect as sa_inspect
from werkzeug.exceptions import HTTPException

import models  # noqa: F401  — registra os modelos no metadata do SQLAlchemy
from config import Config, ISOJSONProvider
from database import criar_banco_se_nao_existir, db, migrate
from routes import registrar_blueprints
from seed import popular_dados_iniciais
from utils.validacao import ErroValidacao

FRONTEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend")
MIGRACOES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "migrations")

login_manager = LoginManager()


@login_manager.user_loader
def carregar_usuario(usuario_id):
    return db.session.get(models.Usuario, int(usuario_id))


@login_manager.unauthorized_handler
def nao_autorizado():
    """A API responde 401 em JSON; o navegador é levado ao login."""
    if request.path.startswith("/api/"):
        return jsonify({"erro": "Faça login para continuar."}), 401
    return send_from_directory(FRONTEND_DIR, "login.html")


def create_app(config=Config, preparar_banco=True):
    """Monta a aplicação.

    `preparar_banco=False` pula a criação do schema e o seed: é o que os
    testes usam, para montarem o seu próprio banco.
    """
    app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")
    app.config.from_object(config)
    app.json = ISOJSONProvider(app)

    # 1) O banco precisa existir antes de o SQLAlchemy tentar conectar.
    if preparar_banco:
        criar_banco_se_nao_existir(config)

    # 2) Pasta de uploads, fora de frontend/ para não ser servida como estática.
    os.makedirs(config.UPLOAD_FOLDER, exist_ok=True)

    # 3) Extensões.
    db.init_app(app)
    migrate.init_app(app, db, directory=MIGRACOES_DIR)
    login_manager.init_app(app)

    _registrar_protecoes(app)
    _registrar_erros(app)
    registrar_blueprints(app)
    _registrar_paginas(app)

    # 4) Schema e dados iniciais.
    if preparar_banco:
        with app.app_context():
            _preparar_banco(config)

    return app


def _preparar_banco(config):
    """Aplica as migrações e popula o seed.

    As migrações são a fonte da verdade do schema — create_all() não é
    usado, porque não altera tabelas que já existem.
    """
    from flask_migrate import upgrade

    if not os.path.isdir(MIGRACOES_DIR):
        print(
            "⚠ Pasta migrations/ ausente. Rode:\n"
            "    flask db init && flask db migrate -m \"schema inicial\" "
            "&& flask db upgrade"
        )
        return

    upgrade()
    print("✔ Migrações aplicadas.")

    if not sa_inspect(db.engine).has_table("usuarios"):
        print("⚠ Tabela 'usuarios' não existe. Verifique as migrações.")
        return

    popular_dados_iniciais(config)


def _registrar_protecoes(app):
    @app.before_request
    def exigir_json_nas_mutacoes():
        """Complemento do SameSite=Lax contra CSRF.

        Um formulário de outro site só consegue enviar form-urlencoded,
        multipart ou text/plain. Exigir JSON nas mutações bloqueia esse
        caminho. Uploads são a exceção declarada.
        """
        if request.method not in {"POST", "PUT", "PATCH", "DELETE"}:
            return None
        if not request.path.startswith("/api/"):
            return None
        if request.path.startswith("/api/arquivos"):
            return None
        if request.method == "DELETE" and not request.get_data():
            return None
        if not request.is_json:
            return jsonify({"erro": "Envie o corpo como application/json."}), 415
        return None


def _registrar_erros(app):
    @app.errorhandler(ErroValidacao)
    def _validacao(e):
        return jsonify({"erro": e.mensagem, "campos": e.campos}), 400

    @app.errorhandler(413)
    def _grande(e):
        limite = app.config["MAX_CONTENT_LENGTH"] // (1024 * 1024)
        return jsonify({"erro": f"Arquivo maior que o limite de {limite} MB."}), 413

    @app.errorhandler(HTTPException)
    def _http(e):
        if request.path.startswith("/api/"):
            return jsonify({"erro": e.description}), e.code
        return e

    @app.errorhandler(Exception)
    def _inesperado(e):
        db.session.rollback()
        app.logger.exception("Erro não tratado em %s", request.path)
        if request.path.startswith("/api/"):
            return jsonify({"erro": "Erro interno. Veja o terminal do servidor."}), 500
        raise e


def _registrar_paginas(app):
    @app.get("/")
    def index():
        return send_from_directory(FRONTEND_DIR, "index.html")

    @app.get("/health")
    def health():
        return jsonify({"status": "ok"})


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True)
