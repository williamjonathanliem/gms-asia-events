import { Suspense } from 'react'
import StatusForm from '@/components/status/StatusForm'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Check Registration Status' }

export default function StatusPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <div className="border-b border-[#E5E5E5] px-4 py-6 text-center sm:px-6 sm:py-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted">GMS Events</p>
        <h1 className="mt-2 text-2xl font-semibold text-[#111111]">Registration Status</h1>
        <p className="mt-2 text-sm text-muted">
          Enter the email address you registered with to check your payment status and download your QR code.
        </p>
      </div>
      <div className="flex flex-1 items-start justify-center px-4 py-8 sm:px-6 sm:py-10">
        <Suspense>
          <StatusForm />
        </Suspense>
      </div>
    </div>
  )
}
