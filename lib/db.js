// dsh-science — 数据库连接模块（P3-1）
// SQLite: node:sqlite（Node >= 22.5 内建）；PostgreSQL: postgres.js；MySQL: mysql2。
// 只读守卫默认开启；写操作必须走审批卡。密码经 ctx.credentials 引用存取。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const READONLY_STMT = /^(select|with|explain|pragma\s+(table_info|table_list|index_list|table_xinfo|index_info|compile_options))/i
const FORBIDDEN_IN_READ = /\b(insert|update|delete|drop|alter|create|attach|detach|replace|grant|revoke|truncate|vacuum|pragma\s+wal_checkpoint)\b/i
const MAX_ROWS_DEFAULT = 200

function log(msg) {
  console.log(`[dsh-science db] ${msg}`)
}

// ---------------------------------------------------------------- storage ---

function dataDir() {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  const dir = join(home, 'dsh-science')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function profilesFile() {
  return join(dataDir(), 'db-profiles.json')
}

function loadProfiles() {
  try {
    return JSON.parse(readFileSync(profilesFile(), 'utf8'))
  } catch {
    return {}
  }
}

function saveProfiles(profiles, opts, exec) {
  const text = JSON.stringify(profiles, null, 2)
  writeFileSync(profilesFile(), text, 'utf8')
  if (opts && opts.mirror) opts.mirror('db-profiles.json', text, exec)
}

// ---------------------------------------------------------------- drivers ---

async function openConnection(profile, credentials) {
  const password = await resolvePassword(profile, credentials)
  switch (profile.kind) {
    case 'sqlite': {
      let DatabaseSync
      try {
        ;({ DatabaseSync } = await import('node:sqlite'))
      } catch {
        throw new Error('当前 Node 运行时不含 node:sqlite（需要 Node >= 22.5）。请在 profile 中改用 PostgreSQL/MySQL，或升级运行时。')
      }
      const db = new DatabaseSync(profile.path, { readOnly: false })
      return {
        kind: 'sqlite',
        async query(sql, maxRows) {
          const stmt = db.prepare(sql)
          const rows = stmt.all()
          return { rows: rows.slice(0, maxRows), total: rows.length, truncated: rows.length > maxRows }
        },
        async exec(sql) {
          db.exec(sql)
          return { ok: true }
        },
        async close() { db.close() },
      }
    }
    case 'postgres': {
      const { default: postgres } = await import('postgres')
      const url = profile.url || buildPgUrl(profile, password)
      const sql = postgres(url, { max: 2, idle_timeout: 20, connect_timeout: 10 })
      return {
        kind: 'postgres',
        async query(sqlText, maxRows) {
          const rows = await sql.unsafe(sqlText)
          return { rows: rows.slice(0, maxRows), total: rows.length, truncated: rows.length > maxRows }
        },
        async exec(sqlText) {
          const result = await sql.unsafe(sqlText)
          return { count: result.count, command: result.command }
        },
        async close() { await sql.end({ timeout: 5 }) },
      }
    }
    case 'mysql': {
      const { default: mysql } = await import('mysql2/promise')
      const conn = await mysql.createConnection({
        host: profile.host || '127.0.0.1',
        port: profile.port || 3306,
        user: profile.user || 'root',
        password,
        database: profile.database,
        connectTimeout: 10000,
      })
      return {
        kind: 'mysql',
        async query(sqlText, maxRows) {
          const [rows] = await conn.query({ sql: sqlText, maxRows })
          const list = Array.isArray(rows) ? rows : [rows]
          return { rows: list.slice(0, maxRows), total: list.length, truncated: list.length > maxRows }
        },
        async exec(sqlText) {
          const [result] = await conn.query(sqlText)
          return { affectedRows: result.affectedRows, changedRows: result.changedRows }
        },
        async close() { await conn.end() },
      }
    }
    default:
      throw new Error(`不支持的数据库类型: ${profile.kind}（支持 sqlite | postgres | mysql）`)
  }
}

function buildPgUrl(profile, password) {
  const auth = `${encodeURIComponent(profile.user || 'postgres')}:${encodeURIComponent(password || '')}`
  return `postgres://${auth}@${profile.host || '127.0.0.1'}:${profile.port || 5432}/${profile.database || 'postgres'}`
}

async function resolvePassword(profile, credentials) {
  const ref = profile.credentialsRef
  if (ref && credentials && typeof credentials.resolve === 'function') {
    try {
      const resolved = await credentials.resolve(ref)
      if (resolved && resolved.value) return resolved.value
    } catch {
      /* fallthrough to inline password */
    }
  }
  return profile.password || ''
}

// ---------------------------------------------------------------- pools -----

const pools = new Map() // profileName -> connection

async function getConnection(profiles, name, credentials) {
  if (pools.has(name)) return pools.get(name)
  const profile = profiles[name]
  if (!profile) throw new Error(`数据库 profile "${name}" 不存在。先用 sci_db_profiles 的 add 动作创建。`)
  const conn = await openConnection(profile, credentials)
  pools.set(name, conn)
  return conn
}

function assertReadOnly(sql) {
  const text = String(sql || '').trim()
  if (!text) throw new Error('SQL 为空')
  if (text.includes(';')) {
    const parts = text.split(';').filter((p) => p.trim())
    if (parts.length > 1) throw new Error('只读查询一次只允许一条语句')
  }
  if (!READONLY_STMT.test(text) || FORBIDDEN_IN_READ.test(text)) {
    throw new Error('只读守卫：sci_db_query 仅接受单条 SELECT/WITH/EXPLAIN/只读 PRAGMA。写操作请使用 sci_db_execute（需要审批）。')
  }
}

// ---------------------------------------------------------------- tools -----

export function registerDbTools(ctx, opts = {}) {
  // 注意：不硬依赖 credentials 服务（headless profile 无此服务）。
  // v1 密码存于 $DSH_HOME/dsh-science/db-profiles.json（用户本机），P5 计划接入 ctx.credentials。
  const credentials = null

  async function runQueryOrExec(args, exec, mode) {
    const profiles = loadProfiles()
    const maxRows = Math.min(Number(args.max_rows) || MAX_ROWS_DEFAULT, 5000)
    if (mode === 'query') assertReadOnly(args.sql)
    const conn = await getConnection(profiles, args.profile, credentials)
    try {
      if (mode === 'query') {
        const result = await conn.query(args.sql, maxRows)
        return {
          profile: args.profile,
          kind: conn.kind,
          rowCount: result.rows.length,
          totalRows: result.total,
          ...(result.truncated ? { truncated: true } : {}),
          rows: result.rows,
        }
      }
      const result = await conn.exec(args.sql)
      return { profile: args.profile, kind: conn.kind, ...result }
    } catch (err) {
      // 连接级错误回收连接，下次重建
      pools.delete(args.profile)
      try { await conn.close() } catch { /* ignore */ }
      throw err
    }
  }

  ctx.tools.register({
    name: 'sci_db_profiles',
    description:
      '管理 dsh-science 数据库连接 profile。动作：list（列出）/ add（新增，需要 name/kind 及连接参数）/ remove（删除）/ test（测试连接并返回 schema 概要）。kind 支持 sqlite（需 path）、postgres、mysql（需 host/port/user/database，密码经 credentialsRef 或 password 字段）。',
    parameters: {
      action: { type: 'string', required: true, description: 'list | add | remove | test' },
      name: { type: 'string', description: 'profile 名称' },
      profile: {
        type: 'object',
        description: 'add 时的连接参数：{ kind, path?, host?, port?, user?, database?, url?, credentialsRef?, password? }',
      },
    },
    output: {
      schema: { type: 'object' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args, exec) {
      const profiles = loadProfiles()
      switch (args.action) {
        case 'list': {
          return {
            profiles: Object.entries(profiles).map(([name, p]) => ({
              name,
              kind: p.kind,
              target: p.kind === 'sqlite' ? p.path : `${p.host}:${p.port}/${p.database}`,
              ...(p.credentialsRef ? { credentialsRef: p.credentialsRef } : {}),
            })),
          }
        }
        case 'add': {
          const p = args.profile || {}
          if (!args.name || !p.kind) throw new Error('add 需要 name 和 profile.kind')
          if (!['sqlite', 'postgres', 'mysql'].includes(p.kind)) throw new Error(`不支持的 kind: ${p.kind}`)
          if (p.kind === 'sqlite' && !p.path) throw new Error('sqlite profile 需要 path')
          if (p.kind !== 'sqlite' && !p.host && !p.url) throw new Error('postgres/mysql 需要 host（或 url）')
          const ref = p.credentialsRef || (p.password ? `DSH_SCI_DB_${String(args.name).toUpperCase().replace(/[^A-Z0-9]/g, '_')}_PASSWORD` : undefined)
          if (p.password && ref && credentials && typeof credentials.set === 'function') {
            try { await credentials.set(ref, p.password) } catch { /* 凭据服务不可用时退回 profile 内存储 */ }
          }
          profiles[args.name] = {
            kind: p.kind,
            path: p.path,
            host: p.host,
            port: p.port,
            user: p.user,
            database: p.database,
            url: p.url,
            credentialsRef: ref,
            // 凭据服务不可用时的兜底（明文，警告）
            password: p.password && !(ref && credentials && typeof credentials.set === 'function') ? p.password : undefined,
          }
          saveProfiles(profiles, opts, exec)
          return { ok: true, name: args.name, ...(ref ? { storedCredentialsRef: ref } : {}) }
        }
        case 'remove': {
          if (!args.name || !profiles[args.name]) throw new Error(`profile "${args.name}" 不存在`)
          delete profiles[args.name]
          saveProfiles(profiles, opts, exec)
          const conn = pools.get(args.name)
          if (conn) { try { await conn.close() } catch { /* ignore */ } pools.delete(args.name) }
          return { ok: true, removed: args.name }
        }
        case 'test': {
          if (!args.name || !profiles[args.name]) throw new Error(`profile "${args.name}" 不存在`)
          const conn = await getConnection(profiles, args.name, credentials)
          try {
            let tables = []
            if (conn.kind === 'sqlite') {
              const r = await conn.query("select name, type from sqlite_master where type in ('table','view') order by name", 100)
              tables = r.rows
            } else if (conn.kind === 'postgres') {
              const r = await conn.query("select table_name as name, table_type as type from information_schema.tables where table_schema='public' order by table_name limit 100", 100)
              tables = r.rows
            } else {
              const r = await conn.query('show tables', 100)
              tables = r.rows
            }
            return { ok: true, profile: args.name, kind: conn.kind, objects: tables }
          } finally {
            pools.delete(args.name)
            try { await conn.close() } catch { /* ignore */ }
          }
        }
        default:
          throw new Error(`未知 action: ${args.action}`)
      }
    },
  })

  ctx.tools.register({
    name: 'sci_db_tables',
    description: '列出数据库 profile 的表/视图与列信息。参数：profile（必填）、table（可选，给出时返回该表的列定义）。',
    parameters: {
      profile: { type: 'string', required: true },
      table: { type: 'string' },
    },
    output: {
      schema: { type: 'object' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args, exec) {
      const profiles = loadProfiles()
      const conn = await getConnection(profiles, args.profile, credentials)
      if (conn.kind === 'sqlite') {
        if (args.table) {
          const r = await conn.query(`pragma table_info("${args.table.replace(/"/g, '""')}")`, 500)
          return { profile: args.profile, table: args.table, columns: r.rows }
        }
        const r = await conn.query("select name, type from sqlite_master where type in ('table','view') order by name", 500)
        return { profile: args.profile, objects: r.rows }
      }
      if (conn.kind === 'postgres') {
        const where = args.table ? ` and table_name = '${args.table.replace(/'/g, "''")}'` : ''
        const r = await conn.query(`select table_name, column_name, data_type from information_schema.columns where table_schema='public'${where} order by table_name, ordinal_position limit 1000`, 1000)
        return { profile: args.profile, columns: r.rows }
      }
      const db = profiles[args.profile].database || (await conn.query('select database()', 1)).rows[0]
      const where = args.table ? ` and table_name = '${args.table.replace(/'/g, "''")}'` : ''
      const r = await conn.query(`select table_name, column_name, column_type from information_schema.columns where table_schema = '${String(db).replace(/'/g, "''")}'${where} order by table_name, ordinal_position limit 1000`, 1000)
      return { profile: args.profile, columns: r.rows }
    },
  })

  ctx.tools.register({
    name: 'sci_db_query',
    description:
      '对数据库执行只读查询（仅单条 SELECT/WITH/EXPLAIN/只读 PRAGMA）。写操作会被拒绝——请用 sci_db_execute。参数：profile、sql、max_rows（默认 200，最大 5000）。',
    parameters: {
      profile: { type: 'string', required: true },
      sql: { type: 'string', required: true },
      max_rows: { type: 'number' },
    },
    output: {
      schema: { type: 'object' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args, exec) {
      return runQueryOrExec(args, null, 'query')
    },
  })

  // 写操作：pre-execute 审批（ask），仅 allowed-once 放行
  ctx.tools.register({
    name: 'sci_db_execute',
    description:
      '对数据库执行写操作（INSERT/UPDATE/DELETE/DDL）。每次调用都需要用户在审批卡上确认。参数：profile、sql。',
    parameters: {
      profile: { type: 'string', required: true },
      sql: { type: 'string', required: true },
    },
    output: {
      schema: { type: 'object' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args, exec) {
      return runQueryOrExec(args, null, 'exec')
    },
  })

  // 写操作审批门：对 sci_db_execute 一律 ask
  try {
    ctx.on('tools/pre-execute', async (exec, next) => {
      if (exec && exec.name === 'sci_db_execute') {
        return { kind: 'ask', reason: 'dsh-science: 数据库写操作需要确认' }
      }
      return next()
    })
  } catch (err) {
    log(`pre-execute gate failed: ${err && err.message}`)
  }

  log('db tools registered (sci_db_profiles / sci_db_tables / sci_db_query / sci_db_execute)')
}
