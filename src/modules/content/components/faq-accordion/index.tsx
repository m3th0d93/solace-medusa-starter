import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@modules/common/components/accordion'
import { Box } from '@modules/common/components/box'
import { Heading } from '@modules/common/components/heading'
import { Text } from '@modules/common/components/text'
import { MinusThinIcon, PlusIcon } from '@modules/common/icons'
import { FAQSection } from 'types/strapi'

type FAQQuestionBookmark = {
  id: string
  label: string
}

export const FAQAccordion = ({
  data,
  questionBookmarks = [],
}: {
  data: FAQSection
  questionBookmarks?: FAQQuestionBookmark[]
}) => {
  return (
    <Box id={data.Bookmark}>
      <Heading
        as="h2"
        className="mb-4 text-xl text-basic-primary small:mb-6 small:text-3xl"
      >
        {data.Title}
      </Heading>
      <Accordion
        type="single"
        collapsible
        className="flex w-full flex-col gap-2"
      >
        {data.Question.map((item, id) => {
          const questionBookmark = questionBookmarks[id]

          return (
            <AccordionItem
              id={questionBookmark?.id}
              data-faq-question-id={questionBookmark?.id}
              value={`item-${id}`}
              key={id}
              className="scroll-mt-24 bg-primary px-5 pb-3 pt-5"
            >
              <AccordionTrigger className="[&[data-state=closed]>#minusIconSvg]:hidden [&[data-state=open]>#plusIconSvg]:hidden">
                <Heading
                  className="text-left text-lg font-medium text-basic-primary"
                  as="h3"
                >
                  {item.Title}
                </Heading>
                <div
                  id="plusIconSvg"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-fg-secondary text-action-primary hover:bg-fg-secondary-hover hover:text-action-primary-hover active:bg-fg-secondary-pressed active:text-action-primary-pressed"
                >
                  <PlusIcon />
                </div>
                <div
                  id="minusIconSvg"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-fg-secondary text-action-primary hover:bg-fg-secondary-hover hover:text-action-primary-hover active:bg-fg-secondary-pressed active:text-action-primary-pressed"
                >
                  <MinusThinIcon />
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <Text size="lg" className="max-w-[664px] text-secondary">
                  {item.Text}
                </Text>
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>
    </Box>
  )
}
