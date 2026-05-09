"use client"

import { CheckmarkCircle02Icon, InformationCircleIcon, Alert02Icon, MultiplicationSignCircleIcon, Loading03Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({
  ...props
}: Omit<ToasterProps, "theme">) => {
  const { theme = "system" } = useTheme()
  const resolvedTheme: ToasterProps["theme"] =
    theme === "light" || theme === "dark" ? theme : "system"
  const toasterProps: ToasterProps = {
    ...props,
    theme: resolvedTheme,
  }

  return (
    <Sonner
      {...toasterProps}
      className="toaster group"
      icons={{
        success: (
          <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-4" />
        ),
        info: (
          <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} className="size-4" />
        ),
        warning: (
          <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="size-4" />
        ),
        error: (
          <HugeiconsIcon icon={MultiplicationSignCircleIcon} strokeWidth={2} className="size-4" />
        ),
        loading: (
          <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--success-bg": "color-mix(in oklch, var(--success) 14%, var(--popover))",
          "--success-border": "color-mix(in oklch, var(--success) 40%, var(--border))",
          "--success-text": "var(--popover-foreground)",
          "--info-bg": "color-mix(in oklch, var(--info) 14%, var(--popover))",
          "--info-border": "color-mix(in oklch, var(--info) 40%, var(--border))",
          "--info-text": "var(--popover-foreground)",
          "--warning-bg": "color-mix(in oklch, var(--warning) 16%, var(--popover))",
          "--warning-border": "color-mix(in oklch, var(--warning) 45%, var(--border))",
          "--warning-text": "var(--popover-foreground)",
          "--error-bg": "color-mix(in oklch, var(--destructive) 14%, var(--popover))",
          "--error-border": "color-mix(in oklch, var(--destructive) 45%, var(--border))",
          "--error-text": "var(--popover-foreground)",
          "--border-radius": "calc(var(--radius) + 2px)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            "cn-toast group !rounded-xl !border !border-border !bg-popover !text-popover-foreground !shadow-[var(--shadow-popover)] backdrop-blur-md backdrop-saturate-150",
          title: "!text-[0.8125rem] !font-medium !leading-snug",
          description: "!text-[11px] !leading-snug !text-muted-foreground",
          actionButton:
            "!bg-primary !text-primary-foreground !rounded-md !text-[11px] !h-6 !px-2",
          cancelButton:
            "!bg-muted !text-muted-foreground !rounded-md !text-[11px] !h-6 !px-2",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
