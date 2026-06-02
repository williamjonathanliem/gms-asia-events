// Native <select> wrapper — use this in server-action forms where FormData must work.
// Use the compound Select from ./select for interactive dropdown menus.
import { cn } from '@/lib/utils'
import { SelectHTMLAttributes, forwardRef } from 'react'

const SelectNative = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm text-foreground',
        'placeholder:text-muted-foreground',
        'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
)
SelectNative.displayName = 'SelectNative'

export { SelectNative }
// Backwards-compat alias so old `import { Select }` still resolves
export { SelectNative as Select }
