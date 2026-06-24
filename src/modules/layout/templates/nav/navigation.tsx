'use client'

import { useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'

import { createNavigation } from '@lib/constants'
import { cn } from '@lib/util/cn'
import { formatNameForTestId } from '@lib/util/formatNameForTestId'
import { toPublicPath } from '@lib/util/public-url'
import { StoreCollection, StoreProductCategory } from '@medusajs/types'
import { Box } from '@modules/common/components/box'
import { NavigationItem } from '@modules/common/components/navigation-item'
import { CollectionsData } from 'types/strapi'

import CollectionsMenu from './collections-menu'
import DropdownMenu from './dropdown-menu'

export default function Navigation({
  productCategories,
  collections,
  strapiCollections,
}: {
  countryCode: string
  productCategories: StoreProductCategory[]
  collections: StoreCollection[]
  strapiCollections: CollectionsData
}) {
  const pathname = usePathname()
  const [openDropdown, setOpenDropdown] = useState<{
    name: string
    handle: string
  } | null>(null)

  const navigation = useMemo(
    () => createNavigation(productCategories, collections),
    [productCategories, collections]
  )

  return (
    <Box className="hidden gap-4 self-stretch large:flex">
      {navigation.map((item: any, index: number) => {
        const handle = item.name.toLowerCase().replace(' ', '-')
        const publicHandle = toPublicPath(item.handle)
        const isCategories =
          handle === 'shop' && pathname.startsWith('/categories')
        const active =
          pathname === publicHandle || pathname.startsWith(`${publicHandle}/`)

        return (
          <DropdownMenu
            key={index}
            item={item}
            activeItem={openDropdown}
            isOpen={openDropdown?.name === item.name}
            onOpenChange={(open) => {
              setOpenDropdown(
                open ? { name: item.name, handle: item.handle } : null
              )
            }}
            customContent={
              item.name === 'Collections' ? (
                <CollectionsMenu
                  cmsCollections={strapiCollections}
                  medusaCollections={collections}
                />
              ) : undefined
            }
          >
            <div
              className="flex h-full items-center"
              data-testid={formatNameForTestId(`${item.name}-dropdown`)}
            >
              <NavigationItem
                href={publicHandle}
                className={cn('!py-2 px-2', {
                  'border-b border-action-primary': active || isCategories,
                })}
              >
                {item.name}
              </NavigationItem>
            </div>
          </DropdownMenu>
        )
      })}
    </Box>
  )
}
