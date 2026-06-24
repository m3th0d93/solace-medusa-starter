'use client'

import { useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { Input } from '@modules/common/components/input'

export default function SearchBox(_props: { countryCode: string }) {
  const inputRef = useRef(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') ?? '')

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const currentUrl = new URL(window.location.href)
      if (query.trim() === '') {
        currentUrl.searchParams.delete('q')
      } else {
        currentUrl.searchParams.set('q', query.trim())
      }
      const newPath = `/blog${currentUrl.search}`
      router.push(newPath)
    }
  }

  return (
    <Input
      type="search"
      name="search"
      ref={inputRef}
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      onKeyDown={handleSearch}
      placeholder="Search"
    />
  )
}
