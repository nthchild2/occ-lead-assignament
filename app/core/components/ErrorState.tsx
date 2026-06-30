import React from 'react'

import { EmptyState } from './EmptyState'

interface ErrorStateProps {
  message?: string
  onRetry: () => void
}

/** Network/error fallback with a retry action — used by lists and detail screens. */
export function ErrorState({
  message = 'Algo salió mal. Intenta de nuevo.',
  onRetry,
}: ErrorStateProps) {
  return (
    <EmptyState
      title="No se pudo cargar la información"
      description={message}
      actionLabel="Reintentar"
      onAction={onRetry}
    />
  )
}
