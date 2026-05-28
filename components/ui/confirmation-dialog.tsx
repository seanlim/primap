'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'

interface ConfirmationDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
  busy?: boolean
  requiredConfirmationText?: string
  confirmationPrompt?: string
  textareaLabel?: string
  textareaValue?: string
  textareaPlaceholder?: string
  textareaRequired?: boolean
  textareaMaxLength?: number
  onTextareaChange?: (value: string) => void
}

export function ConfirmationDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
  busy = false,
  requiredConfirmationText,
  confirmationPrompt,
  textareaLabel,
  textareaValue = '',
  textareaPlaceholder,
  textareaRequired = false,
  textareaMaxLength,
  onTextareaChange,
}: ConfirmationDialogProps) {
  const titleId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [confirmationValue, setConfirmationValue] = useState('')
  const confirmedText = !requiredConfirmationText || confirmationValue === requiredConfirmationText
  const confirmedTextarea = !textareaRequired || textareaValue.trim().length > 0
  const canConfirm = confirmedText && confirmedTextarea

  useEffect(() => {
    if (!open) return
    if (requiredConfirmationText) inputRef.current?.focus()
    else if (textareaLabel) textareaRef.current?.focus()
    else cancelRef.current?.focus()
  }, [open, requiredConfirmationText, textareaLabel])

  const handleCancel = useCallback(() => {
    setConfirmationValue('')
    onTextareaChange?.('')
    onCancel()
  }, [onCancel, onTextareaChange])

  const handleConfirm = useCallback(() => {
    if (!canConfirm) return
    setConfirmationValue('')
    onConfirm()
  }, [canConfirm, onConfirm])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        handleCancel()
        return
      }

      if (e.key !== 'Tab') return

      const focusable = [inputRef.current, textareaRef.current, cancelRef.current, confirmRef.current].filter(
        (el): el is HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement => el !== null
      )
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    },
    [busy, handleCancel]
  )

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onKeyDown={handleKeyDown}
    >
      <div className="fixed inset-0 bg-black/50" onClick={() => !busy && handleCancel()} />
      <div className="relative bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
        <h3 id={titleId} className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500 mt-2">{message}</p>
        {requiredConfirmationText && (
          <label className="mt-4 block text-sm text-gray-600">
            <span className="block text-xs font-medium text-gray-500">
              {confirmationPrompt || `Type ${requiredConfirmationText} to confirm`}
            </span>
            <input
              ref={inputRef}
              value={confirmationValue}
              onChange={(e) => setConfirmationValue(e.target.value)}
              disabled={busy}
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-60"
            />
          </label>
        )}
        {textareaLabel && (
          <label className="mt-4 block text-sm text-gray-600">
            <span className="block text-xs font-medium text-gray-500">
              {textareaLabel}
            </span>
            <textarea
              ref={textareaRef}
              value={textareaValue}
              onChange={(e) => onTextareaChange?.(e.target.value)}
              disabled={busy}
              placeholder={textareaPlaceholder}
              maxLength={textareaMaxLength}
              rows={4}
              className="mt-2 w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-60"
            />
            {textareaMaxLength && (
              <span className="mt-1 block text-right text-xs text-gray-400">
                {textareaValue.length}/{textareaMaxLength}
              </span>
            )}
          </label>
        )}
        <div className="flex gap-3 mt-6">
          <button
            ref={cancelRef}
            onClick={handleCancel}
            disabled={busy}
            className="flex-1 py-2.5 px-4 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={handleConfirm}
            disabled={busy || !canConfirm}
            className={`flex-1 py-2.5 px-4 rounded-xl font-medium transition-colors text-sm text-white disabled:opacity-60 disabled:cursor-not-allowed ${
              destructive
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
