import { Box } from '@modules/common/components/box'
import { Text } from '@modules/common/components/text'

export default function ProductPrice({
  calculatedPrice,
  salePrice,
  quoteOnly,
}: {
  calculatedPrice: string
  salePrice: string
  quoteOnly?: boolean
}) {
  if (quoteOnly) {
    return (
      <Box className="flex items-center justify-center gap-2">
        <Text className="font-bold text-basic-primary" size="lg">
          Price on request
        </Text>
      </Box>
    )
  }

  if (!calculatedPrice) {
    return null
  }

  return (
    <Box className="flex items-center justify-center gap-2">
      {salePrice !== calculatedPrice && (
        <Text size="md" className="text-secondary line-through">
          {salePrice}
        </Text>
      )}
      <Text className="font-bold text-basic-primary" size="lg">
        {calculatedPrice}
      </Text>
    </Box>
  )
}
