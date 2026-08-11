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
 * The box the three cards live in. Exported because the real sheet and the dev
 * previews both need it, and the two axes below only agree if they agree
 * exactly.
 *
 * The stack turns horizontal once the viewport can hold it, rather than at a
 * borrowed device breakpoint. The binding constraint is the heading, not the
 * body: the actions there are floated so the failure message can wrap around
 * them, and a float is sized before anything flows past it, so the title gets
 * only the remainder and has no way to ask for more. Three fixed widths have
 * to fit on one line or the title wraps:
 *
 *   title                130px   "סטטוס השליחה"
 *   gap                   16px
 *   widest button        180px   "עריכת מספר הפקס", the longest label
 *                       ------
 *   heading              326px
 *   card padding          56px   px-7 either side
 *   two collapsed        104px   2 × 3.25rem
 *   their overlap        -24px   2 × -0.75rem
 *   page gutters          32px   px-4 either side, the narrowest case
 *                       ------
 *   FLOW_STACK_MIN       494px   rounded up to 499
 *
 * An earlier version derived this from the body wanting about 21rem and put it
 * at 448px, which let the horizontal layout run down to widths where the
 * heading could not work: the title wrapped beside the buttons and no
 * arrangement of them could prevent it, because the three widths above simply
 * did not fit. Stacking the buttons does not help — that makes the float
 * taller, not narrower.
 *
 * Below the threshold the stack turns on its side: the strips run across the
 * top and bottom, the open card takes the height between them, and the heading
 * stops floating so the title has the full width. The taller column height is
 * that same open card plus the two strips it now sits between, so the body
 * keeps the room it has in the horizontal layout instead of surrendering it to
 * the strips. Changing any figure above means recomputing the `min-[499px]`
 * variants here and in the collapsed heights below.
 */
export const FLOW_STACK_CLASS =
  "flex h-[37.5rem] w-full flex-col items-stretch min-[499px]:h-[31rem] min-[499px]:flex-row min-[499px]:items-start lg:h-[27rem]"

/**
 * Presents one stage of the fax flow. The active card expands while completed
 * and future cards collapse into ordered tabs. Only completed tabs are
 * interactive, preventing users from skipping required validation.
 *
 * `flexBasis` and `flexGrow` size the card along whichever axis the stack is
 * running, so the same two numbers collapse it to a column of strips on a phone
 * and to a row of them on a desktop, with no second set of measurements.
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
        "relative min-h-0 min-w-0 gap-0 overflow-hidden py-0 transition-[flex-basis,flex-grow,transform,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        // A collapsed card is a strip holding a marker, a rule, a label and an
        // icon. Standing up it is 3.25rem wide and the label turns on its side;
        // lying down it is 3.25rem tall and the label reads normally. Wider
        // screens can spare more, but only in the horizontal layout, where the
        // measurement is width taken from the open card rather than height.
        "[--flow-card-collapsed:3.25rem] md:[--flow-card-collapsed:5rem]",
        "flex ring-1 ring-foreground/12 min-[499px]:h-full",
        // Each card is tucked under the one before it by the same amount on
        // either axis, so the strips read as a stack rather than as a list.
        // The depth offsets do not carry over: across a row they are the stack
        // seen edge-on, but down a column they would only be uneven gaps.
        step > 1 && "-mt-3 min-[499px]:mt-0 min-[499px]:-mr-3",
        isActive &&
          "flex-1 shadow-[0_1px_2px_oklch(0.198_0.01_65/0.08),0_28px_64px_-30px_oklch(0.198_0.01_65/0.35)]",
        isComplete &&
          "bg-card shadow-[0_12px_32px_-24px_oklch(0.198_0.01_65/0.35)] min-[499px]:translate-y-2",
        state === "future" &&
          "bg-[color-mix(in_oklch,var(--card),var(--muted)_35%)] shadow-[0_10px_26px_-24px_oklch(0.198_0.01_65/0.3)] min-[499px]:translate-y-4"
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
          "absolute inset-0 flex flex-row items-center gap-3 overflow-hidden px-5 py-0 transition-opacity duration-150 min-[499px]:w-full min-[499px]:flex-col min-[499px]:gap-2 min-[499px]:px-1.5 min-[499px]:py-4 md:gap-3 md:px-2 md:py-5",
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

        {/* Stretching matters only lying down, where the label is the strip's
            width but nothing gives it the strip's height: an absolute child
            leaves its parent no content to be as tall as, and the parent
            collapses to nothing and clips the label away. */}
        <span className="relative min-h-0 min-w-0 flex-1 self-stretch overflow-hidden min-[499px]:w-full">
          {/* Rotating the label leaves its layout box unrotated, so the box has
              to be sized by the parent and the text centred inside it. That
              holds lying down too, where the only change is that the text is
              not turned and its length is capped by the strip rather than by
              the card's height. */}
          <span
            dir={isComplete ? "ltr" : "rtl"}
            className={cn(
              "absolute top-1/2 left-1/2 block max-w-full -translate-x-1/2 -translate-y-1/2 truncate whitespace-nowrap min-[499px]:max-w-72 min-[499px]:-rotate-90",
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
  title,
  description,
  descriptionTone = "muted",
  actions,
}: {
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
    // `items-stretch` overrides the `items-start` CardHeader carries for its
    // own grid: left alone it makes every child shrink to fit, so actions that
    // ask to span the heading silently cannot. It is inert above the
    // breakpoint, where the heading is a block again.
    <CardHeader className="flex flex-col items-stretch border-b border-border px-7 py-5 min-[499px]:block min-[499px]:after:block min-[499px]:after:clear-both min-[499px]:after:content-['']">
      {/* A float takes its natural width and the text beside it gets whatever
          is left, with no way to ask for more. So the float has two widths
          worth having and nothing in between: wide enough for both buttons
          abreast, or narrow enough for one, with the pair stacked. `min-w`
          gives the second directly — the buttons keep `whitespace-nowrap`, so
          min-content here is the wider label and not a hairline.

          Capping it at the title's leftover instead was worse in a way that is
          easy to miss: the title fits by construction, but the float then eats
          every pixel the title does not, and the message wrapping past it is
          left a ribbon. The message is the point of the heading; the buttons
          are not.

          The query measures the heading rather than the viewport, so no
          formula relates the two, and 411px is the parts rather than a
          calibration: 265 for both buttons and their gap, 16 for ms-4, 130 for
          the title beside them.

          Once the stack stands the card up there is no width to share, and a
          float would only wrap the title around buttons that already span the
          card. So the heading becomes an ordinary column and the actions fall
          to the end of it, below the message they answer. */}
      {actions ? (
        <div className="order-last mt-3 min-[499px]:float-end min-[499px]:mt-0 min-[499px]:mb-1 min-[499px]:ms-4 min-[499px]:max-w-min min-[499px]:@[411px]/card-header:max-w-none">
          {actions}
        </div>
      ) : null}

      {/* No step number here. The strips beside the open card already carry 1,
          2 and 3, and turn into checkmarks as they complete, so a marker in the
          heading repeated a position the stack was showing anyway — and it took
          the width the title needs to stay on one line beside the actions. */}
      <CardTitle className="text-lg font-semibold">{title}</CardTitle>
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
