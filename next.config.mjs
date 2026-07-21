/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['docxtemplater', 'pizzip'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
}

export default nextConfig
