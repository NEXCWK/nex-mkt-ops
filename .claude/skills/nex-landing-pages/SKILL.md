---
name: nex-landing-pages
description: Gera landing pages de condição especial da Nex Coworking a partir de 3 modelos parametrizados (LSL, VSL, Squeeze). Use quando o usuário quiser criar uma nova LP Nex, escolher um dos 3 modelos, preencher os campos correspondentes e receber HTML/CSS pronto para publicar.
---

# Nex Landing Pages — Gerador de LPs de Condição Especial

Esta skill produz landing pages de campanha para a Nex Coworking (Curitiba) a partir de 3 modelos fixos. O layout, tipografia (Proxima Nova), design system e CSS **não mudam entre páginas** — só o conteúdo, imagens e o embed do formulário RD Station.

## Fluxo obrigatório (o sistema já expõe isso na UI, mas replique na conversa)

O sistema em que esta skill roda apresenta ao usuário 3 cartões (LSL, VSL, Squeeze). Ao escolher um, aparecem campos pré-definidos + uploads de imagem/vídeo + área para colar o CSS do RD Station. Ao dar OK, você **entrega o HTML e o CSS finais**.

1. **Identificar o modelo escolhido** — LSL, VSL ou Squeeze. Se o usuário estiver em dúvida, use a árvore de decisão abaixo.
2. **Coletar os campos** — carregue o schema correspondente em `references/modelo-<slug>.md` e confirme que todos os campos obrigatórios foram preenchidos. Se faltar, peça só o que falta.
3. **Coletar assets** — imagem de hero (obrigatória), vídeo (só VSL, opcional), logos (usar os defaults se o usuário não subir novos).
4. **Coletar CSS do RD Station** — o usuário cola o CSS do formulário publicado no RD (não é embed JS; é CSS que substitui o form de demo). Se vazio, mantém o `<form>` de demonstração dos templates.
5. **Gerar a saída** — copie o template do modelo escolhido de `templates/<modelo>.html`, substitua todos os `{{PLACEHOLDERS}}` pelos valores coletados, e devolva:
   - Um bloco de código com o `<nome-da-pagina>.html` completo.
   - Instrução de que `styles.css` e a pasta `fonts/` vêm inalterados de `templates/styles.css` + `assets/fonts/` desta skill.
   - Checklist final: quais imagens/vídeos o usuário precisa colocar em `public/lp/` ao lado do HTML.

Não pergunte permissão para gerar. Se o usuário completou o formulário e deu OK, entregue.

## Árvore de decisão de modelo

- **LSL** (`modelo-lsl.md`) — quando a oferta precisa ser **argumentada**: produto de ticket alto (escritório privativo), contrato longo, várias objeções para vencer. Estrutura: hero + benefícios (3 cards) + faixa de urgência + formulário longo + regulamento.
- **VSL** (`modelo-vsl.md`) — quando existe **vídeo/tour** que vende melhor que texto (mesas fixas, demonstração do espaço). Estrutura: hero curto + vídeo + benefícios + faixa de urgência + formulário + regulamento.
- **Squeeze** (`modelo-squeeze.md`) — quando a oferta é **simples e urgente** (pacote de horas, day-use, sala de reunião avulsa). Estrutura: **uma dobra única** com hero à esquerda e formulário à direita, sobre imagem de fundo.

## Regras invariantes (nunca quebrar)

- **Não editar `styles.css`** — se o usuário pedir mudança visual que não passa pelas variáveis existentes, avise que sai do escopo do modelo. Ajustes de cor pontuais podem ir num `<style>` inline no `<head>` da página gerada.
- **Fontes Proxima Nova** vêm de `./fonts/` (auto-hospedadas). Nunca trocar por Google Fonts.
- **Bloco de texto do hero sempre alinhado à esquerda** (`.hero-copy` com `margin-left: 0`).
- **Faixa de urgência** amarela (`.urgency-banner`) é obrigatória acima do formulário em LSL/VSL, e integrada no Squeeze.
- **Header** com logo branco + link `nex.work` (top-right). **Footer** com logo, endereço fiscal completo e "Acesse nosso site oficial: nex.work".
- **Idioma**: pt-BR. **Título**: `<Assunto> em Curitiba — Condição Especial | Nex`.
- **Tom**: direto, sem gerúndio, sem "!". Frases curtas. Peso 400 nos títulos (o design system usa Proxima Nova Regular nos headings — não pedir bold).
- **CTAs padrão**: "Enviar para o time comercial" / "Quero a condição especial" / "Solicitar proposta". Nunca "Cadastre-se agora!!".

## Referências (carregar sob demanda)

- `references/design-system.md` — tokens de cor, tipografia e spacing.
- `references/fluxo-uso.md` — passo-a-passo detalhado do processo do sistema.
- `references/modelo-lsl.md` — schema completo do modelo LSL.
- `references/modelo-vsl.md` — schema completo do modelo VSL.
- `references/modelo-squeeze.md` — schema completo do modelo Squeeze.
- `references/rd-station-css.md` — como o CSS colado do RD Station substitui o form.

## Formato de entrega

Sempre entregue nesta ordem:

1. **Nome do arquivo** sugerido (ex: `escritorio-privativo-q1-2027.html`).
2. **Bloco `html`** com o arquivo completo, placeholders todos resolvidos.
3. **Checklist de arquivos irmãos** que precisam estar em `public/lp/` (ou pasta equivalente):
   - `styles.css` (desta skill, inalterado)
   - `fonts/*.otf` (desta skill, inalterado)
   - `logo-nex-white.png`, `logo-nex-black.png`
   - Imagem de hero (nome que o usuário definiu)
   - Vídeo/embed (se VSL)
4. **Aviso** se algum campo opcional foi deixado no default.
