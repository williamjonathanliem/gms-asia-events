import { cn } from '@/lib/utils'
import { LabelHTMLAttributes } from 'react'

interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean
}

export function Label({ className, children, required, ...props }: LabelProps) {
  return (
    <label
      className={cn('block text-sm font-medium text-[#111111] mb-1.5', className)}
      {...props}
    >
      {children}
      {required && <span className="text-error ml-1 font-normal">*</span>}
    </label>
  )
}
