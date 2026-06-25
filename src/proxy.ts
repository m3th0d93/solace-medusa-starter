import { NextRequest, NextResponse } from 'next/server'

import { sdk } from '@lib/config'
import { HttpTypes } from '@medusajs/types'

const BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL
const PUBLISHABLE_API_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
const DEFAULT_REGION = process.env.NEXT_PUBLIC_DEFAULT_REGION || 'gb'

const PUBLIC_ROUTE_PREFIXES = new Set([
  '',
  'about-us',
  'account',
  'blog',
  'cart',
  'categories',
  'checkout',
  'collections',
  'faq',
  'order',
  'privacy-policy',
  'products',
  'reset-password',
  'results',
  'shop',
  'terms-and-conditions',
])

const STATIC_ROUTE_PREFIXES = new Set(['fonts'])
const TOP_LEVEL_COMMERCE_PREFIXES = new Set(['categories', 'products'])

const regionMapCache = {
  regionMap: new Map<string, HttpTypes.StoreRegion>(),
  regionMapUpdated: Date.now(),
}

async function getRegionMap() {
  const { regionMap, regionMapUpdated } = regionMapCache

  if (
    !regionMap.keys().next().value ||
    regionMapUpdated < Date.now() - 3600 * 1000
  ) {
    try {
      if (!BACKEND_URL || !PUBLISHABLE_API_KEY) {
        throw new Error(
          'Missing NEXT_PUBLIC_MEDUSA_BACKEND_URL or NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY'
        )
      }

      const { regions } = await sdk.store.region.list()

      if (!regions?.length) {
        throw new Error('No regions configured in Medusa backend')
      }

      regions.forEach((region: HttpTypes.StoreRegion) => {
        region.countries?.forEach((c) => {
          regionMapCache.regionMap.set(c.iso_2 ?? '', region)
        })
      })

      regionMapCache.regionMapUpdated = Date.now()
    } catch (error) {
      throw new Error('Error fetching regions', error)
    }
  }

  return regionMapCache.regionMap
}

/**
 * Fetches regions from Medusa and sets the region cookie.
 * @param request
 * @param response
 */
function getCountryCode(
  request: NextRequest,
  regionMap: Map<string, HttpTypes.StoreRegion | number>
) {
  try {
    let countryCode

    const vercelCountryCode = request.headers
      .get('x-vercel-ip-country')
      ?.toLowerCase()

    const urlCountryCode = request.nextUrl.pathname.split('/')[1]?.toLowerCase()

    if (urlCountryCode && regionMap.has(urlCountryCode)) {
      countryCode = urlCountryCode
    } else if (vercelCountryCode && regionMap.has(vercelCountryCode)) {
      countryCode = vercelCountryCode
    } else if (regionMap.has(DEFAULT_REGION)) {
      countryCode = DEFAULT_REGION
    } else if (regionMap.keys().next().value) {
      countryCode = regionMap.keys().next().value
    }

    return countryCode
  } catch (error) {
    throw new Error('Error getting the country code', error)
  }
}

/**
 * Proxy to handle region selection and onboarding status.
 */
export async function proxy(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const isOnboarding = searchParams.get('onboarding') === 'true'
  const cartId = searchParams.get('cart_id')
  const checkoutStep = searchParams.get('step')
  const onboardingCookie = request.cookies.get('_medusa_onboarding')
  const cartIdCookie = request.cookies.get('_medusa_cart_id')
  const pathSegments = request.nextUrl.pathname.split('/').filter(Boolean)
  const firstPathSegment = pathSegments[0]?.toLowerCase() ?? ''

  if (request.nextUrl.pathname === '/metal-access-panels-en') {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/categories/metal-access-panels'
    return NextResponse.redirect(redirectUrl, 301)
  }

  if (request.nextUrl.pathname === '/macs') {
    return new NextResponse('Gone', { status: 410 })
  }

  if (STATIC_ROUTE_PREFIXES.has(firstPathSegment)) {
    return NextResponse.next()
  }

  if (TOP_LEVEL_COMMERCE_PREFIXES.has(firstPathSegment)) {
    return NextResponse.next()
  }

  const regionMap = await getRegionMap()

  const countryCode = regionMap && (await getCountryCode(request, regionMap))
  const urlHasCountryCode =
    firstPathSegment !== '' && regionMap.has(firstPathSegment)
  const cleanPath =
    urlHasCountryCode && pathSegments.length > 1
      ? `/${pathSegments.slice(1).join('/')}`
      : '/'

  if (!urlHasCountryCode && !PUBLIC_ROUTE_PREFIXES.has(firstPathSegment)) {
    return new NextResponse(null, { status: 404 })
  }

  let response: NextResponse

  if (urlHasCountryCode) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = cleanPath
    response = NextResponse.redirect(redirectUrl, 308)
  } else if (countryCode) {
    const rewriteUrl = request.nextUrl.clone()
    rewriteUrl.pathname = `/${countryCode}${
      request.nextUrl.pathname === '/' ? '' : request.nextUrl.pathname
    }`
    response = NextResponse.rewrite(rewriteUrl)
  } else {
    response = NextResponse.next()
  }

  if (
    !urlHasCountryCode &&
    (!isOnboarding || onboardingCookie) &&
    (!cartId || cartIdCookie)
  ) {
    return response
  }

  // If a cart_id is in the params, we set it as a cookie and redirect to the address step.
  if (cartId && !checkoutStep) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = cleanPath
    redirectUrl.searchParams.set('step', 'address')
    response = NextResponse.redirect(redirectUrl, 307)
    response.cookies.set('_medusa_cart_id', cartId, { maxAge: 60 * 60 * 24 })
  }

  // Set a cookie to indicate that we're onboarding. This is used to show the onboarding flow.
  if (isOnboarding) {
    response.cookies.set('_medusa_onboarding', 'true', {
      maxAge: 60 * 60 * 24,
    })
  }

  return response
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|fonts|.*\\..*).*)'],
}
