"use client"

import { Popover } from "@base-ui/react/popover"

import { ACCEPTED_DOCUMENT_FORMATS } from "@/shared/document/document-formats"

/** Shows the accepted upload extensions without repeating them in page copy. */
export function SupportedFormatsPopover() {
  return (
    <Popover.Root>
      <Popover.Trigger
        type="button"
        className="inline-flex align-baseline font-medium text-foreground underline decoration-border underline-offset-4 transition-colors hover:text-brand focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
      >
        סוגי קבצים נתמכים
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="top" sideOffset={8} className="z-50">
          <Popover.Popup className="max-w-[min(90vw,22rem)] rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-lg outline-none">
            <Popover.Title className="text-sm font-semibold">
              סוגי קבצים נתמכים
            </Popover.Title>
            <Popover.Description className="mt-1 text-sm text-muted-foreground">
              <bdi dir="ltr">
                {Object.keys(ACCEPTED_DOCUMENT_FORMATS)
                  .map((format) => `.${format.toUpperCase()}`)
                  .join(", ")}
              </bdi>
            </Popover.Description>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
