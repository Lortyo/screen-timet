'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Trash2, Edit2, Check, X, Info } from 'lucide-react'
import { useRouter } from 'next/navigation'

type ScreenTime = {
  id: string
  description: string
  duration_seconds: number
  start_time: string  // Tambah kolom ini ke tipe data
  end_time: string    // Tambah kolom ini ke tipe data
  created_at: string
}

type GroupedData = {
  [date: string]: {
    entries: ScreenTime[]
    totalSeconds: number
  }
}

const LIMIT_SECONDS = 6 * 3600 // Batas 6 Jam

const getHealthStatus = (totalSeconds: number) => {
  const hours = totalSeconds / 3600

  if (hours <= 4) {
    return { label: 'Optimal', color: 'text-green-500', border: 'border-green-900', bg: 'bg-green-950/30' }
  } else if (hours <= 7) {
    return { label: 'Wajar', color: 'text-blue-500', border: 'border-blue-900', bg: 'bg-blue-950/30' }
  } else if (hours <= 10) {
    return { label: 'Waspada', color: 'text-yellow-500', border: 'border-yellow-900', bg: 'bg-yellow-950/30' }
  } else {
    return { label: 'Bahaya', color: 'text-red-500', border: 'border-red-900', bg: 'bg-red-950/30' }
  }
}

export default function HistoryPage() {
  const supabase = createClient()
  const router = useRouter()
  const [groupedData, setGroupedData] = useState<GroupedData>({})
  const [loading, setLoading] = useState(true)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
      } else {
        fetchHistory() // Panggil riwayat HANYA jika sudah dipastikan login
      }
    }
    checkUser()
  }, [router, supabase])

  const fetchHistory = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('screen_time')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error)
      setLoading(false)
      return
    }

    groupAndSetData(data as ScreenTime[])
  }

  const groupAndSetData = (data: ScreenTime[]) => {
    const grouped = data.reduce((acc: GroupedData, curr: ScreenTime) => {
      const dateStr = new Date(curr.created_at).toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })

      if (!acc[dateStr]) acc[dateStr] = { entries: [], totalSeconds: 0 }
      
      acc[dateStr].entries.push(curr)
      acc[dateStr].totalSeconds += curr.duration_seconds
      return acc
    }, {})

    setGroupedData(grouped)
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    const confirmDelete = confirm('Hapus riwayat ini?')
    if (!confirmDelete) return
    await supabase.from('screen_time').delete().eq('id', id)
    fetchHistory() 
  }

  const handleEditSave = async (id: string) => {
    if (!editValue.trim()) return
    await supabase.from('screen_time').update({ description: editValue }).eq('id', id)
    setEditingId(null)
    fetchHistory()
  }

  const formatHours = (seconds: number) => `${(seconds / 3600).toFixed(1)} Jam`
  
  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${h}h ${m}m`
    return `${m}m ${s}s`
  }

  // Fungsi Baru: Mengubah tanggal ISO Supabase menjadi Format Jam Digital (HH:MM)
  const formatClockTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-gray-500">
        Memuat riwayat...
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-black text-white p-6 md:p-12 font-light">
      <div className="max-w-3xl mx-auto">
        
        <div className="flex justify-between items-center mb-8 border-b border-gray-900 pb-6">
          <Link href="/" className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition">
            <ArrowLeft size={16} /> Kembali ke Timer
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/summary" className="text-xs tracking-widest uppercase text-blue-500 hover:text-blue-400 transition">
              Lihat Ringkasan Mingguan &rarr;
            </Link>
            <h1 className="text-sm tracking-[0.3em] uppercase text-gray-500">Riwayat</h1>
          </div>
        </div>

        {/* Info Legend Card */}
        <div className="mb-12 border border-gray-800 rounded-lg p-4 bg-gray-900/20">
          <div className="flex items-center gap-2 mb-3 text-gray-400">
            <Info size={16} />
            <span className="text-xs tracking-widest uppercase">Indikator Kesehatan Jurnal Medis</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500"></span> {'< 4 Jam (Optimal)'}</div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500"></span> {'4-7 Jam (Wajar)'}</div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-yellow-500"></span> {'7-10 Jam (Waspada)'}</div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500"></span> {'> 10 Jam (Bahaya)'}</div>
          </div>
        </div>

        {Object.entries(groupedData).map(([date, group]) => {
          const status = getHealthStatus(group.totalSeconds)

          return (
            <div key={date} className="mb-12">
              <div className="flex justify-between items-end border-b border-gray-800 pb-4 mb-4">
                <h2 className="text-lg md:text-xl font-normal tracking-wide text-gray-200">{date}</h2>
                <div className="text-right flex items-center gap-4">
                  <p className="text-sm md:text-base font-mono text-gray-400">{formatHours(group.totalSeconds)}</p>
                  <span className={`text-[10px] tracking-widest uppercase border ${status.border} ${status.color} ${status.bg} px-2 py-1 rounded`}>
                    {status.label}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                {group.entries.map((entry) => (
                  <div key={entry.id} className="group flex flex-col md:flex-row md:items-center justify-between py-3 px-2 rounded hover:bg-gray-900/50 transition">
                    
                    <div className="flex-1 mb-2 md:mb-0 pr-4">
                      {editingId === entry.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="bg-gray-800 text-white text-sm px-3 py-1 rounded outline-none border border-gray-700 w-full focus:border-gray-500"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && handleEditSave(entry.id)}
                          />
                          <button onClick={() => handleEditSave(entry.id)} className="text-green-500 hover:text-green-400 p-1">
                            <Check size={18} />
                          </button>
                          <button onClick={() => setEditingId(null)} className="text-red-500 hover:text-red-400 p-1">
                            <X size={18} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                          <span className="text-sm md:text-base text-gray-300 group-hover:text-white transition">
                            {entry.description}
                          </span>
                          {/* Tampilan Jam Mulai s.d Selesai yang Baru */}
                          <span className="text-[11px] font-mono text-gray-500 bg-gray-900/40 px-1.5 py-0.5 rounded w-max">
                            {formatClockTime(entry.start_time)} — {formatClockTime(entry.end_time)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-6">
                      <span className="text-sm font-mono text-gray-400">{formatDuration(entry.duration_seconds)}</span>
                      
                      <div className="flex items-center gap-3 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        {editingId !== entry.id && (
                          <button 
                            onClick={() => {
                              setEditingId(entry.id)
                              setEditValue(entry.description)
                            }} 
                            className="text-gray-500 hover:text-white transition"
                          >
                            <Edit2 size={16} />
                          </button>
                        )}
                        <button onClick={() => handleDelete(entry.id)} className="text-gray-500 hover:text-red-500 transition">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    
                  </div>
                ))}
              </div>
            </div>
          )
        })}
        
        {Object.keys(groupedData).length === 0 && (
          <div className="text-center text-sm tracking-widest text-gray-600 uppercase mt-20">
            Belum ada data terekam
          </div>
        )}
      </div>
    </main>
  )
}