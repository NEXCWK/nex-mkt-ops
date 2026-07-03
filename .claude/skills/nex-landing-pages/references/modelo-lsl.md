# Modelo LSL — Long Sales Letter

**Quando usar:** ofertas de ticket alto e contrato longo que precisam de argumentação (ex.: escritório privativo, adesão a plano anual robusto). O usuário rola a página lendo vários argumentos antes de converter.

**Arquivo template:** `templates/lsl.html`

**Estrutura:** header → hero → 3 benefícios → faixa de urgência → formulário com bullets → regulamento numerado → footer.

## Placeholders

| Placeholder                | Tipo        | Obrigatório | Descrição / limite                                                  |
| -------------------------- | ----------- | ----------- | ------------------------------------------------------------------- |
| `{{LANG}}`                 | string      | não         | Default `pt-BR`.                                                    |
| `{{PAGE_TITLE}}`           | string      | sim         | `<title>` — padrão `<Assunto> em Curitiba — Condição Especial \| Nex`. |
| `{{META_DESCRIPTION}}`     | string      | sim         | Até 155 caracteres.                                                 |
| `{{HERO_IMAGE}}`           | string      | sim         | Nome do arquivo, ex: `hero-privativo.jpg`. Deve estar em `public/lp/`. |
| `{{HERO_TAG}}`             | string      | não         | Default `Condição especial`. Máx 3 palavras.                        |
| `{{HERO_TITLE}}`           | string      | sim         | H1. 3-8 palavras. Sem exclamação.                                   |
| `{{HERO_SUBTITLE}}`        | string      | sim         | Linha amarela. 1 frase objetiva com a promessa/benefício-chave.     |
| `{{HERO_BODY_1}}`          | string      | sim         | Parágrafo 1 do hero. 1-2 frases.                                    |
| `{{HERO_BODY_2}}`          | string      | não         | Parágrafo 2 do hero. Opcional.                                      |
| `{{BENEFITS_EYEBROW}}`     | string      | não         | Default `O que está incluído`.                                      |
| `{{BENEFITS_TITLE}}`       | string      | sim         | H2 da seção de benefícios.                                          |
| `{{BENEFIT_CARDS}}`        | array (=3)  | sim         | Exatamente 3 objetos `{ title, description }`. Numeração 01/02/03 é adicionada automaticamente. |
| `{{URGENCY_TEXT}}`         | string      | não         | Default `Condição especial por tempo limitado ou disponibilidade de salas.` |
| `{{FORM_EYEBROW}}`         | string      | não         | Default `Solicite sua proposta`.                                    |
| `{{FORM_LEAD_TITLE}}`      | string      | sim         | H2 do lado esquerdo do formulário.                                  |
| `{{FORM_LEAD_BODY}}`       | string      | sim         | Parágrafo explicativo antes dos bullets.                            |
| `{{FORM_BULLETS}}`         | array       | sim         | 3-5 bullets curtos (o que o lead ganha ao preencher).               |
| `{{FORM_CARD_TITLE}}`      | string      | não         | Default `Quero a condição especial`.                                |
| `{{FORM_CARD_NOTE}}`       | string      | não         | Default `Preencha os campos abaixo. Nosso time comercial entrará em contato em até 1 dia útil.` |
| `{{FORM_CTA}}`             | string      | não         | Default `Enviar para o time comercial`.                             |
| `{{RD_STATION_EMBED}}`     | html/string | não         | Ver `rd-station-css.md`. Se vazio, mantém form de demo.             |
| `{{REGULATION_EYEBROW}}`   | string      | não         | Default `Regulamento`.                                              |
| `{{REGULATION_TITLE}}`     | string      | não         | Default `Como funciona a condição especial.`                        |
| `{{REGULATION_INTRO}}`     | string      | não         | Default `Regras claras para você tomar a decisão certa, sem surpresas.` |
| `{{REGULATION_ITEMS}}`     | array       | sim         | Lista numerada de regras (6-10 itens).                              |
| `{{FOOTER_LEGAL}}`         | string      | não         | Default: CNPJ + endereço da Nex conforme template.                  |

## Regras específicas

- `{{BENEFIT_CARDS}}` deve ter **exatamente 3** itens — o grid do template é 3 colunas.
- Prefixe cada benefício com foco em **valor concreto** (número, prazo, item incluído).
- `{{REGULATION_ITEMS}}` sempre inclui item de "não cumulativa com outras promoções" e "Nex reserva-se o direito de encerrar a promoção".
