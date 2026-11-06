import os
from decimal import Decimal, InvalidOperation

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://zzbrsrobmuzfhwcozqgg.supabase.co").rstrip("/")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY", "sb_secret_15riIEyz4iJD5P3Zscuu6w_fnPl8tA4")

def acessar_supabase(metodo, tabela, parametros=None, dados=None):
    # Garante que a URL seja montada com as barras corretas
    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/{tabela.lstrip('/')}"

    headers = {
        "apikey": SUPABASE_SECRET_KEY,
        "Authorization": f"Bearer {SUPABASE_SECRET_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }

    resposta = requests.request(
        metodo,
        url,
        headers=headers,
        params=parametros,
        json=dados,
        timeout=10,
    )
    resposta.raise_for_status()
    return resposta.json()


@app.before_request
def conferir_configurar():
    # Verificar se o usuário está tentando acessar uma rota de API
    if request.path.startswith("/api/"):
        if not SUPABASE_URL or not SUPABASE_SECRET_KEY:
            return (
                jsonify(mensagem="Configure a URL e a chave do Supabase"),
                503,
            )


@app.get("/")
def inicio():
    return render_template("index.html")


@app.get("/api/categorias")
def listar_categorias():
    categorias = acessar_supabase(
        "GET", "categorias", {"select": "categoria_id, nome", "order": "nome.asc"}
    )
    return jsonify(categorias)


@app.get("/api/produtos")
def listar_produtos():
    produtos = acessar_supabase(
        "GET",
        "produtos",
        {
            "select": "produto_id, nome, preco, estoque, categorias(nome)",
            "order": "produto_id.desc",
        },
    )
    return jsonify(produtos)


@app.post("/api/produtos")
def cadastrar_produto():
    dados = request.get_json(silent=True)
    if not isinstance(dados, dict):
        return jsonify(mensagem="Envie um objeto JSON válido."), 400

    # Validação de presença de campos
    campos = ["nome", "preco", "estoque", "categoria_id"]
    for campo in campos:
        if dados.get(campo) is None or str(dados.get(campo)).strip() == "":
            return jsonify(mensagem=f"O campo {campo} deve ser preenchido."), 400

    nome = str(dados["nome"]).strip()
    texto_preco = str(dados["preco"]).strip().replace(",", ".")
    texto_estoque = str(dados["estoque"]).strip()
    texto_categoria = str(dados["categoria_id"]).strip()

    if len(nome) < 3 or len(nome) > 80:
        return jsonify(mensagem="O nome deve ter de 3 a 80 caracteres."), 400

    try:
        preco = Decimal(texto_preco)
        estoque = int(texto_estoque)
        categoria_id = int(texto_categoria)
    except (InvalidOperation, ValueError):
        return jsonify(
            mensagem="Informe preço numérico, estoque inteiro e categoria válida."
        ), 400

    if not preco.is_finite() or preco <= 0 or preco > Decimal("999999.99"):
        return jsonify(
            mensagem="O preço deve estar entre R$ 0,01 e R$ 999.999,99."
        ), 400
    if preco != preco.quantize(Decimal("0.01")):
        return jsonify(mensagem="O preço deve ter no máximo duas casas decimais."), 400
    if estoque < 0 or estoque > 1000000:
        return jsonify(mensagem="O estoque deve estar entre 0 e 1.000.000 unidades."), 400
    if categoria_id <= 0:
        return jsonify(mensagem="Selecione uma categoria válida."), 400

    categorias = acessar_supabase(
        "GET",
        "categorias",
        {"select": "categoria_id", "categoria_id": f"eq.{categoria_id}"},
    )

    if not categorias:
        return jsonify(mensagem="A categoria informada não existe."), 400

    acessar_supabase(
        "POST",
        "produtos",
        dados={
            "nome": nome,
            "preco": str(preco),
            "estoque": estoque,
            "categoria_id": categoria_id,
        },
    )

    return jsonify(mensagem="Produto cadastrado com sucesso."), 201


# --- NOVAS ROTAS: CLIENTES ---

@app.get("/api/clientes")
def listar_clientes():
    clientes = acessar_supabase(
        "GET", "clientes", {"select": "cliente_id, nome, email, telefone", "order": "nome.asc"}
    )
    return jsonify(clientes)


@app.post("/api/clientes")
def cadastrar_cliente():
    dados = request.get_json(silent=True)
    if not isinstance(dados, dict):
        return jsonify(mensagem="Envie um objeto JSON válido."), 400

    nome = str(dados.get("nome", "")).strip()
    email = str(dados.get("email", "")).strip()
    telefone = str(dados.get("telefone", "")).strip() if dados.get("telefone") else None

    # Validação simples
    if not nome:
        return jsonify(mensagem="O nome do cliente é obrigatório."), 400
    if not email:
        return jsonify(mensagem="O e-mail do cliente é obrigatório."), 400

    acessar_supabase(
        "POST",
        "clientes",
        dados={
            "nome": nome,
            "email": email,
            "telefone": telefone,
        },
    )

    return jsonify(mensagem="Cliente cadastrado com sucesso."), 201


# --- NOVAS ROTAS: CARRINHO DE COMPRAS ---

@app.get("/api/carrinho")
def listar_carrinho():
    cliente_id = request.args.get("cliente_id")
    if not cliente_id:
        return jsonify(mensagem="Informe o ID do cliente."), 400

    itens = acessar_supabase(
        "GET",
        "carrinho",
        {
            "select": "carrinho_id, cliente_id, produto_id, quantidade, produtos(nome, preco)",
            "cliente_id": f"eq.{cliente_id}",
            "order": "carrinho_id.asc",
        },
    )
    return jsonify(itens)


@app.post("/api/carrinho")
def adicionar_ao_carrinho():
    dados = request.get_json(silent=True)
    if not isinstance(dados, dict):
        return jsonify(mensagem="Envie um objeto JSON válido."), 400

    try:
        cliente_id = int(dados.get("cliente_id", 0))
        produto_id = int(dados.get("produto_id", 0))
        quantidade = int(dados.get("quantidade", 0))
    except ValueError:
        return jsonify(mensagem="Os IDs de cliente, produto e quantidade devem ser numéricos."), 400

    if cliente_id <= 0:
        return jsonify(mensagem="Selecione um cliente válido."), 400
    if produto_id <= 0:
        return jsonify(mensagem="Selecione um produto válido."), 400

    # Validação de quantidade igual ou menor que zero
    if quantidade <= 0:
        return jsonify(mensagem="A quantidade deve ser maior que zero."), 400

    # Validação de duplicidade no carrinho do cliente
    existente = acessar_supabase(
        "GET",
        "carrinho",
        {
            "select": "carrinho_id",
            "cliente_id": f"eq.{cliente_id}",
            "produto_id": f"eq.{produto_id}",
        },
    )

    if existente:
        return jsonify(
            mensagem="Este produto já está no carrinho deste cliente. Remova-o antes para alterar a quantidade."
        ), 400

    acessar_supabase(
        "POST",
        "carrinho",
        dados={
            "cliente_id": cliente_id,
            "produto_id": produto_id,
            "quantidade": quantidade,
        },
    )

    return jsonify(mensagem="Produto adicionado ao carrinho com sucesso."), 201


@app.delete("/api/carrinho/<int:carrinho_id>")
def remover_do_carrinho(carrinho_id):
    acessar_supabase(
        "DELETE",
        "carrinho",
        {"carrinho_id": f"eq.{carrinho_id}"},
    )
    return jsonify(mensagem="Item removido do carrinho."), 200


# --- TRATAMENTO DE ERROS ---

@app.errorhandler(requests.exceptions.RequestException)
def tratar_erro_supabase(erro):
    app.logger.warning("Falha no acesso ao supabase: %s", type(erro).__name__)
    if isinstance(erro, requests.exceptions.HTTPError) and erro.response is not None:
        try:
            detalhe = erro.response.json()
        except ValueError:
            detalhe = {}

        codigo = detalhe.get("code") if isinstance(detalhe, dict) else None

        if codigo == "23505":
            return jsonify(mensagem="Já existe um registro com esses dados cadastrados."), 409
        if codigo == "23503":
            return jsonify(mensagem="O cliente ou produto selecionado não está mais disponível."), 409
        if codigo == "23514":
            return jsonify(mensagem="Os dados não atendem às regras do banco."), 409

    return jsonify(mensagem="Não foi possível acessar o banco. Tente novamente."), 503


@app.errorhandler(500)
def tratar_erro_inesperado(erro):
    return jsonify(mensagem="Ocorreu uma falha interna."), 503


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)