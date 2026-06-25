import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'

import {
  buildBaseline,
  buildReadinessMarkdown,
  decideCategoryResult,
  decideInnerPageResult,
  decideMenuResult,
  decideProductClickthroughResult,
  detectFormattingFlags,
  isSafeVerificationBaseUrl,
} from './jakdor-import-verifier-lib.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const storefrontRoot = path.resolve(__dirname, '..')
const jakdorRoot = path.resolve(storefrontRoot, '..')
const defaultNormalizedDir = path.join(
  jakdorRoot,
  'migration',
  'snapshots',
  'normalized',
  '20260625T074941Z-fixed'
)
const defaultRawSnapshot = path.join(
  jakdorRoot,
  'migration',
  'snapshots',
  'raw',
  '20260625T074941Z',
  'opencart-raw.json'
)
const defaultGoldenCorpus = path.join(
  jakdorRoot,
  'migration',
  'opencart',
  'import',
  'golden-corpus.json'
)
const defaultResolutions = path.join(
  jakdorRoot,
  'migration',
  'opencart',
  'import',
  'golden-poc-resolutions.json'
)

function parseArgs(argv) {
  const args = {
    baseUrl: process.env.PUBLIC_BASE_URL ?? 'https://staging.jakdor.co.uk',
    normalizedDir: defaultNormalizedDir,
    rawSnapshot: defaultRawSnapshot,
    goldenCorpus: defaultGoldenCorpus,
    resolutions: defaultResolutions,
    reportDir: null,
    screenshots: true,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--base-url') args.baseUrl = argv[++index]
    else if (arg === '--normalized-dir') args.normalizedDir = path.resolve(argv[++index])
    else if (arg === '--raw-snapshot') args.rawSnapshot = path.resolve(argv[++index])
    else if (arg === '--golden-corpus') args.goldenCorpus = path.resolve(argv[++index])
    else if (arg === '--resolutions') args.resolutions = path.resolve(argv[++index])
    else if (arg === '--report-dir') args.reportDir = path.resolve(argv[++index])
    else if (arg === '--no-screenshots') args.screenshots = false
    else if (arg === '--help') {
      printHelp()
      process.exit(0)
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  if (!args.reportDir) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    args.reportDir = path.join(
      jakdorRoot,
      'migration',
      'reports',
      'import-verification',
      stamp
    )
  }

  return args
}

function printHelp() {
  console.log(`Usage:
  node deploy/check-jakdor-import-readiness.mjs --base-url https://staging.jakdor.co.uk

Options:
  --base-url <url>          Staging, throwaway, localhost, or 127.0.0.1 target
  --normalized-dir <path>   Normalized snapshot folder
  --raw-snapshot <path>     Raw OpenCart snapshot JSON
  --golden-corpus <path>    Optional frozen corpus for explicit product checks
  --resolutions <path>      Optional blocker/media resolution manifest
  --report-dir <path>       Output folder for JSON, Markdown, and screenshots
  --no-screenshots          Skip PNG screenshot output
`)
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'))
}

async function readOptionalJson(filePath) {
  try {
    return await readJson(filePath)
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
}

function absoluteUrl(baseUrl, routePath) {
  return new URL(routePath, baseUrl).toString()
}

function publicPathFromHref(baseUrl, href) {
  try {
    const url = new URL(href, baseUrl)
    return `${url.pathname}${url.search}`
  } catch {
    return href
  }
}

function extractProductCount(text) {
  const match = String(text ?? '').match(/\b(\d+)\s+products?\b/i)
  if (!match) return null
  return Number(match[1])
}

function slugify(value) {
  return String(value)
    .replace(/^\//, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

function resolvedMediaRefs(resolutions) {
  return new Set(
    (resolutions?.media ?? [])
      .filter((item) => item.status === 'resolved' && item.asset_ref)
      .map((item) => String(item.asset_ref))
  )
}

function resolvedDispositions(resolutions) {
  const resolved = new Set()

  for (const section of ['media', 'products', 'redirects']) {
    for (const item of resolutions?.[section] ?? []) {
      if (item.status === 'resolved' && item.resolves_disposition) {
        resolved.add(String(item.resolves_disposition))
      }
    }
  }

  if (
    resolutions?.attributes?.status === 'resolved' &&
    resolutions.attributes.resolves_disposition
  ) {
    resolved.add(String(resolutions.attributes.resolves_disposition))
  }

  return resolved
}

function productDescriptionsById(rawSnapshot) {
  return new Map(
    (rawSnapshot.tables?.product_description ?? [])
      .filter((row) => String(row.language_id ?? '1') === '1')
      .map((row) => [String(row.product_id), row])
  )
}

function buildGoldenProductChecks(rawSnapshot, routeReport, goldenCorpus) {
  const descriptions = productDescriptionsById(rawSnapshot)
  const routes = routeReport.products ?? {}

  return (goldenCorpus?.products ?? [])
    .map((item) => {
      const productId = String(item.opencart_product_id)
      const url = item.expected_path ?? routes[productId]

      if (!url) return null

      return {
        url,
        opencart_product_id: productId,
        expected_h1: descriptions.get(productId)?.name ?? 'product page',
        quote_only_expected:
          item.role === 'zero_price_quote_only' ||
          (item.must_verify ?? []).includes('quote_only'),
      }
    })
    .filter(Boolean)
}

async function launchBrowser() {
  try {
    return await chromium.launch()
  } catch (error) {
    if (!String(error?.message).includes("Executable doesn't exist")) {
      throw error
    }

    return chromium.launch({ channel: 'chrome' })
  }
}

async function fetchStatus(url) {
  try {
    const response = await fetch(url, { redirect: 'manual' })
    return response.status
  } catch {
    return null
  }
}

async function gotoForReport(page, url) {
  const status = await fetchStatus(url)
  try {
    const response = await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 60000,
    })
    return {
      navigationError: null,
      status: response?.status() ?? status,
    }
  } catch (error) {
    return {
      navigationError: String(error?.message ?? error).split('\n')[0],
      status,
    }
  }
}

async function newCheckedPage(browser, viewport) {
  const page = await browser.newPage({ viewport })
  const consoleErrors = []

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => {
    consoleErrors.push(error.message)
  })

  return { page, consoleErrors }
}

async function collectBrokenImages(page, baseUrl) {
  const refs = await page.evaluate(() =>
    Array.from(document.images)
      .filter((image) => image.currentSrc && image.complete && image.naturalWidth === 0)
      .map((image) => image.currentSrc)
  )
  return refs.map((href) => publicPathFromHref(baseUrl, href))
}

async function collectBrokenLinks(page, baseUrl) {
  const hrefs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a[href]'))
      .map((link) => link.getAttribute('href'))
      .filter(Boolean)
  )

  return hrefs
    .filter((href) => href.startsWith('http') && !href.includes(new URL(baseUrl).hostname))
    .filter((href) => !href.startsWith('mailto:') && !href.startsWith('tel:'))
}

async function saveScreenshot(page, screenshotsDir, name, enabled) {
  if (!enabled) return null
  await fs.mkdir(screenshotsDir, { recursive: true })
  const filePath = path.join(screenshotsDir, `${name}.png`)
  await page.screenshot({ path: filePath, fullPage: true })
  return filePath
}

async function checkCategory(browser, baseUrl, category, mediaProblems, screenshotsDir, screenshots) {
  const { page, consoleErrors } = await newCheckedPage(browser, {
    width: 1440,
    height: 1000,
  })

  try {
    const navigation = await gotoForReport(page, absoluteUrl(baseUrl, category.url))
    const actualStatus = navigation.status
    const html = await page.content()
    const bodyText = await page.locator('body').innerText({ timeout: 10000 }).catch(() => '')
    const h1 = await page.locator('h1').first().innerText({ timeout: 5000 }).catch(() => '')
    const productLinks = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href*="/products/"]'))
        .map((link) => link.getAttribute('href'))
        .filter(Boolean)
    )
    const normalizedProductLinks = [...new Set(productLinks.map((href) => publicPathFromHref(baseUrl, href)))]
    const brokenImages = await collectBrokenImages(page, baseUrl)
    const brokenLinks = await collectBrokenLinks(page, baseUrl)
    const formattingFlags = detectFormattingFlags(html)
    if (navigation.navigationError) {
      formattingFlags.push(`navigation failed: ${navigation.navigationError}`)
    }
    const uiEvidence = await page.evaluate(() => {
      const body = document.body.textContent ?? ''
      return {
        has_filter_control: /filter/i.test(body),
        has_sort_control: /relevance|new in|sort/i.test(body),
        has_breadcrumb: document.querySelector('nav, [aria-label*="breadcrumb" i]') !== null,
      }
    })

    if (!uiEvidence.has_filter_control) formattingFlags.push('category filter control not detected')
    if (!uiEvidence.has_sort_control) formattingFlags.push('category sort control not detected')
    if (!uiEvidence.has_breadcrumb) formattingFlags.push('category breadcrumb not detected')

    const missingAssets = []
    const categoryProblem = mediaProblems.find(
      (row) =>
        String(row.origin_entity_type) === 'category' &&
        String(row.origin_entity_id) === String(category.category_id)
    )
    if (categoryProblem?.ref) missingAssets.push(categoryProblem.ref)

    await saveScreenshot(
      page,
      screenshotsDir,
      `desktop-category-${slugify(category.url)}`,
      screenshots
    )

    return decideCategoryResult({
      url: category.url,
      expected_status: 200,
      actual_status: actualStatus,
      expected_title_or_h1: category.expected_h1,
      actual_title_or_h1: h1,
      expected_product_count: category.expected_product_count,
      actual_product_count: extractProductCount(bodyText),
      source_linked_count: category.source_linked_count,
      source_public_visible_count: category.source_public_visible_count,
      visible_product_ids: category.visible_product_ids,
      excluded_product_ids: category.excluded_product_ids,
      excluded_products: category.excluded_products,
      product_links: normalizedProductLinks,
      broken_images: brokenImages,
      broken_links: brokenLinks,
      console_errors: consoleErrors,
      missing_assets: missingAssets,
      formatting_flags: formattingFlags,
      screenshot: screenshots ? `screenshots/desktop-category-${slugify(category.url)}.png` : null,
    })
  } finally {
    await page.close()
  }
}

async function checkInnerPage(browser, baseUrl, innerPage) {
  const { page, consoleErrors } = await newCheckedPage(browser, {
    width: 1440,
    height: 1000,
  })

  try {
    const navigation = await gotoForReport(page, absoluteUrl(baseUrl, innerPage.url))
    const html = await page.content().catch(() => '')
    const h1 = await page.locator('h1').first().innerText({ timeout: 5000 }).catch(() => '')
    const brokenImages = await collectBrokenImages(page, baseUrl).catch(() => [])
    const brokenLinks = await collectBrokenLinks(page, baseUrl).catch(() => [])
    const formattingFlags = detectFormattingFlags(html)
    if (navigation.navigationError) {
      formattingFlags.push(`navigation failed: ${navigation.navigationError}`)
    }
    const evidence = await page.evaluate(() => {
      const headingCounts = {}
      for (const rank of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']) {
        headingCounts[rank] = document.querySelectorAll(rank).length
      }
      const pdfLinks = Array.from(document.querySelectorAll('a[href]'))
        .map((link) => link.getAttribute('href'))
        .filter((href) => href && /\.pdf(\?|#|$)/i.test(href))
      const faqDataCount = document.querySelectorAll('[data-faq-question-id]').length
      const mainH3Count = document.querySelectorAll('main h3').length

      return {
        faq_item_count: faqDataCount || mainH3Count,
        pdf_links: pdfLinks,
        image_count: document.images.length,
        link_count: document.querySelectorAll('a[href]').length,
        heading_counts: headingCounts,
      }
    }).catch(() => ({}))

    return decideInnerPageResult({
      url: innerPage.url,
      expected_status: 200,
      actual_status: navigation.status,
      expected_title_or_h1: innerPage.title,
      actual_title_or_h1: h1,
      expected_product_count: null,
      actual_product_count: null,
      broken_images: brokenImages,
      broken_links: brokenLinks,
      console_errors: consoleErrors,
      missing_assets: [],
      formatting_flags: formattingFlags,
      evidence,
    })
  } finally {
    await page.close()
  }
}

async function checkMenu(browser, baseUrl, expectedCategories, screenshotsDir, screenshots) {
  const desktop = await newCheckedPage(browser, { width: 1440, height: 900 })
  let desktopLinks = []
  let activeShopOnCategory = false
  const formattingFlags = []

  try {
    const desktopNavigation = await gotoForReport(
      desktop.page,
      absoluteUrl(baseUrl, expectedCategories[0].url)
    )
    if (desktopNavigation.status !== 200) {
      formattingFlags.push(
        `desktop menu probe page returned ${desktopNavigation.status ?? 'no response'}`
      )
    }
    if (desktopNavigation.navigationError) {
      formattingFlags.push(`desktop menu navigation failed: ${desktopNavigation.navigationError}`)
    }

    const shopLink = desktop.page.locator('a[href$="/shop"]').filter({ hasText: 'Shop' })
    const shopLinkCount = await shopLink.count().catch(() => 0)
    if (shopLinkCount > 0) {
      await shopLink.first().hover({ timeout: 10000 })
      await desktop.page.waitForTimeout(500)
    } else {
      formattingFlags.push(
        'desktop Shop link not available; target page may be failing before nav render'
      )
    }
    desktopLinks = await desktop.page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href^="/categories/"]'))
        .map((link) => link.getAttribute('href'))
        .filter(Boolean)
    ).catch(() => [])
    activeShopOnCategory = await desktop.page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href="/shop"]')).some((link) =>
        String(link.getAttribute('class') ?? '').includes('border-action-primary')
      )
    ).catch(() => false)
    await saveScreenshot(desktop.page, screenshotsDir, 'desktop-category-menu', screenshots)
  } finally {
    await desktop.page.close()
  }

  const mobile = await newCheckedPage(browser, { width: 390, height: 844 })
  let mobileLinks = []
  let mobileShopAllHref = null

  try {
    const mobileNavigation = await gotoForReport(mobile.page, absoluteUrl(baseUrl, '/'))
    if (mobileNavigation.status !== 200) {
      formattingFlags.push(`mobile menu probe page returned ${mobileNavigation.status ?? 'no response'}`)
    }
    if (mobileNavigation.navigationError) {
      formattingFlags.push(`mobile menu navigation failed: ${mobileNavigation.navigationError}`)
    }
    const mobileButton = mobile.page.locator('button.large\\:hidden')
    const mobileButtonCount = await mobileButton.count().catch(() => 0)
    if (mobileButtonCount > 0) {
      await mobileButton.first().click({ timeout: 10000 })
      await mobile.page.waitForTimeout(500)
    } else {
      formattingFlags.push('mobile menu button not available; target page may be failing before nav render')
    }
    mobileLinks = await mobile.page.evaluate(() =>
      Array.from(document.querySelectorAll('[role="dialog"] a[href^="/categories/"], a[href^="/categories/"]'))
        .map((link) => link.getAttribute('href'))
        .filter(Boolean)
    ).catch(() => [])
    mobileShopAllHref = await mobile.page.evaluate(() => {
      const link = Array.from(document.querySelectorAll('a[href]')).find((candidate) =>
        /shop all/i.test(candidate.textContent ?? '')
      )
      return link?.getAttribute('href') ?? null
    }).catch(() => null)
    await saveScreenshot(mobile.page, screenshotsDir, 'mobile-menu-root', screenshots)
  } finally {
    await mobile.page.close()
  }

  return decideMenuResult({
    expectedCategories,
    desktop_links: [...new Set(desktopLinks)],
    mobile_links: [...new Set(mobileLinks)],
    active_shop_on_category: activeShopOnCategory,
    mobile_shop_all_href: mobileShopAllHref,
    console_errors: [...desktop.consoleErrors, ...mobile.consoleErrors],
    formatting_flags: formattingFlags,
  })
}

async function checkProductPage(browser, baseUrl, productPath, options = {}) {
  const { page, consoleErrors } = await newCheckedPage(browser, {
    width: 1440,
    height: 1000,
  })

  try {
    const navigation = await gotoForReport(page, absoluteUrl(baseUrl, productPath))
    const h1 = await page.locator('h1').first().innerText({ timeout: 5000 }).catch(() => '')
    const brokenImages = await collectBrokenImages(page, baseUrl).catch(() => [])
    const formattingFlags = detectFormattingFlags(await page.content().catch(() => ''))
    if (navigation.navigationError) {
      formattingFlags.push(`navigation failed: ${navigation.navigationError}`)
    }
    const evidence = await page.evaluate(() => {
      const addButton = document.querySelector('[data-testid="add-product-button"]')
      const price = document.querySelector('[data-testid="product-price"]')
      const body = document.body.textContent ?? ''

      return {
        quote_only_ui_detected:
          document.querySelector('[data-testid="quote-only-product"]') !== null ||
          /price on request|requires a quote|request a quote/i.test(body),
        add_to_cart_enabled: addButton ? !addButton.disabled : false,
        add_to_cart_text: addButton?.textContent ?? '',
        displayed_price_text: price?.textContent ?? '',
      }
    }).catch(() => ({}))

    return decideProductClickthroughResult({
      url: productPath,
      source_category_url: options.sourceCategoryUrl,
      opencart_product_id: options.opencartProductId,
      expected_status: 200,
      actual_status: navigation.status,
      expected_title_or_h1: options.expectedH1 ?? 'product page',
      actual_title_or_h1: h1,
      expected_product_count: null,
      actual_product_count: null,
      broken_images: brokenImages,
      broken_links: [],
      console_errors: consoleErrors,
      missing_assets: [],
      formatting_flags: formattingFlags,
      quote_only_expected: Boolean(options.quoteOnlyExpected),
      evidence,
    })
  } finally {
    await page.close()
  }
}

async function checkProductClickthrough(browser, baseUrl, categoryRows, productChecks = []) {
  const rows = []
  const checkedPaths = new Set()

  for (const categoryRow of categoryRows) {
    const firstProduct = categoryRow.product_links?.[0] ?? null
    if (!firstProduct) {
      rows.push({
        url: categoryRow.url,
        expected_status: 200,
        actual_status: null,
        expected_title_or_h1: 'first category product',
        actual_title_or_h1: '',
        expected_product_count: null,
        actual_product_count: null,
        broken_images: [],
        broken_links: [],
        console_errors: [],
        missing_assets: [],
        formatting_flags: ['category has no product link to click through'],
        decision: 'needs_import_fix',
      })
      continue
    }

    checkedPaths.add(firstProduct)
    rows.push(
      await checkProductPage(browser, baseUrl, firstProduct, {
        sourceCategoryUrl: categoryRow.url,
      })
    )
  }

  for (const productCheck of productChecks) {
    if (checkedPaths.has(productCheck.url)) continue

    checkedPaths.add(productCheck.url)
    rows.push(
      await checkProductPage(browser, baseUrl, productCheck.url, {
        opencartProductId: productCheck.opencart_product_id,
        expectedH1: productCheck.expected_h1,
        quoteOnlyExpected: productCheck.quote_only_expected,
      })
    )
  }

  return rows
}

function buildAssetFormattingRows(mediaReport, summaryReport, rawSnapshot, resolutions) {
  const rows = []
  const resolvedRefs = resolvedMediaRefs(resolutions)
  const resolved = resolvedDispositions(resolutions)
  const mediaProblems = (mediaReport.rows ?? []).filter(
    (row) =>
      !resolvedRefs.has(String(row.ref)) &&
      (row.validation_status !== 'pass' ||
        row.cross_domain ||
        row.decision === 'block')
  )

  for (const problem of mediaProblems) {
    rows.push({
      url: `${problem.origin_entity_type}:${problem.origin_entity_id}`,
      expected_status: 200,
      actual_status: problem.http_status ?? null,
      expected_title_or_h1: problem.ref,
      actual_title_or_h1: problem.content_type ?? '',
      expected_product_count: null,
      actual_product_count: null,
      broken_images: problem.validation_status === 'pass' ? [] : [problem.original_url],
      broken_links: [],
      console_errors: [],
      missing_assets: problem.decision === 'block' ? [problem.ref] : [],
      formatting_flags: [
        problem.reason,
        problem.validation_error,
        problem.cross_domain ? 'cross-domain asset requires localize/replace/drop decision' : null,
      ].filter(Boolean),
      decision:
        problem.cross_domain || problem.decision === 'block'
          ? 'needs_content_decision'
          : 'needs_import_fix',
    })
  }

  const zeroPriceProduct = (rawSnapshot.tables?.product ?? []).find(
    (row) => String(row.product_id) === '80' && Number(row.price) === 0
  )
  if (zeroPriceProduct && !resolved.has('quote_only_no_purchase')) {
    rows.push({
      url: 'product:80',
      expected_status: 200,
      actual_status: 200,
      expected_title_or_h1: 'zero-price product disposition',
      actual_title_or_h1: zeroPriceProduct.model,
      expected_product_count: null,
      actual_product_count: null,
      broken_images: [],
      broken_links: [],
      console_errors: [],
      missing_assets: [],
      formatting_flags: ['Product 80 zero-price/quote-only status requires explicit import disposition'],
      decision: 'needs_content_decision',
    })
  }

  const hardStopFlags = summaryReport.hard_stop_flags ?? []
  for (const flag of hardStopFlags.filter((item) => item.includes('demo attribute'))) {
    if (resolved.has('drop_demo_attributes')) continue

    rows.push({
      url: 'attributes',
      expected_status: 200,
      actual_status: 200,
      expected_title_or_h1: 'attribute keep/drop decision',
      actual_title_or_h1: 'demo/test attributes',
      expected_product_count: null,
      actual_product_count: null,
      broken_images: [],
      broken_links: [],
      console_errors: [],
      missing_assets: [],
      formatting_flags: [flag],
      decision: 'needs_content_decision',
    })
  }

  return rows
}

function buildRedirectReadinessRows(routeReport, rawSnapshot) {
  const orphanCount = routeReport.orphan_category_seo_rows?.length ?? 0
  const languageZeroCount = routeReport.language_zero_rows?.length ?? 0
  const dashEnCount = routeReport.dash_en_rows?.length ?? 0
  const redirectManagerCount = Number(rawSnapshot.optional_counts?.oc_redirectManagerTable ?? 0)
  const flags = []

  if (orphanCount) flags.push(`${orphanCount} orphan category SEO rows require disposition`)
  if (languageZeroCount) flags.push(`${languageZeroCount} language_id=0 SEO rows require language decision`)
  if (dashEnCount) flags.push(`${dashEnCount} -en SEO rows require redirect decision`)
  if (redirectManagerCount) flags.push(`${redirectManagerCount} redirectManagerTable rows must be flattened before launch`)

  return [
    {
      url: 'redirect-readiness',
      expected_status: 200,
      actual_status: flags.length === 0 ? 200 : 409,
      expected_title_or_h1: 'standardized Medusa canonical URLs with legacy redirects',
      actual_title_or_h1: routeReport.canonical_policy?.legacy_opencart_seo ?? '',
      expected_product_count: null,
      actual_product_count: null,
      broken_images: [],
      broken_links: [],
      console_errors: [],
      missing_assets: [],
      formatting_flags: flags,
      decision: flags.length === 0 ? 'pass' : 'needs_redirect_decision',
    },
  ]
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (!isSafeVerificationBaseUrl(args.baseUrl)) {
    throw new Error(
      `Refusing to verify against non-staging/non-local target: ${args.baseUrl}`
    )
  }

  const routeReport = await readJson(path.join(args.normalizedDir, 'route-report.json'))
  const mediaReport = await readJson(path.join(args.normalizedDir, 'media-report.json'))
  const summaryReport = await readJson(path.join(args.normalizedDir, 'summary.json'))
  const categoryReconciliation = await readOptionalJson(
    path.join(args.normalizedDir, 'category-reconciliation.json')
  )
  const rawSnapshot = await readJson(args.rawSnapshot)
  const goldenCorpus = await readOptionalJson(args.goldenCorpus)
  const resolutions = await readOptionalJson(args.resolutions)
  const baseline = buildBaseline(rawSnapshot, routeReport, categoryReconciliation)
  const goldenProductChecks = buildGoldenProductChecks(
    rawSnapshot,
    routeReport,
    goldenCorpus
  )
  const screenshotsDir = path.join(args.reportDir, 'screenshots')

  await fs.mkdir(args.reportDir, { recursive: true })

  const mediaProblems = (mediaReport.rows ?? []).filter(
    (row) =>
      !resolvedMediaRefs(resolutions).has(String(row.ref)) &&
      (row.validation_status !== 'pass' ||
        row.cross_domain ||
        row.decision === 'block')
  )

  const browser = await launchBrowser()
  try {
    const categoryRows = []
    for (const category of baseline.categories) {
      categoryRows.push(
        await checkCategory(
          browser,
          args.baseUrl,
          category,
          mediaProblems,
          screenshotsDir,
          args.screenshots
        )
      )
    }

    const menuRows = [
      await checkMenu(
        browser,
        args.baseUrl,
        baseline.categories,
        screenshotsDir,
        args.screenshots
      ),
    ]

    const innerPageRows = []
    for (const innerPage of baseline.innerPages) {
      innerPageRows.push(await checkInnerPage(browser, args.baseUrl, innerPage))
    }

    const productClickthroughRows = await checkProductClickthrough(
      browser,
      args.baseUrl,
      categoryRows,
      goldenProductChecks
    )
    const assetFormattingRows = buildAssetFormattingRows(
      mediaReport,
      summaryReport,
      rawSnapshot,
      resolutions
    )
    const redirectRows = buildRedirectReadinessRows(routeReport, rawSnapshot)

    await writeJson(path.join(args.reportDir, 'category-page-check-report.json'), categoryRows)
    await writeJson(path.join(args.reportDir, 'menu-check-report.json'), menuRows)
    await writeJson(path.join(args.reportDir, 'inner-page-check-report.json'), innerPageRows)
    await writeJson(
      path.join(args.reportDir, 'product-clickthrough-check-report.json'),
      productClickthroughRows
    )
    await writeJson(
      path.join(args.reportDir, 'asset-formatting-check-report.json'),
      assetFormattingRows
    )
    await writeJson(path.join(args.reportDir, 'redirect-readiness-report.json'), redirectRows)

    const markdown = buildReadinessMarkdown({
      baseUrl: args.baseUrl,
      generatedAt: new Date().toISOString(),
      reports: {
        categories: categoryRows,
        menu: menuRows,
        innerPages: innerPageRows,
        productClickthrough: productClickthroughRows,
        assetFormatting: assetFormattingRows,
        redirects: redirectRows,
      },
    })
    await fs.writeFile(path.join(args.reportDir, 'import-readiness-report.md'), markdown, 'utf8')

    console.log(`Jakdor import readiness reports written to ${args.reportDir}`)
  } finally {
    await browser.close()
  }
}

await main()
