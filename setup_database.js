const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./bancoDeDados.db');

db.serialize(() => {
    console.log("Iniciando a criação completa do banco de dados...");

    db.run(`CREATE TABLE IF NOT EXISTS professores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        senha TEXT NOT NULL
    )`, (err) => {
        if (err) return console.error("Erro ao criar tabela 'professores':", err.message);
        console.log("Tabela 'professores' pronta.");
    });

    db.run(`CREATE TABLE IF NOT EXISTS infograficos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        titulo TEXT NOT NULL,
        caminho_imagem TEXT NOT NULL,
        autor TEXT,
        professor_id INTEGER,
        FOREIGN KEY (professor_id) REFERENCES professores (id)
    )`, (err) => {
        if (err) return console.error("Erro ao criar tabela 'infograficos':", err.message);
        console.log("Tabela 'infograficos' pronta.");
    });

    db.run(`CREATE TABLE IF NOT EXISTS pontos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        infografico_id INTEGER,
        posicao_x REAL NOT NULL,
        posicao_y REAL NOT NULL,
        texto TEXT NOT NULL,
        FOREIGN KEY (infografico_id) REFERENCES infograficos (id) ON DELETE CASCADE
    )`, (err) => {
        if (err) return console.error("Erro ao criar tabela 'pontos':", err.message);
        console.log("Tabela 'pontos' pronta.");
    });

});

db.close((err) => {
    if (err) return console.error(err.message);
    console.log('Script finalizado. Banco de dados configurado.');
});