"""Instâncias das extensões de banco e criação automática do schema."""

import re

import pymysql
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()
migrate = Migrate()


def criar_banco_se_nao_existir(cfg):
    """Conecta ao MySQL sem banco selecionado e cria o banco, se necessário.

    É o passo que permite rodar `python app.py` numa máquina limpa: o
    SQLAlchemy precisa que o banco já exista para poder conectar.
    """
    if not re.fullmatch(r"[A-Za-z0-9_]+", cfg.DB_NAME):
        raise ValueError("DB_NAME deve conter apenas letras, números e _")

    conexao = pymysql.connect(
        host=cfg.DB_HOST,
        port=cfg.DB_PORT,
        user=cfg.DB_USER,
        password=cfg.DB_PASSWORD,
        charset="utf8mb4",
    )
    try:
        with conexao.cursor() as cursor:
            cursor.execute(
                f"CREATE DATABASE IF NOT EXISTS `{cfg.DB_NAME}` "
                "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            )
        conexao.commit()
        print(f"✔ Banco '{cfg.DB_NAME}' pronto.")
    finally:
        conexao.close()
