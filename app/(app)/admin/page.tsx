import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Users, Calendar, MapPin, AlertTriangle, Settings } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AdminDashboard() {
  const supabase = await createClient()

  const [
    { count: totalUsers },
    { count: pendingUsers },
    { count: activeRounds },
    { count: totalWalks },
    { count: totalObservations },
    { count: openIncidents },
  ] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
    supabase.from('survey_rounds').select('id', { count: 'exact', head: true }).eq('status', 'OPEN'),
    supabase.from('walk_slots').select('id', { count: 'exact', head: true }),
    supabase.from('observations').select('id', { count: 'exact', head: true }).eq('status', 'SUBMITTED'),
    supabase.from('incidents').select('id', { count: 'exact', head: true }).eq('resolved', false),
  ])

  const cards = [
    { label: 'Users', value: totalUsers || 0, sub: `${pendingUsers || 0} pending`, href: '/admin/users', icon: Users, color: 'bg-blue-50 text-blue-600' },
    { label: 'Rounds', value: activeRounds || 0, sub: 'active', href: '/admin/rounds', icon: Calendar, color: 'bg-green-50 text-green-600' },
    { label: 'Walks', value: totalWalks || 0, sub: 'total', href: '/admin/walks', icon: MapPin, color: 'bg-purple-50 text-purple-600' },
    { label: 'Reports', value: totalObservations || 0, sub: 'submitted', href: '/admin/rounds', icon: Calendar, color: 'bg-indigo-50 text-indigo-600' },
    { label: 'Incidents', value: openIncidents || 0, sub: 'open', href: '/admin/incidents', icon: AlertTriangle, color: 'bg-red-50 text-red-600' },
    { label: 'Settings', value: '', sub: 'Configure', href: '/admin/settings', icon: Settings, color: 'bg-gray-50 text-gray-600' },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {cards.map(card => (
          <Link
            key={card.label}
            href={card.href}
            className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${card.color}`}>
              <card.icon className="w-5 h-5" />
            </div>
            {card.value !== '' && (
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
            )}
            <p className="text-sm text-gray-500">
              {card.label}{card.sub ? ` - ${card.sub}` : ''}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
