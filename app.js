/* O navegador conversa com Flask. Somente Python conhece a chave do Supabase. */

// Elementos da interface
const formularioProduto = document.getElementById("formulario");
const mensagemProduto = document.getElementById("mensagem");
const mensagemLista = document.getElementById("mensagem-lista");
const listaProdutos = document.getElementById("lista-produtos");
const campoCategoria = document.getElementById("categoria");
const botaoCadastrarProduto = document.getElementById("botao-cadastrar");

// Elementos - Cliente
const formularioCliente = document.getElementById("formulario-cliente");
const mensagemCliente = document.getElementById("mensagem-cliente");
const botaoCadastrarCliente = document.getElementById("botao-cadastrar-cliente");

// Elementos - Carrinho
const formularioCarrinho = document.getElementById("formulario-carrinho");
const selectCarrinhoCliente = document.getElementById("carrinho-cliente");
const selectCarrinhoProduto = document.getElementById("carrinho-produto");
const inputCarrinhoQuantidade = document.getElementById("carrinho-quantidade");
const mensagemCarrinho = document.getElementById("mensagem-carrinho");
const listaCarrinho = document.getElementById("lista-carrinho");
const elementoTotalCarrinho = document.getElementById("total-carrinho");
const botaoAdicionarCarrinho = document.getElementById("botao-adicionar-carrinho");

function mostrarMensagem(elemento, texto, sucesso) {
  elemento.textContent = texto;
  elemento.className = sucesso ? "mensagem sucesso" : "mensagem erro";
}

function formatarMoeda(valor) {
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// --- CATEGORIAS & PRODUTOS ---

async function carregarCategorias() {
  try {
    const resposta = await fetch("/api/categorias");
    const dados = await resposta.json();
    if (!resposta.ok) {
      mostrarMensagem(mensagemProduto, dados.mensagem, false);
      return;
    }
    campoCategoria.replaceChildren(new Option("Selecione uma categoria", ""));
    for (const categoria of dados) {
      const opcao = new Option(categoria.nome, categoria.categoria_id);
      campoCategoria.appendChild(opcao);
    }
  } catch (erro) {
    mostrarMensagem(mensagemProduto, "Não foi possível carregar as categorias.", false);
  }
}

async function carregarProdutos() {
  mensagemLista.textContent = "Consultando produtos...";
  try {
    const resposta = await fetch("/api/produtos");
    const produtos = await resposta.json();
    if (!resposta.ok) {
      mensagemLista.textContent = produtos.mensagem;
      return;
    }

    // Atualiza a tabela de produtos
    listaProdutos.replaceChildren();
    for (const produto of produtos) {
      const linha = document.createElement("tr");
      const valores = [
        produto.nome,
        produto.categorias ? produto.categorias.nome : "Sem categoria",
        formatarMoeda(produto.preco),
        produto.estoque,
      ];
      for (const valor of valores) {
        const celula = document.createElement("td");
        celula.textContent = valor;
        linha.appendChild(celula);
      }
      listaProdutos.appendChild(linha);
    }

    // Atualiza o select de produtos do carrinho
    selectCarrinhoProduto.replaceChildren(new Option("Selecione um produto", ""));
    for (const produto of produtos) {
      const opcao = new Option(`${produto.nome} (${formatarMoeda(produto.preco)})`, produto.produto_id);
      selectCarrinhoProduto.appendChild(opcao);
    }

    mensagemLista.textContent = produtos.length === 0 ? "Nenhum produto cadastrado." : "Lista atualizada.";
  } catch (erro) {
    mensagemLista.textContent = "Não foi possível atualizar a lista de produtos.";
  }
}

async function cadastrarProduto(evento) {
  evento.preventDefault();
  botaoCadastrarProduto.disabled = true;
  mostrarMensagem(mensagemProduto, "Enviando dados...", true);

  const produto = {
    nome: document.getElementById("nome").value,
    categoria_id: campoCategoria.value,
    preco: document.getElementById("preco").value,
    estoque: document.getElementById("estoque").value,
  };

  try {
    const resposta = await fetch("/api/produtos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(produto),
    });
    const dados = await resposta.json();
    mostrarMensagem(mensagemProduto, dados.mensagem, resposta.ok);
    if (resposta.ok) {
      formularioProduto.reset();
      await carregarProdutos();
    }
  } catch (erro) {
    mostrarMensagem(mensagemProduto, "Erro ao cadastrar produto.", false);
  } finally {
    botaoCadastrarProduto.disabled = false;
  }
}

// --- CLIENTES ---

async function carregarClientes() {
  try {
    const resposta = await fetch("/api/clientes");
    const clientes = await resposta.json();
    if (!resposta.ok) return;

    selectCarrinhoCliente.replaceChildren(new Option("Selecione um cliente", ""));
    for (const cliente of clientes) {
      const opcao = new Option(`${cliente.nome} (${cliente.email})`, cliente.cliente_id);
      selectCarrinhoCliente.appendChild(opcao);
    }
  } catch (erro) {
    console.error("Erro ao carregar clientes:", erro);
  }
}

async function cadastrarCliente(evento) {
  evento.preventDefault();
  botaoCadastrarCliente.disabled = true;
  mostrarMensagem(mensagemCliente, "Cadastrando cliente...", true);

  const cliente = {
    nome: document.getElementById("cliente-nome").value.trim(),
    email: document.getElementById("cliente-email").value.trim(),
    telefone: document.getElementById("cliente-telefone").value.trim(),
  };

  // Validação no frontend
  if (!cliente.nome || !cliente.email) {
    mostrarMensagem(mensagemCliente, "Por favor, preencha o nome e o e-mail.", false);
    botaoCadastrarCliente.disabled = false;
    return;
  }

  try {
    const resposta = await fetch("/api/clientes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cliente),
    });
    const dados = await resposta.json();
    mostrarMensagem(mensagemCliente, dados.mensagem, resposta.ok);
    if (resposta.ok) {
      formularioCliente.reset();
      await carregarClientes();
    }
  } catch (erro) {
    mostrarMensagem(mensagemCliente, "Não foi possível cadastrar o cliente.", false);
  } finally {
    botaoCadastrarCliente.disabled = false;
  }
}

// --- CARRINHO DE COMPRAS ---

async function carregarCarrinho() {
  const clienteId = selectCarrinhoCliente.value;
  listaCarrinho.replaceChildren();
  elementoTotalCarrinho.textContent = "R$ 0,00";

  if (!clienteId) {
    const linha = document.createElement("tr");
    const celula = document.createElement("td");
    celula.colSpan = 5;
    celula.textContent = "Selecione um cliente para visualizar o carrinho.";
    linha.appendChild(celula);
    listaCarrinho.appendChild(linha);
    return;
  }

  try {
    const resposta = await fetch(`/api/carrinho?cliente_id=${clienteId}`);
    const itens = await resposta.json();

    if (!resposta.ok) {
      mostrarMensagem(mensagemCarrinho, itens.mensagem, false);
      return;
    }

    if (itens.length === 0) {
      const linha = document.createElement("tr");
      const celula = document.createElement("td");
      celula.colSpan = 5;
      celula.textContent = "O carrinho deste cliente está vazio.";
      linha.appendChild(celula);
      listaCarrinho.appendChild(linha);
      return;
    }

    let valorTotal = 0;

    for (const item of itens) {
      const precoUnitario = Number(item.produtos ? item.produtos.preco : 0);
      const subtotal = precoUnitario * item.quantidade;
      valorTotal += subtotal;

      const linha = document.createElement("tr");

      // Colunas: Produto, Quantidade, Preço Unitário, Subtotal
      const tdNome = document.createElement("td");
      tdNome.textContent = item.produtos ? item.produtos.nome : "Produto não encontrado";

      const tdQtd = document.createElement("td");
      tdQtd.textContent = item.quantidade;

      const tdPreco = document.createElement("td");
      tdPreco.textContent = formatarMoeda(precoUnitario);

      const tdSubtotal = document.createElement("td");
      tdSubtotal.textContent = formatarMoeda(subtotal);

      // Botão Remover
      const tdAcao = document.createElement("td");
      const botaoRemover = document.createElement("button");
      botaoRemover.type = "button";
      botaoRemover.className = "btn-remover";
      botaoRemover.textContent = "Remover";
      botaoRemover.onclick = () => removerDoCarrinho(item.carrinho_id);
      tdAcao.appendChild(botaoRemover);

      linha.append(tdNome, tdQtd, tdPreco, tdSubtotal, tdAcao);
      listaCarrinho.appendChild(linha);
    }

    elementoTotalCarrinho.textContent = formatarMoeda(valorTotal);
  } catch (erro) {
    mostrarMensagem(mensagemCarrinho, "Não foi possível carregar o carrinho.", false);
  }
}

async function adicionarAoCarrinho(evento) {
  evento.preventDefault();
  const clienteId = selectCarrinhoCliente.value;
  const produtoId = selectCarrinhoProduto.value;
  const quantidade = parseInt(inputCarrinhoQuantidade.value, 10);

  // Validações no frontend
  if (!clienteId) {
    mostrarMensagem(mensagemCarrinho, "Selecione um cliente antes de adicionar produtos.", false);
    return;
  }
  if (!produtoId) {
    mostrarMensagem(mensagemCarrinho, "Selecione um produto para adicionar.", false);
    return;
  }
  if (isNaN(quantidade) || quantidade <= 0) {
    mostrarMensagem(mensagemCarrinho, "A quantidade deve ser maior que zero.", false);
    return;
  }

  botaoAdicionarCarrinho.disabled = true;
  mostrarMensagem(mensagemCarrinho, "Adicionando ao carrinho...", true);

  try {
    const resposta = await fetch("/api/carrinho", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cliente_id: Number(clienteId),
        produto_id: Number(produtoId),
        quantidade: quantidade,
      }),
    });

    const dados = await resposta.json();
    mostrarMensagem(mensagemCarrinho, dados.mensagem, resposta.ok);

    if (resposta.ok) {
      inputCarrinhoQuantidade.value = "1";
      selectCarrinhoProduto.value = "";
      await carregarCarrinho();
    }
  } catch (erro) {
    mostrarMensagem(mensagemCarrinho, "Falha ao adicionar produto ao carrinho.", false);
  } finally {
    botaoAdicionarCarrinho.disabled = false;
  }
}

async function removerDoCarrinho(carrinhoId) {
  try {
    const resposta = await fetch(`/api/carrinho/${carrinhoId}`, {
      method: "DELETE",
    });
    const dados = await resposta.json();
    mostrarMensagem(mensagemCarrinho, dados.mensagem, resposta.ok);
    if (resposta.ok) {
      await carregarCarrinho();
    }
  } catch (erro) {
    mostrarMensagem(mensagemCarrinho, "Erro ao remover item do carrinho.", false);
  }
}

// Eventos e inicializações
formularioProduto.addEventListener("submit", cadastrarProduto);
formularioCliente.addEventListener("submit", cadastrarCliente);
formularioCarrinho.addEventListener("submit", adicionarAoCarrinho);
selectCarrinhoCliente.addEventListener("change", carregarCarrinho);
document.getElementById("botao-atualizar").addEventListener("click", carregarProdutos);

carregarCategorias();
carregarProdutos();
carregarClientes();