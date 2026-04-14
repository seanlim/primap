import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Footprints,
  HelpCircle,
  Navigation,
  ShieldAlert,
  UserRound,
  Shirt,
  Droplets,
  WifiOff,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const mockButtonClass =
  'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-gray-600 bg-white ring-1 ring-gray-200'
const guideStepClass =
  'rounded-xl border border-gray-200 bg-gray-50 p-4'
const majorStepLabelClass =
  'inline-flex h-11 items-center gap-2 rounded-2xl px-4 text-sm font-semibold'
const actionCardClass =
  'inline-flex items-center justify-between rounded-xl bg-white px-3 py-2.5 shadow-sm hover:shadow-md border border-transparent hover:border-green-200 transition-all'
const subStepContentClass = 'flex-1 pl-1 sm:pl-2'

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
      {children}
    </p>
  )
}

export default async function GuidancePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="space-y-6 animate-fade-in">
      <Link
        href="/home"
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Home
      </Link>

      <div className="bg-gradient-to-r from-green-600 to-emerald-500 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold text-white">Beginner Guide</h1>
        <p className="mt-1 text-sm text-white/80">
          Learn how to sign up, join a walk, and submit your first report.
        </p>
      </div>

      <div id="start-guide" className="space-y-3">
        <SectionLabel>Getting Started</SectionLabel>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-50">
              <Footprints className="w-5 h-5 text-sky-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between gap-3">
                <p className={`${majorStepLabelClass} bg-sky-50 text-sky-700`}>
                  <span>1</span>
                  <span>Join A Walk Slot</span>
                </p>
                <Link
                  href="/walk"
                  className={actionCardClass}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-green-50 rounded-full flex items-center justify-center shrink-0">
                      <Footprints className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Browse Walks</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                </Link>
              </div>
              <div className="mt-3 space-y-3">
                <div className={guideStepClass}>
                  <div className="flex items-start gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-700">
                      1
                    </div>
                    <div className={subStepContentClass}>
                      <p className="text-sm font-semibold text-gray-900">Browse available walks</p>
                      <div className="mt-3">
                        <div className={mockButtonClass}>
                          <Footprints className="w-4 h-4 text-sky-600" />
                          <span>Walks</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={guideStepClass}>
                  <div className="flex items-start gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-700">
                      2
                    </div>
                    <div className={subStepContentClass}>
                      <p className="text-sm font-semibold text-gray-900">Open a slot and join if available</p>
                      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                          <span>If you need to cancel, cancel as early as possible.</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50">
              <UserRound className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="flex-1">
              <p className={`${majorStepLabelClass} bg-emerald-50 text-emerald-700`}>
                <span>2</span>
                <span>Attend The Walk</span>
              </p>

              <div className="mt-4 rounded-2xl bg-indigo-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-indigo-700 ring-1 ring-indigo-100">
                    <WifiOff className="w-4 h-4 text-indigo-600 shrink-0" />
                    <p>If you want to write report offline during the walk...</p>
                  </div>
                  <Link href="/report" className={actionCardClass}>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-green-50 rounded-full flex items-center justify-center shrink-0">
                        <ClipboardList className="w-4 h-4 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">View Reports</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                  </Link>
                </div>
                <div className="mt-3 space-y-3">
                  <div className={guideStepClass}>
                    <div className="flex items-start gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-700">
                        1
                      </div>
                      <div className={subStepContentClass}>
                        <p className="text-sm font-semibold text-gray-900">Browse the reports</p>
                        <div className="mt-3">
                          <div className={mockButtonClass}>
                            <ClipboardList className="w-4 h-4 text-blue-600" />
                            <span>Reports</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={guideStepClass}>
                    <div className="flex items-start gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-700">
                        2
                      </div>
                      <div className={subStepContentClass}>
                        <p className="text-sm font-semibold text-gray-900">Open the walk&apos;s report and enter editing page once</p>
                        <div className="mt-3">
                          <div className={mockButtonClass}>
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                            <span>Edit Report</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-emerald-50 p-4">
                  <Droplets className="w-5 h-5 text-emerald-600" />
                  <p className="mt-3 text-sm font-semibold text-gray-900">Water</p>
                  <p className="mt-1 text-sm text-gray-500">Bring enough water for the walk.</p>
                </div>
                <div className="rounded-xl bg-sky-50 p-4">
                  <Shirt className="w-5 h-5 text-sky-600" />
                  <p className="mt-3 text-sm font-semibold text-gray-900">Long pants</p>
                  <p className="mt-1 text-sm text-gray-500">Wear suitable clothing for the field survey.</p>
                </div>
                <div className="rounded-xl bg-amber-50 p-4">
                  <Footprints className="w-5 h-5 text-amber-700" />
                  <p className="mt-3 text-sm font-semibold text-gray-900">Covered shoes</p>
                  <p className="mt-1 text-sm text-gray-500">Wear suitable footwear for the field survey.</p>
                </div>
              </div>

            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50">
              <ClipboardList className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between gap-3">
                <p className={`${majorStepLabelClass} bg-blue-50 text-blue-700`}>
                  <span>3</span>
                  <span>Submit A Report</span>
                </p>
                <Link
                  href="/report"
                  className={actionCardClass}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-green-50 rounded-full flex items-center justify-center shrink-0">
                      <ClipboardList className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">View Reports</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                </Link>
              </div>
              <div className="mt-3 space-y-3">
                <div className={guideStepClass}>
                  <div className="flex items-start gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                      1
                    </div>
                    <div className={subStepContentClass}>
                      <p className="text-sm font-semibold text-gray-900">Mark completion status</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full px-3 py-1 text-xs font-semibold bg-green-100 text-green-700">
                          COMPLETED
                        </span>
                        <span className="rounded-full px-3 py-1 text-xs font-semibold bg-amber-100 text-amber-700">
                          PARTIAL
                        </span>
                        <span className="rounded-full px-3 py-1 text-xs font-semibold bg-rose-100 text-rose-700">
                          ABORTED
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={guideStepClass}>
                  <div className="flex items-start gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                      2
                    </div>
                    <div className={subStepContentClass}>
                      <p className="text-sm font-semibold text-gray-900">Add sighting if sighted</p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl bg-white p-4 ring-1 ring-gray-200">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50 shadow-sm">
                            <Navigation className="w-5 h-5 text-emerald-600" />
                          </div>
                          <p className="mt-3 text-sm font-semibold text-gray-900">GPS</p>
                          <p className="mt-1 text-sm text-gray-500">
                            Mark the coordinates on the map or use the coordinates extracted from media.
                          </p>
                        </div>
                        <div className="rounded-xl bg-white p-4 ring-1 ring-gray-200">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50 shadow-sm">
                            <Camera className="w-5 h-5 text-emerald-600" />
                          </div>
                          <p className="mt-3 text-sm font-semibold text-gray-900">Media</p>
                          <p className="mt-1 text-sm text-gray-500">
                            Add photos or video of sighted primates.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={guideStepClass}>
                  <div className="flex items-start gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                      3
                    </div>
                    <div className={subStepContentClass}>
                      <p className="text-sm font-semibold text-gray-900">Add additional notes</p>
                      <p className="mt-1 text-sm text-gray-500">
                        Add demographics, behaviour, or anything else useful for the report.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                  <div className="flex items-start gap-3">
                    <ShieldAlert className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-red-800">Seen an incident?</p>
                      <p className="mt-1 text-sm text-red-700">Report it separately in the incident section.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <SectionLabel>More Help</SectionLabel>

        <details className="rounded-2xl bg-white p-5 shadow-sm group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-gray-900">
            How do I submit a report with no sighting?
            <ChevronRight className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-90" />
          </summary>
          <p className="mt-3 text-sm text-gray-500">
            Do not add a sighting. Complete the report fields and submit with the walk details and GPS.
          </p>
        </details>

        <details className="rounded-2xl bg-white p-5 shadow-sm group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-gray-900">
            Can I edit my submission?
            <ChevronRight className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-90" />
          </summary>
          <p className="mt-3 text-sm text-gray-500">
            Submitted reports cannot be edited in the app. If you need a change, contact an admin.
          </p>
        </details>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
        <SectionLabel>Still Need Help?</SectionLabel>
        <div className="mt-3 flex items-start gap-3">
          <HelpCircle className="w-5 h-5 text-amber-700 mt-0.5 shrink-0" />
          <p className="text-sm text-gray-500">
            Ask an admin if you need help with access, reporting, or anything unexpected during a walk.
          </p>
        </div>
      </div>
    </div>
  )
}
