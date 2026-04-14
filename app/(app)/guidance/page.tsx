import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
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
  'inline-flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm transition hover:border-sky-200 hover:bg-sky-50'
const offlineButtonClass =
  'inline-flex items-center gap-3 rounded-xl border border-indigo-100 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50'
const guideStepClass =
  'rounded-xl border border-sky-100 bg-gradient-to-br from-white via-sky-50/60 to-sky-50/30 p-4 shadow-sm'
const majorStepLabelClass =
  'inline-flex h-11 items-center gap-2 rounded-2xl px-4 text-sm font-semibold'
const subStepContentClass = 'flex-1 pl-2 sm:pl-3'
const subStepNumberClass =
  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold'
const compactStepCardClass =
  'rounded-xl border border-gray-100 bg-gradient-to-br from-white via-gray-50 to-white px-4 py-4 shadow-sm'
const infoCardClass = 'rounded-xl border border-gray-100 bg-white p-4 shadow-sm'
const majorCardClass = 'overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm'
const majorCardInnerClass = 'px-5 py-5'
const headerStripBase = 'border-b border-gray-100 px-5 py-3.5'
const actionIconCircleClass =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-50 ring-1 ring-green-100'
const infoIconCircleClass =
  'flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 ring-1 ring-sky-100'

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

        <div className={majorCardClass}>
          <div className={`${headerStripBase} bg-gradient-to-r from-sky-50 via-white to-white`}>
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-50 ring-1 ring-sky-100">
                <Footprints className="w-5 h-5 text-sky-600" />
              </div>
              <div className="min-w-0">
                <p className={`${majorStepLabelClass} bg-sky-50 text-sky-700 ring-1 ring-sky-100`}>
                  <span>1</span>
                  <span>Join A Walk</span>
                </p>
              </div>
            </div>
          </div>
          <div className={`${majorCardInnerClass} space-y-3`}>
            <div className={guideStepClass}>
              <div className="flex items-start gap-3">
                <div className={`${subStepNumberClass} bg-sky-100 text-sky-700`}>1</div>
                <div className={subStepContentClass}>
                  <p className="text-sm font-semibold text-gray-900">Browse walks</p>
                  <p className="mt-1 text-sm text-gray-500">Take a look at currently available walks.</p>
                  <div className="mt-3">
                    <Link href="/walk" className={mockButtonClass} aria-label="Browse walks">
                      <span className={actionIconCircleClass}>
                        <Footprints className="w-4 h-4 text-green-600" />
                      </span>
                      <span>Walks</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            <div className={guideStepClass}>
              <div className="flex items-start gap-3">
                <div className={`${subStepNumberClass} bg-sky-100 text-sky-700`}>2</div>
                <div className={subStepContentClass}>
                  <p className="text-sm font-semibold text-gray-900">Join a walk slot</p>
                  <p className="mt-1 text-sm text-gray-500">Open a slot and join if capacity holds.</p>
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

        <div className={majorCardClass}>
          <div className={`${headerStripBase} bg-gradient-to-r from-emerald-50 via-white to-white`}>
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 ring-1 ring-emerald-100">
                <UserRound className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className={`${majorStepLabelClass} bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100`}>
                  <span>2</span>
                  <span>Attend The Walk</span>
                </p>
              </div>
            </div>
          </div>
          <div className={`${majorCardInnerClass} space-y-4`}>
            <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-indigo-50 to-white p-4 shadow-sm">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-indigo-100 bg-indigo-100/70 px-4 py-2 text-sm font-semibold text-indigo-800 shadow-sm">
                <WifiOff className="w-4 h-4 text-indigo-600 shrink-0" />
                <p>If you want to write report offline during the walk...</p>
              </div>

              <div className="mt-3 space-y-3">
                <div className={`${compactStepCardClass} border-indigo-100 bg-gradient-to-br from-white via-indigo-50 to-white`}>
                  <div className="flex items-start gap-3">
                    <div className={`${subStepNumberClass} bg-indigo-100 text-indigo-700`}>1</div>
                    <div className={subStepContentClass}>
                      <p className="text-sm font-semibold text-gray-900">Browse the reports</p>
                      <div className="mt-3">
                        <Link href="/report" className={offlineButtonClass} aria-label="Browse reports">
                          <span className={actionIconCircleClass}>
                            <ClipboardList className="w-4 h-4 text-green-600" />
                          </span>
                          <span className="text-gray-900">Reports</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`${compactStepCardClass} border-indigo-100 bg-gradient-to-br from-white via-indigo-50 to-white`}>
                  <div className="flex items-center gap-3">
                    <div className={`${subStepNumberClass} bg-indigo-100 text-indigo-700`}>2</div>
                    <div className={`${subStepContentClass} py-1`}>
                      <p className="text-sm font-semibold text-gray-900">
                        Open the walk&apos;s report and enter editing page once
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/70 ring-1 ring-emerald-100">
                  <Droplets className="w-5 h-5 text-emerald-600" />
                </div>
                <p className="mt-3 text-sm font-semibold text-gray-900">Water</p>
                <p className="mt-1 text-sm text-gray-500">Bring enough water for the walk.</p>
              </div>
              <div className="rounded-xl border border-sky-100 bg-sky-50 p-4 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/70 ring-1 ring-sky-100">
                  <Shirt className="w-5 h-5 text-sky-600" />
                </div>
                <p className="mt-3 text-sm font-semibold text-gray-900">Long pants</p>
                <p className="mt-1 text-sm text-gray-500">Wear suitable clothing for the field survey.</p>
              </div>
              <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/70 ring-1 ring-amber-100">
                  <Footprints className="w-5 h-5 text-amber-700" />
                </div>
                <p className="mt-3 text-sm font-semibold text-gray-900">Covered shoes</p>
                <p className="mt-1 text-sm text-gray-500">Wear suitable footwear for the field survey.</p>
              </div>
            </div>
          </div>
        </div>

        <div className={majorCardClass}>
          <div className={`${headerStripBase} bg-gradient-to-r from-blue-50 via-white to-white`}>
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 ring-1 ring-blue-100">
                <ClipboardList className="w-5 h-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className={`${majorStepLabelClass} bg-blue-50 text-blue-700 ring-1 ring-blue-100`}>
                  <span>3</span>
                  <span>Submit The Report</span>
                </p>
              </div>
            </div>
          </div>
          <div className={`${majorCardInnerClass} space-y-3`}>
            <div className={guideStepClass}>
              <div className="flex items-start gap-3">
                <div className={`${subStepNumberClass} bg-blue-100 text-blue-700`}>1</div>
                <div className={subStepContentClass}>
                  <p className="text-sm font-semibold text-gray-900">Find the report for the walk</p>
                  <p className="mt-1 text-sm text-gray-500">Open the walk report before you mark completion.</p>
                  <div className="mt-3">
                    <Link href="/report" className={mockButtonClass} aria-label="Browse reports">
                      <span className={actionIconCircleClass}>
                        <ClipboardList className="w-4 h-4 text-green-600" />
                      </span>
                      <span>Reports</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            <div className={guideStepClass}>
              <div className="flex items-start gap-3">
                <div className={`${subStepNumberClass} bg-blue-100 text-blue-700`}>2</div>
                <div className={subStepContentClass}>
                  <p className="text-sm font-semibold text-gray-900">Mark completion status</p>
                  <p className="mt-1 text-sm text-gray-500">Add comment for PARTIAL/ABORTED walks.</p>
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
                <div className={`${subStepNumberClass} bg-blue-100 text-blue-700`}>3</div>
                <div className={subStepContentClass}>
                  <p className="text-sm font-semibold text-gray-900">Add sighting</p>
                  <p className="mt-1 text-sm text-gray-500">Record sightings of primates or other animals.</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className={infoCardClass}>
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 shadow-sm">
                        <Navigation className="w-5 h-5 text-sky-600" />
                      </div>
                      <p className="mt-3 text-sm font-semibold text-gray-900">GPS</p>
                      <p className="mt-1 text-sm text-gray-500">
                        Mark the coordinates on the map or use the coordinates extracted from media.
                      </p>
                    </div>
                    <div className={infoCardClass}>
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 shadow-sm">
                        <Camera className="w-5 h-5 text-sky-600" />
                      </div>
                      <p className="mt-3 text-sm font-semibold text-gray-900">Media</p>
                      <p className="mt-1 text-sm text-gray-500">Add photos or video of sighted primates.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className={guideStepClass}>
              <div className="flex items-start gap-3">
                <div className={`${subStepNumberClass} bg-blue-100 text-blue-700`}>4</div>
                <div className={subStepContentClass}>
                  <p className="text-sm font-semibold text-gray-900">Add additional notes</p>
                  <p className="mt-1 text-sm text-gray-500">
                    Add demographics, behaviour, or anything else useful for the report.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/70 ring-1 ring-red-100">
                  <ShieldAlert className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-red-800">Seen an incident?</p>
                  <p className="mt-1 text-sm text-red-700">Report it separately in the incident section.</p>
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
