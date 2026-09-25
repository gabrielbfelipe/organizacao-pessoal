"""Backup do banco em .sql, via mysqldump.

A senha nunca vai na linha de comando: um `ps` na máquina mostraria a
lista de argumentos de qualquer processo, senha inclusive. O caminho
correto é um arquivo temporário de credenciais passado em
--defaults-extra-file, apagado logo depois.
"""

import os
import shutil
import subprocess
import tempfile
from datetime import datetime

# Onde o instalador oficial do MySQL põe o mysqldump no Windows.
CAMINHOS_PROVAVEIS = [
    r"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe",
    r"C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqldump.exe",
    r"C:\xampp\mysql\bin\mysqldump.exe",
    "/usr/bin/mysqldump",
    "/usr/local/bin/mysqldump",
]


class BackupIndisponivel(RuntimeError):
    """mysqldump não foi encontrado, ou falhou ao rodar."""


def encontrar_mysqldump(configurado=None):
    """Procura o mysqldump: config, PATH, e por fim os caminhos usuais."""
    if configurado and os.path.exists(configurado):
        return configurado

    no_path = shutil.which("mysqldump")
    if no_path:
        return no_path

    for caminho in CAMINHOS_PROVAVEIS:
        if os.path.exists(caminho):
            return caminho

    raise BackupIndisponivel(
        "mysqldump não encontrado. Instale as ferramentas do MySQL ou "
        "aponte o caminho na variável MYSQLDUMP do .env."
    )


def nome_do_arquivo(banco):
    return f"backup_{banco}_{datetime.now():%Y-%m-%d_%H%M}.sql"


def gerar(cfg):
    """Devolve (bytes do dump, nome sugerido do arquivo)."""
    executavel = encontrar_mysqldump(getattr(cfg, "MYSQLDUMP", None))

    # O arquivo de credenciais existe só durante a chamada.
    descritor, credenciais = tempfile.mkstemp(prefix="ordo-", suffix=".cnf")
    try:
        with os.fdopen(descritor, "w", encoding="utf-8") as arquivo:
            arquivo.write(
                "[client]\n"
                f"user={cfg.DB_USER}\n"
                f"password={cfg.DB_PASSWORD}\n"
                f"host={cfg.DB_HOST}\n"
                f"port={cfg.DB_PORT}\n"
            )

        resultado = subprocess.run(
            [
                executavel,
                f"--defaults-extra-file={credenciais}",
                "--single-transaction",   # não trava as tabelas durante o dump
                "--routines",
                "--events",
                "--default-character-set=utf8mb4",
                "--add-drop-table",
                cfg.DB_NAME,
            ],
            capture_output=True,
            timeout=300,
        )

        if resultado.returncode != 0:
            detalhe = resultado.stderr.decode("utf-8", "replace").strip()
            # A senha não aparece na saída, mas o caminho do .cnf sim.
            detalhe = detalhe.replace(credenciais, "<credenciais>")
            raise BackupIndisponivel(f"mysqldump falhou: {detalhe[:400]}")

        return resultado.stdout, nome_do_arquivo(cfg.DB_NAME)

    except subprocess.TimeoutExpired as e:
        raise BackupIndisponivel("O backup demorou demais e foi interrompido.") from e
    finally:
        try:
            os.remove(credenciais)
        except OSError:
            pass
