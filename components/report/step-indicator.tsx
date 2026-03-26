'use client'

import { Check } from 'lucide-react'

interface Step {
  id: string
  label: string
}

interface StepIndicatorProps {
  steps: Step[]
  activeStepId: string
  onStepClick: (stepId: string) => void
}

export function StepIndicator({ steps, activeStepId, onStepClick }: StepIndicatorProps) {
  const activeIndex = steps.findIndex(s => s.id === activeStepId)

  return (
    <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-100 py-3 px-2 -mx-4 sm:-mx-0 mb-2">
      <div className="flex items-center justify-between max-w-md mx-auto">
        {steps.map((step, index) => {
          const isActive = step.id === activeStepId
          const isCompleted = index < activeIndex

          return (
            <div key={step.id} className="flex items-center flex-1 last:flex-none">
              <button
                type="button"
                onClick={() => onStepClick(step.id)}
                className="flex flex-col items-center gap-1 group"
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-green-600 text-white ring-4 ring-green-100'
                      : isCompleted
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 text-gray-500 group-hover:bg-gray-300'
                  }`}
                >
                  {isCompleted ? <Check className="w-3.5 h-3.5" /> : index + 1}
                </div>
                <span
                  className={`hidden md:block text-[10px] leading-tight text-center max-w-[60px] ${
                    isActive
                      ? 'text-green-700 font-medium'
                      : isCompleted
                        ? 'text-green-600'
                        : 'text-gray-400'
                  }`}
                >
                  {step.label}
                </span>
              </button>

              {/* Connecting line */}
              {index < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-1 rounded-full transition-colors ${
                    index < activeIndex ? 'bg-green-500' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
