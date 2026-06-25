import { getProductPrice } from '@lib/util/get-product-price'
import { isQuoteOnlyProduct } from '@lib/util/is-quote-only-product'
import { StoreProduct } from '@medusajs/types'
import { Box } from '@modules/common/components/box'
import { Button } from '@modules/common/components/button'
import { Container } from '@modules/common/components/container'
import LocalizedClientLink from '@modules/common/components/localized-client-link'

import { ProductTile } from '../product-tile'
import CarouselWrapper from './carousel-wrapper'

interface ViewAllProps {
  link: string
  text?: string
}

interface ProductCarouselProps {
  products: StoreProduct[]
  regionId: string
  title: string
  viewAll?: ViewAllProps
  testId?: string
}

export function ProductCarousel({
  products,
  regionId,
  title,
  viewAll,
  testId,
}: ProductCarouselProps) {
  const pricedProducts = products.flatMap((item) => {
    const cheapestVariant = getProductPrice({
      product: item,
    })

    if (!cheapestVariant.cheapestPrice) {
      return []
    }

    return [{ item, cheapestVariant }]
  })

  if (!pricedProducts.length) {
    return null
  }

  return (
    <Container className="overflow-hidden" data-testid={testId}>
      <Box className="flex flex-col gap-6 small:gap-12">
        <CarouselWrapper title={title} productsCount={pricedProducts.length}>
          <Box className="flex gap-2">
            {pricedProducts.map(({ item, cheapestVariant }, index) => {
              return (
                <Box
                  className="flex-[0_0_calc(72.666%-8px)] small:flex-[0_0_calc(62.666%-8px)] medium:flex-[0_0_calc(42.666%-8px)] xl:flex-[0_0_calc(33.333%-8px)] 2xl:flex-[0_0_calc(30.333%-8px)]"
                  key={index}
                >
                  <ProductTile
                    product={{
                      id: item.id,
                      created_at: item.created_at,
                      title: item.title,
                      handle: item.handle,
                      thumbnail: item.thumbnail,
                      calculatedPrice:
                        cheapestVariant.cheapestPrice.calculated_price,
                      salePrice: cheapestVariant.cheapestPrice.original_price,
                      quoteOnly: isQuoteOnlyProduct(item),
                    }}
                    regionId={regionId}
                  />
                </Box>
              )
            })}
          </Box>
        </CarouselWrapper>
        {viewAll && (
          <Button asChild>
            <LocalizedClientLink
              href={viewAll.link}
              className="mx-auto w-max !px-5 !py-3"
            >
              {viewAll.text || 'View all'}
            </LocalizedClientLink>
          </Button>
        )}
      </Box>
    </Container>
  )
}
