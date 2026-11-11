// dsh-science — 共享存储路径（host 侧各模块共用）
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

export function dataDirOf() {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  const dir = join(home, 'dsh-science')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/** 插件包根目录（lib/ 的上一级） */
export function PKG_ROOT_OF() {
  return join(dirname(fileURLToPath(import.meta.url)), '..')
}

// 用户配置（$DSH_HOME/dsh-science/config.json，手动编辑，改即生效）：
//   falsificationThreshold — 证伪风险触发的 negative 数阈值（正整数，默认 2）
//   blockedGate            — 派单依赖闸门："warn"（默认，记录+提示）| "hard"（依赖未完成拒绝派发）
export function configOf() {
  try {
    const parsed = JSON.parse(readFileSync(join(dataDirOf(), 'config.json'), 'utf8'))
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
  } catch (err) {
    if (err && err.code !== 'ENOENT') {
      console.error(`[dsh-science] config.json 读取失败（按默认配置运行）: ${err && err.message}`)
    }
  }
  return {}
}

export function falsificationThresholdOf() {
  // 只接受数字或纯十进制整数字符串；拒绝布尔（true→1）/十六进制串（'0x10'→16）等 Number() 强转陷阱
  const raw = configOf().falsificationThreshold
  let v
  if (typeof raw === 'number') v = raw
  else if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) v = Number(raw.trim())
  else return 2
  return Number.isSafeInteger(v) && v >= 1 ? v : 2
}

export function blockedGateOf() {
  // 大小写/首尾空白不敏感，避免 'HARD' 一类笔误静默 fail-open 回退到 warn
  const v = String(configOf().blockedGate ?? '').trim().toLowerCase()
  return v === 'hard' ? 'hard' : 'warn'
}
