import { createContext, useContext, useState, useEffect } from 'react'

const VersionContext = createContext(null)

export function VersionProvider({ children }) {
  const [version, setVersion] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api.getVersion().then((v) => {
      setVersion(v)
      setLoading(false)
    })
  }, [])

  return <VersionContext.Provider value={{ version, loading }}>{children}</VersionContext.Provider>
}

export function useVersion() {
  const context = useContext(VersionContext)
  if (!context) throw new Error('useVersion must be used within VersionProvider')
  return context
}
