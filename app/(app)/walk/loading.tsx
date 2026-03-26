import { Skeleton } from '@/components/ui/skeleton'

export default function WalkLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-[100px] rounded-xl" />
      <Skeleton className="h-4 w-40" />
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-[100px] rounded-xl" />
        ))}
      </div>
    </div>
  )
}
