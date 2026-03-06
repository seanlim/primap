'use client'

import { ShieldX } from 'lucide-react'
import { signOut } from '@/lib/actions/auth-actions'

export default function BlockedPage() {
  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white p-8 rounded-2xl shadow-lg max-w-sm w-full text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldX className="w-8 h-8 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Account Blocked</h1>
        <p className="text-gray-500 mb-6">
          Your account has been disabled or rejected. Please contact the admin if you believe this is an error.
        </p>
        <button
          onClick={handleSignOut}
          className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-xl hover:bg-gray-200 font-medium transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}
