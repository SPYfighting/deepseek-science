import { useCallback, useEffect, useState } from 'react'
import { stateViewOf } from './state-view.js'

const STATE_URL = '/plugins/dsh-science/state'

export function useWorkbenchState(pollMs = 5000) {
  const [record, setRecord] = useState({ loading: true, raw: null, view: null, error: null })
  const refresh = useCallback(async () => {
    try {
      const response = await fetch(STATE_URL, { credentials: 'same-origin' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const raw = await response.json()
      const view = stateViewOf(raw)
      if (!view.available) throw new Error(view.error)
      setRecord({ loading: false, raw, view, error: null })
      return view
    } catch (error) {
      setRecord((current) => ({ loading: false, raw: current.raw, view: current.view, error: error.message || '暂时无法读取工作台状态。' }))
      return null
    }
  }, [])

  useEffect(() => {
    let active = true
    const run = async () => { if (active) await refresh() }
    void run()
    const timer = setInterval(run, pollMs)
    return () => { active = false; clearInterval(timer) }
  }, [pollMs, refresh])

  return { ...record, refresh }
}
