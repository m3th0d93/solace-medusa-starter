'use client'

import { useEffect, useState } from 'react'

import { scrollToSection } from '@lib/util/scroll-to-section'
import { Box } from '@modules/common/components/box'
import {
  FAQAccordion,
  type FAQQuestionBookmark,
} from '@modules/content/components/faq-accordion'
import SidebarBookmarks from '@modules/content/components/sidebar-bookmarks'
import type { FAQSection } from 'types/strapi'

type FAQContentProps = {
  sections: FAQSection[]
  questionBookmarksBySection: FAQQuestionBookmark[][]
}

export const FAQContent = ({
  sections,
  questionBookmarksBySection,
}: FAQContentProps) => {
  const [openQuestionId, setOpenQuestionId] = useState<string>()
  const [pendingScrollId, setPendingScrollId] = useState<string>()
  const bookmarks = questionBookmarksBySection.flat()

  useEffect(() => {
    if (!pendingScrollId) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      scrollToSection(pendingScrollId)
      setPendingScrollId(undefined)
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [openQuestionId, pendingScrollId])

  return (
    <Box className="mt-6 grid grid-cols-12 medium:mt-12">
      <Box className="col-span-12 mb-10 medium:col-span-3 medium:mb-0">
        <SidebarBookmarks
          data={bookmarks}
          onBookmarkSelect={(bookmarkId) => {
            setOpenQuestionId(bookmarkId)
            setPendingScrollId(bookmarkId)
          }}
        />
      </Box>

      <Box className="col-span-12 space-y-10 medium:col-span-8 medium:col-start-5">
        {sections.map((section, id) => (
          <FAQAccordion
            key={id}
            data={section}
            questionBookmarks={questionBookmarksBySection[id]}
            openQuestionId={openQuestionId}
            onOpenQuestionIdChange={setOpenQuestionId}
          />
        ))}
      </Box>
    </Box>
  )
}
