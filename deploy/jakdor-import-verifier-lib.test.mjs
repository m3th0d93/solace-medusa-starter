import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildBaseline,
  buildReadinessMarkdown,
  decideCategoryResult,
  decideInnerPageResult,
  decideMenuResult,
  detectFormattingFlags,
  isSafeVerificationBaseUrl,
  summarizeDecisions,
} from './jakdor-import-verifier-lib.mjs'

const rawSnapshot = {
  tables: {
    category: [
      { category_id: '33', image: 'catalog/product-36.png', parent_id: '0' },
      { category_id: '18', image: 'catalog/panels/MD.PF.FROpen2.jpg', parent_id: '0' },
    ],
    category_description: [
      { category_id: '33', name: 'Access Panels' },
      { category_id: '18', name: 'Metal Access Panels' },
    ],
    product: [
      { product_id: '1', status: '1' },
      { product_id: '2', status: '1' },
      { product_id: '3', status: '0' },
    ],
    product_to_category: [
      { product_id: '1', category_id: '33' },
      { product_id: '2', category_id: '33' },
      { product_id: '3', category_id: '33' },
      { product_id: '2', category_id: '18' },
    ],
    information_description: [
      { information_id: '10', title: 'FAQ' },
      { information_id: '4', title: 'About' },
    ],
  },
}

const routeReport = {
  canonical_policy: {
    categories: '/categories/<ancestor-handle>/<category-handle>',
    content_pages: '/<standard-page-handle>',
    products: '/products/<medusa-handle>',
    legacy_opencart_seo: 'redirect inputs only, not canonical route requirements',
  },
  categories: {
    33: '/categories/access-panels',
    18: '/categories/metal-access-panels',
  },
  information_pages: {
    10: '/faq',
    4: '/about-us',
  },
}

test('buildBaseline derives category routes, names, and enabled product counts', () => {
  const baseline = buildBaseline(rawSnapshot, routeReport)

  assert.deepEqual(baseline.categories, [
    {
      category_id: '18',
      expected_h1: 'Metal Access Panels',
      expected_product_count: 1,
      source_linked_count: 1,
      source_public_visible_count: 1,
      visible_product_ids: [2],
      excluded_product_ids: [],
      excluded_products: [],
      image: 'catalog/panels/MD.PF.FROpen2.jpg',
      parent_id: '0',
      url: '/categories/metal-access-panels',
    },
    {
      category_id: '33',
      expected_h1: 'Access Panels',
      expected_product_count: 2,
      source_linked_count: 3,
      source_public_visible_count: 2,
      visible_product_ids: [1, 2],
      excluded_product_ids: [3],
      excluded_products: [],
      image: 'catalog/product-36.png',
      parent_id: '0',
      url: '/categories/access-panels',
    },
  ])

  assert.deepEqual(baseline.innerPages, [
    { information_id: '4', title: 'About', url: '/about-us' },
    { information_id: '10', title: 'FAQ', url: '/faq' },
  ])
})

test('buildBaseline uses category reconciliation public-visible counts and keeps exclusion evidence', () => {
  const categoryReconciliation = {
    rows: [
      {
        category_id: 33,
        category_name: 'Access Panels',
        source_linked_count: 3,
        source_public_visible_count: 2,
        linked_product_ids: [1, 2, 3],
        visible_product_ids: [1, 2],
        excluded_product_ids: [3],
        excluded_products: [
          {
            product_id: 3,
            name: 'Hidden panel',
            model: 'HIDDEN',
            reasons: ['missing_language_1_description'],
          },
        ],
      },
    ],
  }

  const baseline = buildBaseline(rawSnapshot, routeReport, categoryReconciliation)
  const accessPanels = baseline.categories.find((category) => category.category_id === '33')

  assert.equal(accessPanels.expected_product_count, 2)
  assert.equal(accessPanels.source_linked_count, 3)
  assert.equal(accessPanels.source_public_visible_count, 2)
  assert.deepEqual(accessPanels.visible_product_ids, [1, 2])
  assert.deepEqual(accessPanels.excluded_product_ids, [3])
  assert.deepEqual(accessPanels.excluded_products, [
    {
      product_id: 3,
      name: 'Hidden panel',
      model: 'HIDDEN',
      reasons: ['missing_language_1_description'],
    },
  ])
})

test('decideCategoryResult requires exact status, h1, product count, links, images, and explicit missing image decision', () => {
  const pass = decideCategoryResult({
    url: '/categories/metal-access-panels',
    expected_status: 200,
    actual_status: 200,
    expected_title_or_h1: 'Metal Access Panels',
    actual_title_or_h1: 'Metal Access Panels',
    expected_product_count: 1,
    actual_product_count: 1,
    product_links: ['/products/metal-door-access-panel'],
    broken_images: [],
    broken_links: [],
    console_errors: [],
    missing_assets: [],
    formatting_flags: [],
  })

  assert.equal(pass.decision, 'pass')

  const blocked = decideCategoryResult({
    ...pass,
    url: '/categories/access-panels',
    expected_title_or_h1: 'Access Panels',
    actual_title_or_h1: 'Access Panels',
    expected_product_count: 17,
    actual_product_count: 17,
    missing_assets: ['catalog/product-36.png'],
  })

  assert.equal(blocked.decision, 'needs_content_decision')
  assert.deepEqual(blocked.formatting_flags, [
    'missing category image requires explicit decision: catalog/product-36.png',
  ])
})

test('detectFormattingFlags catches unresolved asset and OpenCart residue markers', () => {
  const flags = detectFormattingFlags(`
    <h1>Â£ broken</h1>
    <img src="https://jakdor.co.uk/image/cache/catalog/foo-100x100.jpg">
    <img src="asset://missing-key">
    <img src="https://accesspanelsdirect.net/image/catalog/icons/roofhatch.jpg">
    &lt;table&gt;
  `)

  assert.deepEqual(flags, [
    'mojibake marker: Â',
    'raw escaped html marker: &lt;',
    'legacy image host remains: jakdor.co.uk/image',
    'OpenCart cache path remains: /image/cache',
    'cross-domain APD asset remains: accesspanelsdirect.net',
    'unresolved asset token remains: asset://',
  ])
})

test('isSafeVerificationBaseUrl allows staging and local targets but rejects live Jakdor', () => {
  assert.equal(isSafeVerificationBaseUrl('https://staging.jakdor.co.uk'), true)
  assert.equal(isSafeVerificationBaseUrl('http://localhost:8000'), true)
  assert.equal(isSafeVerificationBaseUrl('http://127.0.0.1:8000'), true)
  assert.equal(isSafeVerificationBaseUrl('https://jakdor.co.uk'), false)
})

test('summarizeDecisions returns blocked when any report row needs action', () => {
  assert.equal(
    summarizeDecisions([
      { decision: 'pass' },
      { decision: 'needs_redirect_decision' },
    ]),
    'blocked'
  )
  assert.equal(summarizeDecisions([{ decision: 'pass' }]), 'pass')
})

test('decideInnerPageResult flags missing imported pages as redirect/content decisions', () => {
  const delivery = decideInnerPageResult({
    url: '/delivery',
    expected_status: 200,
    actual_status: 404,
    expected_title_or_h1: 'Delivery Information',
    actual_title_or_h1: '',
    broken_images: [],
    broken_links: [],
    console_errors: [],
    missing_assets: [],
    formatting_flags: [],
    evidence: {},
  })

  assert.equal(delivery.decision, 'needs_redirect_decision')

  const faq = decideInnerPageResult({
    url: '/faq',
    expected_status: 200,
    actual_status: 200,
    expected_title_or_h1: 'FAQ',
    actual_title_or_h1: 'FAQ',
    broken_images: [],
    broken_links: [],
    console_errors: [],
    missing_assets: [],
    formatting_flags: [],
    evidence: {
      faq_item_count: 5,
      pdf_links: ['/media/Fittinginstructions.pdf'],
    },
  })

  assert.equal(faq.decision, 'pass')

  const weakFaq = decideInnerPageResult({
    ...faq,
    evidence: {
      faq_item_count: 4,
      pdf_links: [],
    },
  })

  assert.equal(weakFaq.decision, 'needs_import_fix')
  assert.deepEqual(weakFaq.formatting_flags, [
    'FAQ expected 5 Q&A items, found 4',
    'FAQ fitting instructions PDF link missing',
  ])
})

test('decideMenuResult requires desktop and mobile canonical category links', () => {
  const expectedCategories = [
    { url: '/categories/access-panels', expected_h1: 'Access Panels' },
    { url: '/categories/metal-access-panels', expected_h1: 'Metal Access Panels' },
  ]

  const result = decideMenuResult({
    expectedCategories,
    desktop_links: ['/categories/access-panels'],
    mobile_links: [
      '/categories/access-panels',
      '/categories/metal-access-panels',
    ],
    active_shop_on_category: true,
    mobile_shop_all_href: '/shop',
    console_errors: [],
  })

  assert.equal(result.decision, 'needs_import_fix')
  assert.deepEqual(result.missing_links, {
    desktop: ['/categories/metal-access-panels'],
    mobile: [],
  })
})

test('decideMenuResult preserves menu collection errors as import failures', () => {
  const result = decideMenuResult({
    expectedCategories: [
      { url: '/categories/access-panels', expected_h1: 'Access Panels' },
    ],
    desktop_links: [],
    mobile_links: [],
    active_shop_on_category: false,
    mobile_shop_all_href: null,
    console_errors: [],
    formatting_flags: ['desktop Shop link not available; target page may be failing before nav render'],
  })

  assert.equal(result.decision, 'needs_import_fix')
  assert.equal(
    result.formatting_flags.includes(
      'desktop Shop link not available; target page may be failing before nav render'
    ),
    true
  )
})

test('buildReadinessMarkdown produces a concise blocker summary', () => {
  const markdown = buildReadinessMarkdown({
    baseUrl: 'https://staging.jakdor.co.uk',
    generatedAt: '2026-06-25T09:00:00.000Z',
    reports: {
      categories: [{ decision: 'pass' }],
      menu: [{ decision: 'needs_import_fix', missing_links: { desktop: ['/categories/access-panels'] } }],
      innerPages: [{ decision: 'needs_redirect_decision', url: '/delivery' }],
      productClickthrough: [],
      assetFormatting: [{ decision: 'needs_content_decision', formatting_flags: ['Product 75 hotlink unresolved'] }],
      redirects: [{ decision: 'needs_redirect_decision', formatting_flags: ['20 orphan category SEO rows'] }],
    },
  })

  assert.match(markdown, /# Jakdor Import Readiness Report/)
  assert.match(markdown, /Overall decision: blocked/)
  assert.match(markdown, /Product 75 hotlink unresolved/)
  assert.match(markdown, /\/delivery/)
})
