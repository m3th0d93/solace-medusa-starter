import Footer from '@modules/layout/templates/footer'
import NavWrapper from '@modules/layout/templates/nav'

const DEFAULT_REGION = process.env.NEXT_PUBLIC_DEFAULT_REGION || 'gb'

export default function PublicProductsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <NavWrapper countryCode={DEFAULT_REGION} />
      {children}
      <Footer countryCode={DEFAULT_REGION} />
    </>
  )
}
