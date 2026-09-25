"""Resumo agregado do dashboard: um request pinta o painel inteiro."""

from flask import Blueprint
from flask_login import login_required

from utils.respostas import ok

bp = Blueprint("dashboard", __name__)


@bp.get("")
@login_required
def resumo():
    from services.dashboard import montar

    return ok(montar())
