import { Skeleton } from '@/components/ui/skeleton'

export default function ReportLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-28" />
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-[80px] rounded-xl" />
        ))}
      </div>
    </div>
  )
}
