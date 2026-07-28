import { Fragment } from "react"

const facts = [
  "עד 10 עמודים לפקס",
  "תשלום חד־פעמי",
  "מעקב עד אישור המסירה",
  "המסמך נמחק אחרי השליחה",
]

export function FactsBar() {
  return (
    <footer className="flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1.5 border-t border-border/70 px-5 py-3 text-xs text-muted-foreground sm:px-8">
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
    </footer>
  )
}
