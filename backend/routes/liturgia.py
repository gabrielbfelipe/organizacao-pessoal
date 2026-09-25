"""Tempo liturgico do dia e as datas fixas que o complementam."""

from datetime import date

from flask import Blueprint, request
from flask_login import login_required

import constants
from database import db
from models import LiturgiaDataFixa
from utils.respostas import criado, erro, ok
from utils.validacao import Validador

bp = Blueprint("liturgia", __name__)


@bp.get("/hoje")
def hoje():
    """Aceita ?data=AAAA-MM-DD para conferir qualquer dia do calendario."""
    from services.liturgia import tempo_liturgico

    bruto = request.args.get("data")
    if bruto:
        try:
            dia = date.fromisoformat(bruto)
        except ValueError:
            return erro("Use o formato AAAA-MM-DD no parametro data.", 400)
    else:
        dia = date.today()

    return ok(tempo_liturgico(dia))


@bp.get("/datas-fixas")
@login_required
def listar_datas_fixas():
    datas = LiturgiaDataFixa.query.order_by(
        LiturgiaDataFixa.mes, LiturgiaDataFixa.dia
    ).all()
    return ok([d.to_dict() for d in datas])


@bp.post("/datas-fixas")
@login_required
def criar_data_fixa():
    v = Validador(request.get_json(silent=True))
    mes = v.inteiro("mes", obrigatorio=True, minimo=1, maximo=12)
    dia = v.inteiro("dia", obrigatorio=True, minimo=1, maximo=31)
    titulo = v.texto("titulo", obrigatorio=True, max_len=160)
    cor = v.escolha("cor", list(constants.CORES_LITURGICAS), default="branco")
    grau = v.escolha("grau", constants.GRAUS_LITURGICOS, default="memoria")
    v.finalizar()

    data_fixa = LiturgiaDataFixa(mes=mes, dia=dia, titulo=titulo, cor=cor, grau=grau)
    db.session.add(data_fixa)
    db.session.commit()
    return criado(data_fixa.to_dict())


@bp.delete("/datas-fixas/<int:id>")
@login_required
def apagar_data_fixa(id):
    data_fixa = db.session.get(LiturgiaDataFixa, id)
    if not data_fixa:
        return erro("Data liturgica nao encontrada.", 404)
    db.session.delete(data_fixa)
    db.session.commit()
    return ok()
