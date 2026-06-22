'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Calendar, Activity, Target } from 'lucide-react'
import { useRouter } from 'next/navigation'

/* ========================================================================
   1. DEFINISI TIPE DATA
   Bagian ini mendefinisikan bentuk data mentah dari database (ScreenTime)
   dan bentuk data yang sudah dikelompokkan per minggu (WeeklyData).
   ======================================================================== */
type ScreenTime = {
  duration_seconds: number
  created_at: string
}

type WeeklyData = {
  [weekRange: string]: {
    totalSeconds: number
  }
}

/* ========================================================================
   2. LOGIKA KESEHATAN & REKOMENDASI MEDIS
   Fungsi-fungsi ini bertugas mengevaluasi rata-rata jam harian pengguna,
   lalu mengembalikan status warna (hijau/kuning/merah) beserta saran singkat.
   ======================================================================== */
const getHealthStatus = (dailyAvgSeconds: number) => {
  const hours = dailyAvgSeconds / 3600
  if (hours <= 4) return { label: 'Rata-rata Optimal', color: 'text-green-500', border: 'border-green-900', bg: 'bg-green-950/30' }
  if (hours <= 7) return { label: 'Rata-rata Wajar', color: 'text-blue-500', border: 'border-blue-900', bg: 'bg-blue-950/30' }
  if (hours <= 10) return { label: 'Rata-rata Waspada', color: 'text-yellow-500', border: 'border-yellow-900', bg: 'bg-yellow-950/30' }
  return { label: 'Rata-rata Bahaya', color: 'text-red-500', border: 'border-red-900', bg: 'bg-red-950/30' }
}

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

  /* ========================================================================
     3. KUMPULAN STATE 
     Menyimpan data riwayat yang sudah dikalkulasi per minggu dan 
     status indikator memuat data (loading).
     ======================================================================== */
  const [weeklyData, setWeeklyData] = useState<WeeklyData>({})
  const [loading, setLoading] = useState(true)

  /* ========================================================================
     4. MANAJEMEN AKUN & PENGAMBILAN DATA DARI DATABASE
     Mengecek status login terlebih dahulu. Jika aman, langsung tarik semua 
     data riwayat pengguna dari Supabase, hanya mengambil kolom durasi dan waktu.
     ======================================================================== */
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
      .order('created_at', { ascending: false }) // Urutkan dari yang terbaru ke terlama

    if (error) {
      console.error(error)
      setLoading(false)
      return
    }

    /* ========================================================================
       5. LOGIKA KALKULASI & PENGELOMPOKAN MINGGUAN (GROUPING)
       Mengubah rentetan data harian menjadi kelompok mingguan.
       Kode ini mencari hari Senin dari tanggal tersebut, lalu mencari hari Minggunya,
       untuk membuat judul rentang minggu (misal: "12 Mei — 18 Mei 2026").
       ======================================================================== */
    const grouped = (data as ScreenTime[]).reduce((acc: WeeklyData, curr: ScreenTime) => {
      const d = new Date(curr.created_at)
      const day = d.getDay()
      
      // Rumus matematika mencari hari Senin pada minggu yang sama
      const diff = d.getDate() - day + (day === 0 ? -6 : 1) 
      const monday = new Date(d.setDate(diff))
      
      // Menemukan hari Minggu (Senin + 6 hari)
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      
      // Membuat format teks judul untuk minggu tersebut
      const opt = { day: 'numeric', month: 'short' } as const
      const weekKey = `${monday.toLocaleDateString('id-ID', opt)} — ${sunday.toLocaleDateString('id-ID', { ...opt, year: 'numeric' })}`

      // Jika minggu tersebut belum ada di objek wadah, buat wadah baru berisi 0 detik
      if (!acc[weekKey]) acc[weekKey] = { totalSeconds: 0 }
      
      // Tambahkan durasi sesi tersebut ke dalam wadah minggunya
      acc[weekKey].totalSeconds += curr.duration_seconds
      
      return acc
    }, {})

    setWeeklyData(grouped)
    setLoading(false)
  }

  /* ========================================================================
     6. FUNGSI FORMATTING (WAKTU & DURASI)
     Mengubah angka detik mutlak dari database menjadi format teks jam dan menit 
     yang mudah dibaca pengguna (misal: 10j 30m).
     ======================================================================== */
  const formatHours = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}j ${minutes}m`
  }

  /* ========================================================================
     7. ANTARMUKA PENGGUNA (UI / HTML)
     ======================================================================== */
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
        
        {/* Header & Navigasi */}
        <div className="flex justify-between items-center mb-12 border-b border-gray-900 pb-6">
          <Link href="/history" className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition">
            <ArrowLeft size={16} /> Kembali ke Riwayat
          </Link>
          <h1 className="text-sm tracking-[0.3em] uppercase text-gray-500">Ringkasan</h1>
        </div>

        {/* Daftar Kartu Ringkasan Mingguan */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Object.entries(weeklyData).map(([week, data]) => {
            
            // Evaluasi rata-rata harian (dibagi 7 hari)
            const dailyAvgSeconds = data.totalSeconds / 7
            const status = getHealthStatus(dailyAvgSeconds)
            const recommendation = getRecommendation(dailyAvgSeconds) 

            return (
              <div key={week} className="flex flex-col border border-gray-800 bg-neutral-950/30 p-6 rounded-lg hover:border-gray-700 transition">
                
                {/* Judul Rentang Minggu */}
                <div className="flex items-center gap-2 text-gray-400 mb-6">
                  <Calendar size={16} />
                  <h2 className="text-sm font-medium tracking-wide">{week}</h2>
                </div>
                
                <div className="space-y-6 flex-1">
                  
                  {/* Total Jam Seminggu */}
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Total Waktu (7 Hari)</p>
                    <p className="text-3xl font-extralight tabular-nums text-white">
                      {formatHours(data.totalSeconds)}
                    </p>
                  </div>

                  <div className="border-t border-gray-800 pt-4">
                    <div className="flex justify-between items-end mb-3">
                      
                      {/* Rata-rata Harian & Status */}
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

                    {/* Area Teks Rekomendasi (Saran Medis) */}
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

        {/* Tampilan Jika Data Riwayat Masih Kosong */}
        {Object.keys(weeklyData).length === 0 && (
          <div className="text-center text-sm tracking-widest text-gray-600 uppercase mt-20">
            Belum ada ringkasan tersedia
          </div>
        )}

      </div>
    </main>
  )
}