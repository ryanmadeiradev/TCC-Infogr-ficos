function falarTexto(texto) {
    window.speechSynthesis.cancel();
    if (!texto) return;

    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = 'pt-BR';
    utterance.rate = 2.0;
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
                const proporcaoImagem = this.naturalWidth / this.naturalHeight;
                visualizador.style.aspectRatio = proporcaoImagem.toString();
                
                const caminhoCorrigido = dados.infografico.caminho_imagem.replace(/\\/g, '/');
                visualizador.style.backgroundImage = `url('/${caminhoCorrigido}')`;
                visualizador.style.backgroundSize = "100% 100%";

                dados.pontos.forEach(ponto => {
                    const marcador = document.createElement('div');
                    marcador.className = 'marcador';
                    marcador.style.left = `${ponto.posicao_x}%`;
                    marcador.style.top = `${ponto.posicao_y}%`;
                    marcador.dataset.texto = ponto.texto;
                    marcador.setAttribute('tabindex', '0');
                    
                    visualizador.appendChild(marcador);
                });

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
    const todosOsMarcadores = document.querySelectorAll('.marcador');
    const titulo = document.getElementById('tituloInfografico').textContent;
    let audioAtivado = false;

    document.addEventListener('keydown', (evento) => {
        if (!audioAtivado) {
            audioAtivado = true;
            falarTexto(`Infográfico: ${titulo}. Use as setas para navegar entre os pontos.`);
            
            if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Escape'].includes(evento.key)) return;
        }

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

        if (todosOsMarcadores.length === 0 || !['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(evento.key)) return;
        
        evento.preventDefault();

        if (evento.key === 'ArrowRight' || evento.key === 'ArrowDown') {
            indiceDoMarcadorSelecionado = (indiceDoMarcadorSelecionado + 1) % todosOsMarcadores.length;
        } else if (evento.key === 'ArrowLeft' || evento.key === 'ArrowUp') {
            indiceDoMarcadorSelecionado = (indiceDoMarcadorSelecionado - 1 + todosOsMarcadores.length) % todosOsMarcadores.length;
        }

        const marcadorAtual = todosOsMarcadores[indiceDoMarcadorSelecionado];
        
        if (marcadorAtual) {
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