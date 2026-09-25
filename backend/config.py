"""Configuração do Ordo, lida do arquivo .env."""

import os
import sys
from datetime import date, datetime, time
from decimal import Decimal
from urllib.parse import quote_plus

from dotenv import load_dotenv
from flask.json.provider import DefaultJSONProvider

# O terminal do Windows usa cp1252, que não codifica os símbolos das
# mensagens de inicialização. Sem isto, um print com "✔" derruba o app.
for _fluxo in (sys.stdout, sys.stderr):
    try:
        _fluxo.reconfigure(encoding="utf-8")
    except (AttributeError, OSError, ValueError):
        pass

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))


class ISOJSONProvider(DefaultJSONProvider):
    """Serializa datas em ISO 8601.

    O provider padrão do Flask usa RFC 822 ("Sun, 27 Sep 2026 10:00:00 GMT"),
    que o FullCalendar não aceita e que o JavaScript interpreta como UTC,
    deslocando todos os horários. Todo o Ordo trabalha com datas *naive*
    no horário local, então a serialização não deve inventar fuso.
    """

    sort_keys = False

    def default(self, o):
        if isinstance(o, (datetime, date, time)):
            return o.isoformat()
        if isinstance(o, Decimal):
            return float(o)
        return super().default(o)


class Config:
    DB_USER = os.getenv("DB_USER", "root")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "")
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = int(os.getenv("DB_PORT", 3306))
    DB_NAME = os.getenv("DB_NAME", "ordo")

    # quote_plus protege senhas com caracteres especiais (@, #, /, etc.)
    SQLALCHEMY_DATABASE_URI = (
        f"mysql+pymysql://{DB_USER}:{quote_plus(DB_PASSWORD)}"
        f"@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_recycle": 280, "pool_pre_ping": True}

    SECRET_KEY = os.getenv("SECRET_KEY", "dev-key-troque-isto")

    # Sessão: Lax + HttpOnly já bloqueia a maior parte do CSRF sem
    # biblioteca extra. O complemento é a exigência de Content-Type JSON
    # nas mutações, feita no before_request de app.py.
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    REMEMBER_COOKIE_HTTPONLY = True
    REMEMBER_COOKIE_SAMESITE = "Lax"

    UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50 MB por arquivo
    EXTENSOES_PERMITIDAS = {".pdf", ".png", ".jpg", ".jpeg", ".docx", ".md", ".txt"}

    ADMIN_NOME = os.getenv("ADMIN_NOME", "Administrador")
    ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@ordo.local")
    ADMIN_SENHA = os.getenv("ADMIN_SENHA", "admin123")

    # mysqldump, usado pelo backup. Detectado no PATH se ficar vazio.
    MYSQLDUMP = os.getenv("MYSQLDUMP", "")
