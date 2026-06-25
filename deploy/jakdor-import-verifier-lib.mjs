export const DECISIONS = new Set([
  'pass',
  'needs_import_fix',
  'needs_content_decision',
  'needs_redirect_decision',
  'blocked',
])

const MOJIBAKE_MARKERS = ['Â', 'Ã‚', 'â€']

export function isSafeVerificationBaseUrl(baseUrl) {
  let url
  try {
    url = new URL(baseUrl)
  } catch {
    return false
  }

  return (
    url.hostname === 'staging.jakdor.co.uk' ||
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.hostname.endsWith('.local')
  )
}

export function buildBaseline(rawSnapshot, routeReport, categoryReconciliation = null) {
  const rawTables = rawSnapshot.tables ?? {}
  const categoryDescriptions = new Map(
    (rawTables.category_description ?? []).map((row) => [
      String(row.category_id),
      row,
    ])
  )
  const enabledProducts = new Set(
    (rawTables.product ?? [])
      .filter((row) => String(row.status) === '1')
      .map((row) => String(row.product_id))
  )
  const linkedProductIdsByCategory = new Map()
  const fallbackVisibleProductIdsByCategory = new Map()

  for (const row of rawTables.product_to_category ?? []) {
    const productId = String(row.product_id)
    const categoryId = String(row.category_id)
    if (!linkedProductIdsByCategory.has(categoryId)) {
      linkedProductIdsByCategory.set(categoryId, new Set())
    }
    linkedProductIdsByCategory.get(categoryId).add(productId)

    if (enabledProducts.has(productId)) {
      if (!fallbackVisibleProductIdsByCategory.has(categoryId)) {
        fallbackVisibleProductIdsByCategory.set(categoryId, new Set())
      }
      fallbackVisibleProductIdsByCategory.get(categoryId).add(productId)
    }
  }

  const categoriesById = new Map(
    (rawTables.category ?? []).map((row) => [String(row.category_id), row])
  )
  const reconciliationByCategoryId = new Map(
    (categoryReconciliation?.rows ?? []).map((row) => [
      String(row.category_id),
      row,
    ])
  )

  const categories = Object.entries(routeReport.categories ?? {})
    .map(([categoryId, url]) => {
      const id = String(categoryId)
      const category = categoriesById.get(id) ?? {}
      const description = categoryDescriptions.get(id) ?? {}
      const reconciliation = reconciliationByCategoryId.get(id)
      const fallbackLinkedProductIds = [
        ...(linkedProductIdsByCategory.get(id) ?? []),
      ].map((productId) => Number(productId))
      const fallbackVisibleProductIds = [
        ...(fallbackVisibleProductIdsByCategory.get(id) ?? []),
      ].map((productId) => Number(productId))
      const sourceLinkedCount =
        reconciliation?.source_linked_count ?? fallbackLinkedProductIds.length
      const sourcePublicVisibleCount =
        reconciliation?.source_public_visible_count ?? fallbackVisibleProductIds.length
      const visibleProductIds =
        reconciliation?.visible_product_ids ?? fallbackVisibleProductIds
      const excludedProductIds =
        reconciliation?.excluded_product_ids ??
        fallbackLinkedProductIds.filter((productId) => !fallbackVisibleProductIds.includes(productId))

      return {
        category_id: id,
        expected_h1: description.name ?? '',
        expected_product_count: sourcePublicVisibleCount,
        source_linked_count: sourceLinkedCount,
        source_public_visible_count: sourcePublicVisibleCount,
        visible_product_ids: visibleProductIds,
        excluded_product_ids: excludedProductIds,
        excluded_products: reconciliation?.excluded_products ?? [],
        image: category.image ?? '',
        parent_id: String(category.parent_id ?? ''),
        url,
      }
    })
    .sort((a, b) => Number(a.category_id) - Number(b.category_id))

  const infoDescriptions = new Map(
    (rawTables.information_description ?? []).map((row) => [
      String(row.information_id),
      row,
    ])
  )

  const innerPages = Object.entries(routeReport.information_pages ?? {})
    .map(([informationId, url]) => ({
      information_id: String(informationId),
      title: infoDescriptions.get(String(informationId))?.title ?? '',
      url,
    }))
    .sort((a, b) => Number(a.information_id) - Number(b.information_id))

  return {
    canonical_policy: routeReport.canonical_policy ?? {},
    categories,
    innerPages,
  }
}

export function detectFormattingFlags(html) {
  const body = String(html ?? '')
  const flags = []

  for (const marker of MOJIBAKE_MARKERS) {
    if (body.includes(marker)) {
      flags.push(`mojibake marker: ${marker}`)
      break
    }
  }

  if (body.includes('&lt;')) {
    flags.push('raw escaped html marker: &lt;')
  }

  if (body.includes('jakdor.co.uk/image')) {
    flags.push('legacy image host remains: jakdor.co.uk/image')
  }

  if (body.includes('/image/cache')) {
    flags.push('OpenCart cache path remains: /image/cache')
  }

  if (body.includes('accesspanelsdirect.net')) {
    flags.push('cross-domain APD asset remains: accesspanelsdirect.net')
  }

  if (body.includes('asset://')) {
    flags.push('unresolved asset token remains: asset://')
  }

  return flags
}

export function decideCategoryResult(result) {
  const next = {
    ...result,
    broken_images: [...(result.broken_images ?? [])],
    broken_links: [...(result.broken_links ?? [])],
    console_errors: [...(result.console_errors ?? [])],
    missing_assets: [...(result.missing_assets ?? [])],
    formatting_flags: [...(result.formatting_flags ?? [])],
  }

  if (
    next.url === '/categories/access-panels' &&
    next.missing_assets.includes('catalog/product-36.png')
  ) {
    next.formatting_flags.push(
      'missing category image requires explicit decision: catalog/product-36.png'
    )
    next.decision = 'needs_content_decision'
    return next
  }

  if (next.actual_status !== next.expected_status) {
    next.decision = 'needs_import_fix'
    return next
  }

  if (
    normalizeText(next.actual_title_or_h1) !==
    normalizeText(next.expected_title_or_h1)
  ) {
    next.decision = 'needs_import_fix'
    return next
  }

  if (next.actual_product_count !== next.expected_product_count) {
    next.decision = 'needs_import_fix'
    return next
  }

  if ((next.product_links ?? []).length === 0) {
    next.decision = 'needs_import_fix'
    return next
  }

  if (
    next.broken_images.length > 0 ||
    next.broken_links.length > 0 ||
    next.console_errors.length > 0 ||
    next.missing_assets.length > 0 ||
    next.formatting_flags.length > 0
  ) {
    next.decision = 'needs_import_fix'
    return next
  }

  next.decision = 'pass'
  return next
}

export function decideInnerPageResult(result) {
  const next = {
    ...result,
    broken_images: [...(result.broken_images ?? [])],
    broken_links: [...(result.broken_links ?? [])],
    console_errors: [...(result.console_errors ?? [])],
    missing_assets: [...(result.missing_assets ?? [])],
    formatting_flags: [...(result.formatting_flags ?? [])],
    evidence: result.evidence ?? {},
  }

  if (
    ['/delivery', '/cookies', '/failure'].includes(next.url) &&
    next.actual_status === 404
  ) {
    next.decision = 'needs_redirect_decision'
    return next
  }

  if (next.url === '/faq') {
    const faqItemCount = Number(next.evidence.faq_item_count ?? 0)
    const pdfLinks = next.evidence.pdf_links ?? []

    if (faqItemCount !== 5) {
      next.formatting_flags.push(`FAQ expected 5 Q&A items, found ${faqItemCount}`)
    }

    if (!pdfLinks.some((link) => String(link).includes('Fittinginstructions.pdf'))) {
      next.formatting_flags.push('FAQ fitting instructions PDF link missing')
    }
  }

  if (next.actual_status !== next.expected_status) {
    next.decision = 'needs_import_fix'
    return next
  }

  if (
    next.broken_images.length > 0 ||
    next.broken_links.length > 0 ||
    next.console_errors.length > 0 ||
    next.missing_assets.length > 0 ||
    next.formatting_flags.length > 0
  ) {
    next.decision = 'needs_import_fix'
    return next
  }

  next.decision = 'pass'
  return next
}

export function decideProductClickthroughResult(result) {
  const next = {
    ...result,
    broken_images: [...(result.broken_images ?? [])],
    broken_links: [...(result.broken_links ?? [])],
    console_errors: [...(result.console_errors ?? [])],
    missing_assets: [...(result.missing_assets ?? [])],
    formatting_flags: [...(result.formatting_flags ?? [])],
    evidence: result.evidence ?? {},
  }

  if (next.quote_only_expected) {
    const addToCartText = normalizeText(next.evidence.add_to_cart_text)
    const displayedPriceText = normalizeText(next.evidence.displayed_price_text)

    if (!next.evidence.quote_only_ui_detected) {
      next.formatting_flags.push('quote-only product UI marker missing')
    }

    if (next.evidence.add_to_cart_enabled) {
      next.formatting_flags.push(
        'quote-only product exposes enabled add-to-cart control'
      )
    }

    if (/add to cart/i.test(addToCartText)) {
      next.formatting_flags.push(
        'quote-only product still labels checkout control as Add to cart'
      )
    }

    if (/£\s*0(?:\.00)?\b|GBP\s*0(?:\.00)?\b|\b0\.00\b/i.test(displayedPriceText)) {
      next.formatting_flags.push('quote-only product renders a zero price')
    }
  }

  if (next.actual_status !== next.expected_status) {
    next.decision = 'needs_import_fix'
    return next
  }

  if (
    next.broken_images.length > 0 ||
    next.broken_links.length > 0 ||
    next.console_errors.length > 0 ||
    next.missing_assets.length > 0 ||
    next.formatting_flags.length > 0
  ) {
    next.decision = 'needs_import_fix'
    return next
  }

  next.decision = 'pass'
  return next
}

export function decideMenuResult(result) {
  const expectedUrls = result.expectedCategories.map((category) => category.url)
  const desktopLinks = new Set(result.desktop_links ?? [])
  const mobileLinks = new Set(result.mobile_links ?? [])
  const missingLinks = {
    desktop: expectedUrls.filter((url) => !desktopLinks.has(url)),
    mobile: expectedUrls.filter((url) => !mobileLinks.has(url)),
  }
  const formattingFlags = [...(result.formatting_flags ?? [])]

  if (!result.active_shop_on_category) {
    formattingFlags.push('desktop Shop active state missing on category page')
  }

  if (result.mobile_shop_all_href !== '/shop') {
    formattingFlags.push(`mobile Shop all href expected /shop, got ${result.mobile_shop_all_href ?? ''}`)
  }

  const decision =
    missingLinks.desktop.length > 0 ||
    missingLinks.mobile.length > 0 ||
    formattingFlags.length > 0 ||
    (result.console_errors ?? []).length > 0
      ? 'needs_import_fix'
      : 'pass'

  return {
    url: 'menu',
    expected_status: 200,
    actual_status: 200,
    expected_title_or_h1: 'Shop menu category links',
    actual_title_or_h1: 'Shop menu category links',
    expected_product_count: expectedUrls.length,
    actual_product_count: Math.min(desktopLinks.size, mobileLinks.size),
    broken_images: [],
    broken_links: [...missingLinks.desktop, ...missingLinks.mobile],
    console_errors: [...(result.console_errors ?? [])],
    missing_assets: [],
    formatting_flags: formattingFlags,
    missing_links: missingLinks,
    mobile_shop_all_href: result.mobile_shop_all_href,
    active_shop_on_category: Boolean(result.active_shop_on_category),
    decision,
  }
}

export function summarizeDecisions(rows) {
  return rows.every((row) => row.decision === 'pass') ? 'pass' : 'blocked'
}

export function buildReadinessMarkdown({ baseUrl, generatedAt, reports }) {
  const sections = [
    ['Category pages', reports.categories ?? []],
    ['Menus', reports.menu ?? []],
    ['Inner pages', reports.innerPages ?? []],
    ['Product clickthrough', reports.productClickthrough ?? []],
    ['Assets and formatting', reports.assetFormatting ?? []],
    ['Redirect readiness', reports.redirects ?? []],
  ]
  const allRows = sections.flatMap(([, rows]) => rows)
  const overall = summarizeDecisions(allRows)
  const lines = [
    '# Jakdor Import Readiness Report',
    '',
    `Generated: ${generatedAt}`,
    `Target: ${baseUrl}`,
    `Overall decision: ${overall}`,
    '',
  ]

  for (const [title, rows] of sections) {
    lines.push(`## ${title}`)
    if (rows.length === 0) {
      lines.push('- No rows produced.')
      lines.push('')
      continue
    }

    for (const row of rows) {
      lines.push(`- ${row.decision}: ${row.url ?? title}`)
      for (const flag of row.formatting_flags ?? []) {
        lines.push(`  - ${flag}`)
      }
      for (const missing of row.missing_assets ?? []) {
        lines.push(`  - missing asset: ${missing}`)
      }
      for (const link of row.broken_links ?? []) {
        lines.push(`  - link issue: ${link}`)
      }
      if (row.missing_links) {
        for (const missing of row.missing_links.desktop ?? []) {
          lines.push(`  - desktop menu missing: ${missing}`)
        }
        for (const missing of row.missing_links.mobile ?? []) {
          lines.push(`  - mobile menu missing: ${missing}`)
        }
      }
    }
    lines.push('')
  }

  return `${lines.join('\n').trimEnd()}\n`
}

export function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}
