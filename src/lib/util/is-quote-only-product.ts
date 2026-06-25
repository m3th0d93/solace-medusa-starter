export function isQuoteOnlyProduct(
  product: { metadata?: Record<string, unknown> | null } | null | undefined
) {
  const value = product?.metadata?.quote_only

  return value === true || value === 'true' || value === 1 || value === '1'
}
