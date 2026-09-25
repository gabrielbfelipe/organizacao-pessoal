"""Materiais: arquivos enviados e links externos.

Esta é a única rota que aceita multipart em vez de JSON — declarada
como exceção no before_request de app.py.

Cuidados de segurança, todos deliberados:
- o arquivo é gravado com nome UUID, nunca com o nome que veio do
  cliente, que fica só no banco para exibição;
- a extensão precisa estar na whitelist de config.EXTENSOES_PERMITIDAS;
- a pasta uploads/ fica fora de frontend/, então nada ali é servido
  como estático: o download passa por rota com @login_required.
"""

import os
import uuid

from flask import Blueprint, current_app, request, send_from_directory
from flask_login import login_required
from werkzeug.utils import secure_filename

from database import db
from models import Arquivo, Disciplina
from utils.respostas import criado, erro, ok
from utils.validacao import Validador

bp = Blueprint("arquivos", __name__)


def _pasta():
    return current_app.config["UPLOAD_FOLDER"]


def _extensao_permitida(nome):
    extensao = os.path.splitext(nome)[1].lower()
    return extensao in current_app.config["EXTENSOES_PERMITIDAS"], extensao


@bp.get("")
@login_required
def listar():
    """Filtros: ?modulo= ?tema= ?disciplina_id= ?busca=."""
    query = Arquivo.query

    for parametro, coluna in (
        ("modulo", Arquivo.modulo),
        ("tema", Arquivo.tema),
    ):
        valor = request.args.get(parametro)
        if valor:
            query = query.filter(coluna == valor)

    disciplina_id = request.args.get("disciplina_id", type=int)
    if disciplina_id:
        query = query.filter(Arquivo.disciplina_id == disciplina_id)

    busca = request.args.get("busca")
    if busca:
        query = query.filter(Arquivo.nome_original.like(f"%{busca}%"))

    arquivos = query.order_by(Arquivo.tema, Arquivo.nome_original).all()
    return ok([a.to_dict() for a in arquivos])


@bp.get("/temas")
@login_required
def listar_temas():
    """Temas em uso, para os agrupamentos da tela."""
    linhas = (
        db.session.query(Arquivo.tema, db.func.count(Arquivo.id))
        .filter(Arquivo.tema.isnot(None))
        .group_by(Arquivo.tema)
        .all()
    )
    return ok([{"tema": tema, "total": total} for tema, total in linhas])


@bp.post("")
@login_required
def enviar():
    """Aceita um arquivo (multipart) ou um link externo (form simples)."""
    modulo = (request.form.get("modulo") or "geral").strip()
    tema = (request.form.get("tema") or "").strip() or None
    disciplina_id = request.form.get("disciplina_id", type=int)
    link_externo = (request.form.get("link_externo") or "").strip() or None

    if disciplina_id and not db.session.get(Disciplina, disciplina_id):
        return erro("Disciplina não encontrada.", 400)

    # ── Material que é só um link ──
    if link_externo:
        nome = (request.form.get("nome") or link_externo)[:255]
        registro = Arquivo(
            nome_original=nome,
            caminho="",
            link_externo=link_externo[:500],
            modulo=modulo,
            tema=tema,
            disciplina_id=disciplina_id,
        )
        db.session.add(registro)
        db.session.commit()
        return criado(registro.to_dict())

    # ── Arquivo enviado ──
    enviado = request.files.get("arquivo")
    if not enviado or not enviado.filename:
        return erro("Envie um arquivo ou informe um link externo.", 400)

    permitida, extensao = _extensao_permitida(enviado.filename)
    if not permitida:
        aceitas = ", ".join(sorted(current_app.config["EXTENSOES_PERMITIDAS"]))
        return erro(f"Extensão não aceita. Use uma destas: {aceitas}.", 400)

    # O nome do cliente nunca vira caminho no disco.
    nome_no_disco = f"{uuid.uuid4().hex}{extensao}"
    caminho = os.path.join(_pasta(), nome_no_disco)
    enviado.save(caminho)

    registro = Arquivo(
        nome_original=secure_filename(enviado.filename)[:255] or f"arquivo{extensao}",
        caminho=nome_no_disco,
        mimetype=enviado.mimetype,
        tamanho=os.path.getsize(caminho),
        modulo=modulo,
        tema=tema,
        disciplina_id=disciplina_id,
    )
    db.session.add(registro)
    db.session.commit()
    return criado(registro.to_dict())


@bp.put("/<int:id>")
@login_required
def atualizar(id):
    """Renomear e reclassificar; o conteúdo em si não muda."""
    registro = db.session.get(Arquivo, id)
    if not registro:
        return erro("Material não encontrado.", 404)

    v = Validador(request.get_json(silent=True))
    nome = v.texto("nome_original", max_len=255)
    tema = v.texto("tema", max_len=100)
    modulo = v.texto("modulo", max_len=20)
    v.finalizar()

    if nome:
        registro.nome_original = nome
    if tema is not None:
        registro.tema = tema
    if modulo:
        registro.modulo = modulo

    db.session.commit()
    return ok(registro.to_dict())


@bp.get("/<int:id>/download")
@login_required
def baixar(id):
    """Serve o arquivo. Protegida por sessão, nunca como estático."""
    registro = db.session.get(Arquivo, id)
    if not registro:
        return erro("Material não encontrado.", 404)
    if not registro.caminho:
        return erro("Este material é um link externo.", 400)

    if not os.path.exists(os.path.join(_pasta(), registro.caminho)):
        return erro("O arquivo não está mais no disco.", 410)

    # PDFs e imagens abrem na própria tela; o resto vira download.
    inline = (registro.mimetype or "").startswith(("application/pdf", "image/"))
    return send_from_directory(
        _pasta(),
        registro.caminho,
        as_attachment=not inline,
        download_name=registro.nome_original,
    )


@bp.delete("/<int:id>")
@login_required
def apagar(id):
    registro = db.session.get(Arquivo, id)
    if not registro:
        return erro("Material não encontrado.", 404)

    if registro.caminho:
        caminho = os.path.join(_pasta(), registro.caminho)
        if os.path.exists(caminho):
            try:
                os.remove(caminho)
            except OSError:
                # O registro sai mesmo assim; um arquivo órfão no disco é
                # menos ruim que uma listagem que aponta para o nada.
                current_app.logger.warning("Não foi possível apagar %s", caminho)

    db.session.delete(registro)
    db.session.commit()
    return ok()
