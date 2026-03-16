import { useEffect, useState } from 'react'

export function useTime() {
  const [now, setNow] = useState<Date>(new Date())

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date())
    }, 30_000)

    return () => window.clearInterval(timer)
  }, [])

  return { now }
}