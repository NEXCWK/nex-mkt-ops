# CSS do RD Station Marketing

O RD Station Marketing entrega o formulário publicado através de **CSS colável** (não é `<iframe>` nem script). O usuário copia esse CSS do painel do RD e cola no campo correspondente da UI.

## Como aplicar no template

Cada template tem, dentro do `.form-card`, este bloco de demonstração:

```html
<!-- Substituir este <form> pelo embed do RD Station Marketing -->
<form action="#" method="post" onsubmit="event.preventDefault(); alert('...');">
  ...
</form>
```

Comportamento:

- Se `{{RD_STATION_CSS}}` **estiver preenchido**: substitua o bloco `<form>...</form>` inteiro pelo conteúdo colado pelo usuário (pode ser um `<div>` + `<style>` do RD, um `<script>` de embed, ou HTML puro — o que o painel do RD gerar).
- Se `{{RD_STATION_CSS}}` **estiver vazio**: mantenha o `<form>` de demo do template. Isso permite ao usuário visualizar a página antes de plugar o RD.

## Onde colocar

Preserve `.form-card` (título, `.form-note`, botão de estilo `.btn.btn-primary`, e `.disclaimer` de LGPD embaixo). Substitua **apenas** o `<form>...</form>`. Se o embed do RD trouxer seu próprio botão, o botão padrão do template pode ser removido — nesse caso mova o `.disclaimer` para depois do embed.

## Sanidade

Se o usuário colar algo que não parece um form (ex: só um snippet CSS solto sem markup), avise que o esperado é o HTML completo do formulário do RD, e mantenha o form de demo até receber a versão correta.
