import assert from 'node:assert/strict'

import { chromium } from 'playwright'

const baseUrl = process.env.PUBLIC_BASE_URL ?? 'https://staging.jakdor.co.uk'
const firstFaqId = 'faq-how-long-does-delivery-take'

function absoluteUrl(path) {
  return new URL(path, baseUrl).toString()
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

const browser = await launchBrowser()
const page = await browser.newPage()
const runtimeErrors = []

page.on('console', (message) => {
  if (message.type() === 'error') {
    runtimeErrors.push(message.text())
  }
})

page.on('pageerror', (error) => {
  runtimeErrors.push(error.message)
})

try {
  await page.goto(absoluteUrl('/faq'), { waitUntil: 'networkidle' })

  const jakdorHeadingCount = await page
    .getByRole('heading', { name: 'Jakdor FAQ' })
    .count()
  assert.equal(
    jakdorHeadingCount,
    0,
    'FAQ page still renders Jakdor FAQ heading'
  )

  const bookmark = page.locator(`[data-bookmark-id="${firstFaqId}"]`)
  await bookmark.waitFor({ state: 'visible' })
  await bookmark.hover()

  const bookmarkStyles = await bookmark.evaluate((element) => {
    const styles = element.ownerDocument.defaultView.getComputedStyle(element)

    return {
      borderBottomWidth: styles.borderBottomWidth,
      textDecorationLine: styles.textDecorationLine,
    }
  })

  assert.equal(
    bookmarkStyles.borderBottomWidth,
    '0px',
    `FAQ bookmark has an underline-style border: ${bookmarkStyles.borderBottomWidth}`
  )
  assert.notEqual(
    bookmarkStyles.textDecorationLine,
    'underline',
    'FAQ bookmark hover text decoration is underline'
  )

  await bookmark.click()

  await page.waitForFunction(
    (faqId) =>
      globalThis.document
        .querySelector(`[data-faq-question-id="${faqId}"] button`)
        ?.getAttribute('aria-expanded') === 'true',
    firstFaqId,
    { timeout: 5000 }
  )

  await page.waitForFunction(
    (faqId) => {
      const target = globalThis.document.querySelector(
        `[data-faq-question-id="${faqId}"]`
      )
      const targetTop = Math.round(target?.getBoundingClientRect().top ?? -1)

      return targetTop >= 80 && targetTop <= 140
    },
    firstFaqId,
    { timeout: 5000 }
  )

  const targetTop = await page
    .locator(`[data-faq-question-id="${firstFaqId}"]`)
    .evaluate((element) => Math.round(element.getBoundingClientRect().top))
  assert.equal(
    targetTop >= 80 && targetTop <= 140,
    true,
    `FAQ bookmark landed at ${targetTop}px, expected sticky-header offset`
  )

  assert.deepEqual(
    runtimeErrors,
    [],
    'FAQ interaction emitted console/page errors'
  )
} finally {
  await browser.close()
}

console.log(`FAQ interaction checks passed for ${baseUrl}`)
