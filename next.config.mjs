/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdf-parse/pdfjs-dist precisam permanecer fora do bundle do webpack: eles
  // carregam um arquivo "pdf.worker.mjs" irmão via caminho relativo em tempo
  // de execução, e o webpack quebra essa referência ao empacotar tudo em um
  // único chunk (erro: "Setting up fake worker failed: Cannot find module...").
  serverExternalPackages: ['docxtemplater', 'pizzip', 'pdf-parse', 'pdfjs-dist'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
}

export default nextConfig
