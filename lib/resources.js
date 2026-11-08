// dsh-science — 工作台数据资源协议（host 侧 provider）
// 客户端经 useResource('sci-data://figures') 等地址读取插件状态文件。
// 一个协议一个 provider（dsh 规则），全部数据走 'sci-data' 协议，地址即文件选择器。

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { dataDirOf } from './store.js'

function log(msg) {
  console.log(`[dsh-science data] ${msg}`)
}

function readJson(name) {
  const file = join(dataDirOf(), name)
  if (!existsSync(file)) return null
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function snapshot(kind) {
  switch (kind) {
    case 'figures': {
      const figs = readJson('figures.json') || {}
      return { kind, figures: Object.values(figs).sort((a, b) => b.registeredAt - a.registeredAt).slice(0, 60) }
    }
    case 'reviews': {
      const revs = readJson('reviews.json') || {}
      return { kind, reviews: Object.values(revs).sort((a, b) => (b.finishedAt || 0) - (a.finishedAt || 0)).slice(0, 30) }
    }
    case 'db': {
      const profs = readJson('db-profiles.json') || {}
      return {
        kind,
        profiles: Object.entries(profs).map(([name, p]) => ({
          name,
          kind: p.kind,
          target: p.kind === 'sqlite' ? p.path : `${p.host || ''}:${p.port || ''}/${p.database || ''}`,
        })),
      }
    }
    case 'ssh': {
      const profs = readJson('ssh-profiles.json') || {}
      const jobs = readJson('ssh-jobs.json') || {}
      return {
        kind,
        hosts: Object.entries(profs).map(([name, p]) => ({
          name,
          host: `${p.username}@${p.host}:${p.port || 22}`,
          auth: p.auth,
          probed: !!p.details,
        })),
        jobs: Object.entries(jobs)
          .slice(-20)
          .map(([id, j]) => ({ id, profile: j.profile, mode: j.mode, name: j.name })),
      }
    }
    default:
      return { kind, error: `未知数据地址: ${kind}` }
  }
}

const KNOWN = new Set(['figures', 'reviews', 'db', 'ssh'])

export function registerDataResources(ctx) {
  try {
    ctx.resources.register({
      protocol: 'sci-data',
      async *open(address, { signal }) {
        const kind = String(address || '').replace(/^sci-data:\/\//, '').replace(/\/$/, '')
        if (!KNOWN.has(kind)) {
          yield { ok: false, failure: { code: 'sci-data/unknown-address', message: `未知数据地址: ${address}` } }
          return
        }
        let last = ''
        // 首帧 + 低频轮询（工作台数据低频变化；内容不变则不产新帧）
        while (!(signal && signal.aborted)) {
          const value = snapshot(kind)
          const serialized = JSON.stringify(value)
          if (serialized !== last) {
            last = serialized
            yield { ok: true, value }
          }
          await new Promise((resolve) => setTimeout(resolve, 2000))
        }
      },
    })
    log('resource protocol sci-data registered (figures/reviews/db/ssh)')
  } catch (err) {
    log(`resources register failed: ${err && err.message}`)
  }
}
