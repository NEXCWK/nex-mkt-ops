# Design System — Nex LPs

Tokens fixos definidos em `templates/styles.css` (`:root`). **Não alterar sem pedido explícito do usuário.**

## Cores

| Token           | Valor     | Uso                                            |
| --------------- | --------- | ---------------------------------------------- |
| `--ink`         | `#000000` | Texto principal, botões primários (texto)      |
| `--bg`          | `#ffffff` | Fundo padrão                                   |
| `--surface`     | `#f5f5f5` | Fundo de seções alternadas, form-card          |
| `--muted`       | `#6b6b6b` | Texto secundário                               |
| `--border`      | `#e5e5e5` | Bordas de cards e inputs                       |
| `--amber`       | `#fbaf1a` | Cor de marca — CTAs, tags, faixa de urgência   |
| `--amber-dark`  | `#e09b0f` | Hover do amber                                 |
| `--whatsapp`    | `#25d366` | (reservado — botão WhatsApp foi removido)      |

## Tipografia

- Família única: **Proxima Nova** auto-hospedada (`./fonts/ProximaNova-*.otf`), 8 variantes (300/400/600/700it/800 + italics).
- Body: 16px / line-height 1.6 / weight 400.
- Headings (h1/h2/h3/h4): **weight 400** (peso leve, por decisão de branding). Nunca usar bold nos títulos.
- H1: `clamp(2.2rem, 4.6vw, 3.6rem)`, letter-spacing `-0.02em`.
- H2: `clamp(1.8rem, 3.4vw, 2.6rem)`.

## Layout

- `--container`: `1180px` (largura máxima).
- `--radius`: `4px`.
- Padding padrão de section: `90px 0` (desktop), `64px 0` (mobile).
- Hero: `min-height: 78vh`, imagem de fundo + gradiente escuro à esquerda, texto branco alinhado à esquerda (`.hero-copy { max-width: 520px; margin-left: 0; }`).

## Componentes reutilizados

- `.site-header` (absolute top, logo branco + link nex.work)
- `.hero` + `.hero-copy` + `.hero-tag` (tag amarela pequena)
- `.urgency-banner` (faixa amarela 100% largura, texto centralizado)
- `.benefits` + `.benefit-grid` + `.benefit-card` (3 colunas, número amarelo)
- `.video-section` + `.video-wrap` + `.play` (fundo preto, placeholder de play amarelo)
- `.form-section` + `.form-card` + `.form-row`
- `.regulation` + `.regulation-content` (fundo preto, lista numerada)
- `.site-footer` (fundo preto, logo, endereço, link nex.work)
- `.btn.btn-primary` (amber, texto preto, radius 4px)

## Imagem de hero

Injetada via custom property no `<head>` da página:

```html
<style>
  .hero { --hero-image: url('./<arquivo>.jpg'); }
</style>
```

No Squeeze é `.squeeze { --hero-image: ... }`.
