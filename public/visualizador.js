function falarTexto(texto) {
    window.speechSynthesis.cancel();
    if (!texto) return;

    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
}

document.addEventListener('DOMContentLoaded', function() {
    const visualizador = document.getElementById('visualizador');
    const tituloInfografico = document.getElementById('tituloInfografico');
    const idDoInfografico = window.location.pathname.split('/').pop();
    
    fetch(`/api/infografico/${idDoInfografico}`)
        .then(response => response.json())
        .then(dados => {
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
                    marcador.dataset.idOriginal = indice;
                    marcador.setAttribute('tabindex', '0');
                    
                    visualizador.appendChild(marcador);
                });

                setTimeout(() => {
                    falarTexto(`Infográfico carregado: ${dados.infografico.titulo}. Use as setas laterais do teclado para navegar entre os pontos.`);
                }, 100);

                iniciarNavegacaoPorTeclado();
            };
            
            img.src = `/${dados.infografico.caminho_imagem.replace(/\\/g, '/')}`;
        })
        .catch(error => {
            console.error('Erro:', error);
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

        if (evento.key === 'Escape') {
            evento.preventDefault();
            falarTexto("Voltando para a galeria.");
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
                falarTexto("Este infográfico não possui pontos mapeados.");
                return;
            }

            const proximoIndice = obterProximoVizinhoEspacial(indiceDoMarcadorSelecionado);

            if (proximoIndice !== -1 && proximoIndice !== undefined) {
                if (indiceDoMarcadorSelecionado !== -1) {
                    historicoCaminho.push(indiceDoMarcadorSelecionado);
                }
                indiceDoMarcadorSelecionado = proximoIndice;
            } else {
                falarTexto("Fim do infográfico.");
                return;
            }
        } 
        else if (evento.key === 'ArrowLeft') {
            if (todosOsMarcadores.length === 0) {
                falarTexto("Início do infográfico. Não há pontos cadastrados.");
                return;
            }

            if (historicoCaminho.length > 0) {
                const atual = todosOsMarcadores[indiceDoMarcadorSelecionado];
                if (atual) pontosVisitados.delete(atual.dataset.idOriginal);

                indiceDoMarcadorSelecionado = historicoCaminho.pop();
            } else {
                falarTexto("Início do infográfico.");
                return;
            }
        }

        const marcadorAtual = todosOsMarcadores[indiceDoMarcadorSelecionado];
        
        if (marcadorAtual) {
            pontosVisitados.add(marcadorAtual.dataset.idOriginal);

            todosOsMarcadores.forEach(m => m.classList.remove('focused'));
            marcadorAtual.classList.add('focused');
            marcadorAtual.focus();
            
            const textoParaLer = marcadorAtual.dataset.texto;
            setTimeout(() => {
                falarTexto(textoParaLer);
            }, 100);
        }
    });
}