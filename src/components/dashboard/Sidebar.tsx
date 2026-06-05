'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { signOut } from '@/app/auth/login/actions'
import { cn, formatDateRange } from '@/lib/utils'
import InstallButton from '@/components/pwa/InstallButton'
import type { StaffUser } from '@/lib/types/database'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
}

const iconRegistrations = (
  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
  </svg>
)

const iconScanner = (
  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zm0 9.75c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zm9.75-9.75c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zm0 9.75h.75v.75h-.75v-.75zm9.75-9.75h.75v.75h-.75v-.75zm-3 6.75h3.75m-3.75 0v3.75m0-3.75h.75v.75h-.75v-.75zm2.25 3h.75v-.75h-.75v.75zm.75 0v-.75h.75v.75h-.75z" />
  </svg>
)

const iconEvents = (
  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
  </svg>
)

const iconStaff = (
  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
  </svg>
)

const iconBlast = (
  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" />
  </svg>
)

const iconSettings = (
  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

const iconAccount = (
  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
  </svg>
)

const iconSignOut = (
  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
  </svg>
)

interface Props {
  staff: StaffUser
  activeEvents: { id: string; name: string; date: string; end_date?: string | null }[]
}

export default function Sidebar({ staff, activeEvents }: Props) {
  const pathname = usePathname()
  const isSuperAdmin = staff.role === 'super_admin'
  const isAdminOrAbove = ['super_admin', 'admin'].includes(staff.role)
  const canScan = ['super_admin', 'admin', 'scanner'].includes(staff.role)
  const canViewRegistrations = staff.role !== 'scanner'

  const navItems: NavItem[] = [
    ...(canViewRegistrations
      ? [{ label: 'Registrations', href: '/dashboard/registrations', icon: iconRegistrations }]
      : []),
    ...(canScan
      ? [{ label: 'Scanner', href: '/scan', icon: iconScanner }]
      : []),
    ...(isAdminOrAbove
      ? [
          { label: 'Events',        href: '/dashboard/events', icon: iconEvents },
          { label: 'Announcements', href: '/dashboard/blast',  icon: iconBlast  },
        ]
      : []),
    ...(isSuperAdmin
      ? [
          { label: 'Staff',    href: '/dashboard/staff',    icon: iconStaff    },
          { label: 'Settings', href: '/dashboard/settings', icon: iconSettings },
        ]
      : []),
    { label: 'Account', href: '/dashboard/account', icon: iconAccount },
  ]

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-[#E5E5E5] bg-white">
      {/* Brand */}
      <div className="flex h-16 items-center border-b border-[#E5E5E5] px-6">
        <div className="flex flex-1 items-center gap-2.5">
          <Image
            src="/gmschurch_logo.jpg"
            alt="GMS"
            width={40}
            height={40}
          />
          <span className="text-sm font-semibold text-[#111111]">GMS Events</span>
        </div>
        {/* Close button shown only on mobile via CSS in DashboardShell */}
      </div>

      {/* Active event indicator */}
      {activeEvents.length > 0 && (
        <div className="border-b border-[#E5E5E5] px-4 py-3 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
            Active Event{activeEvents.length > 1 ? 's' : ''}
          </p>
          {activeEvents.map((ev) => (
            <div key={ev.id} className="flex items-start gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-success" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-[#111111] leading-snug truncate">{ev.name}</p>
                <p className="text-[10px] text-muted leading-snug">{formatDateRange(ev.date, ev.end_date)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-btn px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-[#111111] text-white'
                  : 'text-muted hover:bg-[#f5f5f5] hover:text-[#111111]'
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User + sign out */}
      <div className="border-t border-[#E5E5E5] px-3 py-4 space-y-1">
        <InstallButton variant="button" />
        <div className="px-3 py-2">
          <p className="text-xs font-medium text-[#111111] truncate">{staff.email}</p>
          <p className="text-xs text-muted capitalize">{staff.role.replace('_', ' ')}</p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-btn px-3 py-2 text-sm text-muted transition-colors hover:bg-[#f5f5f5] hover:text-[#111111]"
          >
            {iconSignOut}
            Sign Out
          </button>
        </form>
        <p className="px-3 pt-2 text-[10px] text-muted/50">
          Made by William Jonathan
        </p>
      </div>
    </aside>
  )
}
