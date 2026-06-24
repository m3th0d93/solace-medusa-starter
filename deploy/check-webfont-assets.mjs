import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

const fontDir = join(root, 'public', 'fonts', 'webfont')
const fontFiles = [
  'WebfontLight.woff2',
  'WebfontLight.woff',
  'WebfontLight.ttf',
  'WebfontLight.eot',
  'WebfontRegular.woff2',
  'WebfontRegular.woff',
  'WebfontRegular.ttf',
  'WebfontRegular.eot',
  'WebfontMedium.woff2',
  'WebfontMedium.woff',
  'WebfontMedium.ttf',
  'WebfontMedium.eot',
]

const errors = []

for (const file of fontFiles) {
  const path = join(fontDir, file)
  if (!existsSync(path)) {
    errors.push(`Missing font file: ${file}`)
    continue
  }

  if (statSync(path).size === 0) {
    errors.push(`Font file is empty: ${file}`)
  }
}

const globalsCss = readFileSync(
  join(root, 'src', 'styles', 'globals.css'),
  'utf8'
)
const typography = readFileSync(
  join(root, 'preset', 'theme', 'typography.js'),
  'utf8'
)
const checkoutPayment = readFileSync(
  join(
    root,
    'src',
    'modules',
    'checkout',
    'components',
    'payment',
    'index.tsx'
  ),
  'utf8'
)

const requiredCssSnippets = [
  "font-family: 'Webfont'",
  'font-weight: 300',
  'font-weight: 400',
  'font-weight: 700',
  '/fonts/webfont/WebfontLight.woff2',
  '/fonts/webfont/WebfontRegular.woff2',
  '/fonts/webfont/WebfontMedium.woff2',
]

for (const snippet of requiredCssSnippets) {
  if (!globalsCss.includes(snippet)) {
    errors.push(`globals.css missing: ${snippet}`)
  }
}

if (!typography.includes("'Webfont'")) {
  errors.push("typography.js does not put 'Webfont' in the sans stack")
}

if (!checkoutPayment.includes('Webfont, sans-serif')) {
  errors.push('checkout payment fontFamily is not Webfont, sans-serif')
}

if (errors.length > 0) {
  console.error(errors.join('\n'))
  process.exit(1)
}

console.log(
  `Webfont assets and references verified (${fontFiles.length} files)`
)
