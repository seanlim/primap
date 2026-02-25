'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Clock, Loader2 } from 'lucide-react'
import { signOut } from '@/lib/actions/auth-actions'
import { useState } from 'react'

export default function PendingPage() {
  const supabase = createClient()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleSignOut = async () => {
    await signOut()
  }

  const handleRefresh = async () => {
    setIsLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('status')
          .eq('id', user.id)
          .single()

        if (profile?.status === 'ACTIVE') {
          router.push('/')
          return
        }
      }
      
      // If not active or error, refresh the page to get latest server data
      router.refresh()
    } catch (error) {
      console.error('Error checking status:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white p-8 rounded-2xl shadow-lg max-w-sm w-full text-center">
        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Clock className="w-8 h-8 text-yellow-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Pending Approval</h1>
        <p className="text-gray-500 mb-6">
          Your account is awaiting admin approval. You&apos;ll be able to access Primap once an admin activates your account.
        </p>
        <div className="space-y-3">
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="w-full bg-green-600 text-white py-3 px-4 rounded-xl hover:bg-green-700 font-medium transition-colors disabled:opacity-50 flex items-center justify-center"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'Check Status'
            )}
          </button>
          <button
            onClick={handleSignOut}
            disabled={isLoading}
            className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-xl hover:bg-gray-200 font-medium transition-colors disabled:opacity-50"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}
