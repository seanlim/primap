export function LoadingSpinner({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center p-8 ${className}`}>
      <div className="w-8 h-8 border-4 border-gray-200 border-t-green-600 rounded-full animate-spin" />
    </div>
  )
}
