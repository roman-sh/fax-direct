import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Fax Direct | שולחים פקס בקלות",
  description: "שירות פשוט ומאובטח לשליחת פקס בישראל",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml"></link>
      </head>
      <body className="antialiased">{children}</body>
    </html>
  )
}
