'use client'

import { useState } from 'react'
import { Popover as PopoverPrimitive } from 'radix-ui'
import { Command } from 'cmdk'
import { cn } from '@/lib/utils'

interface ComboboxProps {
  options:            readonly string[]
  value:              string
  onChange:           (value: string) => void
  placeholder?:       string
  searchPlaceholder?: string
  /** Hidden input for native form submission (FormData / server actions) */
  name?:              string
  /** Applied to the trigger button — pass your inputCls here */
  className?:         string
  emptyText?:         string
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder       = 'Select an option',
  searchPlaceholder = 'Search...',
  name,
  className,
  emptyText         = 'No results found.',
}: ComboboxProps) {
  const [open, setOpen] = useState(false)

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      {/* Hidden input carries the value into FormData on submit */}
      {name && <input type="hidden" name={name} value={value} />}

      {/* ── Trigger ── */}
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'flex w-full items-center justify-between gap-2 text-left',
            className
          )}
          style={{ color: value ? 'inherit' : undefined }}
        >
          <span className={cn('truncate', !value && 'opacity-50')}>
            {value || placeholder}
          </span>
          <svg
            className={cn(
              'size-3.5 shrink-0 opacity-40 transition-transform duration-150',
              open && 'rotate-180'
            )}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </PopoverPrimitive.Trigger>

      {/* ── Dropdown ── */}
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side="bottom"
          align="start"
          sideOffset={4}
          avoidCollisions={false}
          style={{ width: 'var(--radix-popover-trigger-width)' }}
          className="z-[200] overflow-hidden rounded-lg border border-[#E5E5E5] bg-white shadow-lg outline-none"
        >
          <Command
            // Prevent cmdk from interfering with page-level keyboard shortcuts
            onKeyDown={(e) => e.stopPropagation()}
            className="flex flex-col"
            style={{ fontFamily: 'inherit', color: '#111111' }}
          >
            {/* Search */}
            <div className="flex items-center gap-2 border-b border-[#E5E5E5] px-3 py-2">
              <svg
                className="size-3.5 shrink-0 text-[#888]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" />
              </svg>
              <Command.Input
                placeholder={searchPlaceholder}
                className="h-8 w-full bg-transparent text-sm text-[#111111] placeholder:text-[#aaa] outline-none border-none focus:ring-0"
                style={{ fontFamily: 'inherit' }}
              />
            </div>

            {/* List */}
            <Command.List className="max-h-60 overflow-y-auto p-1">
              <Command.Empty
                className="py-5 text-center text-xs text-[#888]"
                style={{ fontFamily: 'inherit' }}
              >
                {emptyText}
              </Command.Empty>

              <Command.Group>
                {options.map((opt) => {
                  const isSelected = opt === value
                  return (
                    <Command.Item
                      key={opt}
                      value={opt}
                      onSelect={() => { onChange(opt); setOpen(false) }}
                      className={cn(
                        'flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm outline-none transition-colors',
                        'text-[#111111]',
                        'data-[selected=true]:bg-[#f5f5f5] hover:bg-[#f5f5f5]',
                        isSelected && 'font-medium bg-[#f5f5f5]'
                      )}
                      style={{ fontFamily: 'inherit', color: '#111111' }}
                    >
                      <span className="flex size-3.5 shrink-0 items-center justify-center">
                        {isSelected && (
                          <svg
                            className="size-3.5 text-[#111111]"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2.5}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        )}
                      </span>
                      {opt}
                    </Command.Item>
                  )
                })}
              </Command.Group>
            </Command.List>
          </Command>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
