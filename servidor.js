const express = require('express');
const session = require('express-session');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const multer = require('multer');
const fs = require('fs');
const dir = './uploads';
const app = express();
const PORTA = process.env.PORT || 3000;

const db = new sqlite3.Database('./bancoDeDados.db', sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        return console.error("Erro ao conectar ao banco de dados:", err.message);
    }
    console.log('Conectado ao banco de dados SQLite.');
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage: storage });

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(session({
    secret: 'meu-segredo-super-secreto',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

if (!fs.existsSync(dir)){
    fs.mkdirSync(dir);
    console.log("Pasta uploads criada com sucesso!");
}

db.all("PRAGMA table_info(infograficos)", (err, cols) => {
    if (err) return console.error('Erro ao verificar colunas da tabela infograficos:', err.message);
    const temTaxaFala = cols && cols.some(c => c.name === 'speech_rate');
    if (!temTaxaFala) {
        db.run(`ALTER TABLE infograficos ADD COLUMN speech_rate REAL DEFAULT 1.0`, (err) => {
            if (err) console.error("Erro ao adicionar coluna 'speech_rate':", err.message);
        });
    }
});

db.all("PRAGMA table_info(infograficos)", (err2, cols2) => {
    if (err2) return console.error('Erro ao verificar colunas da tabela infograficos:', err2.message);
    const temDescricao = cols2 && cols2.some(c => c.name === 'descricao_geral');
    if (!temDescricao) {
        db.run(`ALTER TABLE infograficos ADD COLUMN descricao_geral TEXT DEFAULT ''`, (err) => {
            if (err) console.error("Erro ao adicionar coluna 'descricao_geral':", err.message);
        });
    }
});

function checarAutenticacao(req, res, next) {
    if (req.session.usuario) return next();
    res.redirect('/login');
}

app.get('/', (req, res) => {
    if (req.session.usuario) res.redirect('/dashboard');
    else res.redirect('/login');
});

app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/cadastro', (req, res) => res.sendFile(path.join(__dirname, 'cadastro.html')));

app.post('/cadastro', async (req, res) => {
    const { usuario, email, senha } = req.body;
    try {
        const hashSenha = await bcrypt.hash(senha, 10);
        db.run(`INSERT INTO professores (usuario, email, senha) VALUES (?, ?, ?)`, [usuario, email, hashSenha], function(err) {
            if (err) {
                return res.redirect('/cadastro?erro=duplicado');
            }
            res.redirect('/login');
        });
    } catch {
        res.status(500).send("Erro no servidor.");
    }
});

app.post('/login', (req, res) => {
    const { email, senha } = req.body;
    db.get(`SELECT * FROM professores WHERE email = ?`, [email], async (err, professor) => {
        if (err || !professor) return res.redirect('/login?erro=1');
        
        const senhaCorreta = await bcrypt.compare(senha, professor.senha);
        if (senhaCorreta) {
            req.session.usuario = {
                id: professor.id,
                usuario: professor.usuario,
                email: professor.email
            };
            res.redirect('/dashboard');
        } else {
            res.redirect('/login?erro=1');
        }
    });
});

app.get('/dashboard', checarAutenticacao, (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));

app.post('/salvar-infografico', checarAutenticacao, upload.single('imagemInfografico'), (req, res) => {
    const { titulo, descricao_geral } = req.body;
    const taxaFala = parseFloat(req.body.speech_rate) || 1.0;
    const caminhoImagem = req.file.path;
    const pontos = JSON.parse(req.body.pontos);
    const professorId = req.session.usuario.id;
    const autor = req.session.usuario.usuario;

    const sqlInfografico = `INSERT INTO infograficos (titulo, caminho_imagem, professor_id, autor, descricao_geral, speech_rate) VALUES (?, ?, ?, ?, ?, ?)`;
    db.run(sqlInfografico, [titulo, caminhoImagem, professorId, autor, descricao_geral || '', taxaFala], function(err) {
        if (err) return res.status(500).json({ success: false, message: 'Erro ao salvar.' });
        const infograficoId = this.lastID;
        
        const stmt = db.prepare(`INSERT INTO pontos (infografico_id, posicao_x, posicao_y, texto, info_acessibilidade) VALUES (?, ?, ?, ?, ?)`);
        pontos.forEach(ponto => stmt.run(infograficoId, ponto.x, ponto.y, ponto.texto, ponto.info_acessibilidade));
        
        stmt.finalize(err => {
            if (err) return res.status(500).json({ success: false, message: 'Erro ao salvar pontos.' });
            res.json({ success: true, message: 'Infográfico salvo com sucesso!' });
        });
    });
});

app.get('/galeria', (req, res) => res.sendFile(path.join(__dirname, 'galeria.html')));
app.get('/infografico/:id', (req, res) => res.sendFile(path.join(__dirname, 'infografico.html')));

app.get('/api/infograficos', (req, res) => {
    const sql = `SELECT id, titulo, caminho_imagem, autor FROM infograficos ORDER BY id DESC`;

    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error("ERRO DETALHADO AO BUSCAR INFOGRÁFICOS:", err);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

app.get('/api/infografico/:id', (req, res) => {
    const id = req.params.id;
    const resultado = {};
    db.get(`SELECT * FROM infograficos WHERE id = ?`, [id], (err, infografico) => {
        if (err || !infografico) return res.status(404).json({ error: "Infográfico não encontrado." });
        resultado.infografico = infografico;
        
        db.all(`SELECT * FROM pontos WHERE infografico_id = ? ORDER BY id ASC`, [id], (err, pontos) => {
            if (err) return res.status(500).json({ error: err.message });
            resultado.pontos = pontos;
            res.json(resultado);
        });
    });
});

app.get('/api/meus-infograficos', checarAutenticacao, (req, res) => {
    const professorId = req.session.usuario.id;
    db.all(`SELECT id, titulo FROM infograficos WHERE professor_id = ? ORDER BY id DESC`, [professorId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.delete('/api/infografico/:id', checarAutenticacao, (req, res) => {
    const infograficoId = req.params.id;
    const professorId = req.session.usuario.id;

    db.run(`DELETE FROM pontos WHERE infografico_id = ? AND infografico_id IN (SELECT id FROM infograficos WHERE professor_id = ?)`, [infograficoId, professorId], function(err) {
        if (err) return res.status(500).json({ success: false, message: "Erro ao deletar pontos." });

        db.run(`DELETE FROM infograficos WHERE id = ? AND professor_id = ?`, [infograficoId, professorId], function(err) {
            if (err) return res.status(500).json({ success: false, message: "Erro ao deletar infográfico." });
            if (this.changes === 0) return res.status(403).json({ success: false, message: "Ação não permitida." });
            res.json({ success: true, message: "Infográfico removido com sucesso." });
        });
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/login'));
});

app.get('/api/exportar-independente/:id', (req, res) => {
    const id = req.params.id;

    db.get("SELECT * FROM infograficos WHERE id = ?", [id], (err, info) => {
        if (err || !info) return res.status(404).send("Infográfico não encontrado.");
        const taxaFalaOffline = parseFloat(req.query.taxaFala) || parseFloat(info.speech_rate) || 1.0;

        db.all("SELECT * FROM pontos WHERE infografico_id = ? ORDER BY id ASC", [id], (err, pontos) => {
            if (err) return res.status(500).send("Erro ao buscar pontos.");

            const caminhoImagem = path.join(__dirname, info.caminho_imagem);
            let imagemBase64 = '';
            let imagemMime = '';

            try {
                const imagemBuffer = fs.readFileSync(caminhoImagem);
                imagemBase64 = imagemBuffer.toString('base64');
                imagemMime = path.extname(caminhoImagem).replace('.', '');
            } catch (e) {
                return res.status(500).send("Erro ao processar imagem.");
            }

const htmlIndependente = `
<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <title>Infográfico - ${info.titulo}</title>
    <style>
        :root {
            --cor-body: #C8E6C9; 
            --verde-escuro: #2E7D32;
        }

        body { 
            font-family: 'Segoe UI', Tahoma, sans-serif; 
            background-color: var(--cor-body); 
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            padding: 20px; 
            margin: 0; 
        }

        .container { 
            background-color: var(--cor-body); 
            padding: 20px; 
            border-radius: 25px; 
            text-align: center; 
            width: 100%;
            max-width: 1200px;
        }
        
        .caixa-instrucao { 
            margin: 0 auto 30px auto; 
            padding: 15px 20px; 
            background-color: var(--cor-body); 
            border: 2px solid #ffffff; 
            border-radius: 20px; 
            cursor: pointer; 
            transition: all 0.3s ease;
            width: 50%; 
            min-width: 300px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.05);
        }

        .caixa-instrucao.focused { 
            border-color: var(--verde-escuro); 
            background-color: #E8F5E9;
            outline: 3px solid var(--verde-escuro); 
            transform: scale(1.02);
            box-shadow: 0 6px 20px rgba(0,0,0,0.1);
        }

        .caixa-instrucao p { margin: 0; font-weight: bold; color: var(--verde-escuro); font-size: 1.2em; }
        .caixa-instrucao .sub-texto { font-size: 0.9em; font-weight: normal; margin-top: 5px; color: #444; }

        #visualizador { 
            position: relative; 
            margin: 10px auto;
            background-color: #C8E6C9;
            box-shadow: 0 8px 20px rgba(0,0,0,0.1);
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
            max-width: 100%;
            overflow: auto;
        }

        .marcador { 
            position: absolute; 
            width: 22px; 
            height: 22px; 
            background-color: rgba(255, 0, 0, 0.8); 
            border: 2px solid white; 
            border-radius: 50%; 
            cursor: pointer; 
            transform: translate(-50%, -50%); 
            z-index: 10;
        }

        .marcador.focused { 
            outline: none;
            transform: translate(-50%, -50%) scale(1.5);
            box-shadow: 0 0 15px rgba(255,255,255,0.8);
            background-color: rgba(255, 0, 0, 1);
        }
    </style>
</head>
<body>
    <div class="container">
        <div id="ponto-instrucao" class="caixa-instrucao" tabindex="0">
            <p id="tituloInfografico">Infográfico: ${info.titulo}</p>
            <p class="sub-texto">Utilize as setas laterais (◄ ►) para navegar entre os pontos.</p>
        </div>

        <div id="visualizador"></div>
    </div>

    <script>
        const pontosDados = ${JSON.stringify(pontos)};
        const descricaoGeral = ${JSON.stringify(info.descricao_geral || '')};
        let taxaFala = ${taxaFalaOffline};
        
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

        let indiceDoMarcadorSelecionado = -1; 
        let historicoCaminho = [];
        let pontosVisitados = new Set();
        let instrucaoLida = false;
        
        const visualizador = document.getElementById('visualizador');
        const pontoInstrucao = document.getElementById('ponto-instrucao');
        const img = new Image();

        img.onload = function() {
            const larguraOriginal = this.naturalWidth;
            const alturaOriginal = this.naturalHeight;
            
            visualizador.style.width = larguraOriginal + 'px';
            visualizador.style.height = alturaOriginal + 'px';
            visualizador.style.backgroundImage = "url('data:image/${imagemMime};base64,${imagemBase64}')";

            pontosDados.forEach((p, i) => {
                const marcador = document.createElement('div');
                marcador.className = 'marcador';
                marcador.style.left = p.posicao_x + '%';
                marcador.style.top = p.posicao_y + '%';
                
                marcador.dataset.x = p.posicao_x;
                marcador.dataset.y = p.posicao_y;
                marcador.dataset.texto = p.texto;
                marcador.dataset.infoAcessibilidade = p.info_acessibilidade || '';
                marcador.dataset.idOriginal = i;
                marcador.setAttribute('tabindex', '0');
                
                visualizador.appendChild(marcador);
            });
        };

        img.src = "data:image/${imagemMime};base64,${imagemBase64}";

        const todosOsMarcadores = document.getElementsByClassName('marcador');

        function obterProximoVizinhoEspacial(indiceAtual) {
            if (indiceAtual === -1) return 0;

            const atual = todosOsMarcadores[indiceAtual];
            const xAtual = parseFloat(atual.dataset.x);
            const yAtual = parseFloat(atual.dataset.y);

            let melhorIndice = -1;
            let menorDistanciaAbsoluta = Infinity;

            Array.from(todosOsMarcadores).forEach((marcador, i) => {
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

        function gerenciarFocoEAudio() {
            pontoInstrucao.classList.remove('focused');
            pontoInstrucao.blur();
            Array.from(todosOsMarcadores).forEach(m => {
                m.classList.remove('focused');
                m.blur();
            });

            const marcadorAtual = todosOsMarcadores[indiceDoMarcadorSelecionado];
            if (marcadorAtual) {
                pontosVisitados.add(marcadorAtual.dataset.idOriginal);
                marcadorAtual.classList.add('focused');
                marcadorAtual.focus();
                marcadorAtual.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
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

                setTimeout(() => { iniciarFala(textoParaLer); }, 100);
            }
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
                    if (sinteseDeVoz.paused) {
                        sinteseDeVoz.resume();
                    } else {
                        sinteseDeVoz.pause();
                    }
                }
                evento.preventDefault();
                return;
            }

            if (!['ArrowRight', 'ArrowLeft'].includes(evento.key)) return;
            
            evento.preventDefault();

            if (!instrucaoLida) {
                instrucaoLida = true;
                
                pontoInstrucao.classList.add('focused');
                pontoInstrucao.focus();

                let textoAbertura = 'Infográfico carregado: ' + ${JSON.stringify(info.titulo)} + '. ';
                if (descricaoGeral && descricaoGeral.trim() !== '') {
                    textoAbertura += descricaoGeral + '. ';
                }
                
                textoAbertura += 'Use as setas laterais para navegar e a tecla Control para pausar ou continuar a leitura. Para avançar ou retroceder 5 segundos, segure a tecla Shift e use as setas direita ou esquerda.';
                
                iniciarFala(textoAbertura);
                return; 
            }

            if (evento.key === 'ArrowRight') {
                if (todosOsMarcadores.length === 0) return;
                
                const proximoIndice = obterProximoVizinhoEspacial(indiceDoMarcadorSelecionado);

                if (proximoIndice !== -1 && proximoIndice !== undefined) {
                    if (indiceDoMarcadorSelecionado >= 0) {
                        historicoCaminho.push(indiceDoMarcadorSelecionado);
                    }
                    indiceDoMarcadorSelecionado = proximoIndice;
                    gerenciarFocoEAudio();
                } else {
                    iniciarFala("Fim do infográfico.");
                }
            } 
            else if (evento.key === 'ArrowLeft') {
                if (todosOsMarcadores.length === 0) return;

                if (historicoCaminho.length > 0) {
                    const atual = todosOsMarcadores[indiceDoMarcadorSelecionado];
                    if (atual) pontosVisitados.delete(atual.dataset.idOriginal);

                    indiceDoMarcadorSelecionado = historicoCaminho.pop();
                    gerenciarFocoEAudio();
                } else {
                    iniciarFala("Início do infográfico.");
                }
            }
        });
    </script>
</body>
</html>`;
            res.setHeader('Content-disposition', 'attachment; filename=' + info.titulo.replace(/\s/g, '_') + '.html');
            res.send(htmlIndependente);
        });
    });
});

app.post('/api/atualizar-infografico/:id', checarAutenticacao, upload.single('imagemInfografico'), (req, res) => {
    const id = req.params.id;
    const { titulo, descricao_geral, speech_rate, pontos } = req.body;
    const pontosJson = JSON.parse(pontos);
    const taxaFalaAtualizada = parseFloat(speech_rate) || 1.0;

    let sql = `UPDATE infograficos SET titulo = ?, descricao_geral = ?, speech_rate = ? WHERE id = ?`;
    let params = [titulo, descricao_geral || '', taxaFalaAtualizada, id];

    if (req.file) {
        sql = `UPDATE infograficos SET titulo = ?, caminho_imagem = ?, descricao_geral = ?, speech_rate = ? WHERE id = ?`;
        params = [titulo, req.file.path, descricao_geral || '', taxaFalaAtualizada, id];
    }

    db.run(sql, params, function(err) {
        if (err) return res.status(500).json({ success: false });

        db.run(`DELETE FROM pontos WHERE infografico_id = ?`, [id], () => {
            const stmt = db.prepare(`INSERT INTO pontos (infografico_id, posicao_x, posicao_y, texto, info_acessibilidade) VALUES (?, ?, ?, ?, ?)`);
            pontosJson.forEach(p => stmt.run(id, p.x, p.y, p.texto, p.info_acessibilidade));
            stmt.finalize(() => res.json({ success: true }));
        });
    });
});

app.listen(PORTA, () => {
    console.log(`Servidor rodando em http://localhost:${PORTA}`);
});