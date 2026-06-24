import { MDXRemote as RemoteMdx } from 'next-mdx-remote/rsc'
import rehypeHighlight from 'rehype-highlight'
import rehypeSlug from 'rehype-slug'
import remarkGfm from 'remark-gfm'
import remarkUnwrapImages from 'remark-unwrap-images'

import { mdxComponents } from './MDXComponents'

type MDXRemoteProps = {
  source: string
}

export async function MDXRemote({ source }: MDXRemoteProps) {
  return (
    <RemoteMdx
      source={source}
      components={mdxComponents}
      options={{
        mdxOptions: {
          remarkPlugins: [remarkUnwrapImages, remarkGfm],
          rehypePlugins: [rehypeHighlight, rehypeSlug],
        },
      }}
    />
  )
}
