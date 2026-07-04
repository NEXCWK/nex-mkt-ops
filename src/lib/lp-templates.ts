/**
 * Templates das Landing Pages Nex (skill nex-landing-pages).
 * 3 modelos fixos: LSL, VSL, Squeeze. O design system (styles.css + fontes
 * Proxima Nova + logo) é INVARIÁVEL — só o conteúdo muda entre páginas.
 *
 * A IA produz apenas os VALORES de conteúdo (copy); a renderização em HTML é
 * feita aqui no servidor, garantindo que o layout/tipografia nunca se desvie.
 *
 * Os assets compartilhados ficam em /public/lp-assets (styles.css, fonts/, logos).
 * O HTML gerado referencia-os por caminho relativo (./styles.css, ./fonts/...),
 * para o pacote final (.zip) ser portátil. Na prévia usamos <base href="/lp-assets/">.
 */

export type ModeloLP = 'lsl' | 'vsl' | 'squeeze'

export const FOOTER_LEGAL_DEFAULT =
  'COLETIVO BATEL - ESPACO DE COWORKING LTDA · CNPJ 13.431.642/0001-97 · ' +
  'Rua Francisco Rocha, 198, Batel, Curitiba/PR, CEP 80.420-130.'

export const URGENCY_DEFAULT = 'Condição especial por tempo limitado ou disponibilidade de salas.'

// Imagem de hero padrão (banco de imagens gratuito) quando o usuário não informa uma
export const DEFAULT_HERO_IMAGE =
  'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1600&q=80'

export interface BenefitCard { title: string; description: string }

export interface ValoresLP {
  // comuns
  lang?: string
  page_title: string
  meta_description: string
  hero_image?: string        // URL absoluta da imagem de hero (opcional)
  hero_tag?: string
  hero_title: string
  hero_subtitle: string
  urgency_text?: string
  form_card_title?: string
  form_card_note?: string
  form_cta?: string
  footer_legal?: string
  rd_embed?: string          // HTML do formulário do RD Station (substitui o form demo)
  // LSL / VSL
  hero_body_1?: string
  hero_body_2?: string
  hero_body?: string         // VSL / Squeeze (parágrafo único)
  benefits_eyebrow?: string
  benefits_title?: string
  benefit_cards?: BenefitCard[]
  form_eyebrow?: string
  form_lead_title?: string
  form_lead_body?: string
  form_bullets?: string[]
  regulation_eyebrow?: string
  regulation_title?: string
  regulation_intro?: string
  regulation_items?: string[]
  // VSL
  video_eyebrow?: string
  video_title?: string
  video_intro?: string
  video_embed?: string
  // Squeeze
  lead_bullets?: string[]
}

function esc(s: string | undefined): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function li(items: string[] | undefined): string {
  return (items ?? []).map(i => `            <li>${esc(i)}</li>`).join('\n')
}

function ol(items: string[] | undefined): string {
  return (items ?? []).map(i => `          <li>${esc(i)}</li>`).join('\n')
}

function benefitCards(cards: BenefitCard[] | undefined): string {
  const c = (cards ?? []).slice(0, 3)
  while (c.length < 3) c.push({ title: '', description: '' })
  return c.map((card, i) => `        <div class="benefit-card">
          <span class="num">0${i + 1}</span>
          <h3>${esc(card.title)}</h3>
          <p>${esc(card.description)}</p>
        </div>`).join('\n')
}

const HEADER = `  <header class="site-header">
    <div class="container">
      <img src="./logo-nex-white.png" alt="Nex" />
    </div>
  </header>`

function footer(v: ValoresLP): string {
  return `  <footer class="site-footer">
    <div class="container">
      <img src="./logo-nex-white.png" alt="Nex Coworking" />
      <p>${esc(v.footer_legal || FOOTER_LEGAL_DEFAULT)}</p>
      <p class="foot-links">Acesse nosso site oficial: <a href="https://nex.work" target="_blank" rel="noopener">nex.work</a></p>
    </div>
  </footer>`
}

/** Formulário: usa o embed do RD Station se houver; senão, o form de demonstração. */
function formInner(v: ValoresLP, emailLabel = 'E-mail'): string {
  if (v.rd_embed && v.rd_embed.trim()) return v.rd_embed
  return `          <form action="#" method="post" onsubmit="event.preventDefault(); alert('Formulário de demonstração — substituir pelo embed do RD Station.');">
            <div class="form-row"><label for="nome">Nome completo</label><input id="nome" name="nome" type="text" required /></div>
            <div class="form-row"><label for="email">${emailLabel}</label><input id="email" name="email" type="email" required /></div>
            <div class="form-row"><label for="whatsapp">WhatsApp</label><input id="whatsapp" name="whatsapp" type="tel" placeholder="(41) 90000-0000" required /></div>
            <div class="form-row"><label for="empresa">Empresa</label><input id="empresa" name="empresa" type="text" required /></div>
            <div class="form-row"><label for="cargo">Cargo</label><input id="cargo" name="cargo" type="text" required /></div>
            <div class="form-row"><label for="observacoes">Observações</label><textarea id="observacoes" name="observacoes"></textarea></div>
            <button class="btn btn-primary" type="submit">${esc(v.form_cta || 'Enviar para o time comercial')}</button>
            <p class="disclaimer">Ao enviar, você concorda em receber contato do time comercial Nex por e-mail ou WhatsApp.</p>
          </form>`
}

/** Estilo do hero: usa a imagem informada ou a padrão gratuita, com fundo escuro de segurança. */
function heroStyle(seletor: string, heroImage?: string): string {
  const img = heroImage && heroImage.trim() ? heroImage.trim() : DEFAULT_HERO_IMAGE
  return `    ${seletor}::before { background-color: #101010; }\n    ${seletor} { --hero-image: url('${img}'); }`
}

function head(v: ValoresLP, heroSel: string): string {
  return `<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(v.page_title)}</title>
  <meta name="description" content="${esc(v.meta_description)}" />
  <link rel="stylesheet" href="./styles.css" />
  <style>
${heroStyle(heroSel, v.hero_image)}
  </style>
</head>`
}

// ── LSL ─────────────────────────────────────────────────────────────────────
function renderLSL(v: ValoresLP): string {
  const body2 = v.hero_body_2 && v.hero_body_2.trim()
    ? `        <p class="body">${esc(v.hero_body_2)}</p>\n` : ''
  return `<!doctype html>
<html lang="${v.lang || 'pt-BR'}">
${head(v, '.hero')}
<body>

${HEADER}

  <section class="hero">
    <div class="container">
      <div class="hero-copy">
        <span class="hero-tag">${esc(v.hero_tag || 'Condição especial')}</span>
        <h1>${esc(v.hero_title)}</h1>
        <p class="subtitle">${esc(v.hero_subtitle)}</p>
        <p class="body">${esc(v.hero_body_1)}</p>
${body2}      </div>
    </div>
  </section>

  <section class="benefits">
    <div class="container">
      <div class="section-title">
        <span class="eyebrow">${esc(v.benefits_eyebrow || 'O que está incluído')}</span>
        <h2>${esc(v.benefits_title)}</h2>
      </div>
      <div class="benefit-grid">
${benefitCards(v.benefit_cards)}
      </div>
    </div>
  </section>

  <section class="urgency-banner">
    <div class="container"><p>${esc(v.urgency_text || URGENCY_DEFAULT)}</p></div>
  </section>

  <section class="form-section" id="formulario">
    <div class="container">
      <div class="grid">
        <div class="lead">
          <span class="eyebrow" style="display:block; color:var(--amber); font-weight:400; font-size:.8rem; letter-spacing:.12em; text-transform:uppercase;">${esc(v.form_eyebrow || 'Solicite sua proposta')}</span>
          <h2 style="margin-top:12px;">${esc(v.form_lead_title)}</h2>
          <p>${esc(v.form_lead_body)}</p>
          <ul>
${li(v.form_bullets)}
          </ul>
        </div>
        <div class="form-card">
          <h3>${esc(v.form_card_title || 'Quero a condição especial')}</h3>
          <p class="form-note">${esc(v.form_card_note || 'Preencha os campos abaixo. Nosso time comercial entrará em contato em até 1 dia útil.')}</p>
${formInner(v, 'E-mail corporativo')}
        </div>
      </div>
    </div>
  </section>

  <section class="regulation">
    <div class="container">
      <div class="section-title">
        <span class="eyebrow">${esc(v.regulation_eyebrow || 'Regulamento')}</span>
        <h2>${esc(v.regulation_title || 'Como funciona a condição especial.')}</h2>
        <p>${esc(v.regulation_intro || 'Regras claras para você tomar a decisão certa, sem surpresas.')}</p>
      </div>
      <div class="regulation-content">
        <ol>
${ol(v.regulation_items)}
        </ol>
      </div>
    </div>
  </section>

${footer(v)}

</body>
</html>`
}

// ── VSL ─────────────────────────────────────────────────────────────────────
function renderVSL(v: ValoresLP): string {
  const video = v.video_embed && v.video_embed.trim()
    ? `      <div class="video-wrap">${v.video_embed}</div>`
    : `      <div class="video-wrap" role="img" aria-label="Player de vídeo (placeholder)">
        <div class="play" aria-hidden="true"></div>
        <span class="label">Placeholder — substituir pelo embed do vídeo</span>
      </div>`
  return `<!doctype html>
<html lang="${v.lang || 'pt-BR'}">
${head(v, '.hero')}
<body>

${HEADER}

  <section class="hero">
    <div class="container">
      <div class="hero-copy">
        <span class="hero-tag">${esc(v.hero_tag || 'Condição especial')}</span>
        <h1>${esc(v.hero_title)}</h1>
        <p class="subtitle">${esc(v.hero_subtitle)}</p>
        <p class="body">${esc(v.hero_body)}</p>
      </div>
    </div>
  </section>

  <section class="video-section">
    <div class="container">
      <div class="section-title">
        <span class="eyebrow">${esc(v.video_eyebrow || 'Assista em 90 segundos')}</span>
        <h2>${esc(v.video_title)}</h2>
        <p>${esc(v.video_intro)}</p>
      </div>
${video}
    </div>
  </section>

  <section class="benefits">
    <div class="container">
      <div class="section-title">
        <span class="eyebrow">${esc(v.benefits_eyebrow || 'O que você ganha')}</span>
        <h2>${esc(v.benefits_title)}</h2>
      </div>
      <div class="benefit-grid">
${benefitCards(v.benefit_cards)}
      </div>
    </div>
  </section>

  <section class="urgency-banner">
    <div class="container"><p>${esc(v.urgency_text || URGENCY_DEFAULT)}</p></div>
  </section>

  <section class="form-section" id="formulario">
    <div class="container">
      <div class="grid">
        <div class="lead">
          <span class="eyebrow" style="display:block; color:var(--amber); font-weight:400; font-size:.8rem; letter-spacing:.12em; text-transform:uppercase;">${esc(v.form_eyebrow || 'Quero garantir minha vaga')}</span>
          <h2 style="margin-top:12px;">${esc(v.form_lead_title)}</h2>
          <p>${esc(v.form_lead_body)}</p>
          <ul>
${li(v.form_bullets)}
          </ul>
        </div>
        <div class="form-card">
          <h3>${esc(v.form_card_title || 'Solicitar condição especial')}</h3>
          <p class="form-note">${esc(v.form_card_note || 'Nosso time comercial retorna em até 1 dia útil.')}</p>
${formInner(v)}
        </div>
      </div>
    </div>
  </section>

  <section class="regulation">
    <div class="container">
      <div class="section-title">
        <span class="eyebrow">${esc(v.regulation_eyebrow || 'Regulamento')}</span>
        <h2>${esc(v.regulation_title || 'Como funciona a condição especial.')}</h2>
        <p>${esc(v.regulation_intro || 'Tudo transparente para você decidir com tranquilidade.')}</p>
      </div>
      <div class="regulation-content">
        <ol>
${ol(v.regulation_items)}
        </ol>
      </div>
    </div>
  </section>

${footer(v)}

</body>
</html>`
}

// ── Squeeze ──────────────────────────────────────────────────────────────────
function renderSqueeze(v: ValoresLP): string {
  return `<!doctype html>
<html lang="${v.lang || 'pt-BR'}">
${head(v, '.squeeze')}
<body>

${HEADER}

  <section class="squeeze">
    <div class="urgency-banner"><p>${esc(v.urgency_text || URGENCY_DEFAULT)}</p></div>
    <div class="container">
      <div class="grid">
        <div class="lead">
          <span class="hero-tag">${esc(v.hero_tag || 'Condição especial')}</span>
          <h1>${esc(v.hero_title)}</h1>
          <p class="subtitle">${esc(v.hero_subtitle)}</p>
          <p>${esc(v.hero_body)}</p>
          <ul>
${li(v.lead_bullets)}
          </ul>
        </div>
        <div class="form-card">
          <h3>${esc(v.form_card_title || 'Quero o pacote promocional')}</h3>
          <p class="form-note">${esc(v.form_card_note || 'Preencha e nosso time comercial entrará em contato em até 1 dia útil.')}</p>
${formInner(v)}
        </div>
      </div>
    </div>
  </section>

${footer(v)}

</body>
</html>`
}

export function renderLP(modelo: ModeloLP, v: ValoresLP): string {
  if (modelo === 'lsl') return renderLSL(v)
  if (modelo === 'vsl') return renderVSL(v)
  return renderSqueeze(v)
}

export const MODELOS_INFO: Record<ModeloLP, { nome: string; oferta: string; estrutura: string }> = {
  lsl: {
    nome: 'LSL — Long Sales Letter',
    oferta: 'Ticket alto, contrato longo, várias objeções (ex.: escritório privativo).',
    estrutura: 'Hero + 3 benefícios + faixa de urgência + formulário + regulamento.',
  },
  vsl: {
    nome: 'VSL — Video Sales Letter',
    oferta: 'Quando um vídeo/tour vende melhor (mesas fixas, demonstração do espaço).',
    estrutura: 'Hero curto + vídeo + benefícios + urgência + formulário + regulamento.',
  },
  squeeze: {
    nome: 'Squeeze',
    oferta: 'Oferta simples e urgente (pacote de horas, day-use, sala avulsa).',
    estrutura: 'Uma dobra única: hero à esquerda + formulário à direita.',
  },
}
