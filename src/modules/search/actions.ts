import { safeDecodeURIComponent } from '@lib/util/safe-decode-uri'
import { sdk } from '@lib/config'
import { HttpTypes } from '@medusajs/types'
import { SearchedProducts } from 'types/global'

export const BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL
export const PUBLISHABLE_API_KEY =
  process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY

export const PRODUCT_LIMIT = 12

type SearchParams = {
  currency_code: string
  region_id: string
  page?: number
  order?: string
  category_id?: string
  collection?: string[]
  type?: string[]
  material?: string[]
  price?: string[]
  query?: string
}

export async function search({
  currency_code,
  region_id,
  page,
  order = 'relevance',
  category_id,
  collection,
  type,
  material,
  price,
  query,
}: SearchParams): Promise<SearchedProducts> {
  const pageNumber = page ?? 1
  const sortBy =
    order === 'price_asc'
      ? 'calculated_price'
      : order === 'price_desc'
        ? '-calculated_price'
        : order === 'created_at'
          ? '-created_at'
          : order

  const searchParams = new URLSearchParams({
    currency_code,
    region_id,
    order: sortBy,
    offset: ((pageNumber - 1) * PRODUCT_LIMIT).toString(),
    limit: PRODUCT_LIMIT.toString(),
  })

  if (category_id) {
    searchParams.append('category_id[]', category_id)
  }

  if (collection && Array.isArray(collection)) {
    collection.forEach((id) => {
      searchParams.append('collection_id[]', id)
    })
  }

  if (type && Array.isArray(type)) {
    type.forEach((id) => {
      searchParams.append('type_id[]', id)
    })
  }

  if (material && Array.isArray(material)) {
    material.forEach((id) => {
      searchParams.append('materials[]', id)
    })
  }

  if (price && Array.isArray(price)) {
    price.forEach((range) => {
      switch (range) {
        case 'under-100':
          searchParams.append('price_to', '100')
          break
        case '100-500':
          searchParams.append('price_from', '100')
          searchParams.append('price_to', '500')
          break
        case '501-1000':
          searchParams.append('price_from', '501')
          searchParams.append('price_to', '1000')
          break
        case 'more-than-1000':
          searchParams.append('price_from', '1000')
          break
      }
    })
  }

  if (query) {
    searchParams.append('q', safeDecodeURIComponent(query))
  }

  try {
    const response = await fetch(
      `${BACKEND_URL}/store/search?${searchParams.toString()}`,
      {
        headers: {
          'x-publishable-api-key': PUBLISHABLE_API_KEY!,
        },
        cache: 'no-store',
      }
    )

    if (response.ok) {
      const contentType = response.headers.get('content-type') ?? ''

      if (contentType.includes('application/json')) {
        const data = await response.json()

        return {
          results: data.products,
          count: data.products.length,
        }
      }
    }
  } catch {
    // Fall back to Medusa's core Store API below.
  }

  const queryParams: HttpTypes.FindParams & HttpTypes.StoreProductParams = {
    limit: PRODUCT_LIMIT,
    offset: (pageNumber - 1) * PRODUCT_LIMIT,
    region_id,
    fields:
      '*variants.calculated_price,+variants.inventory_quantity,*variants,*variants.prices,*categories,+metadata',
  }

  if (sortBy === '-created_at') {
    queryParams.order = sortBy
  }

  if (category_id) {
    queryParams.category_id = [category_id]
  }

  if (collection?.length) {
    queryParams.collection_id = collection
  }

  if (query) {
    queryParams.q = safeDecodeURIComponent(query)
  }

  const { products, count } = await sdk.store.product.list(queryParams, {
    cache: 'no-store',
  })

  return {
    results: products,
    count: count ?? products.length,
  }
}
