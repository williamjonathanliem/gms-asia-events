export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-sm font-medium text-[#111111]">Event not found</p>
      <p className="text-sm text-muted">
        This event does not exist or registration is currently closed.
      </p>
    </main>
  )
}
