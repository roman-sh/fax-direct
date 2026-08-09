import type { CSSProperties, ReactNode } from "react"
import { Check } from "lucide-react"

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

export type FaxStep = 1 | 2 | 3

type FlowCardProps = {
  step: FaxStep
  activeStep: FaxStep
  title: string
  summary: string
  icon: ReactNode
  children: ReactNode
  onOpen: (step: FaxStep) => void
  /** Prevents reopening a completed step, e.g. while a paid fax is sending. */
  locked?: boolean
}

/**
 * Presents one stage of the desktop fax flow. The active card expands while
 * completed and future cards collapse into ordered tabs. Only completed tabs
 * are interactive, preventing users from skipping required validation.
 */
export function FlowCard({
  step,
  activeStep,
  title,
  summary,
  icon,
  children,
  onOpen,
  locked = false,
}: FlowCardProps) {
  const isActive = step === activeStep
  const isComplete = step < activeStep
  const state = isActive ? "active" : isComplete ? "complete" : "future"
  const cardStyle = {
    flexBasis: isActive ? "0rem" : "5rem",
    flexGrow: isActive ? 1 : 0,
    // Keep the closest card above more distant cards as the stack changes.
    zIndex: 30 - Math.abs(step - activeStep),
  } satisfies CSSProperties

  return (
    <Card
      data-state={state}
      style={cardStyle}
      className={cn(
        "relative min-w-0 gap-0 overflow-hidden py-0 transition-[flex-basis,flex-grow,transform,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        "hidden h-full ring-1 ring-foreground/12 lg:flex",
        step > 1 && "lg:-mr-3",
        isActive &&
          "flex flex-1 shadow-[0_1px_2px_oklch(0.198_0.01_65/0.08),0_28px_64px_-30px_oklch(0.198_0.01_65/0.35)]",
        isComplete &&
          "translate-y-2 bg-card shadow-[0_12px_32px_-24px_oklch(0.198_0.01_65/0.35)]",
        state === "future" &&
          "translate-y-4 bg-[color-mix(in_oklch,var(--card),var(--muted)_35%)] shadow-[0_10px_26px_-24px_oklch(0.198_0.01_65/0.3)]"
      )}
    >
      <div
        className={cn(
          "absolute inset-0 flex flex-col transition-opacity duration-150",
          isActive
            ? "pointer-events-auto opacity-100 delay-150"
            : "pointer-events-none opacity-0"
        )}
        aria-hidden={!isActive}
      >
        {children}
      </div>

      <button
        type="button"
        disabled={!isComplete || locked}
        onClick={() => onOpen(step)}
        className={cn(
          "absolute inset-0 hidden w-full flex-col items-center gap-3 overflow-hidden px-2 py-5 transition-opacity duration-150 lg:flex",
          isActive
            ? "pointer-events-none opacity-0"
            : "pointer-events-auto opacity-100 delay-150",
          isComplete && !locked
            ? "text-foreground hover:bg-brand-subtle/45"
            : "cursor-default",
          isComplete ? "text-foreground" : "text-muted-foreground"
        )}
        aria-label={
          isComplete && !locked ? `חזרה לשלב ${step}: ${title}` : title
        }
      >
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
            isComplete
              ? "border-success/30 bg-success-subtle text-success"
              : "border-border bg-muted text-muted-foreground"
          )}
        >
          {isComplete ? <Check className="size-4" /> : step}
        </span>

        <span
          aria-hidden="true"
          className="h-8 w-px shrink-0 bg-border"
        />

        <span className="relative min-h-0 w-full flex-1 overflow-hidden">
          <span
            dir={isComplete ? "ltr" : "rtl"}
            className={cn(
              "absolute top-1/2 left-1/2 block max-w-72 -translate-x-1/2 -translate-y-1/2 -rotate-90 truncate whitespace-nowrap",
              isComplete
                ? "font-mono text-xs font-medium"
                : "text-xs font-semibold"
            )}
          >
            {isComplete ? summary : title}
          </span>
        </span>

        <span className="shrink-0 text-muted-foreground">{icon}</span>
      </button>
    </Card>
  )
}

export function CardHeading({
  step,
  title,
  description,
}: {
  step: FaxStep
  title: string
  description: string
}) {
  return (
    <CardHeader className="border-b border-border px-7 py-5">
      <div className="flex items-start gap-3">
        <span className="font-mono text-xs font-medium text-brand">
          0{step}
        </span>
        <div className="min-w-0">
          <CardTitle className="text-lg font-semibold">{title}</CardTitle>
          <CardDescription className="mt-1">{description}</CardDescription>
        </div>
      </div>
    </CardHeader>
  )
}
