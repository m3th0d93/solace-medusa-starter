import ProductPage, {
  dynamic,
  generateMetadata as generateLocalizedMetadata,
} from '../../[countryCode]/(main)/products/[handle]/page'

const DEFAULT_REGION = process.env.NEXT_PUBLIC_DEFAULT_REGION || 'gb'

type Props = {
  params: Promise<{ handle: string }>
}

export { dynamic }

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
