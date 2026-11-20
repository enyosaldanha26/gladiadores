# Gladiadores — Jogo de Tabuleiro (Web)

Adaptação web fiel do jogo de tabuleiro **Gladiadores**, implementada em HTML, CSS e JavaScript puros (sem dependências externas ou backend) e publicada via GitHub Pages.

👉 **Jogar online:** [https://enyosaldanha26.github.io/gladiadores/](https://enyosaldanha26.github.io/gladiadores/)

## Recursos

- **3 a 4 jogadores**:
  - **4 jogadores**: baralho completo de 50 cartas (4 naipes de armas de 1 a 10 — Gládio, Tridente, Mangual e Machado —, 6 cartas de Arma Danificada e 4 Leões), 12 cartas por jogador e 4 rodadas.
  - **3 jogadores**: 41 cartas (sem as cartas de valor 2 e 3 e com 3 Leões), 13 cartas por jogador e 3 rodadas.
- **Tabuleiros Lado A & Lado B**:
  - **Lado A — Maioria nos Naipes**: avance e recue nas 4 trilhas de armas e pontue por posição final.
  - **Lado B — Corrida de Glória**: equilibre naipes ou foque em um só; vence ao atingir 15 pts (3J) / 20 pts (4J) ou ao fim das rodadas.
- **Modos de Jogo**:
  - **Solo vs Bots**: enfrente bots com perfis *Estratégico* e *Casual*.
  - **Passar e Jogar**: partidas presenciais no mesmo dispositivo com cortina de privacidade entre turnos.
- **Manual e Histórico embutidos**: regras completas em abas, zoom interativo no tabuleiro e nas cartas, histórico de batalhas e efeitos sonoros sintetizados via Web Audio API.

## Como executar localmente

### Windows
Execute o atalho `Jogar Gladiadores.bat`, que inicia um servidor HTTP local via PowerShell (`scripts/serve.ps1`) e abre o jogo automaticamente.

### Qualquer sistema operacional
Sirva a pasta raiz do repositório com qualquer servidor HTTP estático:

```bash
python -m http.server 8000
```

Ou via Node.js:

```bash
npx serve .
```

Em seguida, acesse `http://localhost:8000`.

## Testes automatizados

A suíte possui **22 testes automatizados** cobrindo regras oficiais, casos de borda e *fuzzing* de 100 partidas IA vs IA:

- **Windows (Chrome/Edge headless):**
  ```powershell
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run_tests.ps1
  ```
- **Navegador:** abra `tests/engine.test.html` através do servidor HTTP local.

## Estrutura do projeto

```text
.
├── index.html               # Página principal (menu + mesa de jogo)
├── Jogar Gladiadores.bat    # Inicializador local para Windows
├── assets/                  # Imagens de cartas, tabuleiros e interface
├── scripts/                 # Scripts auxiliares (servidor local, testes e extração)
├── src/
│   ├── css/styles.css       # Estilos da aplicação
│   └── js/                  # Motor de regras, IA, áudio, UI e controlador principal
└── tests/
    └── engine.test.html     # Suíte de testes automatizados do motor e da IA
```

## Créditos Oficiais

- **Game Designers:** Ênyo Saldanha, Lucas Medeiros
- **Desenvolvedores do Jogo:** Augusto Barbosa, Eurico Cunha, Gustavo Silveira
- **Ilustrador:** Arthur Mask
- **Diretor de Arte:** Filipe Castro
- **Designers Gráficos:** Bruno Marquez, João Victor Cramonez (JVC_ARTZ)
- **Escritora de Regras:** Bianca Melyna
- **Revisão de Regras:** Augusto Barbosa, Claudinei Mendonça, Gustavo Lopes, Gustavo Silveira
- **Validação Final (QA):** Alexandre Reis, Paulo “Bandana” Matos, João Victor Cramonez, Maria Julia Ronzani
- **Publicação Original:** Games ForFun LLC
- **Edição Brasileira:** Calamity Jogos de Tabuleiro e Acessórios Ltda.
