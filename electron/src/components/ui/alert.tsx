import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  [
    "relative w-full grid gap-x-2.5 gap-y-0.5",
    "rounded-lg border px-3 py-2.5 text-left text-sm",
    "has-data-[slot=alert-action]:pr-20",
    "has-[>svg]:grid-cols-[auto_1fr]",
    "*:[svg]:row-span-2 *:[svg]:translate-y-[2px] *:[svg]:text-current",
    "*:[svg:not([class*='size-'])]:size-4",
    "group/alert",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground border-border/70",
        info:
          "bg-[color-mix(in_oklch,var(--info)_8%,transparent)] border-[color-mix(in_oklch,var(--info)_30%,transparent)] text-foreground *:[svg]:text-[color-mix(in_oklch,var(--info)_70%,var(--foreground))]",
        warning:
          "bg-[color-mix(in_oklch,var(--warning)_10%,transparent)] border-[color-mix(in_oklch,var(--warning)_35%,transparent)] text-foreground *:[svg]:text-[color-mix(in_oklch,var(--warning)_60%,var(--foreground))]",
        success:
          "bg-[color-mix(in_oklch,var(--success)_8%,transparent)] border-[color-mix(in_oklch,var(--success)_30%,transparent)] text-foreground *:[svg]:text-[color-mix(in_oklch,var(--success)_70%,var(--foreground))]",
        destructive:
          "bg-[color-mix(in_oklch,var(--destructive)_8%,transparent)] border-[color-mix(in_oklch,var(--destructive)_30%,transparent)] text-destructive *:data-[slot=alert-description]:text-destructive/85 *:[svg]:text-current",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "font-semibold tracking-[-0.005em] group-has-[>svg]/alert:col-start-2 [&_a]:hover:text-foreground [&_a]:underline [&_a]:underline-offset-3",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-muted-foreground text-[0.8125rem] leading-relaxed text-balance md:text-pretty",
        "group-has-[>svg]/alert:col-start-2",
        "[&_p:not(:last-child)]:mb-3 [&_a]:hover:text-foreground [&_a]:underline [&_a]:underline-offset-3",
        className
      )}
      {...props}
    />
  )
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-action"
      className={cn("absolute top-2 right-2", className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription, AlertAction }
