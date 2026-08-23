import Image from "next/image"

export function AppBar() {
  return (
    <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border/70 px-5 py-3.5 sm:px-8">
      <div className="flex items-center">
        <Image
          src="/fax-direct-logo.png"
          alt="fax.direct"
          width={491}
          height={156}
          className="h-8 w-auto"
        />
      </div>

      <span className="flex items-center gap-2 font-mono text-[0.7rem] tracking-[0.14em] text-muted-foreground">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-brand" />
        ISRAEL · HE
      </span>
    </header>
  )
}
