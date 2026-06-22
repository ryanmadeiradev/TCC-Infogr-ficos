function falarTexto(texto) {
    window.speechSynthesis.cancel();
    if (!texto) return;

    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
}

document.addEventListener('DOMContentLoaded', function() {
    const containerGaleria = document.getElementById('containerGaleria');

    fetch('/api/infograficos')
        .then(response => response.json())
        .then(infograficos => {
            containerGaleria.innerHTML = '';

            const caixaInstrucao = document.createElement('div');
            caixaInstrucao.id = 'instrucao-galeria';
            caixaInstrucao.className = 'caixa-instrucao-galeria';
            caixaInstrucao.setAttribute('tabindex', '0');
            caixaInstrucao.innerHTML = `
                <h2>Galeria de Infográficos</h2>
                <p>Use as setas para navegar e Enter para selecionar.</p>
                <div class="setas-visual">➔ ↓ ↑ ⬅</div>
            `;
            containerGaleria.appendChild(caixaInstrucao);

            if (infograficos.length === 0) {
                containerGaleria.innerHTML += '<p style="grid-column: 1/-1; text-align: center;">Nenhum infográfico disponível no momento.</p>';   
                iniciarNavegacaoGaleria(true);
                return;
            }

            infograficos.forEach(info => {
                const linkCard = document.createElement('a');
                linkCard.href = `/infografico/${info.id}`;
                linkCard.className = 'card-infografico';
                linkCard.setAttribute('role', 'link'); 
                linkCard.setAttribute('tabindex', '0');

                const imagem = document.createElement('img');
                const pathLimpo = info.caminho_imagem ? info.caminho_imagem.replace(/\\/g, '/') : '';
                imagem.src = `/${pathLimpo}`;
                imagem.alt = `Capa do infográfico: ${info.titulo}`; 
                
                const titulo = document.createElement('h3');
                titulo.textContent = info.titulo;

                const autor = document.createElement('p');
                autor.className = 'card-autor';
                autor.textContent = `Autor: ${info.autor || 'Ryan Madeira'}`;

                const btnDownload = document.createElement('button');
                btnDownload.innerHTML = 'Download';
                btnDownload.className = 'btn-download-offline';
                btnDownload.setAttribute('aria-label', `Baixar versão offline de: ${info.titulo}`);
                btnDownload.setAttribute('tabindex', '-1');

                btnDownload.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.location.href = `/api/exportar-independente/${info.id}`;
                });

                linkCard.appendChild(imagem);
                linkCard.appendChild(titulo);
                linkCard.appendChild(autor);
                linkCard.appendChild(btnDownload);
                containerGaleria.appendChild(linkCard);
            });
            
            iniciarNavegacaoGaleria(false);
        })
        .catch(err => {
            console.error('Erro na Galeria:', err);
            containerGaleria.innerHTML = '<p>Erro ao carregar infográficos. Verifique a conexão.</p>';
        });
});

function iniciarNavegacaoGaleria(galeriaVazia) {
    let indiceSelecionado = -1;
    const todosOsCards = Array.from(document.querySelectorAll('.card-infografico'));
    const caixaInstrucao = document.getElementById('instrucao-galeria');
    let audioAtivado = false;

    if (caixaInstrucao) {
        caixaInstrucao.classList.add('focused');
        caixaInstrucao.focus();
    }

    function gerenciarFocoEAudio() {
        caixaInstrucao.classList.remove('focused');
        todosOsCards.forEach(c => c.classList.remove('focused'));

        if (indiceSelecionado === -1) {
            caixaInstrucao.classList.add('focused');
            caixaInstrucao.focus();
            caixaInstrucao.scrollIntoView({ behavior: 'smooth', block: 'center' });
            falarTexto("Galeria de Infográficos. Use as setas para navegar e Enter para selecionar.");
        } else {
            const cardAtual = todosOsCards[indiceSelecionado];
            if (cardAtual) {
                cardAtual.classList.add('focused');
                cardAtual.focus();
                cardAtual.scrollIntoView({ behavior: 'smooth', block: 'center' });

                const titulo = cardAtual.querySelector('h3').textContent;
                const autor = cardAtual.querySelector('.card-autor').textContent;
                falarTexto(`${titulo}. ${autor}. Pressione Enter para abrir.`);
            }
        }
    }

    document.addEventListener('keydown', (evento) => {
        const teclasPermitidas = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Enter'];
        if (!teclasPermitidas.includes(evento.key)) return;

        evento.preventDefault();

        if (!audioAtivado) {
            audioAtivado = true;
            if (indiceSelecionado === -1 && !['Enter'].includes(evento.key)) {
                gerenciarFocoEAudio();
                return;
            }
        }

        if (evento.key === 'ArrowRight' || evento.key === 'ArrowDown') {
            if (galeriaVazia) {
                falarTexto("Nenhum infográfico disponível no momento.");
                return;
            }

            if (indiceSelecionado < todosOsCards.length - 1) {
                indiceSelecionado++;
                gerenciarFocoEAudio();
            } else {
                falarTexto("Fim da galeria.");
            }
        } 
        else if (evento.key === 'ArrowLeft' || evento.key === 'ArrowUp') {
            if (indiceSelecionado > -1) {
                indiceSelecionado--;
                gerenciarFocoEAudio();
            } else {
                falarTexto("Início da galeria. Você está na caixa de instruções.");
            }
        }

        if (evento.key === 'Enter' && indiceSelecionado > -1) {
            falarTexto("Abrindo infográfico...");
            setTimeout(() => {
                if (todosOsCards[indiceSelecionado]) {
                    todosOsCards[indiceSelecionado].click();
                }
            }, 500);
        }
    });
}