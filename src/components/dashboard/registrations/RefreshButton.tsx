'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

export default function RefreshButton() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [spun, setSpun] = useState(false)

  function handleRefresh() {
    setSpun(true)
    startTransition(() => {
      router.refresh()
    })
    setTimeout(() => setSpun(false), 600)
  }

  return (
    <button
      type="button"
      onClick={handleRefresh}
      disabled={pending}
      title="Refresh"
      className="flex items-center justify-center rounded-btn border border-[#E5E5E5] p-2 text-muted transition-colors hover:bg-[#f5f5f5] hover:text-[#111111] disabled:opacity-40"
    >
      <svg
        className={`size-4 transition-transform duration-500 ${spun ? 'rotate-180' : ''}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.75}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
        />
      </svg>
    </button>
  )
}
