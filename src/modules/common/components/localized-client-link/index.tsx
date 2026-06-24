'use client'

import React from 'react'
import Link from 'next/link'

import { toPublicPath } from '@lib/util/public-url'

const LocalizedClientLink = ({
  children,
  href,
  ...props
}: {
  children?: React.ReactNode
  href: string
  className?: string
  onClick?: () => void
  passHref?: true
  [x: string]: any
}) => {
  return (
    <Link href={toPublicPath(href)} {...props}>
      {children}
    </Link>
  )
}

export default LocalizedClientLink
