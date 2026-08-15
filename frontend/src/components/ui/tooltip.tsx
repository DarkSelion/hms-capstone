import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../lib/utils'

export interface TooltipTriggerProps {
  ref: (node: HTMLElement | null) => void
  onMouseEnter: () => void
  onMouseLeave: () => void
  onFocus: () => void
  onBlur: () => void
}

interface TooltipProps {
  children: (props: TooltipTriggerProps) => React.ReactNode
  content: string
  side?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
}

export function Tooltip({
  children,
  content,
  side = 'right',
  align = 'center',
}: TooltipProps) {
  const triggerRef = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })

  const handleMouseEnter = () => {
    setVisible(true)
  }

  const handleMouseLeave = () => {
    setVisible(false)
  }

  const handleFocus = () => {
    setVisible(true)
  }

  const handleBlur = () => {
    setVisible(false)
  }

  const updatePosition = () => {
    if (!triggerRef.current) return

    const rect = triggerRef.current.getBoundingClientRect()
    const offset = 8

    let top = 0
    let left = 0

    switch (side) {
      case 'top':
        top = rect.top - 24
        left = rect.left + (align === 'start' ? 0 : align === 'end' ? rect.width : rect.width / 2)
        break
      case 'bottom':
        top = rect.bottom + offset
        left = rect.left + (align === 'start' ? 0 : align === 'end' ? rect.width : rect.width / 2)
        break
      case 'left':
        top = rect.top + rect.height / 2
        left = rect.left - 200 - offset
        break
      case 'right':
      default:
        top = rect.top + rect.height / 2
        left = rect.right + offset
    }

    // Clamp to viewport
    const tooltipWidth = 200
    const tooltipHeight = 32
    const maxLeft = window.innerWidth - tooltipWidth - 8

    if (left + tooltipWidth > window.innerWidth) {
      left = maxLeft
    }
    if (left < 8) {
      left = 8
    }
    if (top + tooltipHeight > window.innerHeight) {
      top = window.innerHeight - tooltipHeight - 8
    }
    if (top < 8) {
      top = 8
    }

    setPosition({ top, left })
  }

  const handleMouseEnterWithPosition = () => {
    updatePosition()
    handleMouseEnter()
  }

  const handleFocusWithPosition = () => {
    updatePosition()
    handleFocus()
  }

  return (
    <>
      {children({
        ref: (node: HTMLElement | null) => {
          triggerRef.current = node
        },
        onMouseEnter: handleMouseEnterWithPosition,
        onMouseLeave: handleMouseLeave,
        onFocus: handleFocusWithPosition,
        onBlur: handleBlur,
      })}
      {visible &&
        createPortal(
          <div
            className={cn(
              'fixed z-[60] rounded-md bg-foreground px-2.5 py-1.5 text-xs font-medium text-card shadow-lg',
              'pointer-events-none transition-opacity duration-200',
            )}
            style={{ top: `${position.top}px`, left: `${position.left}px` }}
            role="tooltip"
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  )
}
