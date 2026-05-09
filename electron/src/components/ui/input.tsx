import { Input as InputPrimitive } from "@base-ui/react/input"
import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, style, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      {...(style ? { style } : {})}
      className={cn(
        "border-input bg-background/60 dark:bg-input/25 placeholder:text-muted-foreground/70",
        "h-8 w-full min-w-0 rounded-md border px-2.5 py-1 text-sm outline-none",
        "shadow-[var(--shadow-xs)]",
        "transition-[color,box-shadow,border-color,background-color] duration-100",
        "focus-visible:border-ring focus-visible:ring-ring/45 focus-visible:ring-2",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/25 aria-invalid:ring-2 dark:aria-invalid:border-destructive/55 dark:aria-invalid:ring-destructive/40",
        "disabled:bg-muted/40 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export { Input }
