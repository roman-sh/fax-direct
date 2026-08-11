import type { ReactNode } from "react"

/**
 * Wrapper for the component previews under /dev.
 *
 * These pages render the real flow components with fabricated props so layout
 * work does not require a session, a payment, or a sent fax. Because they are
 * the production components, anything corrected while looking at a preview is
 * corrected in the application itself.
 */
export const metadata = {
  title: "Fax Direct — component previews",
  robots: { index: false, follow: false },
}

export default function DevLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-background">{children}</div>
}
