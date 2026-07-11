// Generuje electron/icon.ico z logo aplikacji (public/icons/icon-512.png).
//
// Windows (a zwlaszcza instalator NSIS) wymaga ikony z KILKOMA rozmiarami
// i nie przyjmuje pojedynczego obrazu 512x512 - stad przeskalowanie.
const path = require('node:path')
const fs = require('node:fs')
const sharp = require('sharp')
const mod = require('png-to-ico')
const pngNaIco = mod.default || mod

const ROZMIARY = [16, 24, 32, 48, 64, 128, 256]
const zrodlo = path.join(__dirname, '..', 'public', 'icons', 'icon-512.png')
const cel = path.join(__dirname, '..', 'electron', 'icon.ico')

async function main() {
  const warianty = await Promise.all(
    ROZMIARY.map((r) => sharp(zrodlo).resize(r, r, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()),
  )
  const ico = await pngNaIco(warianty)
  fs.writeFileSync(cel, ico)
  console.log(`Zapisano ${path.relative(process.cwd(), cel)} – rozmiary ${ROZMIARY.join(', ')} (${(ico.length / 1024).toFixed(0)} KB)`)
}

main().catch((e) => {
  console.error('Nie udalo sie wygenerowac ikony:', e.message)
  process.exit(1)
})
