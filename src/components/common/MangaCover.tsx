"use client"

import { useState } from "react"
import { BookOpen } from "lucide-react"
import { cn } from "~/lib/utils"

interface MangaCoverProps {
  src: string | null | undefined
  alt: string
  className?: string
  aspectRatio?: string // e.g., "3/4", "1/1"
  objectFit?: "cover" | "contain" | "fill" | "none"
  loading?: "lazy" | "eager"
  priority?: boolean
}

export function MangaCover({
  src,
  alt,
  className,
  aspectRatio = "3/4",
  objectFit = "contain", // Use contain to avoid cropping images with varying aspect ratios
  loading = "lazy",
  priority = false,
}: MangaCoverProps) {
  const [hasError, setHasError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const aspectClass = aspectRatio === "3/4"
    ? "aspect-[3/4]"
    : aspectRatio === "1/1"
    ? "aspect-square"
    : aspectRatio === "2/3"
    ? "aspect-[2/3]"
    : undefined

  const objectFitClass = {
    cover: "object-cover",
    contain: "object-contain",
    fill: "object-fill",
    none: "object-none",
  }[objectFit]

  const showFallback = !src || hasError

  return (
    <div
      className={cn(
        "relative bg-muted overflow-hidden flex items-center justify-center",
        aspectClass,
        className
      )}
    >
      {showFallback ? (
        <div className="flex items-center justify-center w-full h-full text-muted-foreground">
          <BookOpen className="w-8 h-8 opacity-30" />
        </div>
      ) : (
        <>
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className={cn(
              "w-full h-full transition-opacity duration-200",
              objectFitClass,
              isLoading && "opacity-0"
            )}
            loading={priority ? "eager" : loading}
            decoding={priority ? "sync" : "async"}
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setHasError(true)
              setIsLoading(false)
            }}
          />
        </>
      )}
    </div>
  )
}