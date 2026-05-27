'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { ArrowRight, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [isLoginMode, setIsLoginMode] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  
  const router = useRouter()
  const supabase = createClient()

  // Jika user tiba-tiba membuka /login tapi ternyata sudah punya sesi aktif, lempar ke Timer
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) router.push('/')
    }
    checkSession()
  }, [router, supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('') // Reset error sebelumnya

    if (isLoginMode) {
      // PROSES LOGIN
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setErrorMsg('Email atau password salah.')
        setLoading(false)
      } else {
        router.push('/')
      }
    } else {
      // PROSES DAFTAR (REGISTER)
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setErrorMsg(error.message)
        setLoading(false)
      } else {
        // Jika setting verifikasi email Supabase dimatikan, user langsung otomatis login
        if (data.session) {
          router.push('/')
        } else {
          setIsLoginMode(true)
          setErrorMsg('Pendaftaran berhasil! Silakan masuk.')
        }
      }
    }
  }

  return (
    <main className="min-h-screen bg-black flex flex-col justify-center items-center p-6 font-light">
      <div className="w-full max-w-sm">
        
        {/* Branding Kecil di Atas */}
        <div className="text-center mb-12">
          <h2 className="text-xs tracking-[0.3em] uppercase text-gray-500">
            Screen Time Tracker
          </h2>
        </div>

        {/* Judul Form */}
        <h1 className="text-3xl font-extralight text-white mb-2 tracking-wide">
          {isLoginMode ? 'Selamat Datang' : 'Buat Akun'}
        </h1>
        <p className="text-gray-500 text-sm mb-8">
          {isLoginMode 
            ? 'Masuk untuk melanjutkan pelacakan waktu layarmu.' 
            : 'Mulai melacak waktu layar dan jaga kesehatanmu.'}
        </p>

        {/* Notifikasi Error (Ganti Alert Browser) */}
        {errorMsg && (
          <div className={`mb-6 p-3 text-sm border rounded ${
            errorMsg.includes('berhasil') 
              ? 'bg-green-950/30 text-green-500 border-green-900' 
              : 'bg-red-950/30 text-red-500 border-red-900'
          }`}>
            {errorMsg}
          </div>
        )}
        
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

        {/* Tombol Toggle Mode (Login/Register) */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            {isLoginMode ? 'Belum punya akun?' : 'Sudah punya akun?'}
            <button 
              onClick={() => {
                setIsLoginMode(!isLoginMode)
                setErrorMsg('') // Bersihkan error jika user ganti mode
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