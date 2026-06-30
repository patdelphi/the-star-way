/**
 * Button 按钮组件
 * 基于 class-variance-authority 实现的 shadcn UI 风格按钮，支持多种变体和尺寸。
 */

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // 基础样式：内联布局、居中、圆角、字体、过渡动画、聚焦可见性
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        // 默认主色按钮
        default: "bg-primary text-on-primary hover:bg-primary/90",
        // 破坏性/错误按钮
        destructive:
          "bg-destructive text-on-error hover:bg-destructive/90",
        // 描边按钮
        outline:
          "border border-outline-variant bg-background text-foreground hover:bg-muted hover:text-foreground",
        // 次要按钮
        secondary:
          "bg-secondary text-on-secondary hover:bg-secondary/80",
        // 幽灵按钮（透明背景）
        ghost:
          "hover:bg-muted hover:text-foreground",
        // 链接样式按钮
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md gap-1.5 px-3",
        lg: "h-10 rounded-md px-6",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** 是否使用 asChild 模式渲染子元素 */
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
