'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Calendar, Activity, Target } from 'lucide-react'
import { useRouter } from 'next/navigation'

type ScreenTime = {
  duration_seconds: number
  created_at: string
}

type WeeklyData = {
  [weekRange: string]: {
    totalSeconds: number
  }
}

// 1. Status Kesehatan Medis
const getHealthStatus = (dailyAvgSeconds: number) => {
  const hours = dailyAvgSeconds / 3600
  if (hours <= 4) return { label: 'Rata-rata Optimal', color: 'text-green-500', border: 'border-green-900', bg: 'bg-green-950/30' }
  if (hours <= 7) return { label: 'Rata-rata Wajar', color: 'text-blue-500', border: 'border-blue-900', bg: 'bg-blue-950/30' }
  if (hours <= 10) return { label: 'Rata-rata Waspada', color: 'text-yellow-500', border: 'border-yellow-900', bg: 'bg-yellow-950/30' }
  return { label: 'Rata-rata Bahaya', color: 'text-red-500', border: 'border-red-900', bg: 'bg-red-950/30' }
}

// 2. Saran Target Jam (Sangat Singkat)
const getRecommendation = (dailyAvgSeconds: number) => {
  const hours = dailyAvgSeconds / 3600
  if (hours <= 4) return "Pertahankan < 4 Jam / Hari"
  if (hours <= 7) return "Pertahankan < 7 Jam / Hari"
  if (hours <= 10) return "Kurangi hingga < 7 Jam / Hari"
  return "Segera kurangi < 7 Jam / Hari"
}

export default function SummaryPage() {
  const supabase = createClient()
  const router = useRouter()
  const [weeklyData, setWeeklyData] = useState<WeeklyData>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkUserAndFetch = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      fetchData()
    }
    checkUserAndFetch()
  }, [router, supabase])

  const fetchData = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('screen_time')
      .select('duration_seconds, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error)
      setLoading(false)
      return
    }

    const grouped = (data as ScreenTime[]).reduce((acc: WeeklyData, curr: ScreenTime) => {
      const d = new Date(curr.created_at)
      const day = d.getDay()
      const diff = d.getDate() - day + (day === 0 ? -6 : 1) 
      const monday = new Date(d.setDate(diff))
      
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      
      const opt = { day: 'numeric', month: 'short' } as const
      const weekKey = `${monday.toLocaleDateString('id-ID', opt)} — ${sunday.toLocaleDateString('id-ID', { ...opt, year: 'numeric' })}`

      if (!acc[weekKey]) acc[weekKey] = { totalSeconds: 0 }
      acc[weekKey].totalSeconds += curr.duration_seconds
      
      return acc
    }, {})

    setWeeklyData(grouped)
    setLoading(false)
  }

  const formatHours = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}j ${minutes}m`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-gray-500">
        Menghitung kalkulasi mingguan...
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-black text-white p-6 md:p-12 font-light">
      <div className="max-w-4xl mx-auto">
        
        <div className="flex justify-between items-center mb-12 border-b border-gray-900 pb-6">
          <Link href="/history" className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition">
            <ArrowLeft size={16} /> Kembali ke Riwayat
          </Link>
          <h1 className="text-sm tracking-[0.3em] uppercase text-gray-500">Ringkasan</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Object.entries(weeklyData).map(([week, data]) => {
            const dailyAvgSeconds = data.totalSeconds / 7
            const status = getHealthStatus(dailyAvgSeconds)
            const recommendation = getRecommendation(dailyAvgSeconds) 

            return (
              <div key={week} className="flex flex-col border border-gray-800 bg-neutral-950/30 p-6 rounded-lg hover:border-gray-700 transition">
                <div className="flex items-center gap-2 text-gray-400 mb-6">
                  <Calendar size={16} />
                  <h2 className="text-sm font-medium tracking-wide">{week}</h2>
                </div>
                
                <div className="space-y-6 flex-1">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Total Waktu (7 Hari)</p>
                    <p className="text-3xl font-extralight tabular-nums text-white">
                      {formatHours(data.totalSeconds)}
                    </p>
                  </div>

                  <div className="border-t border-gray-800 pt-4">
                    <div className="flex justify-between items-end mb-3">
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-widest mb-1 flex items-center gap-2">
                          <Activity size={12} /> Rata-rata Harian
                        </p>
                        <p className="text-xl font-extralight tabular-nums text-gray-300">
                          {formatHours(dailyAvgSeconds)}
                        </p>
                      </div>
                      <span className={`text-[10px] tracking-widest uppercase border ${status.border} ${status.color} ${status.bg} px-2 py-1 rounded`}>
                        {status.label}
                      </span>
                    </div>

                    {/* Area Teks Rekomendasi (Lebih Ramping & Minimalis) */}
                    <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 bg-gray-900/20 p-2 rounded">
                      <Target size={14} className="text-blue-500" />
                      <span>Saran: <span className="text-gray-300 font-medium">{recommendation}</span></span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {Object.keys(weeklyData).length === 0 && (
          <div className="text-center text-sm tracking-widest text-gray-600 uppercase mt-20">
            Belum ada ringkasan tersedia
          </div>
        )}

      </div>
    </main>
  )
}