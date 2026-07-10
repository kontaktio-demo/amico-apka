// Generuje ikony PWA (PNG) z oryginalnego znaku AMICO (granatowy kafelek + białe „M").
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pub = resolve(__dirname, '..', 'public')
mkdirSync(resolve(pub, 'icons'), { recursive: true })

const M =
  'M379.2,337.3c-1.8,0-5.2.4-5.2-2.2s2.9-10.8,5.2-26.2c1.7-10.8,3.1-24.5,3.1-40.1s.4-21-4.4-21-9.8,14.4-11.2,17.9c-12.2,29.9-10.2,36.6-16.7,36.6s-7.8-6.7-20.8-36.6c-1.5-3.2-6.3-17.9-10.8-17.9s-4.7,17.9-4.7,21c0,38,9.2,64.3,9.2,66.3s-3.5,2.2-5.2,2.2c-3.6,0-23.6,2.8-23.6-51.9s21-69.3,23.5-69.3c5.7,0,7.7,0,14.9,9.8,13.7,18.8,14.6,29.4,17.5,29.4s3.1-10.6,18.5-29.4c8.2-9.9,10.3-9.8,16-9.8s21.4-2.6,21.4,69.3-23,51.9-26.7,51.9Z'

// vb: kwadrat 172.9 wokol litery M; rx w jednostkach vb
const tile = (rx, pad = 0) => {
  const vb = `${263.4 - pad} ${191.4 - pad} ${172.9 + pad * 2} ${172.9 + pad * 2}`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="512" height="512">
    <rect x="${263.4 - pad}" y="${191.4 - pad}" width="${172.9 + pad * 2}" height="${172.9 + pad * 2}" rx="${rx}" fill="#0e1533"/>
    <path fill="#ffffff" d="${M}"/>
  </svg>`
}

async function png(svg, size, name) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(resolve(pub, name))
  console.log('->', name)
}

await png(tile(34), 192, 'icons/icon-192.png')
await png(tile(34), 512, 'icons/icon-512.png')
await png(tile(0, 26), 512, 'icons/icon-512-maskable.png') // maskable: pełne tło + margines bezpieczeństwa
await png(tile(30), 180, 'apple-touch-icon.png')
console.log('Ikony AMICO gotowe.')
