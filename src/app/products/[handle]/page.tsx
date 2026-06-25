import ProductPage, {
  generateMetadata as generateLocalizedMetadata,
} from '../../[countryCode]/(main)/products/[handle]/page'

const DEFAULT_REGION = process.env.NEXT_PUBLIC_DEFAULT_REGION || 'gb'

type Props = {
  params: Promise<{ handle: string }>
}

export const dynamic = 'force-dynamic'

function withDefaultRegion(params: Props['params']) {
  return params.then(({ handle }) => ({
    countryCode: DEFAULT_REGION,
    handle,
  }))
}

export async function generateMetadata(props: Props) {
  return generateLocalizedMetadata({
    params: withDefaultRegion(props.params),
  })
}

export default function PublicProductPage(props: Props) {
  return ProductPage({
    params: withDefaultRegion(props.params),
  })
}
