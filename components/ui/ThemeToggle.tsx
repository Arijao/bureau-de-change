'use client'

import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const [dark, setDark] = useState(false)

  // Synchronisation initiale avec ce qu'a appliqué le script anti-flash
  useEffect(() => {
    setDark(document.documentElement.getAttribute('data-theme') === 'dark')
  }, [])

  function toggle() {
    const next = dark ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('theme', next)
    setDark(!dark)
  }

  return (
    <button
      onClick={toggle}
      className="btn-logout"
      title={dark ? 'Mode clair' : 'Mode sombre'}
      aria-label={dark ? 'Passer en mode clair' : 'Passer en mode sombre'}
      style={{ fontSize: 15, padding: '5px 9px', lineHeight: 1 }}
    >
      {dark ? '☀️' : '🌙'}
    </button>
  )
}