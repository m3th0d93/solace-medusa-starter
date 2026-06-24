import assert from 'node:assert/strict'

const baseUrl = process.env.PUBLIC_BASE_URL ?? 'https://staging.jakdor.co.uk'

function absoluteUrl(path) {
  return new URL(path, baseUrl).toString()
}

async function request(path, options = {}) {
  return fetch(absoluteUrl(path), {
    redirect: 'manual',
    ...options,
  })
}

async function assertStatus(path, expectedStatus, expectedText) {
  const response = await request(path)
  const body = await response.text()

  assert.equal(
    response.status,
    expectedStatus,
    `${path} returned ${response.status}, expected ${expectedStatus}`
  )

  assert.equal(
    body.includes('Application error'),
    false,
    `${path} rendered an application error`
  )

  if (expectedText) {
    assert.equal(
      body.includes(expectedText),
      true,
      `${path} did not include expected text: ${expectedText}`
    )
  }
}

async function assertRedirect(path, expectedLocation) {
  const response = await request(path)
  const location = response.headers.get('location')
  const locationPath = location
    ? new URL(location, baseUrl).pathname + new URL(location, baseUrl).search
    : null

  assert.equal(
    [307, 308].includes(response.status),
    true,
    `${path} returned ${response.status}, expected a redirect`
  )
  assert.equal(
    locationPath,
    expectedLocation,
    `${path} redirected to ${location}`
  )
}

async function assertAsset(path, expectedContentType) {
  const response = await request(path, { method: 'HEAD' })
  const contentType = response.headers.get('content-type') ?? ''

  assert.equal(
    response.status,
    200,
    `${path} returned ${response.status}, expected 200`
  )
  assert.equal(
    contentType.includes(expectedContentType),
    true,
    `${path} content-type ${contentType}, expected ${expectedContentType}`
  )
}

await assertStatus('/', 200)
await assertStatus('/faq', 200, 'How long does delivery take?')
await assertStatus('/shop', 200, 'No products.')
await assertStatus('/terms-and-conditions', 200, 'Content pending')
await assertAsset('/fonts/webfont/WebfontRegular.woff2', 'font/woff2')

await assertRedirect('/gb', '/')
await assertRedirect('/gb/faq', '/faq')
await assertRedirect('/gb/terms-and-conditions', '/terms-and-conditions')

await assertStatus('/gbboobs/faq', 404)
await assertStatus('/xx/faq', 404)

console.log(`Public route checks passed for ${baseUrl}`)
