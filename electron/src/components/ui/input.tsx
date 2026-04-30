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
        "dark:bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/45 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 disabled:bg-input/50 dark:disabled:bg-input/80 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 h-9 rounded-lg border bg-background/70 px-2.5 py-1 text-base transition-[color,box-shadow,border-color,background-color] file:h-6 file:text-sm file:font-medium focus-visible:ring-3 aria-invalid:ring-3 md:text-sm file:text-foreground placeholder:text-muted-foreground/75 w-full min-w-0 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] file:inline-flex file:border-0 file:bg-transparent",
        className
      )}
      {...props}
    />
  )
}

export { Input }
