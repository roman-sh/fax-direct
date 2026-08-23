import Link from "next/link"
import type { ReactNode } from "react"

import { AppBar } from "@/components/app-bar"
import { SiteFooter } from "@/components/site-footer"

type LegalPageProps = {
  children: ReactNode
  title: string
}

/** Keeps the legal pages inside the same shell as the fax flow. */
export function LegalPage({ children, title }: LegalPageProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppBar />

      <main className="flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <article className="mx-auto max-w-3xl rounded-2xl bg-card px-6 py-8 text-sm leading-7 text-card-foreground ring-1 ring-foreground/10 sm:px-10 sm:py-10">
          <Link
            className="text-muted-foreground hover:text-foreground"
            href="/"
          >
            חזרה לשליחת פקס
          </Link>

          <h1 className="mt-5 text-2xl font-bold sm:text-3xl">{title}</h1>
          <p className="mt-2 text-xs text-muted-foreground">
            עודכן לאחרונה: 23 באוגוסט 2026
          </p>

          <div className="mt-8 space-y-7">{children}</div>
        </article>
      </main>

      <SiteFooter />
    </div>
  )
}

/** Standard heading used for one subject within a legal page. */
export function LegalSection({
  children,
  title,
}: {
  children: ReactNode
  title: string
}) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold">{title}</h2>
      <div className="space-y-2 text-muted-foreground">{children}</div>
    </section>
  )
}
