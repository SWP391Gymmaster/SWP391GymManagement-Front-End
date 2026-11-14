import { useCallback, useEffect, useRef, useState } from 'react'

export default function useApi(loader, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: '' })
  const requestId = useRef(0)

  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo
  const load = useCallback(loader, deps)

  const reload = useCallback(async () => {
    const id = ++requestId.current
    setState({ data: null, loading: true, error: '' })
    try {
      const data = await load()
      if (id === requestId.current) setState({ data, loading: false, error: '' })
    } catch (e) {
      if (id === requestId.current) setState({ data: null, loading: false, error: e.message })
    }
  }, [load])

  useEffect(() => {
    const id = ++requestId.current
    let cancelled = false
    load()
      .then((data) => !cancelled && id === requestId.current && setState({ data, loading: false, error: '' }))
      .catch((e) => !cancelled && id === requestId.current && setState({ data: null, loading: false, error: e.message }))
    return () => {
      cancelled = true
    }
  }, [load])

  return { ...state, reload }
}
