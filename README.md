# 👁️ AudiblEye - Plataforma de Aprendizado Assistivo

O **AudiblEye** é uma aplicação web voltada à acessibilidade pedagógica, desenvolvida como Trabalho de Conclusão de Curso (TCC) para o curso de Tecnologia em Análise e Desenvolvimento de Sistemas (ADS) no **IFSUL - Campus Bagé**. A plataforma permite que educadores transformem imagens estáticas em infográficos interativos narrados para estudantes com deficiência visual.

---

## 🌐 Link de Acesso

Acesse o sistema em produção: [https://tcc-infogr-ficos.onrender.com/galeria](https://tcc-infogr-ficos.onrender.com/galeria)

> ⚠️ **Aviso de Hospedagem:** O projeto está hospedado no plano gratuito do Render. Por esse motivo, o servidor entra em repouso após períodos de inatividade. Ao acessar o link pela primeira vez, aguarde cerca de 1 a 2 minutos para que a instância inicialize e o sistema carregue completamente.

---

## 🧪 Guia de Utilização (Passo a Passo)

### 1. Cadastro e Acesso (Módulo Professor)
* Acesse a página da aplicação.
* Utilize a função de **auto-cadastro** para criar a sua conta informando **Nome, E-mail e Senha**.
* Em seguida, faça o **login** com as credenciais cadastradas para ter acesso ao painel de gerenciamento.

### 2. Criando um Infográfico Interativo
* No painel do professor, clique para criar um novo infográfico.
* Defina um **Título** e uma **Descrição Geral** do material.
* Faça o **upload** da imagem do infográfico (formatos compatíveis: JPG ou PNG).
* **Mapeamento de Pontos:** Clique diretamente sobre a imagem carregada para adicionar os pontos de interesse e estudo.
* **Descrição Conceitual e Espacial:** Preencha o texto informativo que será narrado e as instruções de navegação por proximidade para orientar o estudante.
* Salve o projeto para registrá-lo no banco de dados.

### 3. Consumo e Teste de Acessibilidade (Módulo Aluno)
* Acesse a **Galeria de Infográficos** (`/galeria`).
* **Navegação por Teclado:** Utilize as **Setas do Teclado (Direita, Esquerda, Cima, Baixo)** para navegar entre os infográficos e explorar os pontos mapeados sem a necessidade de mouse.
* **Síntese de Voz Nativa:** O sistema utiliza a **Web Speech API** para ler automaticamente as descrições conceituais e espaciais à medida que o foco é alterado, simulando a experiência de autonomia de um estudante com deficiência visual.

---

## 🛠️ Tecnologias Utilizadas

* **Back-end:** Node.js com Express.
* **Banco de Dados:** SQLite (para persistência relacional de usuários, infográficos e coordenadas).
* **Front-end:** HTML5, CSS3 e JavaScript puro (Vanilla JS), otimizado para controle de DOM e gerenciamento de foco programático.
* **Tecnologia Assistiva:** Web Speech API (síntese de voz nativa do navegador).
* **Infraestrutura e Implantação:** GitHub (versionamento) e Render (hospedagem e entrega contínua).

---

## 🎓 Autor

**Ryan Madeira**  
Graduando em Análise e Desenvolvimento de Sistemas — IFSUL Campus Bagé/RS.  
Foco em Tecnologias Assistivas, Acessibilidade Web e Inclusão Digital.