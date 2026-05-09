"use client"

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "gap-3 group/tabs flex data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  [
    "group/tabs-list text-muted-foreground inline-flex w-fit items-center justify-center",
    "group-data-horizontal/tabs:h-8 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col",
    "rounded-lg p-1 border border-transparent",
    "data-[variant=line]:rounded-none data-[variant=line]:p-0 data-[variant=line]:border-b data-[variant=line]:border-border/70",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-muted/70 border-border/40",
        line: "gap-3 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex flex-1 items-center justify-center whitespace-nowrap",
        "gap-1.5 rounded-md border border-transparent px-2.5 py-0.5 text-[0.8125rem] font-medium",
        "[&_svg:not([class*='size-'])]:size-3.5 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        "h-[calc(100%-2px)] group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start",
        "text-muted-foreground transition-[color,background-color,border-color,box-shadow,transform] duration-100",
        "hover:text-foreground",
        "focus-visible:border-ring/70 focus-visible:ring-ring/45 focus-visible:outline-none focus-visible:ring-2",
        "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
        "group-data-[variant=default]/tabs-list:data-active:bg-background group-data-[variant=default]/tabs-list:data-active:text-foreground group-data-[variant=default]/tabs-list:data-active:shadow-[var(--shadow-xs)]",
        "dark:group-data-[variant=default]/tabs-list:data-active:bg-background/90 dark:group-data-[variant=default]/tabs-list:data-active:border-border/40",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:rounded-none group-data-[variant=line]/tabs-list:px-0.5 group-data-[variant=line]/tabs-list:pb-2",
        "group-data-[variant=line]/tabs-list:data-active:text-foreground",
        "after:absolute after:opacity-0 after:transition-opacity after:bg-primary",
        "group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-1px] group-data-horizontal/tabs:after:h-[2px] after:rounded-full",
        "group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-[2px]",
        "group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("text-sm flex-1 outline-none", className)}
      {...props}
    />
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
