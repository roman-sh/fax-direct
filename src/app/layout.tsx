import type { Metadata, Viewport } from "next"
import { Geist_Mono, Noto_Sans_Hebrew } from "next/font/google"
import Script from "next/script"
import "./globals.css"

const CLARITY_PROJECT_ID = "yiv1jo1r8b"

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
    "שולחים פקס אונליין בישראל בלי מכונת פקס ובלי הרשמה. מעלים קובץ PDF, מזינים את מספר הנמען, משלמים בתשלום חד־פעמי ועוקבים אחרי מצב השליחה באותו עמוד.",
  applicationName: "Fax Direct",
  openGraph: {
    title: "שליחת פקס אונליין ללא הרשמה | Fax Direct",
    description:
      "שליחת פקס חד־פעמית מהדפדפן: קובץ PDF, מספר נמען ומעקב אחרי המסירה.",
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
        <link rel="icon" href="/symbol.png" type="image/png"></link>
        {process.env.NODE_ENV === "production" ? (
          <Script id="microsoft-clarity" strategy="afterInteractive">
            {`(function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window,document,"clarity","script","${CLARITY_PROJECT_ID}");`}
          </Script>
        ) : null}
      </head>
      <body className="antialiased">{children}</body>
    </html>
  )
}
