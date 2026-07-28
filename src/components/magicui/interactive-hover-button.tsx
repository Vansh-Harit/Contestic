"use client"

import React from "react"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface InteractiveHoverButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  text?: string
}

export const InteractiveHoverButton = React.forwardRef<
  HTMLButtonElement,
  InteractiveHoverButtonProps
>(({ text = "View Details", className, ...props }, ref) => {
  return (
    <button
      ref={ref}
      className={cn(
        "group relative w-full cursor-pointer overflow-hidden rounded-lg border border-gray-200 bg-white px-4 py-2 text-center text-sm font-medium text-gray-700 transition-all duration-300 hover:border-transparent",
        className
      )}
      {...props}
    >
      {/* Gradient overlay that slides in from the left */}
      <span className="absolute left-0 top-0 h-full w-0 bg-gradient-to-r from-[#6366F1] to-[#7C3AED] transition-all duration-300 ease-out group-hover:w-full" />
      
      {/* Arrow icon that appears from the left */}
      <span className="relative flex items-center justify-center gap-2">
        <span className="inline-block translate-x-2 transition-all duration-300 group-hover:translate-x-0 group-hover:text-white">
          {text}
        </span>
        <ArrowRight className="inline-block h-4 w-4 translate-x-0 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:text-white group-hover:opacity-100" />
      </span>
    </button>
  )
})

InteractiveHoverButton.displayName = "InteractiveHoverButton"
