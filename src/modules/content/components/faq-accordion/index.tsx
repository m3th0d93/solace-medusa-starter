'use client'

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

export type FAQQuestionBookmark = {
  id: string
  label: string
}

export const FAQAccordion = ({
  data,
  questionBookmarks = [],
  openQuestionId,
  onOpenQuestionIdChange,
}: {
  data: FAQSection
  questionBookmarks?: FAQQuestionBookmark[]
  openQuestionId?: string
  onOpenQuestionIdChange?: (id?: string) => void
}) => {
  return (
    <Box id={data.Bookmark}>
      <Accordion
        type="single"
        collapsible
        className="flex w-full flex-col gap-2"
        value={onOpenQuestionIdChange ? (openQuestionId ?? '') : undefined}
        onValueChange={(value) => {
          onOpenQuestionIdChange?.(value || undefined)
        }}
      >
        {data.Question.map((item, id) => {
          const questionBookmark = questionBookmarks[id]
          const questionValue = questionBookmark?.id ?? `item-${id}`

          return (
            <AccordionItem
              id={questionBookmark?.id}
              data-faq-question-id={questionBookmark?.id}
              value={questionValue}
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
              <AccordionContent forceMount>
                <Text size="lg" className="max-w-[664px] text-secondary">
                  <LinkedQuestionText text={item.Text} />
                </Text>
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>
    </Box>
  )
}

const LinkedQuestionText = ({ text }: { text: string }) => {
  const parts = String(text).split(/((?:https?:\/\/|\/)[^\s]+)/g)

  return (
    <>
      {parts.map((part, index) => {
        if (/^(?:https?:\/\/|\/)/.test(part)) {
          return (
            <a key={index} href={part} className="underline">
              {part}
            </a>
          )
        }

        return part
      })}
    </>
  )
}
