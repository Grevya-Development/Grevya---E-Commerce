import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("shimmer-bg rounded-xl bg-[#33381C]/5 border border-[#A68D65]/10", className)}
      {...props}
    />
  )
}

export { Skeleton }

