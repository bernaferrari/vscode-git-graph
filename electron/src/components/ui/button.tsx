"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "rounded-md border border-transparent bg-clip-padding text-sm font-medium inline-flex items-center justify-center whitespace-nowrap shrink-0 [&_svg]:pointer-events-none [&_svg]:shrink-0 outline-none group/button select-none transition-[color,background-color,box-shadow,transform,border-color] duration-100 active:translate-y-[0.5px] disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed focus-visible:border-ring focus-visible:ring-ring/55 dark:focus-visible:ring-ring/65 aria-invalid:ring-destructive/25 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 aria-invalid:ring-2 focus-visible:ring-2",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_1px_2px_rgba(0,0,0,0.18)] hover:bg-primary/92 active:bg-primary/88 [a]:hover:bg-primary/92",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground hover:border-border dark:bg-input/20 dark:border-input dark:hover:bg-input/40 aria-expanded:bg-muted aria-expanded:text-foreground shadow-[var(--shadow-xs)]",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/75 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "text-foreground/85 hover:bg-muted hover:text-foreground dark:hover:bg-muted/60 aria-expanded:bg-muted aria-expanded:text-foreground",
        destructive:
          "bg-destructive/10 hover:bg-destructive/18 focus-visible:ring-destructive/30 dark:focus-visible:ring-destructive/40 dark:bg-destructive/20 text-destructive focus-visible:border-destructive/45 dark:hover:bg-destructive/30",
        "destructive-solid":
          "bg-destructive text-white shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_1px_2px_rgba(0,0,0,0.18)] hover:bg-destructive/90 focus-visible:ring-destructive/40",
        link:
          "text-primary underline-offset-4 hover:underline rounded-none px-0 h-auto",
      },
      size: {
        default:
          "h-8 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs:
          "h-6 gap-1 rounded-[6px] px-2 text-xs in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm:
          "h-7 gap-1 rounded-[7px] px-2.5 text-[0.8125rem] in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
        lg:
          "h-9 gap-2 px-3.5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[6px] in-data-[slot=button-group]:rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[7px] in-data-[slot=button-group]:rounded-md",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export { Button, buttonVariants }
