const DEFAULT_INTERNAL_COUNTRY_CODE =
  process.env.NEXT_PUBLIC_DEFAULT_REGION || 'gb'

const countryPrefixPattern = new RegExp(
  `^/${DEFAULT_INTERNAL_COUNTRY_CODE}(?=/|$)`,
  'i'
)

export function toPublicPath(href: string) {
  if (!href || href === '#' || /^[a-z][a-z0-9+.-]*:/i.test(href)) {
    return href
  }

  const prefixedHref = href.startsWith('/') ? href : `/${href}`
  const publicHref = prefixedHref.replace(countryPrefixPattern, '')

  return publicHref || '/'
}
