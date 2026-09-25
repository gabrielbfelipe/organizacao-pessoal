"""Registro central dos blueprints da API.

Cada modulo novo entra aqui com o seu prefixo. Manter o registro num so
lugar evita que app.py cresca a cada fase do projeto.
"""

from flask import Blueprint

import constants


def registrar_blueprints(app):
    from routes.agenda import bp_agenda, bp_compromissos
    from routes.anotacoes import bp as anotacoes_bp
    from routes.arquivos import bp as arquivos_bp
    from routes.auth import bp as auth_bp
    from routes.avisos import bp as avisos_bp
    from routes.backup import bp as backup_bp
    from routes.busca import bp as busca_bp
    from routes.categorias import bp as categorias_bp
    from routes.dashboard import bp as dashboard_bp
    from routes.estudos import (
        bp_disciplinas,
        bp_flashcards,
        bp_metas,
        bp_sessoes,
    )
    from routes.igreja import bp as igreja_escalas_bp
    from routes.igreja_extra import bp_eventos, bp_horarios
    from routes.livros import bp as livros_bp
    from routes.lembretes import bp as lembretes_bp
    from routes.tarefas import bp as tarefas_bp
    from routes.liturgia import bp as liturgia_bp
    from routes.oracoes import bp as oracoes_bp
    from routes.simulados import bp_erros, bp_simulados

    app.register_blueprint(auth_bp, url_prefix="/api")
    app.register_blueprint(dashboard_bp, url_prefix="/api/dashboard")
    app.register_blueprint(liturgia_bp, url_prefix="/api/liturgia")
    app.register_blueprint(categorias_bp, url_prefix="/api/categorias")

    # Agenda
    app.register_blueprint(bp_compromissos, url_prefix="/api/compromissos")
    app.register_blueprint(bp_agenda, url_prefix="/api/agenda")
    app.register_blueprint(lembretes_bp, url_prefix="/api/lembretes")
    app.register_blueprint(avisos_bp, url_prefix="/api/avisos")
    app.register_blueprint(tarefas_bp, url_prefix="/api/tarefas")

    # Igreja
    app.register_blueprint(igreja_escalas_bp, url_prefix="/api/igreja/escalas")
    app.register_blueprint(bp_eventos, url_prefix="/api/igreja/eventos")
    app.register_blueprint(bp_horarios, url_prefix="/api/igreja/horarios")
    app.register_blueprint(oracoes_bp, url_prefix="/api/igreja/oracoes")

    # Estudos
    app.register_blueprint(bp_disciplinas, url_prefix="/api/disciplinas")
    app.register_blueprint(bp_simulados, url_prefix="/api/simulados")
    app.register_blueprint(bp_erros, url_prefix="/api/erros")
    app.register_blueprint(bp_sessoes, url_prefix="/api/sessoes")
    app.register_blueprint(bp_metas, url_prefix="/api/metas")
    app.register_blueprint(bp_flashcards, url_prefix="/api/flashcards")

    # Compartilhados entre os módulos
    app.register_blueprint(livros_bp, url_prefix="/api/livros")
    app.register_blueprint(anotacoes_bp, url_prefix="/api/anotacoes")
    app.register_blueprint(arquivos_bp, url_prefix="/api/arquivos")
    app.register_blueprint(busca_bp, url_prefix="/api/busca")
    app.register_blueprint(backup_bp, url_prefix="/api/backup")
    app.register_blueprint(_bp_constantes(), url_prefix="/api")


def _bp_constantes():
    """Expoe as listas de constants.py para os <select> do frontend,
    para que as opcoes nao sejam duplicadas em JavaScript."""
    bp = Blueprint("constantes", __name__)

    @bp.get("/constantes")
    def listar():
        from utils.respostas import ok

        return ok(
            {
                "modulos": constants.MODULOS,
                "prioridades": constants.PRIORIDADES,
                "status_tarefa": constants.STATUS_TAREFA,
                "recorrencias": constants.RECORRENCIAS,
                "antecedencias": [
                    {"minutos": m, "rotulo": r} for m, r in constants.ANTECEDENCIAS
                ],
                "funcoes_cerimoniario": constants.FUNCOES_CERIMONIARIO,
                "status_escala": constants.STATUS_ESCALA,
                "tipos_evento": constants.TIPOS_EVENTO,
                "tipos_horario_fixo": constants.TIPOS_HORARIO_FIXO,
                "categorias_oracao": constants.CATEGORIAS_ORACAO,
                "status_livro": constants.STATUS_LIVRO,
                "temas_material": constants.TEMAS_MATERIAL,
                "dias_semana": constants.DIAS_SEMANA,
                "alternativas": constants.ALTERNATIVAS,
                "motivos_erro": constants.MOTIVOS_ERRO,
                "tipos_sessao": constants.TIPOS_SESSAO,
                "periodos_meta": constants.PERIODOS_META,
                "dificuldades_flashcard": constants.DIFICULDADES_FLASHCARD,
                "cores_liturgicas": constants.CORES_LITURGICAS,
                "graus_liturgicos": constants.GRAUS_LITURGICOS,
            }
        )

    return bp
