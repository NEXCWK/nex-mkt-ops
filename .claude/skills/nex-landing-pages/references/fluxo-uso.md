# Fluxo de uso do sistema

Esta skill é acionada dentro de um sistema Claude Code que já tem UI de formulário. O fluxo real que o usuário vive é:

1. **Tela inicial** — 3 cartões: LSL, VSL, Squeeze. Cada um mostra nome do modelo, tipo de oferta ideal e uma miniatura.
2. **Usuário clica no modelo** — o sistema abre um formulário com **campos pré-determinados de acordo com o modelo escolhido** (o schema desses campos vive em `references/modelo-<slug>.md`).
3. **Campos exibidos por modelo**:
   - Campos de **texto** (título hero, subtítulo, corpo, bullets, regulamento, etc.).
   - **Uploads** de imagem (hero obrigatório; logos opcionais se quiser sobrescrever o default branco/preto).
   - **Upload de vídeo ou URL** (só no modelo VSL).
   - **Box livre** para observações/instruções extras que o usuário queira passar para você.
   - **Box para colar o CSS do RD Station** — o usuário pega o CSS gerado pelo RD Station Marketing e cola aqui; ele substitui o `<form>` de demonstração do template. Se vazio, o form de demo permanece.
4. **Usuário revisa e clica em OK** — o sistema envia todos esses dados para você (Claude).
5. **Você (Claude) gera** — copie o template do modelo, substitua todos os `{{PLACEHOLDERS}}` pelos valores recebidos, aplique as regras invariantes do `SKILL.md`, e devolva o HTML pronto + o checklist de arquivos irmãos.

## Papel da skill nesse fluxo

- Você **não** cria a UI de formulário — isso já existe no sistema.
- Você **consome** os dados que a UI coleta e **produz** o HTML final.
- O schema de campos que a UI expõe deve **espelhar 1:1** os `{{PLACEHOLDERS}}` documentados em cada `references/modelo-*.md`.
- Se o sistema mandar um campo que a skill não conhece, ignore com um aviso; se faltar um campo obrigatório, pergunte só o que falta.

## O que a saída deve permitir

O usuário pega o HTML gerado, salva como `<nome>.html` numa pasta ao lado dos assets compartilhados (`styles.css`, `fonts/`, logos, imagem de hero), e a página está pronta para publicar — sem build, sem framework, HTML+CSS puro.
