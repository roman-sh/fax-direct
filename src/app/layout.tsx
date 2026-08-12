import type { Metadata, Viewport } from "next"
import { Geist_Mono, Noto_Sans_Hebrew } from "next/font/google"
import "./globals.css"

const notoHebrew = Noto_Sans_Hebrew({
  variable: "--font-noto-hebrew",
  subsets: ["hebrew"],
  display: "swap",
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "שליחת פקס אונליין ללא הרשמה | Fax Direct",
  description:
    "שולחים פקס אונליין בישראל בלי מכונת פקס ובלי הרשמה. מעלים קובץ PDF, מזינים את מספר הנמען, משלמים ₪10 ועוקבים אחרי מצב השליחה באותו עמוד.",
  applicationName: "Fax Direct",
  openGraph: {
    title: "שליחת פקס אונליין ללא הרשמה | Fax Direct",
    description:
      "שליחת פקס חד־פעמית מהדפדפן: קובץ PDF, מספר נמען, ₪10 ומעקב אחרי המסירה.",
    locale: "he_IL",
    type: "website",
  },
}

export const viewport: Viewport = {
  themeColor: "#ffffff",
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
      className={`${notoHebrew.variable} ${geistMono.variable}`}
    >
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml"></link>
      </head>
      <body className="antialiased">{children}</body>
    </html>
  )
}
