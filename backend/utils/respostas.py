"""Formato único de resposta da API.

Toda rota devolve JSON. Sucessos devolvem o objeto ou a lista direto;
erros devolvem sempre {"erro": "...", "campos": {...}}, para que o
frontend saiba onde exibir a mensagem sem adivinhar.
"""

from flask import jsonify


def ok(dados=None, status=200):
    if dados is None:
        return "", 204
    return jsonify(dados), status


def criado(dados):
    return jsonify(dados), 201


def erro(mensagem, status=400, campos=None):
    corpo = {"erro": mensagem}
    if campos:
        corpo["campos"] = campos
    return jsonify(corpo), status


def paginar(query, pagina=1, por_pagina=50, serializador=None):
    """Pagina uma query e devolve o envelope que as listas do frontend esperam."""
    por_pagina = min(max(por_pagina, 1), 200)
    pag = query.paginate(page=max(pagina, 1), per_page=por_pagina, error_out=False)
    serializar = serializador or (lambda item: item.to_dict())
    return {
        "itens": [serializar(item) for item in pag.items],
        "pagina": pag.page,
        "por_pagina": pag.per_page,
        "total": pag.total,
        "paginas": pag.pages,
    }
