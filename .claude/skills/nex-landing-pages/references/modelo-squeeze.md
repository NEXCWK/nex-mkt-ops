# Modelo Squeeze

**Quando usar:** ofertas **simples e urgentes**, onde a decisão do lead pode acontecer em segundos — pacote de horas, sala de reunião avulsa, day-use promocional. Uma única dobra concentra tudo.

**Arquivo template:** `templates/squeeze.html`

**Estrutura:** header → dobra única (hero à esquerda com título/subtítulo/bullets + formulário à direita, sobre imagem escura) com faixa de urgência integrada no topo → footer. **Sem** seção separada de benefícios ou regulamento.

## Placeholders

| Placeholder                | Tipo        | Obrigatório | Descrição                                                           |
| -------------------------- | ----------- | ----------- | ------------------------------------------------------------------- |
| `{{LANG}}`                 | string      | não         | Default `pt-BR`.                                                    |
| `{{PAGE_TITLE}}`           | string      | sim         | `<title>`.                                                          |
| `{{META_DESCRIPTION}}`     | string      | sim         | Até 155 caracteres.                                                 |
| `{{HERO_IMAGE}}`           | string      | sim         | Nome do arquivo em `public/lp/`.                                    |
| `{{URGENCY_TEXT}}`         | string      | não         | Faixa amarela no topo da dobra. Default padrão.                     |
| `{{HERO_TAG}}`             | string      | não         | Default `Condição especial`.                                        |
| `{{HERO_TITLE}}`           | string      | sim         | H1.                                                                 |
| `{{HERO_SUBTITLE}}`        | string      | sim         | Linha amarela — a promessa concreta (ex: "Pacote de 20h com 25% de desconto"). |
| `{{HERO_BODY}}`            | string      | sim         | 1 parágrafo curto de contexto.                                      |
| `{{LEAD_BULLETS}}`         | array       | sim         | 3-5 bullets do que o produto inclui.                                |
| `{{FORM_CARD_TITLE}}`      | string      | não         | Default `Quero o pacote promocional`.                               |
| `{{FORM_CARD_NOTE}}`       | string      | não         | Default `Preencha e nosso time comercial entrará em contato em até 1 dia útil.` |
| `{{FORM_CTA}}`             | string      | não         | Default `Enviar para o time comercial`.                             |
| `{{RD_STATION_EMBED}}`     | html/string | não         | Ver `rd-station-css.md`.                                            |
| `{{FOOTER_LEGAL}}`         | string      | não         | Default padrão da Nex.                                              |

## Regras específicas

- Squeeze **não tem** cards de benefício nem regulamento numerado — se o usuário quiser esses blocos, é sinal de que deveria estar usando **LSL** ou **VSL**.
- O subtítulo é o **hook comercial** — deve conter número/percentual/prazo concreto.
- A dobra ocupa `min-height: 100vh` — mantenha o texto enxuto para não estourar em telas menores.
- Faixa de urgência aqui é integrada dentro da seção `.squeeze`, não uma section separada como no LSL/VSL.
