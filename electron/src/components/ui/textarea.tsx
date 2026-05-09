import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex w-full min-h-16 outline-none field-sizing-content",
        "rounded-md border border-input bg-background/60 dark:bg-input/25",
        "px-2.5 py-2 text-sm shadow-[var(--shadow-xs)]",
        "placeholder:text-muted-foreground/70",
        "transition-[color,box-shadow,border-color,background-color] duration-100",
        "focus-visible:border-ring focus-visible:ring-ring/45 focus-visible:ring-2",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/25 aria-invalid:ring-2 dark:aria-invalid:border-destructive/55 dark:aria-invalid:ring-destructive/40",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
