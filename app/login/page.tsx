'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { ArrowRight, Loader2 } from 'lucide-react'

export default function LoginPage() {
  /* ========================================================================
     1. KUMPULAN STATE & ROUTING
     Bagian ini menyimpan status mode form (Login atau Register), data input 
     pengguna (email dan password), status loading, dan pesan error.
     ======================================================================== */
  const [isLoginMode, setIsLoginMode] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  
  const router = useRouter()
  const supabase = createClient()

  /* ========================================================================
     2. PROTEKSI HALAMAN (AUTO-REDIRECT)
     Jika pengguna sudah memiliki sesi login yang aktif dan mencoba mengakses
     halaman /login, mereka akan langsung dialihkan ke halaman utama (Timer).
     ======================================================================== */
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) router.push('/')
    }
    checkSession()
  }, [router, supabase])

  /* ========================================================================
     3. LOGIKA FORM SUBMIT (LOGIN & REGISTER)
     Menangani proses autentikasi ke Supabase saat form disubmit.
     Membedakan alur eksekusi berdasarkan mode form saat ini (isLoginMode).
     ======================================================================== */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('') // Reset pesan error sebelum percobaan baru

    if (isLoginMode) {
      // ---> ALUR MASUK (LOGIN)
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setErrorMsg('Email atau password salah.')
        setLoading(false)
      } else {
        router.push('/') // Berhasil login, arahkan ke Timer
      }
    } else {
      // ---> ALUR DAFTAR (REGISTER)
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setErrorMsg(error.message)
        setLoading(false)
      } else {
        // Jika verifikasi email (Confirm Email) di Supabase dinonaktifkan,
        // pengguna baru akan langsung mendapatkan sesi dan otomatis login.
        if (data.session) {
          router.push('/')
        } else {
          // Jika verifikasi email aktif, minta pengguna untuk login manual.
          setIsLoginMode(true)
          setErrorMsg('Pendaftaran berhasil! Silakan masuk.')
        }
      }
    }
  }

  /* ========================================================================
     4. ANTARMUKA PENGGUNA (UI / HTML)
     ======================================================================== */
  return (
    <main className="min-h-screen bg-black flex flex-col justify-center items-center p-6 font-light">
      <div className="w-full max-w-sm">
        
        {/* === Header Branding === */}
        <div className="text-center mb-12">
          <h2 className="text-xs tracking-[0.3em] uppercase text-gray-500">
            Screen Time Tracker
          </h2>
        </div>

        {/* === Judul & Deskripsi Form === */}
        <h1 className="text-3xl font-extralight text-white mb-2 tracking-wide">
          {isLoginMode ? 'Selamat Datang' : 'Buat Akun'}
        </h1>
        <p className="text-gray-500 text-sm mb-8">
          {isLoginMode 
            ? 'Masuk untuk melanjutkan pelacakan waktu layarmu.' 
            : 'Mulai melacak waktu layar dan jaga kesehatanmu.'}
        </p>

        {/* === Kotak Notifikasi Error/Sukses === */}
        {errorMsg && (
          <div className={`mb-6 p-3 text-sm border rounded ${
            errorMsg.includes('berhasil') 
              ? 'bg-green-950/30 text-green-500 border-green-900' 
              : 'bg-red-950/30 text-red-500 border-red-900'
          }`}>
            {errorMsg}
          </div>
        )}
        
        {/* === Form Input === */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <input
              type="email"
              placeholder="Alamat Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-transparent text-white px-4 py-3 rounded outline-none border border-gray-800 focus:border-gray-400 transition placeholder:text-gray-700"
              required
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="Password (Min. 6 Karakter)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-transparent text-white px-4 py-3 rounded outline-none border border-gray-800 focus:border-gray-400 transition placeholder:text-gray-700"
              required
              minLength={5}
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-white text-black py-3.5 rounded font-medium hover:bg-gray-200 transition mt-2 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                {isLoginMode ? 'Masuk' : 'Daftar Sekarang'}
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* === Tombol Toggle Mode (Login/Register) === */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            {isLoginMode ? 'Belum punya akun?' : 'Sudah punya akun?'}
            <button 
              onClick={() => {
                setIsLoginMode(!isLoginMode)
                setErrorMsg('') // Bersihkan pesan error saat ganti mode
              }}
              className="ml-2 text-white hover:underline underline-offset-4"
            >
              {isLoginMode ? 'Daftar di sini' : 'Masuk'}
            </button>
          </p>
        </div>

      </div>
    </main>
  )
}