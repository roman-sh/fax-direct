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
 * Presents one stage of the fax flow. The active card expands while completed
 * and future cards collapse into ordered tabs. Only completed tabs are
 * interactive, preventing users from skipping required validation.
 *
 * The stack appears once the viewport can hold it, rather than at a borrowed
 * device breakpoint. Its width is the sum of what the parts need:
 *
 *   open card          21.00rem   summary rows, and a heading carrying both a
 *                                 message and up to two buttons
 *   two collapsed       6.50rem   2 × 3.25rem
 *   their overlap      -1.50rem   2 × -0.75rem
 *   page gutters        2.00rem   px-4 either side, the narrowest case
 *                      --------
 *   FLOW_STACK_MIN     28.00rem   ≈ 448px
 *
 * Below that the open card would be squeezed past usefulness, so a single card
 * is shown instead until the vertical layout exists. Changing any figure above
 * means recomputing the `min-[28rem]` variants in this file.
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
    flexBasis: isActive ? "0rem" : "var(--flow-card-collapsed)",
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
        // A collapsed card is a strip holding a marker, a rule, rotated text and
        // an icon. Narrow screens give it less, so the open card keeps room for
        // a heading that already carries a message and up to two buttons.
        "[--flow-card-collapsed:3.25rem] md:[--flow-card-collapsed:5rem]",
        "hidden h-full ring-1 ring-foreground/12 min-[28rem]:flex",
        step > 1 && "min-[28rem]:-mr-3",
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
          "absolute inset-0 hidden w-full flex-col items-center gap-2 overflow-hidden px-1.5 py-4 transition-opacity duration-150 min-[28rem]:flex md:gap-3 md:px-2 md:py-5",
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
  descriptionTone = "muted",
  actions,
}: {
  step: FaxStep
  title: string
  description: string
  /** `destructive` carries a failure message in place of the usual blurb. */
  descriptionTone?: "muted" | "destructive"
  /**
   * Trailing-edge controls. The card body is a fixed-height box that cannot
   * scroll, so terminal-state actions live here rather than below the content,
   * where they would compete with it for a height that does not exist.
   */
  actions?: ReactNode
}) {
  return (
    // The actions float rather than sitting in a flex row, so the description
    // keeps the full width of the heading: its first lines are shortened
    // beside the buttons and the rest run the whole way underneath them. A
    // failure message is the longest text here, and boxing it into the column
    // left of the buttons wrapped it into a narrow ribbon while the space
    // below them stayed empty. Nothing between the float and the text may
    // establish its own formatting context, which is why the title and the
    // step marker are inline rather than a flex row.
    <CardHeader className="block border-b border-border px-7 py-5 after:block after:clear-both after:content-['']">
      {/* A float keeps its width whatever the text does, so two buttons abreast
          leave the title too little room and wrap it. Stacking them narrows the
          float enough for the title to hold one line. The query measures the
          card rather than the viewport, because the open card's width depends
          on the stack around it as much as on the screen. */}
      {actions ? (
        <div className="float-end ms-4 mb-1">{actions}</div>
      ) : null}

      <CardTitle className="text-lg font-semibold">
        <span className="me-3 font-mono text-xs font-medium text-brand">
          0{step}
        </span>
        {title}
      </CardTitle>
      <CardDescription
        className={cn(
          "mt-1",
          descriptionTone === "destructive" && "text-destructive"
        )}
      >
        {description}
      </CardDescription>
    </CardHeader>
  )
}
