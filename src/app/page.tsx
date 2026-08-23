import { Fragment } from "react"

import { AppBar } from "@/components/app-bar"
import { FaxSheet } from "@/components/fax-sheet"
import { SiteFooter } from "@/components/site-footer"
import { getMarketConfig } from "@/server/config/market-config.service"

export const dynamic = "force-dynamic"

const facts = [
  "עד 10 עמודים לפקס",
  "תשלום חד־פעמי",
  "מעקב עד אישור המסירה",
  "המסמך נמחק אחרי השליחה",
]

export default async function Home() {
  const config = await getMarketConfig("IL")

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh lg:overflow-hidden">
      <AppBar />

      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5 sm:px-6 sm:py-8">
        <div className="my-auto flex w-full flex-col items-center gap-4 sm:gap-5">
          <div className="text-center">
            <h1 className="text-xl font-bold text-balance sm:text-3xl">
              שליחת פקס אונליין בלי הרשמה ובלי מנוי
            </h1>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground sm:text-sm">
              {facts.map((fact, index) => (
                <Fragment key={fact}>
                  {index > 0 && (
                    <span
                      aria-hidden="true"
                      className="size-1 rounded-full bg-muted-foreground/40"
                    />
                  )}
                  <span>{fact}</span>
                </Fragment>
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

      <SiteFooter />
    </div>
  )
}
