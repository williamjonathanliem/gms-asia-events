'use client'

import { useRef, useState } from 'react'
import { uploadStripeProof } from './actions'

export default function StripeProofUpload({ registrationId }: { registrationId: string }) {
  const [fileName,  setFileName]  = useState('')
  const [uploading, setUploading] = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [done,      setDone]      = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  if (done) {
    return (
      <div className="rounded-lg border border-success/30 bg-success/5 px-5 py-4 text-center">
        <p className="text-sm font-medium text-success">Proof uploaded successfully.</p>
        <p className="mt-0.5 text-xs text-muted">Our team will cross-reference this with your Stripe receipt.</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-[#E5E5E5] px-5 py-5 space-y-4">
      <div>
        <p className="text-sm font-semibold text-[#111111]">
          Upload Payment Screenshot{' '}
          <span className="text-xs font-normal text-muted">(optional)</span>
        </p>
        <p className="mt-1 text-xs text-muted leading-relaxed">
          Optionally upload a screenshot of your Stripe payment receipt so our team can cross-reference your transaction.
        </p>
      </div>

      <form
        ref={formRef}
        onSubmit={async (e) => {
          e.preventDefault()
          if (!formRef.current) return
          setUploading(true)
          setError(null)
          const result = await uploadStripeProof(registrationId, new FormData(formRef.current))
          if (result.error) {
            setError(result.error)
            setUploading(false)
          } else {
            setDone(true)
          }
        }}
        className="space-y-3"
      >
        {error && <p className="text-xs text-error">{error}</p>}

        <label className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 transition-colors ${
          fileName ? 'border-[#111111] bg-[#fafafa]' : 'border-[#E5E5E5] hover:border-[#999]'
        }`}>
          <input
            type="file"
            name="proof_screenshot"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')}
          />
          {fileName ? (
            <>
              <svg className="size-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              <span className="max-w-full break-all text-center text-sm font-medium text-[#111111]">{fileName}</span>
              <span className="text-xs text-muted">Click to change</span>
            </>
          ) : (
            <>
              <svg className="size-5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <span className="text-sm font-medium text-[#111111]">Click to upload</span>
              <span className="text-xs text-muted">JPG &middot; PNG &middot; WebP &middot; max 5 MB</span>
            </>
          )}
        </label>

        {fileName && (
          <button
            type="submit"
            disabled={uploading}
            className="w-full rounded-lg bg-[#111111] py-2.5 text-sm font-semibold text-white hover:bg-[#2a2a2a] transition-colors disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Upload Proof'}
          </button>
        )}
      </form>
    </div>
  )
}
