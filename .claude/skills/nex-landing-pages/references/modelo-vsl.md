# Modelo VSL — Video Sales Letter

**Quando usar:** quando um **vídeo curto** (tour do espaço, depoimento, demo) vende melhor que texto. Ideal para mesas fixas, day-use recorrente, apresentação do coworking.

**Arquivo template:** `templates/vsl.html`

**Estrutura:** header → hero (curto) → seção de vídeo → 3 benefícios → faixa de urgência → formulário → regulamento → footer.

## Placeholders

| Placeholder                | Tipo        | Obrigatório | Descrição                                                           |
| -------------------------- | ----------- | ----------- | ------------------------------------------------------------------- |
| `{{LANG}}`                 | string      | não         | Default `pt-BR`.                                                    |
| `{{PAGE_TITLE}}`           | string      | sim         | `<title>`.                                                          |
| `{{META_DESCRIPTION}}`     | string      | sim         | Até 155 caracteres.                                                 |
| `{{HERO_IMAGE}}`           | string      | sim         | Nome do arquivo em `public/lp/`.                                    |
| `{{HERO_TAG}}`             | string      | não         | Default `Condição especial`.                                        |
| `{{HERO_TITLE}}`           | string      | sim         | H1.                                                                 |
| `{{HERO_SUBTITLE}}`        | string      | sim         | Linha amarela.                                                      |
| `{{HERO_BODY}}`            | string      | sim         | 1 parágrafo curto. (VSL usa hero mais enxuto que LSL.)              |
| `{{VIDEO_EYEBROW}}`        | string      | não         | Default `Assista em 90 segundos`.                                   |
| `{{VIDEO_TITLE}}`          | string      | sim         | H2 da seção de vídeo.                                               |
| `{{VIDEO_INTRO}}`          | string      | não         | Frase abaixo do H2.                                                 |
| `{{VIDEO_EMBED}}`          | html/string | não         | `<iframe>` do YouTube/Vimeo, ou tag `<video>`. Se vazio, mantém o placeholder de play amarelo do template. |
| `{{BENEFITS_EYEBROW}}`     | string      | não         | Default `O que você ganha`.                                         |
| `{{BENEFITS_TITLE}}`       | string      | sim         | H2 da seção de benefícios.                                          |
| `{{BENEFIT_CARDS}}`        | array (=3)  | sim         | Exatamente 3 objetos `{ title, description }`.                      |
| `{{URGENCY_TEXT}}`         | string      | não         | Default padrão.                                                     |
| `{{FORM_EYEBROW}}`         | string      | não         | Ex: `Quero garantir minha mesa`.                                    |
| `{{FORM_LEAD_TITLE}}`      | string      | sim         | H2 do form.                                                         |
| `{{FORM_LEAD_BODY}}`       | string      | sim         | Parágrafo antes dos bullets.                                        |
| `{{FORM_BULLETS}}`         | array       | sim         | 3-5 bullets.                                                        |
| `{{FORM_CARD_TITLE}}`      | string      | não         | Default `Solicitar condição especial`.                              |
| `{{FORM_CARD_NOTE}}`       | string      | não         | Default `Nosso time comercial retorna em até 1 dia útil.`           |
| `{{FORM_CTA}}`             | string      | não         | Default `Enviar para o time comercial`.                             |
| `{{RD_STATION_EMBED}}`     | html/string | não         | Ver `rd-station-css.md`.                                            |
| `{{REGULATION_EYEBROW}}`   | string      | não         | Default `Regulamento`.                                              |
| `{{REGULATION_TITLE}}`     | string      | não         | Default `Como funciona a condição especial.`                        |
| `{{REGULATION_INTRO}}`     | string      | não         | Default `Tudo transparente para você decidir com tranquilidade.`    |
| `{{REGULATION_ITEMS}}`     | array       | sim         | 6-10 itens.                                                         |
| `{{FOOTER_LEGAL}}`         | string      | não         | Default padrão da Nex.                                              |

## Regras específicas

- **Vídeo é a peça central** — se `{{VIDEO_EMBED}}` estiver vazio, alerte o usuário de que a página vai ao ar com placeholder. VSL sem vídeo funcional perde o propósito.
- Para YouTube use `<iframe src="https://www.youtube.com/embed/<ID>" ...>` sem controles extras; o wrapper `.video-wrap` já mantém aspect ratio 16:9.
- Hero mais curto que LSL (1 parágrafo), porque o vídeo carrega o argumento.
