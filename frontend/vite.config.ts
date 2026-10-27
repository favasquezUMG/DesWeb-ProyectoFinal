import { defineConfig, loadEnv, type HtmlTagDescriptor, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// Vite config — https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  return {
    build: {
      // Sin sourcemaps en producción: no se publica el código fuente
      sourcemap: false,
    },
    plugins: [
      react(),
      tailwindcss(),
      sitioPublico(env.VITE_SITE_URL || 'https://colegio-vanguardia.netlify.app'),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: 'localhost',
      port: parseInt(process.env.PORT || '8443'),
      strictPort: true,
    },
    preview: {
      host: 'localhost',
      port: parseInt(process.env.PORT || '8443'),
    },
  }
})

/**
 * SEO del sitio público. Con VITE_SITE_URL (URL pública del frontend; por defecto https://colegio-vanguardia.netlify.app)
 * agrega canonical, og:url, la imagen social con URL absoluta y genera sitemap.xml; sin ella solo
 * se generan robots.txt y los datos estructurados sin URL.
 */
function sitioPublico(siteUrl: string): Plugin {
  const base = siteUrl.trim().replace(/\/+$/, '')
  const datosEstructurados = {
    '@context': 'https://schema.org',
    '@type': 'School',
    name: 'Colegio Vanguardia',
    description: 'Educación de Preprimaria a Diversificado en sedes de Guatemala, con portal académico en línea.',
    email: 'info@colegiovanguardia.edu.gt',
    address: { '@type': 'PostalAddress', addressCountry: 'GT' },
    ...(base ? { url: `${base}/`, logo: `${base}/apple-touch-icon.png`, image: `${base}/og.png` } : {}),
  }

  return {
    name: 'sitio-publico',
    transformIndexHtml(html) {
      const tags: HtmlTagDescriptor[] = [
        { tag: 'script', attrs: { type: 'application/ld+json' }, children: JSON.stringify(datosEstructurados), injectTo: 'head' },
      ]
      if (!base) return { html, tags }
      tags.push(
        { tag: 'link', attrs: { rel: 'canonical', href: `${base}/` }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:url', content: `${base}/` }, injectTo: 'head' },
      )
      return { html: html.replace('content="/og.png"', `content="${base}/og.png"`), tags }
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\n${base ? `\nSitemap: ${base}/sitemap.xml\n` : ''}`,
      })
      if (!base) return
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          `  <url><loc>${base}/</loc><changefreq>monthly</changefreq></url>`,
          '</urlset>',
          '',
        ].join('\n'),
      })
    },
  }
}

