import { Box } from '@modules/common/components/box'
import { Heading } from '@modules/common/components/heading'
import { Text } from '@modules/common/components/text'

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function ContentPageBody({ content }: { content: string }) {
  const blocks = content
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)

  return (
    <Box className="flex flex-col gap-4">
      {blocks.map((block, index) => {
        if (block.startsWith('## ')) {
          const title = block.replace(/^##\s+/, '')

          return (
            <Heading
              key={`${index}-${title}`}
              as="h2"
              id={slugify(title)}
              className="w-full text-xl text-basic-primary small:text-2xl"
            >
              {title}
            </Heading>
          )
        }

        return (
          <Text
            key={`${index}-${block.slice(0, 24)}`}
            className="w-full text-md text-secondary"
          >
            {block}
          </Text>
        )
      })}
    </Box>
  )
}
