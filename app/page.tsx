'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { Play, Square } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function TimerPage() {
  const supabase = createClient()
  const router = useRouter()

  /* ========================================================================
     1. KUMPULAN STATE & REFERENSI
     ======================================================================== */
  const [isActive, setIsActive] = useState(false)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [loading, setLoading] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [alarmLimit, setAlarmLimit] = useState<number>(0)

  const elapsedRef = useRef(0)
  const alarmNotifiedRef = useRef(false)
  const autoStopTriggeredRef = useRef(false)
  const notificationRef = useRef<Notification | null>(null)

  /* ========================================================================
     HELPER FUNCTIONS (Diurutkan di atas agar aman digunakan di bawahnya)
     ======================================================================== */

  const updateElapsedTime = useCallback((newElapsed: number) => {
    setElapsedTime(newElapsed)
    elapsedRef.current = newElapsed
  }, [])

  const clearTimerStorage = useCallback(() => {
    try {
      localStorage.removeItem('timer_is_active')
      localStorage.removeItem('timer_last_tick')
      localStorage.removeItem('timer_start_ms')
      localStorage.removeItem('timer_alarm_limit')
    } catch (e) {
      console.error('Failed to clear localStorage:', e)
    }
  }, [])

  const splitSessionsByMidnight = useCallback((startTime: Date, endTime: Date, baseDescription: string) => {
    const records = []

    if (endTime <= startTime) {
      console.error('Invalid time range: endTime must be after startTime', { startTime, endTime })
      return []
    }

    let currentStart = new Date(startTime)
    const finalEnd = new Date(endTime)

    let partNumber = 1
    const needsSplit = currentStart.toDateString() !== finalEnd.toDateString()
    const MAX_ITERATIONS = 366 // Safety: max 1 tahun

    let iterations = 0
    while (currentStart < finalEnd && iterations < MAX_ITERATIONS) {
      iterations++

      const nextMidnight = new Date(currentStart)
      nextMidnight.setDate(nextMidnight.getDate() + 1)
      nextMidnight.setHours(0, 0, 0, 0)

      const currentEnd = nextMidnight > finalEnd ? finalEnd : nextMidnight
      const durationSeconds = Math.floor((currentEnd.getTime() - currentStart.getTime()) / 1000)

      if (durationSeconds > 0) {
        records.push({
          // ✅ FIXED: Menghapus tanda minus (-) aneh dan menyatukan string dengan benar
          description: needsSplit ? `${baseDescription} - Bagian ${partNumber}` : baseDescription,
          start_time: currentStart.toISOString(),
          end_time: currentEnd.toISOString(),
          duration_seconds: durationSeconds,
        })
        partNumber++
      }

      currentStart = new Date(currentEnd)
    }

    if (iterations >= MAX_ITERATIONS) {
      console.error('splitSessionsByMidnight exceeded max iterations')
    }

    return records
  }, [])

  const handleAutoStopSleep = useCallback(async (seconds: number, endMs: number) => {
    if (autoStopTriggeredRef.current) {
      console.warn('Auto-stop sudah dipanggil, skip untuk mencegah duplikasi')
      return
    }

    if (seconds <= 0) {
      clearTimerStorage()
      setIsActive(false)
      return
    }

    autoStopTriggeredRef.current = true
    setIsActive(false)
    clearTimerStorage()
    updateElapsedTime(0)
    setAlarmLimit(0)

    const endTime = new Date(endMs)
    const startTime = new Date(endMs - seconds * 1000)

    const records = splitSessionsByMidnight(startTime, endTime, 'Sesi Baru (Berhenti Otomatis - Laptop Sleep/Mati)')
    const { error } = await supabase.from('screen_time').insert(records)

    if (error) {
      console.error('Failed to save auto-stop session:', error)
      alert('Gagal menyimpan data. Error: ' + error.message)
      autoStopTriggeredRef.current = false
    } else {
      alert('Laptop terdeteksi Sleep atau tab ditutup. Timer telah dihentikan otomatis dan datamu berhasil disimpan!')
      setTimeout(() => {
        autoStopTriggeredRef.current = false
      }, 1000)
    }
  }, [clearTimerStorage, updateElapsedTime, splitSessionsByMidnight, supabase])

  /* ========================================================================
     2. MANAJEMEN AKUN & PENGAMANAN LOGOUT
     ======================================================================== */
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) router.push('/login')
    }
    checkUser()
  }, [router, supabase])

  useEffect(() => {
    return () => {
      if (notificationRef.current) {
        notificationRef.current.close()
        notificationRef.current = null
      }
    }
  }, [])

  const handleLogout = useCallback(async () => {
    const finalSeconds = elapsedRef.current
    if (isActive && finalSeconds > 0) {
      const endTime = new Date()
      const startTime = new Date(endTime.getTime() - finalSeconds * 1000)

      const records = splitSessionsByMidnight(startTime, endTime, 'Sesi Baru (Tersimpan otomatis saat Logout)')
      const { error } = await supabase.from('screen_time').insert(records)

      if (error) {
        console.error('Failed to save on logout:', error)
        const shouldLogout = confirm('Gagal menyimpan data timer. Tetap logout?')
        if (!shouldLogout) return
      }
    }

    if (notificationRef.current) {
      notificationRef.current.close()
      notificationRef.current = null
    }

    await supabase.auth.signOut()
    clearTimerStorage()
    router.push('/login')
  }, [isActive, splitSessionsByMidnight, clearTimerStorage, supabase, router])

  /* ========================================================================
     4. PEMULIHAN AWAL (SAAT HALAMAN BARU DIBUKA)
     ======================================================================== */
  useEffect(() => {
    setIsMounted(true)

    const savedActive = localStorage.getItem('timer_is_active') === 'true'
    const savedLastTick = parseInt(localStorage.getItem('timer_last_tick') || '0', 10)
    const savedStartMs = parseInt(localStorage.getItem('timer_start_ms') || '0', 10)
    const savedAlarm = parseInt(localStorage.getItem('timer_alarm_limit') || '0', 10)

    const now = Date.now()
    const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000
    const isValidTimestamp = (ts: number) => {
      if (ts <= 0) return false
      if (ts > now) return false
      if (now - ts > TWO_YEARS_MS) return false
      return true
    }

    if (savedActive && (!isValidTimestamp(savedStartMs) || !isValidTimestamp(savedLastTick))) {
      console.warn('Invalid localStorage timestamps detected, clearing timer data')
      clearTimerStorage()
      return
    }

    if (savedAlarm > 0) setAlarmLimit(savedAlarm)

    if (savedActive && savedLastTick > 0 && savedStartMs > 0) {
      const timeGapSeconds = Math.floor((now - savedLastTick) / 1000)

      if (timeGapSeconds > 60) {
        const secondsBeforeSleep = Math.floor((savedLastTick - savedStartMs) / 1000)
        handleAutoStopSleep(secondsBeforeSleep, savedLastTick)
      } else {
        const currentElapsed = Math.floor((now - savedStartMs) / 1000)
        updateElapsedTime(currentElapsed)
        setIsActive(true)
        if (savedAlarm > 0 && currentElapsed >= savedAlarm) alarmNotifiedRef.current = true
      }
    }
  }, [clearTimerStorage, handleAutoStopSleep, updateElapsedTime])

  /* ========================================================================
     5. SISTEM ALARM & NOTIFIKASI BROWSER
     ======================================================================== */
  const triggerBrowserNotification = useCallback(() => {
    if (notificationRef.current) {
      notificationRef.current.close()
    }

    if (!('Notification' in window)) return

    if (Notification.permission === 'granted') {
      const hours = Math.floor(alarmLimit / 3600)
      const minutes = Math.floor((alarmLimit % 3600) / 60)
      const timeText = hours > 0 ? `${hours} Jam` : `${minutes} Menit`

      notificationRef.current = new Notification('⚠️ Waktu Layar Habis!', {
        body: `Kamu sudah menggunakan layar selama ${timeText}. Waktunya istirahat!`,
        icon: '/favicon.ico',
        tag: 'screen-time-alarm',
        requireInteraction: true
      })

      setTimeout(() => {
        if (notificationRef.current) {
          notificationRef.current.close()
          notificationRef.current = null
        }
      }, 30000)

      if ('vibrate' in navigator) {
        try {
          navigator.vibrate([200, 100, 200])
        } catch (e) {
          console.warn('Vibration API failed:', e)
        }
      }
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().catch(e => {
        console.warn('Failed to request notification permission:', e)
      })
    }
  }, [alarmLimit])

  useEffect(() => {
    elapsedRef.current = elapsedTime 
    if (isActive && alarmLimit > 0 && elapsedTime >= alarmLimit && !alarmNotifiedRef.current) {
      triggerBrowserNotification()
      alarmNotifiedRef.current = true
    }
  }, [elapsedTime, isActive, alarmLimit, triggerBrowserNotification])

  /* ========================================================================
     6. MESIN TIMER UTAMA & DETEKSI TAB VISIBILITY
     ======================================================================== */
  useEffect(() => {
    let interval: NodeJS.Timeout
    let lastRealTime = Date.now() 

    if (isActive) {
      const startMsStr = localStorage.getItem('timer_start_ms')
      const startMs = startMsStr ? parseInt(startMsStr, 10) : Date.now()

      interval = setInterval(() => {
        const now = Date.now()
        const lastTickStr = localStorage.getItem('timer_last_tick')
        const lastTick = lastTickStr ? parseInt(lastTickStr, 10) : now

        const gapSeconds = Math.floor((now - lastTick) / 1000)
        const realTimeDiff = Math.abs(now - lastRealTime)

        if (realTimeDiff < 500 || realTimeDiff > 2000) {
          console.warn(`Clock adjustment detected! Real diff: ${realTimeDiff}ms`)
          const actualElapsed = Math.floor((now - startMs) / 1000)
          if (actualElapsed >= 0) { 
            updateElapsedTime(actualElapsed)
            localStorage.setItem('timer_last_tick', now.toString())
          }
          lastRealTime = now
          return
        }

        if (gapSeconds > 60) {
          clearInterval(interval)
          const finalSeconds = Math.floor((lastTick - startMs) / 1000)
          handleAutoStopSleep(finalSeconds, lastTick)
        } else if (gapSeconds < 0) {
          console.warn('Negative gap detected, recalculating from start_ms')
          const actualElapsed = Math.floor((now - startMs) / 1000)
          if (actualElapsed >= 0) {
            updateElapsedTime(actualElapsed)
            localStorage.setItem('timer_last_tick', now.toString())
          }
        } else {
          const actualElapsed = Math.floor((now - startMs) / 1000)
          updateElapsedTime(actualElapsed)
          localStorage.setItem('timer_last_tick', now.toString())
        }

        lastRealTime = now
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isActive, handleAutoStopSleep, updateElapsedTime])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isActive) {
        if (autoStopTriggeredRef.current) return

        const savedStartMs = parseInt(localStorage.getItem('timer_start_ms') || '0', 10)
        const savedLastTick = parseInt(localStorage.getItem('timer_last_tick') || '0', 10)
        const now = Date.now()

        if (savedLastTick > 0 && savedStartMs > 0) {
          const gapSeconds = Math.floor((now - savedLastTick) / 1000)

          if (gapSeconds > 60) {
            console.warn(`Tab suspended terdeteksi! Gap: ${gapSeconds} detik`)
            const finalSeconds = Math.floor((savedLastTick - savedStartMs) / 1000)
            handleAutoStopSleep(finalSeconds, savedLastTick)
          } else {
            const actualElapsed = Math.floor((now - savedStartMs) / 1000)
            updateElapsedTime(actualElapsed)
            localStorage.setItem('timer_last_tick', now.toString())
          }
        }
      }
    }

    const handlePageFocus = () => {
      if (isActive && !autoStopTriggeredRef.current) {
        const savedStartMs = parseInt(localStorage.getItem('timer_start_ms') || '0', 10)
        const now = Date.now()

        if (savedStartMs > 0) {
          const actualElapsed = Math.floor((now - savedStartMs) / 1000)
          updateElapsedTime(actualElapsed) 
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handlePageFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handlePageFocus)
    }
  }, [isActive, handleAutoStopSleep, updateElapsedTime]) 

  const handleStart = () => {
    setIsActive(true)
    alarmNotifiedRef.current = false
    autoStopTriggeredRef.current = false 
    const now = Date.now()

    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') Notification.requestPermission()
    }

    localStorage.setItem('timer_start_ms', now.toString())
    localStorage.setItem('timer_is_active', 'true')
    localStorage.setItem('timer_last_tick', now.toString())
    localStorage.setItem('timer_alarm_limit', alarmLimit.toString())
  }

  const handleStop = async () => {
    if (loading) return 

    setIsActive(false)
    setLoading(true)
    const finalSeconds = elapsedRef.current
    clearTimerStorage()

    if (notificationRef.current) {
      notificationRef.current.close()
      notificationRef.current = null
    }

    if (finalSeconds > 0) {
      const endTime = new Date()
      const startTime = new Date(endTime.getTime() - finalSeconds * 1000)

      const records = splitSessionsByMidnight(startTime, endTime, 'Sesi Baru')

      const { error } = await supabase.from('screen_time').insert(records)

      if (error) {
        console.error('Failed to save session:', error)
        alert('Gagal menyimpan data. Error: ' + error.message)
        setIsActive(true)
        setLoading(false)
        return
      }
    }

    setLoading(false)
    updateElapsedTime(0)
    setAlarmLimit(0)
    autoStopTriggeredRef.current = false 
    alarmNotifiedRef.current = false
  }

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0')
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${h}:${m}:${s}`
  }

  if (!isMounted) return null

  /* ========================================================================
     7. ANTARMUKA PENGGUNA (UI / HTML)
     ======================================================================== */
  return (
    <main className="flex flex-col items-center justify-between min-h-screen bg-black text-white py-16 px-4 relative">
      <button onClick={handleLogout} className="absolute top-6 right-6 text-xs tracking-widest uppercase text-gray-500 hover:text-red-500 transition-colors">
        Keluar
      </button>
      
      <h1 className="text-sm tracking-[0.3em] uppercase font-light text-gray-400">
        Screen Time Tracker
      </h1>

      <div className="flex flex-col items-center">
        <div className="text-[100px] sm:text-[140px] md:text-[180px] font-extralight tracking-tighter tabular-nums leading-none">
          {formatTime(elapsedTime)}
        </div>

        <div className="mt-4">
          <select
            value={alarmLimit}
            onChange={(e) => setAlarmLimit(parseInt(e.target.value, 10))}
            disabled={isActive}
            className="bg-transparent text-gray-500 text-xs tracking-widest uppercase outline-none text-center cursor-pointer border border-transparent hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <option value={0} className="bg-neutral-900 text-white">Sesi Bebas (Tanpa Alarm)</option>
            <option value={10} className="bg-neutral-900 text-white">Set Alarm: 10 Detik (Untuk Tes)</option>
            <option value={1800} className="bg-neutral-900 text-white">Set Alarm: 30 Menit</option>
            <option value={3600} className="bg-neutral-900 text-white">Set Alarm: 1 Jam</option>
            <option value={5400} className="bg-neutral-900 text-white">Set Alarm: 1 Jam 30 Menit</option>
            <option value={7200} className="bg-neutral-900 text-white">Set Alarm: 2 Jam</option>
            <option value={14400} className="bg-neutral-900 text-white">Set Alarm: 4 Jam</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col items-center gap-12">
        {!isActive ? (
          <button onClick={handleStart} className="w-20 h-20 flex items-center justify-center bg-white text-black rounded-full hover:scale-105 transition-transform shadow-lg shadow-white/5">
            <Play size={32} fill="black" />
          </button>
        ) : (
          <button onClick={handleStop} disabled={loading} className="w-20 h-20 flex items-center justify-center border-2 border-white text-white rounded-full hover:scale-105 transition-transform disabled:opacity-50">
            {loading ? <span className="w-6 h-6 border-2 border-t-transparent border-white rounded-full animate-spin"></span> : <Square size={32} fill="white" />}
          </button>
        )}

        <Link href="/history" className="text-xs tracking-widest uppercase text-gray-500 hover:text-white transition-colors">
          Lihat Riwayat
        </Link>
      </div>
    </main>
  )
}