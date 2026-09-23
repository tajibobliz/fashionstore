import type { DetailedHTMLProps, HTMLAttributes } from 'react'

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': DetailedHTMLProps<
        HTMLAttributes<HTMLElement> & {
          src?: string
          alt?: string
          ar?: boolean | ''
          'ar-modes'?: string
          'camera-controls'?: boolean | ''
          'auto-rotate'?: boolean | ''
          'shadow-intensity'?: string
          poster?: string
          loading?: 'auto' | 'lazy' | 'eager'
        },
        HTMLElement
      >
    }
  }
}
