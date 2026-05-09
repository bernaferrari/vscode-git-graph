import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  [
    "inline-flex items-center justify-center w-fit shrink-0 whitespace-nowrap overflow-hidden",
    "h-5 gap-1 rounded-md border border-transparent px-1.5 py-0 text-[11px] font-medium leading-none tracking-[0.005em]",
    "has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1",
    "[&>svg]:size-3 [&>svg]:pointer-events-none",
    "transition-[color,background-color,border-color,box-shadow] duration-100",
    "focus-visible:border-ring focus-visible:ring-ring/45 focus-visible:ring-2",
    "aria-invalid:ring-destructive/25 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
    "group/badge",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-primary/95 text-primary-foreground [a]:hover:bg-primary",
        secondary:
          "bg-secondary text-secondary-foreground border-border/50 [a]:hover:bg-secondary/80",
        soft:
          "bg-muted text-foreground/80 border-border/50",
        destructive:
          "bg-destructive/10 text-destructive border-destructive/25 [a]:hover:bg-destructive/15 dark:bg-destructive/20",
        success:
          "bg-[color-mix(in_oklch,var(--success)_14%,transparent)] text-[color-mix(in_oklch,var(--success)_70%,var(--foreground))] border-[color-mix(in_oklch,var(--success)_30%,transparent)]",
        warning:
          "bg-[color-mix(in_oklch,var(--warning)_18%,transparent)] text-[color-mix(in_oklch,var(--warning)_60%,var(--foreground))] border-[color-mix(in_oklch,var(--warning)_35%,transparent)]",
        info:
          "bg-[color-mix(in_oklch,var(--info)_14%,transparent)] text-[color-mix(in_oklch,var(--info)_70%,var(--foreground))] border-[color-mix(in_oklch,var(--info)_30%,transparent)]",
        outline:
          "border-border text-foreground/85 [a]:hover:bg-muted [a]:hover:text-foreground",
        ghost:
          "text-muted-foreground hover:bg-muted hover:text-foreground dark:hover:bg-muted/50",
        link:
          "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ className, variant })),
      },
      props
    ),
    ...(render ? { render } : {}),
    state: {
      slot: "badge",
      variant,
    },
  })
}

// eslint-disable-next-line react-refresh/only-export-components
export { Badge, badgeVariants }
