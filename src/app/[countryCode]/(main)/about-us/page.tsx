import { Metadata } from 'next'

import { getAboutUs, getExploreBlogData } from '@lib/data/fetch'
import { Container } from '@modules/common/components/container'
import { Heading } from '@modules/common/components/heading'
import { Banner } from '@modules/content/components/banner'
import { BasicContentSection } from '@modules/content/components/basic-content-section'
import { FramedTextSection } from '@modules/content/components/framed-text-section'
import { NumericalSection } from '@modules/content/components/numerical-section'
import { ExploreBlog } from '@modules/home/components/explore-blog'
import StoreBreadcrumbs from '@modules/store/templates/breadcrumbs'

export const metadata: Metadata = {
  title: 'About Us',
  description:
    'At Solace, we deliver innovative products designed to meet your needs with quality and care.',
}

export default async function AboutUsPage() {
  const aboutUs = await getAboutUs()
  const data = aboutUs.data as any

  if (data?.ContentMode === 'opencart_html' && data?.PageContent) {
    return (
      <Container className="!py-8">
        <StoreBreadcrumbs breadcrumb="About us" />
        <Heading as="h1" className="mt-4 text-4xl medium:text-5xl">
          About us
        </Heading>
        <div
          data-testid="opencart-about-content"
          className="mt-8 text-md text-secondary"
          dangerouslySetInnerHTML={{ __html: data.PageContent }}
        />
      </Container>
    )
  }

  const { Banner: bannerData, OurStory, WhyUs, OurCraftsmanship, Numbers } =
    data

  const { data: posts } = await getExploreBlogData()

  return (
    <>
      {bannerData && <Banner data={bannerData} />}
      {OurStory && <BasicContentSection data={OurStory} />}
      {WhyUs && <FramedTextSection data={WhyUs} />}
      {OurCraftsmanship && <BasicContentSection data={OurCraftsmanship} />}
      {Numbers && <NumericalSection data={Numbers} />}
      <ExploreBlog posts={posts} />
    </>
  )
}
