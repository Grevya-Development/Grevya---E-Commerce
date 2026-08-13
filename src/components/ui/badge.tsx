import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 tracking-wide",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[#33381C] text-white hover:bg-[#262A14] shadow-xs",
        secondary:
          "border-transparent bg-[#A68D65]/15 text-[#33381C] hover:bg-[#A68D65]/25 border border-[#A68D65]/20",
        destructive:
          "border-transparent bg-rose-100 text-rose-800 border border-rose-200",
        outline: "border-[#A68D65]/30 text-[#33381C] bg-white/50 backdrop-blur-xs",
        success: "border-emerald-200 bg-emerald-50 text-emerald-800 border",
        warning: "border-amber-200 bg-amber-50 text-amber-800 border",
        info: "border-sky-200 bg-sky-50 text-sky-800 border",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
