import { Skeleton } from '@/components/ui/skeleton'

export default function WalkDetailLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-28" />
      <div className="bg-white rounded-xl p-6 shadow-sm space-y-4">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-12 w-full rounded-xl mt-2" />
      </div>
      <Skeleton className="h-4 w-36" />
      <div className="space-y-2">
        <Skeleton className="h-[56px] rounded-xl" />
        <Skeleton className="h-[56px] rounded-xl" />
      </div>
    </div>
  )
}
