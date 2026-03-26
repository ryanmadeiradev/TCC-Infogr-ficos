function falarTexto(texto) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = 'pt-BR';
    utterance.rate = 2.5;
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
            caixaInstrucao.innerHTML = `
                <h3>Galeria de Infográficos</h3>
                <p>Use as setas para navegar entre eles e Enter para selecionar.</p>
                <div class="setas-visual">➔ ↓ ↑ ⬅</div>
            `;
            containerGaleria.appendChild(caixaInstrucao);

            if (infograficos.length === 0) {
                containerGaleria.innerHTML += '<p style="grid-column: 1/-1; text-align: center;">Nenhum infográfico disponível.</p>';
                return;
            }

            infograficos.forEach(info => {
                const linkCard = document.createElement('a');
                linkCard.href = `/infografico/${info.id}`;
                linkCard.className = 'card-infografico';

                const imagem = document.createElement('img');
                imagem.src = info.caminho_imagem ? `/${info.caminho_imagem.replace(/\\/g, '/')}` : '';
                
                const titulo = document.createElement('h3');
                titulo.textContent = info.titulo;

                const autor = document.createElement('p');
                autor.className = 'card-autor';
                autor.textContent = `Autor: ${info.autor || 'Ryan Madeira'}`;

                const btnDownload = document.createElement('button');
                btnDownload.innerHTML = 'Download';
                btnDownload.className = 'btn-download-offline';

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
            
            iniciarNavegacaoGaleria();
        });
});

function iniciarNavegacaoGaleria() {
    let indiceSelecionado = -2;
    const todosOsCards = document.querySelectorAll('.card-infografico');
    const caixaInstrucao = document.getElementById('instrucao-galeria');

    document.addEventListener('keydown', (evento) => {
        if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(evento.key)) {
            evento.preventDefault();

            if (indiceSelecionado === -2) {
                indiceSelecionado = -1;
            } else if (evento.key === 'ArrowRight' || evento.key === 'ArrowDown') {
                if (indiceSelecionado < todosOsCards.length - 1) indiceSelecionado++;
                else indiceSelecionado = -1;
            } else if (evento.key === 'ArrowLeft' || evento.key === 'ArrowUp') {
                if (indiceSelecionado > -1) indiceSelecionado--;
                else indiceSelecionado = todosOsCards.length - 1;
            }

            caixaInstrucao.classList.remove('focused');
            todosOsCards.forEach(c => c.classList.remove('focused'));

            if (indiceSelecionado === -1) {
                caixaInstrucao.classList.add('focused');
                caixaInstrucao.scrollIntoView({ behavior: 'smooth', block: 'center' });
                falarTexto("Galeria de Infográficos. Use as setas para navegar entre eles e Enter para selecionar.");
            } else {
                const cardAtual = todosOsCards[indiceSelecionado];
                cardAtual.classList.add('focused');
                cardAtual.scrollIntoView({ behavior: 'smooth', block: 'center' });

                const titulo = cardAtual.querySelector('h3').textContent;
                const autor = cardAtual.querySelector('.card-autor').textContent;
                falarTexto(`${titulo}. ${autor}`);
            }
        }

        if (evento.key === 'Enter' && indiceSelecionado > -1) {
            evento.preventDefault();
            todosOsCards[indiceSelecionado].click();
        }
    });
}