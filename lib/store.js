// dsh-science — 共享存储路径（host 侧各模块共用）
import { existsSync, mkdirSync } from 'node:fs'
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
