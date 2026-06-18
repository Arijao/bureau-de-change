'use client'

import { useEffect } from 'react'

/**
 * Applique le thème au montage si le script anti-flash inline
 * n'a pas pu le faire (environnement sans localStorage, etc.).
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!document.documentElement.hasAttribute('data-theme')) {
      const stored = localStorage.getItem('theme') as 'light' | 'dark' | null
      const preferred =
        stored ??
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      document.documentElement.setAttribute('data-theme', preferred)
    }
  }, [])

  return <>{children}</>
}