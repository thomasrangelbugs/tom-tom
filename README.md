# Tom-Tom — Senhor dos Raios

Jogo de plataforma procedural em Canvas, com tema inspirado em Thor: colete raios, obtenha o Mjölnir, quebre blocos e atravesse portais.

## Estado do projeto

Aplicação web estática executada no navegador. O repositório não define etapa de instalação nem de compilação, salvo quando indicado abaixo.

## Funcionalidades

- Fases procedurais
- Raios colecionáveis
- Power-up Mjölnir
- Blocos e inimigos
- Clima/estação
- Trilha e save local
- Touch e tela cheia

## Tecnologias

- HTML5 Canvas
- CSS
- JavaScript
- localStorage

## Estrutura principal

- `netlify.toml — publica redobrinha-game`
- `redobrinha-game/index.html — entrada`
- `redobrinha-game/game.js — motor`
- `redobrinha-game/styles.css — interface`
- `redobrinha-game/assets/ — mídia`
- `trilha.mp3 e trilha2.mp3 — áudio`

## Executar localmente

Não há dependências de pacote nem comando de build registrado para este projeto. Abra `redobrinha-game/index.html` em um navegador moderno.

## Controles

- Setas ou A/D: mover.
- S ou seta para baixo: abaixar.
- Espaço: pular/pulo duplo.
- Shift: correr.
- No celular, use controles laterais.

## Dados e persistência

- Progresso/configurações são locais ao navegador; limpar dados pode removê-los.

## Testes

Não foi identificado script de teste automatizado. Valide manualmente os fluxos descritos em **Como usar**, em desktop e em viewport móvel.

## Publicação

- O `netlify.toml` da raiz define `publish = "redobrinha-game"` sem build.
- Há também configuração dentro da pasta publicada.

## Limitações e segurança

- Não há teste automatizado.
- Áudio/tela cheia podem exigir gesto do usuário.
- Confirme direitos de músicas e referências visuais.

## Repositório

[redobrai-del/thomas-projetos](https://github.com/redobrai-del/thomas-projetos)