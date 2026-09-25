"""Dados iniciais do Ordo.

Tudo aqui é idempotente: cada bloco só insere se ainda não houver nada,
então rodar `python app.py` várias vezes não duplica nem sobrescreve.
"""

from database import db
from models import Categoria, Disciplina, LiturgiaDataFixa, Oracao, Usuario

CATEGORIAS_PADRAO = [
    ("Pessoal", "#1B2A41", "geral"),
    ("Trabalho", "#4A6FA5", "geral"),
    ("Igreja", "#B8963E", "igreja"),
    ("Estudos", "#2E7D4F", "estudos"),
    ("Saúde", "#B22222", "geral"),
]

DISCIPLINAS_PADRAO = [
    ("Português", "#B22222"),
    ("Matemática", "#1B2A41"),
    ("Raciocínio Lógico", "#4A6FA5"),
    ("Direito Constitucional", "#6B3FA0"),
    ("Direito Administrativo", "#B8963E"),
    ("Informática", "#2E7D4F"),
]

# Solenidades e festas de data fixa. O cálculo móvel não as cobre, e é
# por elas que o vermelho dos mártires aparece no lugar certo.
# (mês, dia, título, cor, grau)
DATAS_FIXAS = [
    (1, 1, "Santa Maria, Mãe de Deus", "branco", "solenidade"),
    (1, 25, "Conversão de São Paulo", "branco", "festa"),
    (2, 2, "Apresentação do Senhor", "branco", "festa"),
    (3, 19, "São José, Esposo de Maria", "branco", "solenidade"),
    (3, 25, "Anunciação do Senhor", "branco", "solenidade"),
    (4, 25, "São Marcos, Evangelista", "vermelho", "festa"),
    (6, 24, "Natividade de São João Batista", "branco", "solenidade"),
    (6, 29, "São Pedro e São Paulo", "vermelho", "solenidade"),
    (7, 3, "São Tomé, Apóstolo", "vermelho", "festa"),
    (7, 25, "São Tiago, Apóstolo", "vermelho", "festa"),
    (8, 6, "Transfiguração do Senhor", "branco", "festa"),
    (8, 10, "São Lourenço, Diácono e Mártir", "vermelho", "festa"),
    (8, 15, "Assunção de Nossa Senhora", "branco", "solenidade"),
    (8, 24, "São Bartolomeu, Apóstolo", "vermelho", "festa"),
    (9, 8, "Natividade de Nossa Senhora", "branco", "festa"),
    (9, 14, "Exaltação da Santa Cruz", "vermelho", "festa"),
    (9, 21, "São Mateus, Evangelista", "vermelho", "festa"),
    (9, 29, "Santos Arcanjos Miguel, Gabriel e Rafael", "branco", "festa"),
    (10, 12, "Nossa Senhora Aparecida, Padroeira do Brasil", "branco", "solenidade"),
    (10, 18, "São Lucas, Evangelista", "vermelho", "festa"),
    (10, 28, "São Simão e São Judas, Apóstolos", "vermelho", "festa"),
    (11, 1, "Todos os Santos", "branco", "solenidade"),
    (11, 2, "Comemoração de Todos os Fiéis Defuntos", "roxo", "comemoracao"),
    (11, 9, "Dedicação da Basílica de Latrão", "branco", "festa"),
    (11, 30, "Santo André, Apóstolo", "vermelho", "festa"),
    (12, 8, "Imaculada Conceição de Nossa Senhora", "branco", "solenidade"),
    (12, 25, "Natal do Senhor", "branco", "solenidade"),
    (12, 26, "Santo Estêvão, Protomártir", "vermelho", "festa"),
    (12, 27, "São João, Apóstolo e Evangelista", "branco", "festa"),
    (12, 28, "Santos Inocentes, Mártires", "vermelho", "festa"),
]

ORACOES_PADRAO = [
    (
        "Oferecimento da manhã",
        "Senhor meu Deus, eu vos ofereço todos os meus pensamentos, "
        "palavras, obras e sofrimentos deste dia. Dai-me a graça de não "
        "vos ofender e de fazer em tudo a vossa santíssima vontade. Amém.",
        "manha",
    ),
    (
        "Angelus",
        "O Anjo do Senhor anunciou a Maria,\n"
        "— e ela concebeu do Espírito Santo.\n\n"
        "Ave Maria, cheia de graça, o Senhor é convosco. Bendita sois vós "
        "entre as mulheres e bendito é o fruto do vosso ventre, Jesus. "
        "Santa Maria, Mãe de Deus, rogai por nós, pecadores, agora e na "
        "hora da nossa morte. Amém.\n\n"
        "Eis aqui a escrava do Senhor,\n"
        "— faça-se em mim segundo a vossa palavra.\n\n"
        "Ave Maria...\n\n"
        "E o Verbo se fez carne,\n"
        "— e habitou entre nós.\n\n"
        "Ave Maria...\n\n"
        "Rogai por nós, Santa Mãe de Deus,\n"
        "— para que sejamos dignos das promessas de Cristo.\n\n"
        "Derramai, ó Deus, a vossa graça em nossos corações, para que nós, "
        "que conhecemos pela voz do Anjo a Encarnação do vosso Filho Jesus "
        "Cristo, cheguemos, por sua Paixão e Cruz, à glória da ressurreição. "
        "Por Cristo, nosso Senhor. Amém.",
        "manha",
    ),
    (
        "Ato de contrição",
        "Meu Deus, eu me arrependo de todo o coração de todos os meus "
        "pecados e os detesto, porque, pecando, mereci as vossas penas e, "
        "muito mais, porque vos ofendi, a vós, sumo bem e digno de ser "
        "amado sobre todas as coisas. Proponho firmemente, com o auxílio "
        "da vossa graça, não mais vos ofender e fugir das ocasiões de "
        "pecado. Amém.",
        "noite",
    ),
    (
        "Oração da noite — Salve Rainha",
        "Salve, Rainha, Mãe de misericórdia, vida, doçura e esperança "
        "nossa, salve! A vós clamamos, os degredados filhos de Eva. A vós "
        "suspiramos, gemendo e chorando neste vale de lágrimas. Eia, pois, "
        "advogada nossa, esses vossos olhos misericordiosos a nós volvei. "
        "E depois deste desterro nos mostrai Jesus Cristo, bendito fruto "
        "do vosso ventre. Ó clemente, ó piedosa, ó doce sempre Virgem "
        "Maria. Amém.",
        "noite",
    ),
    (
        "Oração a São Miguel Arcanjo",
        "São Miguel Arcanjo, defendei-nos no combate. Sede o nosso "
        "refúgio contra as maldades e ciladas do demônio. Que Deus "
        "manifeste o seu poder, é o que humildemente pedimos. E vós, "
        "príncipe da milícia celeste, com o poder divino, precipitai no "
        "inferno a Satanás e aos outros espíritos malignos que vagueiam "
        "pelo mundo para perdição das almas. Amém.",
        "pessoal",
    ),
    (
        "Vinde, Espírito Santo",
        "Vinde, Espírito Santo, enchei os corações dos vossos fiéis e "
        "acendei neles o fogo do vosso amor. Enviai o vosso Espírito e "
        "tudo será criado, e renovareis a face da terra. Amém.",
        "pessoal",
    ),
    (
        "Oração antes da celebração",
        "Senhor Jesus, Sumo e Eterno Sacerdote, dai-me servir ao vosso "
        "altar com reverência, atenção e amor. Que meus gestos não chamem "
        "atenção para mim, mas conduzam o povo ao mistério que celebramos. "
        "Guardai-me da pressa e da distração, e fazei do meu serviço uma "
        "oração. Amém.",
        "pessoal",
    ),
]


def popular_dados_iniciais(cfg):
    """Insere os dados padrão apenas se as tabelas estiverem vazias."""
    if not Categoria.query.first():
        for nome, cor, modulo in CATEGORIAS_PADRAO:
            db.session.add(Categoria(nome=nome, cor=cor, modulo=modulo))
        print("✔ Categorias padrão criadas.")

    if not Disciplina.query.first():
        for nome, cor in DISCIPLINAS_PADRAO:
            db.session.add(Disciplina(nome=nome, cor=cor))
        print("✔ Disciplinas padrão criadas.")

    if not LiturgiaDataFixa.query.first():
        for mes, dia, titulo, cor, grau in DATAS_FIXAS:
            db.session.add(
                LiturgiaDataFixa(mes=mes, dia=dia, titulo=titulo, cor=cor, grau=grau)
            )
        print(f"✔ {len(DATAS_FIXAS)} datas litúrgicas fixas cadastradas.")

    if not Oracao.query.first():
        for titulo, texto, categoria in ORACOES_PADRAO:
            db.session.add(Oracao(titulo=titulo, texto=texto, categoria=categoria))
        print(f"✔ {len(ORACOES_PADRAO)} orações iniciais cadastradas.")

    if not Usuario.query.first():
        usuario = Usuario(nome=cfg.ADMIN_NOME, email=cfg.ADMIN_EMAIL)
        usuario.definir_senha(cfg.ADMIN_SENHA)
        db.session.add(usuario)
        print(f"✔ Usuário inicial criado: {cfg.ADMIN_EMAIL}")

    db.session.commit()
