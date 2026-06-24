import { Metadata } from 'next'

import { getFAQ } from '@lib/data/fetch'
import { createAnchorId } from '@lib/util/anchor-id'
import { Container } from '@modules/common/components/container'
import { Heading } from '@modules/common/components/heading'
import { FAQContent } from '@modules/content/components/faq-content'
import StoreBreadcrumbs from '@modules/store/templates/breadcrumbs'

export const metadata: Metadata = {
  title: 'FAQs',
  description:
    'Find quick answers to common questions about our products/services.',
}

export default async function FAQPage() {
  const {
    data: { FAQSection },
  } = await getFAQ()

  const usedBookmarkIds = new Map<string, number>()
  const questionBookmarksBySection = FAQSection.map((section) =>
    section.Question.map((question, questionIndex) => {
      const baseId = createAnchorId(
        'faq',
        question.Title,
        `question-${section.id}-${question.id ?? questionIndex}`
      )
      const currentCount = usedBookmarkIds.get(baseId) ?? 0
      usedBookmarkIds.set(baseId, currentCount + 1)

      return {
        id: currentCount === 0 ? baseId : `${baseId}-${currentCount + 1}`,
        label: question.Title,
      }
    })
  )

  return (
    <Container className="min-h-screen max-w-full bg-secondary !p-0">
      <Container className="!py-8">
        <StoreBreadcrumbs breadcrumb="Frequently asked questions" />
        <Heading as="h1" className="mt-4 text-4xl medium:text-5xl">
          Frequently asked questions
        </Heading>
        <FAQContent
          sections={FAQSection}
          questionBookmarksBySection={questionBookmarksBySection}
        />
      </Container>
    </Container>
  )
}
