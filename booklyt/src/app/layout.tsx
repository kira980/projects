import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"
import { PwaRegister } from "@/components/pwa-register"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-geist-sans",
})

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // enables env(safe-area-inset-*) on iOS
}

export const metadata: Metadata = {
  title: {
    default: "Booklyt – Appointment Booking for Modern Businesses",
    template: "%s | Booklyt",
  },
  description:
    "Create a booking website for your business. Customise your design, manage services and staff, and let customers book appointments online with Booklyt.",
  keywords: ["appointment booking", "salon software", "barber booking", "scheduling"],
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Booklyt",
  },
  other: {
    "facebook-domain-verification": "hhh821alhflb6pl09eme9z3lwejewo",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased`} suppressHydrationWarning>
        {children}
        <PwaRegister />
        <Toaster />
      </body>
    </html>
  )
}
