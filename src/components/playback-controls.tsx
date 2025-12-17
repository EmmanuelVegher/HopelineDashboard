"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Play, Pause } from "lucide-react"
import { cn } from "@/lib/utils"

interface PlaybackControlsProps {
  mediaRef: React.RefObject<HTMLMediaElement>
  className?: string
}

const PlaybackControls: React.FC<PlaybackControlsProps> = ({ mediaRef, className }) => {
  const [isPlaying, setIsPlaying] = React.useState(false)
  const [currentTime, setCurrentTime] = React.useState(0)
  const [duration, setDuration] = React.useState(0)
  const [playbackRate, setPlaybackRate] = React.useState(1)

  const media = mediaRef.current

  React.useEffect(() => {
    if (!media) return

    const handleLoadedMetadata = () => {
      setDuration(media.duration)
    }

    const handleTimeUpdate = () => {
      setCurrentTime(media.currentTime)
    }

    const handleEnded = () => {
      setIsPlaying(false)
    }

    const handlePlay = () => {
      setIsPlaying(true)
    }

    const handlePause = () => {
      setIsPlaying(false)
    }

    media.addEventListener('loadedmetadata', handleLoadedMetadata)
    media.addEventListener('timeupdate', handleTimeUpdate)
    media.addEventListener('ended', handleEnded)
    media.addEventListener('play', handlePlay)
    media.addEventListener('pause', handlePause)

    return () => {
      media.removeEventListener('loadedmetadata', handleLoadedMetadata)
      media.removeEventListener('timeupdate', handleTimeUpdate)
      media.removeEventListener('ended', handleEnded)
      media.removeEventListener('play', handlePlay)
      media.removeEventListener('pause', handlePause)
    }
  }, [media])

  React.useEffect(() => {
    if (media) {
      media.playbackRate = playbackRate
    }
  }, [playbackRate, media])

  const togglePlayPause = () => {
    if (!media) return
    if (isPlaying) {
      media.pause()
    } else {
      media.play()
    }
  }

  const handleSeek = (value: number[]) => {
    if (!media) return
    const newTime = value[0]
    media.currentTime = newTime
    setCurrentTime(newTime)
  }

  const handleSpeedChange = (value: string) => {
    const rate = parseFloat(value)
    setPlaybackRate(rate)
  }

  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <div className={cn("flex items-center gap-4 p-4 bg-background border rounded-lg", className)}>
      <Button
        variant="outline"
        size="icon"
        onClick={togglePlayPause}
        disabled={!media}
      >
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>

      <div className="flex-1 flex items-center gap-2">
        <span className="text-sm text-muted-foreground w-12">
          {formatTime(currentTime)}
        </span>
        <Slider
          value={[currentTime]}
          max={duration || 100}
          step={0.1}
          onValueChange={handleSeek}
          className="flex-1"
          disabled={!media}
        />
        <span className="text-sm text-muted-foreground w-12">
          {formatTime(duration)}
        </span>
      </div>

      <Select value={playbackRate.toString()} onValueChange={handleSpeedChange}>
        <SelectTrigger className="w-20">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="0.5">0.5x</SelectItem>
          <SelectItem value="1">1x</SelectItem>
          <SelectItem value="1.25">1.25x</SelectItem>
          <SelectItem value="1.5">1.5x</SelectItem>
          <SelectItem value="2">2x</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}

export { PlaybackControls }