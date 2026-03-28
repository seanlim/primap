import { Skeleton } from '@/components/ui/skeleton'

export default function WalkReportLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-[100px] rounded-xl" />
      <Skeleton className="h-[160px] rounded-xl" />
      <Skeleton className="h-4 w-40" />
      <div className="space-y-2">
        <Skeleton className="h-[60px] rounded-xl" />
        <Skeleton className="h-[60px] rounded-xl" />
      </div>
    </div>
  )
}
