document.addEventListener('DOMContentLoaded', function() {
    const tituloInfograficoInput = document.getElementById('tituloInfografico');
    const carregadorImagem = document.getElementById('carregadorImagem');
    const containerInfografico = document.getElementById('containerInfografico');
    const instrucoes = document.getElementById('instrucoes');
    const botaoSalvar = document.getElementById('botaoSalvar');
    const listaInfograficos = document.getElementById('listaInfograficos');
    const avisoErroImagem = document.getElementById('avisoErroImagem');

    let dadosDosMarcadores = [];
    let arquivoDeImagem = null;
    let editandoId = null; 

    function mostrarNotificacao(mensagem) {
        const toast = document.getElementById('notificacaoSucesso');
        toast.textContent = mensagem;
        toast.classList.add('mostrar');
        setTimeout(() => { toast.classList.remove('mostrar'); }, 3000);
    }

    const modalPonto = document.getElementById('modalPonto');
    const textareaPonto = document.getElementById('textareaPonto');
    const btnSalvarPonto = document.getElementById('btnSalvarPonto');
    const btnCancelarPonto = document.getElementById('btnCancelarPonto');
    const btnExcluirPonto = document.getElementById('btnExcluirPonto');
    
    let callbackSalvar = null;
    let callbackExcluir = null;

    function abrirModalPonto(prefill, onSave, onDelete) {
        textareaPonto.value = prefill || '';
        modalPonto.style.display = 'flex';
        textareaPonto.focus();
        callbackSalvar = onSave;
        callbackExcluir = onDelete;
        btnExcluirPonto.style.display = prefill ? 'block' : 'none';
    }

    function fecharModalPonto() {
        modalPonto.style.display = 'none';
        callbackSalvar = null;
        callbackExcluir = null;
    }

    btnSalvarPonto.addEventListener('click', () => {
        const texto = textareaPonto.value.trim();
        if (texto && callbackSalvar) {
            callbackSalvar(texto);
            fecharModalPonto();
        } else if (!texto) {
            mostrarNotificacao('Por favor, digite a descrição do ponto.');
        }
    });

    btnCancelarPonto.addEventListener('click', fecharModalPonto);

    btnExcluirPonto.addEventListener('click', () => {
        if (callbackExcluir) {
            callbackExcluir();
            fecharModalPonto();
        }
    });

    modalPonto.addEventListener('click', (e) => {
        if (e.target === modalPonto) fecharModalPonto();
    });

    function carregarMeusInfograficos() {
        fetch('/api/meus-infograficos')
            .then(response => response.json())
            .then(infograficos => {
                listaInfograficos.innerHTML = '';
                if (infograficos.length === 0) {
                    listaInfograficos.innerHTML = '<p>Você ainda não criou nenhum infográfico.</p>';
                    return;
                }
                infograficos.forEach(info => {
                    const item = document.createElement('div');
                    item.className = 'item-infografico';
                    item.innerHTML = `
                        <span>${info.titulo}</span>
                        <div>
                            <button class="btn-editar" data-id="${info.id}" style="background-color: #ffc107; color: black; border: none; padding: 8px 12px; border-radius: 5px; cursor: pointer; margin-right: 10px;">Editar</button>
                            <button class="btn-remover" data-id="${info.id}">Remover</button>
                        </div>
                    `;
                    listaInfograficos.appendChild(item);
                });
            });
    }

    listaInfograficos.addEventListener('click', function(evento) {
        const id = evento.target.dataset.id;
        if (evento.target.classList.contains('btn-remover')) {
            if (confirm("Deseja remover este infográfico?")) {
                fetch(`/api/infografico/${id}`, { method: 'DELETE' })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        mostrarNotificacao("Removido com sucesso!");
                        carregarMeusInfograficos();
                    }
                });
            }
        } else if (evento.target.classList.contains('btn-editar')) {
            prepararEdicao(id);
        }
    });

    function prepararEdicao(id) {
        fetch(`/api/infografico/${id}`)
            .then(res => res.json())
            .then(data => {
                editandoId = id;
                tituloInfograficoInput.value = data.infografico.titulo;
                containerInfografico.innerHTML = '';
                const imagem = document.createElement('img');
                imagem.src = `/${data.infografico.caminho_imagem.replace(/\\/g, '/')}`;
                containerInfografico.appendChild(imagem);
                instrucoes.style.display = 'block';
                botaoSalvar.style.display = 'block';
                botaoSalvar.textContent = "Atualizar";
                dadosDosMarcadores = data.pontos.map(p => ({ x: p.posicao_x, y: p.posicao_y, texto: p.texto }));
                desenharMarcadores();
                imagem.addEventListener('click', adicionarMarcador);
                window.scrollTo({ top: 0, behavior: 'smooth' });
                esconderErroImagem();
            });
    }

    carregadorImagem.addEventListener('change', function(evento) {
        const arquivo = evento.target.files[0];
        if (!arquivo) return;

        const formatosValidos = ['image/jpeg', 'image/png', 'image/jpg'];
        if (!formatosValidos.includes(arquivo.type)) {
            mostrarErroImagem("Formato inválido! Use apenas JPG ou PNG.");
            return;
        }

        const leitor = new FileReader();
        leitor.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const LARGURA_MAX = 1200;
                const ALTURA_MAX = 650;

                if (this.width > LARGURA_MAX || this.height > ALTURA_MAX) {
                    mostrarErroImagem(`Imagem muito grande (${this.width}x${this.height}px). O máximo é ${LARGURA_MAX}x${ALTURA_MAX}px.`);
                } else {
                    esconderErroImagem();
                    arquivoDeImagem = arquivo;
                    containerInfografico.innerHTML = '';
                    const imagemVisualizacao = document.createElement('img');
                    imagemVisualizacao.src = e.target.result;
                    containerInfografico.appendChild(imagemVisualizacao);
                    instrucoes.style.display = 'block';
                    imagemVisualizacao.addEventListener('click', adicionarMarcador);
                }
            };
            img.src = e.target.result;
        }
        leitor.readAsDataURL(arquivo);
    });

    function mostrarErroImagem(mensagem) {
        avisoErroImagem.textContent = "⚠️ " + mensagem;
        avisoErroImagem.style.display = 'block';
        carregadorImagem.value = ''; 
        containerInfografico.innerHTML = '';
        instrucoes.style.display = 'none';
        botaoSalvar.style.display = 'none';
        arquivoDeImagem = null;
    }

    function esconderErroImagem() {
        avisoErroImagem.style.display = 'none';
    }

    function adicionarMarcador(evento) {
        abrirModalPonto('', (texto) => {
            const rect = containerInfografico.getBoundingClientRect();
            const x = ((evento.clientX - rect.left) / rect.width) * 100;
            const y = ((evento.clientY - rect.top) / rect.height) * 100;
            dadosDosMarcadores.push({ x, y, texto });
            desenharMarcadores();
            botaoSalvar.style.display = 'block';
        }, null);
    }

    function editarMarcador(index, ponto) {
        abrirModalPonto(
            ponto.texto, 
            (novoTexto) => {
                dadosDosMarcadores[index].texto = novoTexto;
                desenharMarcadores();
            },
            () => {
                dadosDosMarcadores.splice(index, 1);
                desenharMarcadores();
                mostrarNotificacao("Ponto removido.");
            }
        );
    }

    function desenharMarcadores() {
        document.querySelectorAll('.marcador').forEach(m => m.remove());
        dadosDosMarcadores.forEach((ponto, index) => {
            const marcador = document.createElement('div');
            marcador.className = 'marcador';
            marcador.style.left = `${ponto.x}%`;
            marcador.style.top = `${ponto.y}%`;
            marcador.onclick = (e) => { e.stopPropagation(); editarMarcador(index, ponto); };
            containerInfografico.appendChild(marcador);
        });
    }

    botaoSalvar.addEventListener('click', function() {
        const titulo = tituloInfograficoInput.value;
        if (!titulo.trim()) return mostrarNotificacao('Dê um nome ao infográfico.');
        if (!editandoId && !arquivoDeImagem) return mostrarNotificacao('Selecione uma imagem válida.');
        if (dadosDosMarcadores.length === 0) return mostrarNotificacao('Adicione pontos na imagem.');

        const formData = new FormData();
        formData.append('titulo', titulo);
        formData.append('pontos', JSON.stringify(dadosDosMarcadores));
        if (arquivoDeImagem) formData.append('imagemInfografico', arquivoDeImagem);

        const url = editandoId ? `/api/atualizar-infografico/${editandoId}` : '/salvar-infografico';

        fetch(url, { method: 'POST', body: formData })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                mostrarNotificacao(editandoId ? "Infográfico atualizado!" : "Infográfico salvo!");
                setTimeout(() => { resetarFormulario(); carregarMeusInfograficos(); }, 1200);
            } else {
                mostrarNotificacao("Erro ao salvar dados.");
            }
        });
    });

    function resetarFormulario() {
        tituloInfograficoInput.value = '';
        containerInfografico.innerHTML = '';
        dadosDosMarcadores = [];
        arquivoDeImagem = null;
        editandoId = null;
        botaoSalvar.style.display = 'none';
        botaoSalvar.textContent = "Salvar";
        instrucoes.style.display = 'none';
        carregadorImagem.value = '';
        esconderErroImagem();
        fecharModalPonto();
    }

    carregarMeusInfograficos();
});