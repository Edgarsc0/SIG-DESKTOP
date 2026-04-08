import { useState, useEffect, useRef, useCallback } from 'react'

const MAX_LOGS = 1000

export function useLogs() {
  const [logs, setLogs] = useState([])
  const logsEndRef = useRef(null)
  const shouldAutoScrollRef = useRef(true)
  const containerRef = useRef(null)

  const agregarLog = useCallback((msg) => {
    setLogs((prev) => {
      const next = [...prev, msg.trim()]
      return next.length > MAX_LOGS ? next.slice(-MAX_LOGS) : next
    })
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      shouldAutoScrollRef.current = scrollTop + clientHeight >= scrollHeight - 50
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs])

  return { logs, agregarLog, logsEndRef, containerRef }
}
