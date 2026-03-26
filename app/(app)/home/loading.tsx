import { Skeleton } from '@/components/ui/skeleton'

export default function HomeLoading() {
  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="rounded-2xl p-6 bg-gray-100">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-[80px] rounded-xl" />
        <Skeleton className="h-[80px] rounded-xl" />
        <Skeleton className="h-[80px] rounded-xl" />
      </div>

      {/* Next walk card */}
      <Skeleton className="h-[120px] rounded-xl" />

      {/* Quick actions */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-[90px] rounded-xl" />
          <Skeleton className="h-[90px] rounded-xl" />
        </div>
      </div>

      {/* Upcoming walks */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-36" />
        <div className="space-y-2">
          <Skeleton className="h-[72px] rounded-xl" />
          <Skeleton className="h-[72px] rounded-xl" />
        </div>
      </div>
    </div>
  )
}
