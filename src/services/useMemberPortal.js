import { useEffect, useState } from 'react'
import { useStore } from '../store/context'

export function useMemberPortal() {
  const { memberService, memberRevision } = useStore()
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState(null)
  useEffect(() => {
    let active = true
    memberService.getOverview().then(
      (data) => { if (active) setResult({ data, revision: memberRevision, attempt }) },
      (error) => { if (active) setResult({ error: error.message, revision: memberRevision, attempt }) },
    )
    return () => { active = false }
  }, [memberService, memberRevision, attempt])
  useEffect(() => {
    const refresh = () => setAttempt((n) => n + 1)
    const timer = setInterval(refresh, 60000)
    window.addEventListener('focus', refresh)
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh) }
  }, [])
  const loading = !result || result.revision !== memberRevision || result.attempt !== attempt
  return {
    data: loading ? null : result.data, error: loading ? '' : result.error,
    loading,
    retry: () => setAttempt((n) => n + 1), memberService,
  }
}
