import type { Metadata } from "next"
import { cache } from "react"

import { AppBar } from "@/components/app-bar"
import { FaxSheet } from "@/components/fax-sheet"
import { HowItWorks } from "@/components/how-it-works"
import { SiteFooter } from "@/components/site-footer"
import { getMarketConfig } from "@/server/config/market-config.service"
import { formatFaxQuote } from "@/lib/format-fax-quote"

export const dynamic = "force-dynamic"

const getHomepageMarketConfig = cache(() => getMarketConfig("IL"))

const facts = [
  "תשלום חד־פעמי בביט",
  "מעקב עד אישור המסירה",
  "המסמך נמחק אחרי השליחה",
]

export async function generateMetadata(): Promise<Metadata> {
  const config = await getHomepageMarketConfig()
  const price = formatFaxQuote(config.price)

  return {
    description: `שולחים פקס אונליין בישראל בלי מכונת פקס ובלי הרשמה. מעלים קובץ PDF או תמונה, מזינים את מספר הנמען, משלמים ${price} ועוקבים אחרי מצב השליחה באותו עמוד.`,
    openGraph: {
      title: "שליחת פקס אונליין ללא הרשמה | Fax Direct",
      description: `שליחת פקס חד־פעמית מהדפדפן: קובץ PDF או תמונה, מספר נמען, ${price} ומעקב אחרי המסירה.`,
      locale: "he_IL",
      type: "website",
    },
  }
}

export default async function Home() {
  const config = await getHomepageMarketConfig()

  return (
    <div className="flex min-h-dvh flex-col">
      <AppBar />

      <main className="flex min-h-0 flex-1 flex-col px-4 py-5 sm:px-6 sm:py-8">
        <div className="my-auto flex w-full flex-col items-center gap-4 sm:gap-5">
          <div className="text-center">
            <h1 className="text-xl font-bold text-balance sm:text-3xl">
              שליחת פקס אונליין בלי הרשמה ובלי מנוי
            </h1>
            <div className="mt-3 flex h-5 flex-wrap items-center justify-center gap-x-3 gap-y-1.5 overflow-hidden text-xs text-muted-foreground sm:text-sm">
              {facts.map((fact, index) => (
                <span
                  key={fact}
                  className="flex shrink-0 items-center gap-3 whitespace-nowrap"
                >
                  {index > 0 && (
                    <span
                      aria-hidden="true"
                      className="size-1 rounded-full bg-muted-foreground/40"
                    />
                  )}
                  <span>{fact}</span>
                </span>
              ))}
            </div>
          </div>

          <FaxSheet
            locale="he-IL"
            maxFileBytes={config.fax.maxFileBytes}
            maxPages={config.fax.maxPages}
          />
        </div>
      </main>

      <div className="shrink-0 px-4 pb-4 sm:px-6 sm:pb-5">
        <HowItWorks price={config.price} />
      </div>

      <SiteFooter />
    </div>
  )
}
