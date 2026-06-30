/**
 * Badge 徽章组件
 * 基于 class-variance-authority 实现，用于展示状态标签、计数或分类标记。
 */

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  // 基础样式：内联弹性布局、居中、圆角、字体、过渡
  "inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        // 默认主色徽章
        default:
          "border-transparent bg-primary text-on-primary hover:bg-primary/80",
        // 次要色徽章
        secondary:
          "border-transparent bg-secondary text-on-secondary hover:bg-secondary/80",
        // 破坏性/错误徽章
        destructive:
          "border-transparent bg-destructive text-on-error hover:bg-destructive/80",
        // 描边徽章
        outline:
          "text-foreground border-outline-variant hover:bg-muted",
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
