'use client'
import { useState, useEffect, useRef } from 'react'
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

  const handleLogout = async () => {
    const finalSeconds = elapsedRef.current
    if (isActive && finalSeconds > 0) {
      await supabase.from('screen_time').insert([{
        description: 'Sesi Baru (Tersimpan otomatis saat Logout)',
        start_time: new Date(Date.now() - finalSeconds * 1000).toISOString(),
        end_time: new Date().toISOString(),
        duration_seconds: finalSeconds,
      }])
    }
    await supabase.auth.signOut()
    localStorage.clear()
    router.push('/login')
  }

  /* ========================================================================
     3. SISTEM AUTO-STOP (DETEKTOR MODE SLEEP LINTAS WAKTU)
     Fungsi baru ini akan dipanggil jika terdeteksi jeda waktu yang tidak wajar
     ======================================================================== */
  const handleAutoStopSleep = async (seconds: number, endMs: number) => {
    if (seconds <= 0) {
      localStorage.clear()
      setIsActive(false)
      return
    }
    
    // Matikan timer dan bersihkan memori di awal agar tidak looping
    setIsActive(false)
    localStorage.clear()
    setElapsedTime(0)
    setAlarmLimit(0)

    const { error } = await supabase.from('screen_time').insert([{
      description: 'Sesi Baru (Berhenti Otomatis - Laptop Sleep/Mati)',
      start_time: new Date(endMs - seconds * 1000).toISOString(),
      end_time: new Date(endMs).toISOString(), // Menggunakan waktu tepat SEBELUM laptop tertidur
      duration_seconds: seconds,
    }])
    
    if (!error) {
      alert('Laptop terdeteksi Sleep atau tab ditutup. Timer telah dihentikan otomatis dan datamu berhasil disimpan!')
    }
  }

  /* ========================================================================
     4. PEMULIHAN AWAL (SAAT HALAMAN BARU DIBUKA)
     ======================================================================== */
  useEffect(() => {
    setIsMounted(true)

    const savedActive = localStorage.getItem('timer_is_active') === 'true'
    const savedLastTick = parseInt(localStorage.getItem('timer_last_tick') || '0', 10)
    const savedStartMs = parseInt(localStorage.getItem('timer_start_ms') || '0', 10)
    const savedAlarm = parseInt(localStorage.getItem('timer_alarm_limit') || '0', 10)

    if (savedAlarm > 0) setAlarmLimit(savedAlarm)

    if (savedActive && savedLastTick > 0 && savedStartMs > 0) {
      const now = Date.now()
      const timeGapSeconds = Math.floor((now - savedLastTick) / 1000)

      if (timeGapSeconds > 60) { // Batas Toleransi Sleep: 60 Detik
        const secondsBeforeSleep = Math.floor((savedLastTick - savedStartMs) / 1000)
        handleAutoStopSleep(secondsBeforeSleep, savedLastTick)
      } else {
        const currentElapsed = Math.floor((now - savedStartMs) / 1000)
        setElapsedTime(currentElapsed)
        setIsActive(true)
        if (savedAlarm > 0 && currentElapsed >= savedAlarm) alarmNotifiedRef.current = true
      }
    }
  }, [])

  /* ========================================================================
     5. SISTEM ALARM & NOTIFIKASI BROWSER
     ======================================================================== */
  useEffect(() => {
    elapsedRef.current = elapsedTime
    if (isActive && alarmLimit > 0 && elapsedTime >= alarmLimit && !alarmNotifiedRef.current) {
      triggerBrowserNotification()
      alarmNotifiedRef.current = true
    }
  }, [elapsedTime, isActive, alarmLimit])

  const triggerBrowserNotification = () => {
    if (!('Notification' in window)) return
    if (Notification.permission === 'granted') {
      const hours = Math.floor(alarmLimit / 3600)
      const minutes = Math.floor((alarmLimit % 3600) / 60)
      const timeText = hours > 0 ? `${hours} Jam` : `${minutes} Menit`

      new Notification('⚠️ Waktu Layar Habis!', {
        body: `Kamu sudah menggunakan layar selama ${timeText}. Waktunya istirahat!`,
        icon: '/favicon.ico',
        tag: 'screen-time-alarm',
        requireInteraction: true
      })
      if ('vibrate' in navigator) navigator.vibrate([200, 100, 200])
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(p => p === 'granted' && triggerBrowserNotification())
    }
  }

  /* ========================================================================
     6. MESIN TIMER UTAMA (DENGAN DETEKTOR MODE SLEEP LANGSUNG)
     ======================================================================== */
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isActive) {
      const startMsStr = localStorage.getItem('timer_start_ms')
      const startMs = startMsStr ? parseInt(startMsStr, 10) : Date.now()

      interval = setInterval(() => {
        const now = Date.now()
        const lastTickStr = localStorage.getItem('timer_last_tick')
        const lastTick = lastTickStr ? parseInt(lastTickStr, 10) : now

        const gapSeconds = Math.floor((now - lastTick) / 1000)

        // LOGIKA BARU: Jika timer sedang jalan tapi tiba-tiba ada jeda > 60 detik antar detak 
        // (Artinya laptop baru saja bangun dari Sleep)
        if (gapSeconds > 60) {
          clearInterval(interval) // Hentikan hitungan saat ini juga
          const finalSeconds = Math.floor((lastTick - startMs) / 1000)
          handleAutoStopSleep(finalSeconds, lastTick) // Tembak fungsi simpan otomatis
        } else {
          const actualElapsed = Math.floor((now - startMs) / 1000)
          setElapsedTime(actualElapsed)
          localStorage.setItem('timer_last_tick', now.toString())
        }
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isActive])

  const handleStart = () => {
    setIsActive(true)
    alarmNotifiedRef.current = false
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
    setIsActive(false)
    setLoading(true)
    const finalSeconds = elapsedRef.current
    localStorage.clear()

    if (finalSeconds > 0) {
      const { error } = await supabase.from('screen_time').insert([{
        description: 'Sesi Baru',
        start_time: new Date(Date.now() - finalSeconds * 1000).toISOString(),
        end_time: new Date().toISOString(),
        duration_seconds: finalSeconds,
      }])
      if (error) console.error(error)
    }
    setLoading(false)
    setElapsedTime(0)
    setAlarmLimit(0)
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