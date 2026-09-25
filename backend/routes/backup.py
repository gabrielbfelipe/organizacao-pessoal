"""Download do backup do banco."""

from flask import Blueprint, Response
from flask_login import login_required

from config import Config
from services.backup import BackupIndisponivel, encontrar_mysqldump, gerar
from utils.respostas import erro, ok

bp = Blueprint("backup", __name__)


@bp.get("/status")
@login_required
def status():
    """Diz se o backup esta disponivel, para a tela nao oferecer em vao."""
    try:
        caminho = encontrar_mysqldump(Config.MYSQLDUMP)
        return ok({"disponivel": True, "mysqldump": caminho})
    except BackupIndisponivel as e:
        return ok({"disponivel": False, "motivo": str(e)})


@bp.get("")
@login_required
def baixar():
    try:
        conteudo, nome = gerar(Config)
    except BackupIndisponivel as e:
        return erro(str(e), 503)

    return Response(
        conteudo,
        mimetype="application/sql",
        headers={
            "Content-Disposition": f'attachment; filename="{nome}"',
            "Content-Length": str(len(conteudo)),
        },
    )
