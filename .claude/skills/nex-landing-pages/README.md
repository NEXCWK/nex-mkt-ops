# Nex Landing Pages — Skill para Claude Code

Skill que gera landing pages de condição especial da Nex Coworking a partir de 3 modelos parametrizados (LSL, VSL, Squeeze).

## Como instalar no seu Claude Code

Copie **a pasta inteira** para o `.claude/skills/` do projeto onde você quer usar:

```
seu-projeto/
└── .claude/
    └── skills/
        └── nex-landing-pages/   ← esta pasta
```

O Claude Code carrega automaticamente skills nessa pasta. Para conferir, rode `/skills` na CLI dele.

## Como usar

1. Peça: *"Criar uma nova LP Nex modelo Squeeze para day-use de sala de reunião, R$ 200 pacote 20h, 25% off"*.
2. O sistema (com esta skill ativa) mostra os cartões dos 3 modelos, você escolhe, preenche o formulário, sobe imagens (e vídeo se for VSL), cola o CSS do RD Station.
3. Ao dar OK, o Claude entrega o `.html` pronto + checklist de arquivos que devem ir juntos.

## Estrutura

- `SKILL.md` — instruções principais e fluxo obrigatório.
- `references/` — schemas dos 3 modelos, design system, fluxo, RD Station.
- `templates/` — os 3 HTML parametrizados + `styles.css` compartilhado (não muda).
- `assets/fonts/` — Proxima Nova (8 variantes .otf) auto-hospedada.

## O que colocar junto do HTML gerado

Ao publicar uma página gerada, a pasta de deploy precisa conter:

- `styles.css` (de `templates/styles.css`)
- `fonts/*.otf` (de `assets/fonts/`)
- `logo-nex-white.png`, `logo-nex-black.png`
- A imagem de hero definida no formulário
- (VSL) URL/embed de vídeo
