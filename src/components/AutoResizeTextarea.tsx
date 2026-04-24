'use client'

import { useEffect, useRef, TextareaHTMLAttributes } from 'react'

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  maxHeight?: number
}

export default function AutoResizeTextarea({ maxHeight = 240, onChange, style, ...props }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  function resize() {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    const next = Math.min(el.scrollHeight, maxHeight)
    el.style.height = next + 'px'
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }

  useEffect(() => { resize() }, [props.value])

  return (
    <textarea
      ref={ref}
      rows={1}
      style={{ resize: 'none', overflowY: 'hidden', ...style }}
      onChange={(e) => { onChange?.(e); resize() }}
      {...props}
    />
  )
}
