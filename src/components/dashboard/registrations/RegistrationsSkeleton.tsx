export default function RegistrationsSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-[#E5E5E5]">
      {/* Fake header row */}
      <div className="border-b border-[#E5E5E5] bg-[#fafafa] px-4 py-3">
        <div className="h-3 w-48 animate-pulse rounded bg-[#E5E5E5]" />
      </div>
      {/* Fake rows */}
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-[#E5E5E5] px-4 py-3 last:border-0">
          <div className="h-3.5 w-36 animate-pulse rounded bg-[#E5E5E5]" style={{ animationDelay: `${i * 40}ms` }} />
          <div className="h-3 w-44 animate-pulse rounded bg-[#E5E5E5]" style={{ animationDelay: `${i * 40 + 20}ms` }} />
          <div className="h-3 w-28 animate-pulse rounded bg-[#E5E5E5]" style={{ animationDelay: `${i * 40 + 40}ms` }} />
          <div className="ml-auto h-5 w-16 animate-pulse rounded-md bg-[#E5E5E5]" style={{ animationDelay: `${i * 40 + 60}ms` }} />
        </div>
      ))}
    </div>
  )
}
