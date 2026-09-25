"""Aparato dos testes que precisam de banco.

Os testes rodam contra um MySQL de verdade, num schema à parte
(`ordo_test`), e não contra SQLite. O motivo é evitar divergência: o
Ordo usa ondelete CASCADE em chaves estrangeiras, UniqueConstraint e a
collation utf8mb4_unicode_ci, e o comportamento de tudo isso muda entre
os bancos. Testar no mesmo motor de produção é o que dá valor ao teste.

O schema dos testes vem de db.create_all() a partir dos modelos. As
migrações continuam sendo a fonte da verdade do banco real.
"""

import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import Config  # noqa: E402
from database import criar_banco_se_nao_existir, db  # noqa: E402


class ConfigTeste(Config):
    DB_NAME = f"{Config.DB_NAME}_test"
    SQLALCHEMY_DATABASE_URI = Config.SQLALCHEMY_DATABASE_URI.replace(
        f"/{Config.DB_NAME}?", f"/{Config.DB_NAME}_test?"
    )
    TESTING = True
    WTF_CSRF_ENABLED = False
    SECRET_KEY = "chave-de-teste"


@pytest.fixture(scope="session")
def app():
    from app import create_app

    criar_banco_se_nao_existir(ConfigTeste)
    aplicacao = create_app(ConfigTeste, preparar_banco=False)

    with aplicacao.app_context():
        db.drop_all()
        db.create_all()

    yield aplicacao

    with aplicacao.app_context():
        db.drop_all()


@pytest.fixture
def contexto(app):
    """Contexto de aplicação com o banco limpo a cada teste."""
    with app.app_context():
        for tabela in reversed(db.metadata.sorted_tables):
            db.session.execute(tabela.delete())
        db.session.commit()
        yield
        db.session.rollback()


@pytest.fixture
def cliente(app, contexto):
    """Cliente HTTP já autenticado, para testar as rotas."""
    from models import Usuario

    usuario = Usuario(nome="Teste", email="teste@ordo.local")
    usuario.definir_senha("senha-de-teste")
    db.session.add(usuario)
    db.session.commit()

    c = app.test_client()
    resposta = c.post(
        "/api/login",
        json={"email": "teste@ordo.local", "senha": "senha-de-teste"},
    )
    assert resposta.status_code == 200, "o login do cliente de teste falhou"
    return c
