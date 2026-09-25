"""Login, logout e identidade do usuário."""

from flask import Blueprint, request
from flask_login import current_user, login_required, login_user, logout_user

from database import db
from models import Usuario
from utils.respostas import erro, ok
from utils.validacao import Validador

bp = Blueprint("auth", __name__)


@bp.post("/login")
def login():
    v = Validador(request.get_json(silent=True))
    email = v.email("email", obrigatorio=True)
    senha = v.texto("senha", obrigatorio=True, max_len=255)
    lembrar = v.booleano("lembrar", default=True)
    v.finalizar()

    usuario = Usuario.query.filter_by(email=email).first()
    if not usuario or not usuario.checar_senha(senha):
        # Mensagem genérica de propósito: não revela se o e-mail existe.
        return erro("E-mail ou senha incorretos.", 401)

    login_user(usuario, remember=lembrar)
    return ok(usuario.to_dict())


@bp.post("/logout")
@login_required
def logout():
    logout_user()
    return ok({"mensagem": "Sessão encerrada."})


@bp.get("/me")
@login_required
def me():
    return ok(current_user.to_dict())


@bp.put("/me")
@login_required
def atualizar_me():
    """Altera nome, e-mail e senha do próprio usuário."""
    v = Validador(request.get_json(silent=True))
    nome = v.texto("nome", max_len=120)
    email = v.email("email")
    senha_atual = v.texto("senha_atual", max_len=255)
    senha_nova = v.texto("senha_nova", max_len=255)
    v.finalizar()

    if nome:
        current_user.nome = nome

    if email and email != current_user.email:
        if Usuario.query.filter_by(email=email).first():
            return erro("Dados inválidos.", 400, {"email": "Este e-mail já está em uso."})
        current_user.email = email

    if senha_nova:
        if not senha_atual or not current_user.checar_senha(senha_atual):
            return erro(
                "Dados inválidos.", 400, {"senha_atual": "Senha atual incorreta."}
            )
        if len(senha_nova) < 8:
            return erro(
                "Dados inválidos.",
                400,
                {"senha_nova": "Use pelo menos 8 caracteres."},
            )
        current_user.definir_senha(senha_nova)

    db.session.commit()
    return ok(current_user.to_dict())
