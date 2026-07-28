export function AppBar() {
  return (
    <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border/70 px-5 py-3.5 sm:px-8">
      <div className="flex items-baseline gap-3">
        <span className="text-[15px] font-bold">
          Fax Direct<span className="text-brand">.</span>
        </span>
        <span className="hidden text-xs text-muted-foreground sm:inline">
          שליחת פקס אונליין
        </span>
      </div>

      <span className="flex items-center gap-2 font-mono text-[0.7rem] tracking-[0.14em] text-muted-foreground">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-brand" />
        ISRAEL · HE
      </span>
    </header>
  )
}
