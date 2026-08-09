import { AppBar } from "@/components/app-bar"
import { FactsBar } from "@/components/facts-bar"
import { FaxSheet } from "@/components/fax-sheet"
import { getMarketConfig } from "@/server/config/market-config.service"

export const dynamic = "force-dynamic"

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
            <p className="mt-2 hidden text-sm text-muted-foreground sm:block">
              מסמך אחד, מספר אחד, תשלום אחד — והפקס בדרך.
            </p>
          </div>

          <FaxSheet
            locale="he-IL"
            maxFileBytes={config.fax.maxFileBytes}
            maxPages={config.fax.maxPages}
          />
        </div>
      </main>

      <FactsBar />
    </div>
  )
}
