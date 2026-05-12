import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'

export const metadata: Metadata = {
  title: {
    template: '%s | GMS Events',
    default: 'GMS Events',
  },
  description: 'GMS Church Conference Registration & Management',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body className="min-h-screen bg-white font-sans text-[#111111] antialiased">
        {children}
      </body>
    </html>
  )
}
