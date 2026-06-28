import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import NavigationLoader from '@/components/NavigationLoader'

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export const metadata: Metadata = {
  title: {
    template: '%s | GMS Events',
    default: 'GMS Events',
  },
  description: 'GMS Church Conference Registration & Management',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'GMS Scanner',
  },
  formatDetection: { telephone: false },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={cn(GeistSans.variable, GeistMono.variable, "font-sans")}
    >
      <body className="min-h-screen bg-white font-sans text-[#111111] antialiased">
        <TooltipProvider>
          <NavigationLoader />
          {children}
          <Toaster richColors closeButton position="bottom-right" />
        </TooltipProvider>
      </body>
    </html>
  )
}
