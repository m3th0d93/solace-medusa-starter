import CategoryTemplate from '@modules/categories/templates'

const DEFAULT_REGION = process.env.NEXT_PUBLIC_DEFAULT_REGION || 'gb'

type Props = {
  params: Promise<{ category: string[] }>
  searchParams: Promise<Record<string, string>>
}

export const dynamic = 'force-dynamic'

export default async function PublicCategoryPage(props: Props) {
  const params = await props.params
  const searchParams = await props.searchParams

  return (
    <CategoryTemplate
      searchParams={searchParams}
      params={{
        countryCode: DEFAULT_REGION,
        category: params.category,
      }}
    />
  )
}
