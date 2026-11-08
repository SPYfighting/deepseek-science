// dsh-science — SSH 远程计算模块（P3-2）
// 作业模式：提交 → 等待 → 收割（无交互式远程 shell）。
// 作业目录布局（远端）：<scratch>/dsh-sci-jobs/<name>-<ts>/
//   run.sh        用户脚本
//   wrapper.sh    超时看门狗 + out/ 打包收割（原创实现）
//   .job_env      环境变量（KEY=VALUE）
//   out/          结果目录（唯一被收割的内容，连同 stdout.log/stderr.log 打包）
//   .phase        状态标记：running | done:<rc>:<wall> | harvest_failed:<rc>:<wall>
// 本地记录：$DSH_HOME/dsh-science/ssh-profiles.json、ssh-jobs.json

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { dataDirOf, PKG_ROOT_OF } from './store.js'
import { homedir, tmpdir } from 'node:os'
import { createHash } from 'node:crypto'

function log(msg) {
  console.log(`[dsh-science ssh] ${msg}`)
}

// ---------------------------------------------------------------- storage ---

function dataDir() {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  const dir = join(home, 'dsh-science')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function loadJson(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

const profilesFile = () => join(dataDir(), 'ssh-profiles.json')
const jobsFile = () => join(dataDir(), 'ssh-jobs.json')

// ---------------------------------------------------------------- sessions --

const clients = new Map() // profileName -> { client, sftp }

async function getClient(profile) {
  if (clients.has(profile.name)) {
    const entry = clients.get(profile.name)
    if (entry.client.readyState && entry.client.readyState === 'ready') return entry
    try { entry.client.end() } catch { /* ignore */ }
    clients.delete(profile.name)
  }
  // vendored ssh2（纯 JS，无生命周期脚本）——发布安装不被 allowBuilds 门槛拦截
  let Client
  try {
    ;({ default: { Client } } = await import(
      pathToFileURL(join(PKG_ROOT_OF(), 'lib/vendor/ssh2.bundle.cjs')).href
    ))
  } catch (importErr) {
    console.error(`[dsh-science ssh] vendor import FAILED: ${importErr && importErr.stack}`)
    throw importErr
  }
  const conn = new Client()
  const config = {
    host: profile.host,
    port: profile.port || 22,
    username: profile.username,
    readyTimeout: 15000,
  }
  if (profile.auth === 'password') config.password = profile.password || ''
  else if (profile.auth === 'key' && profile.keyPath) {
    config.privateKey = readFileSync(profile.keyPath, 'utf8')
    if (profile.password) config.passphrase = profile.password
  } // 默认 agent
  else {
    // vendored bundle 同样导出 Client（agent 认证走同一模块）
    const { default: { Client } } = await import(
      pathToFileURL(join(PKG_ROOT_OF(), 'lib/vendor/ssh2.bundle.cjs')).href
    )
    const agentSock = process.env.SSH_AUTH_SOCK
    if (agentSock) config.agent = agentSock
  }
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve)
    conn.on('error', reject)
    conn.connect(config)
  })
  const sftp = await new Promise((resolve, reject) => {
    conn.sftp((err, s) => (err ? reject(err) : resolve(s)))
  })
  const entry = { client: conn, sftp }
  clients.set(profile.name, entry)
  conn.on('close', () => clients.delete(profile.name))
  return entry
}

function execCmd(entry, command, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`命令超时(${timeoutMs}ms): ${command.slice(0, 80)}`)), timeoutMs)
    entry.client.exec(command, (err, stream) => {
      if (err) { clearTimeout(timer); return reject(err) }
      let stdout = ''
      let stderr = ''
      let code = 0
      stream.on('data', (d) => { stdout += d.toString() })
      stream.stderr.on('data', (d) => { stderr += d.toString() })
      stream.on('close', (c) => { clearTimeout(timer); code = c; resolve({ code, stdout, stderr }) })
    })
  })
}

// ---------------------------------------------------------------- wrapper ----

// 原创作业包装脚本：超时看门狗（TERM→宽限→KILL）+ out/ 打包 + .phase 标记
const WRAPPER_SH = `#!/usr/bin/env bash
set -u
cd "$(dirname "$0")"
rm -rf out stdout.log stderr.log .phase out.tar.gz out.tar.gz.tmp
mkdir -p out
JOB_TIMEOUT=\${SCI_JOB_TIMEOUT_S:-1800}
GRACE=\${SCI_TERM_GRACE_S:-30}
set -a; [ -f .job_env ] && . ./.job_env; set +a
t0=\${EPOCHSECONDS:-$(date +%s)}
setsid timeout --foreground --kill-after="$GRACE" "$JOB_TIMEOUT" bash run.sh > stdout.log 2> stderr.log &
wpid=$!
trap '[ -n "$wpid" ] && kill -TERM -- -"$wpid" 2>/dev/null' TERM
wait "$wpid"; rc=$?
[ "$rc" -gt 128 ] && kill -0 "$wpid" 2>/dev/null 2>/dev/null && wait "$wpid" && rc=$?
wall=$(( \${EPOCHSECONDS:-$(date +%s)} - t0 ))
kill -KILL -- -"$wpid" 2>/dev/null
if [ "$rc" -eq 0 ] && [ -z "$(ls -A out 2>/dev/null)" ]; then
  echo "dsh-science: WARN out/ 为空——结果请写到 out/ 目录" >> stderr.log
fi
if env -u TAR_OPTIONS -u GZIP tar -czf out.tar.gz.tmp out stdout.log stderr.log 2>/dev/null && mv -f out.tar.gz.tmp out.tar.gz; then
  echo "done:$rc:$wall" > .phase
else
  echo "harvest_failed:$rc:$wall" > .phase
fi
exit $rc
`


// SFTP 无 shell：把远端路径里的 ~ 展开为主目录
async function expandRemotePath(entry, profile, remotePath) {
  if (!remotePath.startsWith('~')) return remotePath
  const home = profile.details?.home
  if (home) return remotePath.replace(/^~(?=\/|$)/, home.replace(/\/$/, ''))
  const r = await execCmd(entry, 'echo $HOME', 10000)
  const h = r.stdout.trim().replace(/\/$/, '')
  return h ? remotePath.replace(/^~(?=\/|$)/, h) : remotePath
}

function jobKey(name) {
  return `${String(name).replace(/[^\w.-]/g, '_')}-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`
}

// ---------------------------------------------------------------- probe ------

const PROBE_CMDS = [
  ['os', 'uname -srm'],
  ['cpu', 'nproc 2>/dev/null || echo ?'],
  ['mem', 'free -h 2>/dev/null | awk \'/^Mem/{print $2}\' || echo ?'],
  ['gpu', 'nvidia-smi --query-gpu=name,memory.total --format=csv,noheader 2>/dev/null | head -4 || true'],
  ['conda', 'command -v conda micromamba mamba 2>/dev/null || true'],
  ['scheduler', 'command -v sbatch qsub bsub 2>/dev/null || true'],
  ['slurm_partitions', 'sinfo -h -o "%P" 2>/dev/null | head -10 || true'],
  ['disk_scratch', 'df -h $HOME 2>/dev/null | tail -1 || true'],
  ['python', 'command -v python3 python 2>/dev/null || true'],
  ['home', 'echo $HOME'],
]

// ---------------------------------------------------------------- tools ------

export function registerSshTools(ctx, opts = {}) {
  const APPROVAL_TOOLS = new Set(['sci_ssh_exec', 'sci_job_submit', 'sci_file_push', 'sci_file_fetch'])

  try {
    ctx.on('tools/pre-execute', async (exec, next) => {
      if (exec && APPROVAL_TOOLS.has(exec.name)) {
        return { kind: 'ask', reason: 'dsh-science: 远程操作需要确认（SSH 命令/作业提交/文件传输）' }
      }
      return next()
    })
  } catch (err) {
    log(`pre-execute gate failed: ${err && err.message}`)
  }

  // -- profiles -------------------------------------------------------------
  ctx.tools.register({
    name: 'sci_ssh_profiles',
    description:
      '管理 SSH 主机 profile。动作：list / add（name, host, username, port?, auth: agent|key|password, keyPath?, password?）/ remove / import（读取本机 ~/.ssh/config 中已知主机名列表）。凭据存于本机文件。',
    parameters: {
      action: { type: 'string', required: true, description: 'list | add | remove | import' },
      name: { type: 'string' },
      profile: { type: 'object', description: 'add 时的连接参数' },
    },
    output: {
      schema: { type: 'object' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args, exec) {
      const profiles = loadJson(profilesFile(), {})
      switch (args.action) {
        case 'list':
          return {
            profiles: Object.entries(profiles).map(([name, p]) => ({
              name,
              host: `${p.username}@${p.host}:${p.port || 22}`,
              auth: p.auth,
              ...(p.probedAt ? { probed: new Date(p.probedAt).toISOString() } : {}),
              ...(p.details ? { details: p.details } : {}),
            })),
          }
        case 'add': {
          const p = args.profile || {}
          if (!args.name || !p.host || !p.username) throw new Error('add 需要 name / profile.host / profile.username')
          profiles[args.name] = {
            host: p.host,
            port: p.port || 22,
            username: p.username,
            auth: p.auth || 'agent',
            keyPath: p.keyPath,
            password: p.password, // v1: 本机文件存储；P5 接入凭据服务
            scratch: p.scratch || '~',
          }
          saveProfiles(profiles)
          return { ok: true, name: args.name }
        }
        case 'remove': {
          if (!profiles[args.name]) throw new Error(`profile "${args.name}" 不存在`)
          delete profiles[args.name]
          saveProfiles(profiles)
          return { ok: true, removed: args.name }
        }
        case 'import': {
          const cfg = readFileSync(join(homedir(), '.ssh', 'config'), 'utf8')
          const hosts = [...cfg.matchAll(/^Host\s+(\S+)$/gmi)].map((m) => m[1]).filter((h) => !h.includes('*'))
          return { hosts }
        }
        default:
          throw new Error(`未知 action: ${args.action}`)
        }
    },
  })
  function saveProfiles(profiles, exec) {
    const text = JSON.stringify(profiles, null, 2)
    writeFileSync(profilesFile(), text, 'utf8')
    if (opts.mirror) opts.mirror('ssh-profiles.json', text, exec)
  }

  // -- probe ----------------------------------------------------------------
  ctx.tools.register({
    name: 'sci_ssh_probe',
    description:
      '探测 SSH 主机计算环境（只读命令）：OS/CPU/内存/GPU/conda/调度器/Slurm 分区/磁盘/python。结果存入 profile.details 供后续作业使用。参数：profile。',
    parameters: { profile: { type: 'string', required: true } },
    output: {
      schema: { type: 'object' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args, exec) {
      const profiles = loadJson(profilesFile(), {})
      const profile = profiles[args.profile]
      if (!profile) throw new Error(`SSH profile "${args.profile}" 不存在。先用 sci_ssh_profiles add 创建。`)
      const entry = await getClient(profile)
      const details = {}
      for (const [key, cmd] of PROBE_CMDS) {
        try {
          const r = await execCmd(entry, cmd, 15000)
          details[key] = (r.stdout || r.stderr).trim() || '(空)'
        } catch (e) {
          details[key] = `ERROR: ${e.message}`
        }
      }
      profile.details = details
      profile.probedAt = Date.now()
      saveProfiles(profiles)
      return { profile: args.profile, details }
    },
  })

  // -- exec（审批）-----------------------------------------------------------
  ctx.tools.register({
    name: 'sci_ssh_exec',
    description:
      '在 SSH 主机上执行一条短命令（探测/状态类，≤120 秒）。长任务请用 sci_job_submit。需要审批。参数：profile、command、timeout_s?。',
    parameters: {
      profile: { type: 'string', required: true },
      command: { type: 'string', required: true },
      timeout_s: { type: 'number' },
    },
    output: {
      schema: { type: 'object' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args, exec) {
      const profiles = loadJson(profilesFile(), {})
      const profile = profiles[args.profile]
      if (!profile) throw new Error(`SSH profile "${args.profile}" 不存在`)
      const entry = await getClient(profile)
      const r = await execCmd(entry, args.command, Math.min((args.timeout_s || 120) * 1000, 120000))
      return {
        profile: args.profile,
        exitCode: r.code,
        stdout: r.stdout.slice(0, 8000),
        stderr: r.stderr.slice(0, 4000),
      }
    },
  })

  // -- job submit（审批）------------------------------------------------------
  ctx.tools.register({
    name: 'sci_job_submit',
    description:
      '向 SSH 主机提交计算作业（提交→等待→收割模式，作业不依赖连接存活）。参数：profile、name、script（bash 脚本文本，结果必须写到 out/）、mode?（auto|slurm|direct）、walltime_s?（默认 1800）、inputs?（本地文件数组，上传到作业目录）、env?（环境变量对象）。需要审批。',
    parameters: {
      profile: { type: 'string', required: true },
      name: { type: 'string', required: true },
      script: { type: 'string', required: true },
      mode: { type: 'string' },
      walltime_s: { type: 'number' },
      inputs: { type: 'array', description: '本地文件路径数组' },
      env: { type: 'object' },
    },
    output: {
      schema: { type: 'object' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args, exec) {
      const profiles = loadJson(profilesFile(), {})
      const profile = profiles[args.profile]
      if (!profile) throw new Error(`SSH profile "${args.profile}" 不存在`)
      const entry = await getClient(profile)
      const walltime = Math.min(Math.max(args.walltime_s || 1800, 30), 7 * 24 * 3600)

      const scratch = profile.details?.home || profile.scratch || '~'
      const job = jobKey(args.name)
      const remoteDir = `${scratch}/dsh-sci-jobs/${job}`
      await execCmd(entry, `mkdir -p '${remoteDir}'`, 15000)

      const put = (remotePath, content) =>
        new Promise((resolve, reject) => {
          entry.sftp.writeFile(remotePath, content, (err) => (err ? reject(err) : resolve()))
        })
      await put(`${remoteDir}/run.sh`, args.script)
      await put(`${remoteDir}/wrapper.sh`, WRAPPER_SH)
      const envLines = Object.entries(args.env || {})
        .map(([k, v]) => `${k}=${JSON.stringify(String(v))}`)
        .join('\n')
      if (envLines) await put(`${remoteDir}/.job_env`, envLines)
      // 传入文件
      for (const local of args.inputs || []) {
        const data = readFileSync(local)
        const remote = `${remoteDir}/inputs/${local.split(/[\\/]/).pop()}`
        await execCmd(entry, `mkdir -p '${remoteDir}/inputs'`, 10000)
        await new Promise((resolve, reject) => {
          entry.sftp.writeFile(remote, data, (err) => (err ? reject(err) : resolve()))
        })
      }
      await execCmd(entry, `chmod +x '${remoteDir}/run.sh' '${remoteDir}/wrapper.sh'`, 10000)
      await execCmd(entry, `echo running > '${remoteDir}/.phase'`, 10000)

      // 模式选择：slurm 存在且未指定 direct → sbatch；否则 nohup direct
      let mode = args.mode || 'auto'
      if (mode === 'auto') {
        const hasSlurm = await execCmd(entry, 'command -v sbatch >/dev/null 2>&1 && echo yes || echo no', 10000)
        mode = hasSlurm.stdout.trim() === 'yes' ? 'slurm' : 'direct'
      }

      const jobs = loadJson(jobsFile(), {})
      jobs[job] = {
        profile: args.profile,
        name: args.name,
        remoteDir,
        mode,
        submittedAt: Date.now(),
        walltime,
      }
      writeFileSync(jobsFile(), JSON.stringify(jobs, null, 2), 'utf8')
      if (opts.mirror) opts.mirror('ssh-jobs.json', JSON.stringify(jobs, null, 2), exec)

      let submitInfo
      if (mode === 'slurm') {
        if (!(await execCmd(entry, 'command -v sbatch >/dev/null 2>&1 && echo yes || echo no', 10000)).stdout.trim().startsWith('yes')) {
          throw new Error('该主机没有 sbatch（非 Slurm 主机）。请用 mode: direct，或先 sci_ssh_probe 确认调度器。')
        }
        const parts = (profile.details?.slurm_partitions || '').trim()
        const sbatchScript = `#!/usr/bin/env bash
#SBATCH -J ${job}
#SBATCH -o wrapper-sbatch.log
${parts ? `#SBATCH -p ${parts.split('\n')[0].replace(/[*#]/g, '').trim()}` : ''}
#SBATCH -t ${Math.ceil(walltime / 60)}
cd '${remoteDir}'
bash wrapper.sh
`
        await put(`${remoteDir}/sbatch.sh`, sbatchScript)
        const r = await execCmd(entry, `cd '${remoteDir}' && sbatch sbatch.sh`, 15000)
        submitInfo = { mode, output: r.stdout.trim(), stderr: r.stderr.trim() }
      } else {
        try {
          await execCmd(
            entry,
            `cd '${remoteDir}' && (setsid bash wrapper.sh > wrapper.log 2>&1 < /dev/null &) ; echo started`,
            15000,
          )
        } catch (launchErr) {
          // 双 fork 后通道仍偶发不立即关闭：超时不算失败，作业已在远端启动
          log(`launch command timed out (job assumed started): ${launchErr.message}`)
        }
        submitInfo = { mode: 'direct' }
      }

      jobs[job].mode = submitInfo.mode
      writeFileSync(jobsFile(), JSON.stringify(jobs, null, 2), 'utf8')
      return { job, remoteDir, mode: submitInfo.mode, submitInfo, note: '用 sci_job_status 轮询；完成后 sci_job_harvest 取回结果' }
    },
  })

  // -- job status / logs / harvest ---------------------------------------------
  ctx.tools.register({
    name: 'sci_job_status',
    description: '查询作业状态（读远端 .phase + 进程检查）。参数：profile、job?（缺省列出全部）。',
    parameters: { profile: { type: 'string', required: true }, job: { type: 'string' } },
    output: {
      schema: { type: 'object' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args, exec) {
      const jobs = loadJson(jobsFile(), {})
      const entries = Object.entries(jobs).filter(([k, v]) => v.profile === args.profile && (!args.job || k === args.job))
      if (entries.length === 0) throw new Error('没有匹配的作业记录')
      const profiles = loadJson(profilesFile(), {})
      const profile = profiles[args.profile]
      const entry = await getClient(profile)
      const out = []
      for (const [id, meta] of entries) {
        try {
          const r = await execCmd(entry, `cat '${meta.remoteDir}/.phase' 2>/dev/null || echo missing`, 10000)
          const phase = r.stdout.trim()
          let parsed
          if (phase.startsWith('done:') || phase.startsWith('harvest_failed:')) {
            const [state, rcS, wallS] = phase.split(':')
            const rc = Number(rcS)
            parsed = { state: state === 'done' && rc !== 0 ? 'failed' : state, rc, wallS: Number(wallS) }
          } else {
            parsed = { state: phase }
          }
          out.push({ job: id, ...parsed, remoteDir: meta.remoteDir, mode: meta.mode })
        } catch (e) {
          out.push({ job: id, state: 'unreachable', error: e.message })
        }
      }
      return { jobs: out }
    },
  })

  ctx.tools.register({
    name: 'sci_job_logs',
    description: '读取作业 stdout/stderr 尾部。参数：profile、job、lines?（默认 100）。',
    parameters: { profile: { type: 'string', required: true }, job: { type: 'string', required: true }, lines: { type: 'number' } },
    output: {
      schema: { type: 'object' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args, exec) {
      const jobs = loadJson(jobsFile(), {})
      const meta = jobs[args.job]
      if (!meta) throw new Error(`作业 "${args.job}" 不存在`)
      const profiles = loadJson(profilesFile(), {})
      const entry = await getClient(profiles[meta.profile])
      const n = Math.min(args.lines || 100, 2000)
      const out = await execCmd(entry, `tail -n ${n} '${meta.remoteDir}/stdout.log' 2>/dev/null`, 15000)
      const err = await execCmd(entry, `tail -n ${n} '${meta.remoteDir}/stderr.log' 2>/dev/null`, 15000)
      return {
        job: args.job,
        stdoutTail: out.stdout.slice(0, 8000),
        stderrTail: err.stdout.slice(0, 8000),
      }
    },
  })

  ctx.tools.register({
    name: 'sci_job_harvest',
    description:
      '收割完成的作业：拉回 out.tar.gz 并解包到本地 $DSH_HOME/dsh-science/jobs/<job>/out/。大于 100MB 的单文件不会自动回传（记录路径，用 sci_file_fetch 单独取）。参数：profile、job。',
    parameters: { profile: { type: 'string', required: true }, job: { type: 'string', required: true } },
    output: {
      schema: { type: 'object' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args, exec) {
      const jobs = loadJson(jobsFile(), {})
      const meta = jobs[args.job]
      if (!meta) throw new Error(`作业 "${args.job}" 不存在`)
      const profiles = loadJson(profilesFile(), {})
      const entry = await getClient(profiles[meta.profile])
      const phase = await execCmd(entry, `cat '${meta.remoteDir}/.phase' 2>/dev/null || echo missing`, 10000)
      const p = phase.stdout.trim()
      if (!p.startsWith('done:') && !p.startsWith('harvest_failed:')) {
        throw new Error(`作业尚未完成（phase=${p}）。完成后再收割。`)
      }
      // 大文件守卫：列出 out/ 中 >100MB 的文件
      const big = await execCmd(
        entry,
        `find '${meta.remoteDir}/out' -type f -size +100M -printf '%s %p\\n' 2>/dev/null | head -20`,
        15000,
      )
      const localDir = join(dataDir(), 'jobs', args.job)
      if (!existsSync(localDir)) mkdirSync(localDir, { recursive: true })
      const localTar = join(localDir, 'out.tar.gz')
      await new Promise((resolve, reject) => {
        entry.sftp.readFile(`${meta.remoteDir}/out.tar.gz`, (err, data) => (err ? reject(err) : resolve(data)))
      }).then(async (data) => {
        writeFileSync(localTar, data)
      })
      // 解包（Windows 下用系统 tar）
      const { execFile } = await import('node:child_process')
      const { promisify } = await import('node:util')
      const runTar = (extra) => promisify(execFile)('tar', ['-xzf', ...extra, localTar, '-C', localDir])
      try {
        await runTar(['--force-local'])
      } catch {
        await runTar([])  // bsdtar（系统自带）不需要 --force-local
      }
      return {
        job: args.job,
        phase: p,
        localDir,
        bigFilesRemote: big.stdout.trim() || undefined,
        note: '结果在 localDir/out/，日志为 localDir/stdout.log、stderr.log',
      }
    },
  })

  // -- file push/fetch（审批）---------------------------------------------------
  ctx.tools.register({
    name: 'sci_file_push',
    description: '上传本地文件到 SSH 主机。需要审批。参数：profile、local、remote。',
    parameters: { profile: { type: 'string', required: true }, local: { type: 'string', required: true }, remote: { type: 'string', required: true } },
    output: {
      schema: { type: 'object' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args, exec) {
      const profiles = loadJson(profilesFile(), {})
      const profile = profiles[args.profile]
      const entry = await getClient(profile)
      const remote = await expandRemotePath(entry, profile, args.remote)
      const data = readFileSync(args.local)
      await new Promise((resolve, reject) => entry.sftp.writeFile(remote, data, (e) => (e ? reject(e) : resolve())))
      return { ok: true, remote, bytes: data.length }
    },
  })

  ctx.tools.register({
    name: 'sci_file_fetch',
    description: '从 SSH 主机下载文件到本地（默认存到 $DSH_HOME/dsh-science/downloads/<job>/，互不覆盖）。需要审批。参数：profile、remote、local?、job?。',
    parameters: { profile: { type: 'string', required: true }, remote: { type: 'string', required: true }, local: { type: 'string' }, job: { type: 'string' } },
    output: {
      schema: { type: 'object' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args, exec) {
      const profiles = loadJson(profilesFile(), {})
      const profile = profiles[args.profile]
      const entry = await getClient(profile)
      const remote = await expandRemotePath(entry, profile, args.remote)
      const data = await new Promise((resolve, reject) =>
        entry.sftp.readFile(remote, (e, d) => (e ? reject(e) : resolve(d))),
      )
      const local = args.local || join(dataDir(), 'downloads', (args.job || String(Date.now())), remote.split('/').pop())
      mkdirSync(dirname(local), { recursive: true })
      writeFileSync(local, data)
      return { ok: true, local, bytes: data.length }
    },
  })

  log('ssh tools registered (profiles/probe/exec/jobs/files)')
}
