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
            if (err) return res.send('Erro ao cadastrar. O nome de usuário ou e-mail já pode existir.');
            res.redirect('/login');
        });
    } catch {
        res.status(500).send("Erro no servidor.");
    }
});

app.post('/login', (req, res) => {
    const { usuario, senha } = req.body;
    db.get(`SELECT * FROM professores WHERE usuario = ?`, [usuario], async (err, professor) => {
        if (err || !professor) return res.redirect('/login?erro=1');
        const senhaCorreta = await bcrypt.compare(senha, professor.senha);
        if (senhaCorreta) {
            req.session.usuario = professor;
            res.redirect('/dashboard');
        } else {
            res.redirect('/login?erro=1');
        }
    });
});

app.get('/dashboard', checarAutenticacao, (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));

app.post('/salvar-infografico', checarAutenticacao, upload.single('imagemInfografico'), (req, res) => {
    const { titulo } = req.body;
    const caminhoImagem = req.file.path;
    const pontos = JSON.parse(req.body.pontos);
    const professorId = req.session.usuario.id;
    const autor = req.session.usuario.usuario;


    const sqlInfografico = `INSERT INTO infograficos (titulo, caminho_imagem, professor_id, autor) VALUES (?, ?, ?, ?)`;
    db.run(sqlInfografico, [titulo, caminhoImagem, professorId, autor], function(err) {
        if (err) return res.status(500).json({ success: false, message: 'Erro ao salvar.' });
        const infograficoId = this.lastID;
        const stmt = db.prepare(`INSERT INTO pontos (infografico_id, posicao_x, posicao_y, texto) VALUES (?, ?, ?, ?)`);
        pontos.forEach(ponto => stmt.run(infograficoId, ponto.x, ponto.y, ponto.texto));
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
        db.all(`SELECT * FROM pontos WHERE infografico_id = ?`, [id], (err, pontos) => {
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

        db.all("SELECT * FROM pontos WHERE infografico_id = ?", [id], (err, pontos) => {
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
            
            border: 1px solid #ffffff; 
            
            border-radius: 20px; 
            cursor: pointer; 
            transition: all 0.3s ease;
            
            width: 50%; 
            min-width: 300px;
            
            box-shadow: 0 4px 15px rgba(0,0,0,0.05);
        }

        .caixa-instrucao.focused { 
            border-color: #ffffff; 
            background-color: var(--cor-body);
            outline: none; 
            transform: scale(1.02);
            box-shadow: 0 6px 20px rgba(0,0,0,0.1);
        }

        .caixa-instrucao p { margin: 0; font-weight: bold; color: var(--verde-escuro); font-size: 1.2em; }
        .caixa-instrucao .sub-texto { font-size: 0.9em; font-weight: normal; margin-top: 5px; color: #444; }

        .box-imagem { 
            position: relative; 
            display: inline-block; 
            border: none; 
            background-color: transparent;
        }

        img { display: block; max-width: 100%; height: auto; border-radius: 10px; }

        .marcador { 
            position: absolute; 
            width: 14px; 
            height: 14px; 
            background-color: rgba(255, 0, 0, 0.9); 
            border: 1.5px solid white; 
            border-radius: 50%; 
            cursor: pointer; 
            transform: translate(-50%, -50%); 
        }

        .marcador.focused { 
            outline: none;
            transform: translate(-50%, -50%) scale(1.8);
            z-index: 10;
            box-shadow: 0 0 15px rgba(255,255,255,0.8);
        }
    </style>
</head>
<body>
    <div class="container">
        <div id="ponto-instrucao" class="caixa-instrucao" tabindex="0">
            <p>Infográfico: ${info.titulo}</p>
            <p class="sub-texto">Utilize as setas do teclado (▲ ▼ ◄ ►) para navegar entre os pontos.</p>
        </div>

        <div class="box-imagem">
            <img src="data:image/${imagemMime};base64,${imagemBase64}">
            <div id="container-pontos"></div>
        </div>
    </div>

    <script>
        const pontosDados = ${JSON.stringify(pontos)};
        const synth = window.speechSynthesis;
        let indiceSelecionado = -2; 

        function falar(texto) {
            synth.cancel();
            const utterance = new SpeechSynthesisUtterance(texto);
            utterance.lang = 'pt-BR';
            utterance.rate = 2.5;
            synth.speak(utterance);
        }

        const pontoInstrucao = document.getElementById('ponto-instrucao');
        const container = document.getElementById('container-pontos');

        pontosDados.forEach((p, i) => {
            const div = document.createElement('div');
            div.className = 'marcador';
            div.style.left = p.posicao_x + '%';
            div.style.top = p.posicao_y + '%';
            div.onclick = (e) => { 
                e.stopPropagation();
                indiceSelecionado = i; 
                focarElemento(i);
            };
            container.appendChild(div);
        });

        const todosOsMarcadores = document.querySelectorAll('.marcador');

        function focarElemento(indice) {
            pontoInstrucao.classList.remove('focused');
            todosOsMarcadores.forEach(m => m.classList.remove('focused'));

            if (indice === -1) {
                pontoInstrucao.classList.add('focused');
                pontoInstrucao.scrollIntoView({ behavior: 'smooth', block: 'center' });
                falar("Infográfico ${info.titulo}. Utilize as setas para navegar entre os pontos.");
            } else if (indice >= 0) {
                const marcador = todosOsMarcadores[indice];
                marcador.classList.add('focused');
                falar(pontosDados[indice].texto);
            }
        }

        document.addEventListener('keydown', (evento) => {
            if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(evento.key)) {
                evento.preventDefault();

                if (indiceSelecionado === -2) {
                    indiceSelecionado = -1; 
                } 
                else if (evento.key === 'ArrowRight' || evento.key === 'ArrowDown') {
                    indiceSelecionado = (indiceSelecionado >= pontosDados.length - 1) ? -1 : indiceSelecionado + 1;
                } 
                else if (evento.key === 'ArrowLeft' || evento.key === 'ArrowUp') {
                    indiceSelecionado = (indiceSelecionado <= -1) ? pontosDados.length - 1 : indiceSelecionado - 1;
                }

                focarElemento(indiceSelecionado);
            }
        });

        pontoInstrucao.onclick = () => {
            indiceSelecionado = -1;
            focarElemento(-1);
        };
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
    const { titulo, pontos } = req.body;
    const pontosJson = JSON.parse(pontos);

    let sql = `UPDATE infograficos SET titulo = ? WHERE id = ?`;
    let params = [titulo, id];

    if (req.file) {
        sql = `UPDATE infograficos SET titulo = ?, caminho_imagem = ? WHERE id = ?`;
        params = [titulo, req.file.path, id];
    }

    db.run(sql, params, function(err) {
        if (err) return res.status(500).json({ success: false });

        db.run(`DELETE FROM pontos WHERE infografico_id = ?`, [id], () => {
            const stmt = db.prepare(`INSERT INTO pontos (infografico_id, posicao_x, posicao_y, texto) VALUES (?, ?, ?, ?)`);
            pontosJson.forEach(p => stmt.run(id, p.x, p.y, p.texto));
            stmt.finalize(() => res.json({ success: true }));
        });
    });
});

app.listen(PORTA, () => {
    console.log(`Servidor rodando em http://localhost:${PORTA}`);
});