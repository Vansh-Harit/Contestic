'use client'

import { useState, useEffect } from 'react'

export function CountdownTimer({ deadline }: { deadline: string }) {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  })
  const [isExpired, setIsExpired] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setInterval> | undefined

    const calculateTimeLeft = () => {
      const diff = new Date(deadline).getTime() - Date.now()
      if (diff <= 0) {
        setIsExpired(true)
        return { days: 0, hours: 0, minutes: 0, seconds: 0 }
      }
      return {
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      }
    }

    const updateTimeLeft = () => {
      const remaining = calculateTimeLeft()
      setTimeLeft(remaining)
      if (
        remaining.days === 0 &&
        remaining.hours === 0 &&
        remaining.minutes === 0 &&
        remaining.seconds === 0
      ) {
        if (timer) clearInterval(timer)
      }
    }

    queueMicrotask(() => {
      if (cancelled) return
      setIsMounted(true)
      updateTimeLeft()
      timer = setInterval(updateTimeLeft, 1000)
    })

    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
    }
  }, [deadline])

  if (!isMounted) return null

  if (isExpired) {
    return <span className="text-error font-bold font-data-md">Ended</span>
  }

  return (
    <span className="font-data-md text-on-surface">
      {String(timeLeft.days).padStart(2, '0')}d :{' '}
      {String(timeLeft.hours).padStart(2, '0')}h :{' '}
      {String(timeLeft.minutes).padStart(2, '0')}m :{' '}
      {String(timeLeft.seconds).padStart(2, '0')}s
    </span>
  )
}
