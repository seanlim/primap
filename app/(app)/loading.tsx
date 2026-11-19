export default function AppLoading() {
  return (
    <div className="space-y-6 animate-pulse" role="status" aria-label="Loading">
      <div className="h-28 rounded-2xl bg-green-600/20" />
      <div className="grid grid-cols-3 gap-3">
        <div className="h-20 rounded-2xl bg-gray-200" />
        <div className="h-20 rounded-2xl bg-gray-200" />
        <div className="h-20 rounded-2xl bg-gray-200" />
      </div>
      <div className="h-40 rounded-2xl bg-gray-200" />
      <div className="h-40 rounded-2xl bg-gray-200" />
    </div>
  )
}
