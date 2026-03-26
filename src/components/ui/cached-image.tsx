"use client";

import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Home as HomeIcon, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface CachedImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackClassName?: string;
}

const CACHE_NAME = "hopeline-image-cache-v1";

export function CachedImage({ src, alt, className, fallbackClassName }: CachedImageProps) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

  useEffect(() => {
    if (!src) {
      setStatus("error");
      return;
    }

    let isMounted = true;

    async function loadImage() {
      try {
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(src);

        if (cachedResponse) {
          const blob = await cachedResponse.blob();
          if (isMounted) {
            setImgSrc(URL.createObjectURL(blob));
            setStatus("loaded");
          }
          return;
        }

        // Not in cache, fetch and store
        const response = await fetch(src);
        if (!response.ok) throw new Error("Failed to fetch image");

        const responseClone = response.clone();
        await cache.put(src, responseClone);

        const blob = await response.blob();
        if (isMounted) {
          setImgSrc(URL.createObjectURL(blob));
          setStatus("loaded");
        }
      } catch (error) {
        console.error("Error loading cached image:", error);
        if (isMounted) {
          // Fallback to direct src if cache fails
          setImgSrc(src);
          setStatus("loaded");
        }
      }
    }

    loadImage();

    return () => {
      isMounted = false;
      if (imgSrc && imgSrc.startsWith("blob:")) {
        URL.revokeObjectURL(imgSrc);
      }
    };
  }, [src]);

  if (status === "loading") {
    return <Skeleton className={cn("w-full h-full", className)} />;
  }

  if (status === "error" || !imgSrc) {
    return (
      <div className={cn("w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50", fallbackClassName)}>
        <HomeIcon className="h-12 w-12 mb-2 opacity-20" />
        <span className="text-xs font-medium uppercase tracking-widest opacity-40">No Image</span>
      </div>
    );
  }

  return (
    <img
      src={imgSrc}
      alt={alt}
      className={className}
      onError={() => setStatus("error")}
    />
  );
}
