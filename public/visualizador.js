let taxaFala = 1.0;
const sinteseDeVoz = window.speechSynthesis;
let textoCompleto = '';
let indiceCaractereAtual = 0;
let enunciadoAtual = null;

function reproduzirAPartirDe(indice) {
    if (!textoCompleto) return;
    
    indice = Math.max(0, Math.min(indice, textoCompleto.length - 1));
    
    if (enunciadoAtual) {
        enunciadoAtual.foiCancelado = true;
    }
    
    if (sinteseDeVoz.speaking || sinteseDeVoz.pending) {
        sinteseDeVoz.cancel();
    }

    const textoParaFalar = textoCompleto.substring(indice);
    const enunciado = new SpeechSynthesisUtterance(textoParaFalar);
    enunciado.lang = 'pt-BR';
    try { enunciado.rate = taxaFala; } catch(erro) { enunciado.rate = 1.0; }
    
    enunciado.onboundary = (evento) => {
        if (enunciado.foiCancelado) return;
        indiceCaractereAtual = indice + (evento.charIndex || 0);
    };
    
    enunciado.onend = () => {
        if (enunciado.foiCancelado) return;
        enunciadoAtual = null;
        indiceCaractereAtual = textoCompleto.length;
    };
    
    enunciado.onerror = () => {
        if (enunciado.foiCancelado) return;
        enunciadoAtual = null;
    };
    
    enunciadoAtual = enunciado;
    
    setTimeout(() => {
        if (!enunciado.foiCancelado) {
            sinteseDeVoz.speak(enunciado);
        }
    }, 50);
}

function iniciarFala(texto) {
    if (!texto) return;
    textoCompleto = texto;
    indiceCaractereAtual = 0;
    reproduzirAPartirDe(0);
}

function pularSegundos(segundos) {
    if (!textoCompleto) return;
    
    const caracteresPorSeg = 15 * (taxaFala || 1.0); 
    const deltaCaracteres = Math.round(segundos * caracteresPorSeg);
    const novoIndice = Math.max(0, Math.min(textoCompleto.length - 1, indiceCaractereAtual + deltaCaracteres));
    
    reproduzirAPartirDe(novoIndice);
}

document.addEventListener('DOMContentLoaded', function() {
    const visualizador = document.getElementById('visualizador');
    const tituloInfografico = document.getElementById('tituloInfografico');
    const idDoInfografico = window.location.pathname.split('/').pop();
    
    fetch(`/api/infografico/${idDoInfografico}`)
        .then(response => response.json())
        .then(dados => {
            const taxaFalaArmazenada = localStorage.getItem('taxaFala');
            if (taxaFalaArmazenada) taxaFala = parseFloat(taxaFalaArmazenada);
            else taxaFala = parseFloat(dados.infografico.speech_rate) || 1.0;
            tituloInfografico.textContent = dados.infografico.titulo;

            const img = new Image();
            img.onload = function() {
                const larguraOriginal = this.naturalWidth;
                const alturaOriginal = this.naturalHeight;
                
                visualizador.style.width = `${larguraOriginal}px`;
                visualizador.style.height = `${alturaOriginal}px`;
                
                const caminhoCorrigido = dados.infografico.caminho_imagem.replace(/\\/g, '/');
                visualizador.style.backgroundImage = `url('/${caminhoCorrigido}')`;
                
                visualizador.style.backgroundSize = "cover"; 
                visualizador.style.backgroundPosition = "center";
                visualizador.style.backgroundRepeat = "no-repeat";

                dados.pontos.forEach((ponto, indice) => {
                    const marcador = document.createElement('div');
                    marcador.className = 'marcador';
                    marcador.style.left = `${ponto.posicao_x}%`;
                    marcador.style.top = `${ponto.posicao_y}%`;
                    marcador.dataset.x = ponto.posicao_x;
                    marcador.dataset.y = ponto.posicao_y;
                    marcador.dataset.texto = ponto.texto;
                    marcador.dataset.infoAcessibilidade = ponto.info_acessibilidade || ''; 
                    marcador.dataset.idOriginal = indice;
                    marcador.setAttribute('tabindex', '0');
                    
                    visualizador.appendChild(marcador);
                });

                setTimeout(() => {
                    const descricao = (dados.infografico.descricao_geral || '').toString().trim();
                    let textoDeAbertura = `Infográfico carregado: ${dados.infografico.titulo}. `;
                    
                    if (descricao) {
                        textoDeAbertura += `${descricao}. `;
                    }
                    
                    textoDeAbertura += `Use as setas laterais para navegar e a tecla Control para pausar ou continuar a leitura. Para avançar ou retroceder 5 segundos, segure a tecla Shift e use as setas direita ou esquerda. Para voltar à galeria, pressione a tecla Esc.`;
                    
                    iniciarFala(textoDeAbertura);
                }, 100);

                iniciarNavegacaoPorTeclado();
            };
            
            img.src = `/${dados.infografico.caminho_imagem.replace(/\\/g, '/')}`;
        })
        .catch(() => {
            tituloInfografico.textContent = 'Erro ao carregar o infográfico.';
        });
});

function iniciarNavegacaoPorTeclado() {
    let indiceDoMarcadorSelecionado = -1;
    const todosOsMarcadores = Array.from(document.querySelectorAll('.marcador'));
    
    let historicoCaminho = [];
    let pontosVisitados = new Set();

    function obterProximoVizinhoEspacial(indiceAtual) {
        if (indiceAtual === -1) {
            return 0;
        }

        const atual = todosOsMarcadores[indiceAtual];
        const xAtual = parseFloat(atual.dataset.x);
        const yAtual = parseFloat(atual.dataset.y);

        let melhorIndice = -1;
        let menorDistanciaAbsoluta = Infinity;

        todosOsMarcadores.forEach((marcador, i) => {
            if (i === indiceAtual) return; 
            if (pontosVisitados.has(marcador.dataset.idOriginal)) return;

            const xCandidato = parseFloat(marcador.dataset.x);
            const yCandidato = parseFloat(marcador.dataset.y);

            const dx = xCandidato - xAtual;
            const dy = yCandidato - yAtual;
            const distanciaEuclidiana = Math.sqrt(dx * dx + dy * dy);

            if (distanciaEuclidiana < menorDistanciaAbsoluta) {
                menorDistanciaAbsoluta = distanciaEuclidiana;
                melhorIndice = i;
            }
        });

        return melhorIndice;
    }

    document.addEventListener('keydown', (evento) => {
        if (['Enter', 'Tab'].includes(evento.key)) return;
        
        if (evento.shiftKey && (evento.key === 'ArrowLeft' || evento.key === 'ArrowRight')) {
            evento.preventDefault();
            if (evento.key === 'ArrowLeft') pularSegundos(-5);
            else pularSegundos(5);
            return;
        }

        if (evento.key === 'Control' || evento.code === 'Space' || (evento.key && evento.key.toLowerCase() === 'p')) {
            if (sinteseDeVoz.speaking) {
                if (sinteseDeVoz.paused) sinteseDeVoz.resume();
                else sinteseDeVoz.pause();
            }
            evento.preventDefault();
            return;
        }

        if (evento.key === 'Escape') {
            evento.preventDefault();
            iniciarFala("Voltando para a galeria.");
            setTimeout(() => {
                const btnVoltar = document.getElementById('linkVoltar');
                if(btnVoltar) btnVoltar.click();
                else window.location.href = '/galeria';
            }, 1000);
            return;
        }

        if (!['ArrowRight', 'ArrowLeft'].includes(evento.key)) return;
        
        evento.preventDefault();

        if (evento.key === 'ArrowRight') {
            if (todosOsMarcadores.length === 0) {
                iniciarFala("Este infográfico não possui pontos mapeados.");
                return;
            }

            const proximoIndice = obterProximoVizinhoEspacial(indiceDoMarcadorSelecionado);

            if (proximoIndice !== -1 && proximoIndice !== undefined) {
                if (indiceDoMarcadorSelecionado !== -1) {
                    historicoCaminho.push(indiceDoMarcadorSelecionado);
                }
                indiceDoMarcadorSelecionado = proximoIndice;
            } else {
                iniciarFala("Fim do infográfico.");
                return;
            }
        } 
        else if (evento.key === 'ArrowLeft') {
            if (todosOsMarcadores.length === 0) {
                iniciarFala("Início do infográfico. Não há pontos cadastrados.");
                return;
            }

            if (historicoCaminho.length > 0) {
                const atual = todosOsMarcadores[indiceDoMarcadorSelecionado];
                if (atual) pontosVisitados.delete(atual.dataset.idOriginal);

                indiceDoMarcadorSelecionado = historicoCaminho.pop();
            } else {
                iniciarFala("Início do infográfico.");
                return;
            }
        }

        const marcadorAtual = todosOsMarcadores[indiceDoMarcadorSelecionado];
        
        if (marcadorAtual) {
            pontosVisitados.add(marcadorAtual.dataset.idOriginal);

            todosOsMarcadores.forEach(m => m.classList.remove('focused'));
            marcadorAtual.classList.add('focused');
            marcadorAtual.focus();
            
            const textoPrincipal = marcadorAtual.dataset.texto;
            const infoAcess = marcadorAtual.dataset.infoAcessibilidade;

            let textoParaLer = '';
            
            if (textoPrincipal && textoPrincipal.trim() !== "") {
                textoParaLer += textoPrincipal.trim();
            }
            
            if (infoAcess && infoAcess.trim() !== "") {
                if (textoParaLer !== "") textoParaLer += '. ';
                textoParaLer += infoAcess.trim();
            }

            setTimeout(() => {
                iniciarFala(textoParaLer);
            }, 100);
        }
    });
}