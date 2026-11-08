// dsh-science — 文献核对模块（v0.9.0，Track 2 B2）
// sci_doi_verify：输入 DOI → Crossref works API 核对并回填真实元数据（标题/期刊/年份/作者）。
// 背景（ALIGNMENT-v09 E2）：本工具此前只存在于角色提示词/审查协议/skills 文本里，从未实现——
// 引用卫生链路的断点。本模块落地它，并作为 sci_result_reference_add（蓝图参考文献）的
// 自动核对底座：带 DOI 登记参考文献时自动调用 verifyDoi，核对失败 → verified:false。
// 核对语义（对齐 aipoch/open-science 的 Crossref 撤稿检查声明）：核对的是"元数据真实性"，
// 覆盖面有限——verified:true 表示 Crossref 存在该 DOI 且元数据回填成功，不构成学术效力担保。
// 限速礼仪：无批量接口，单次调用；超时 15s；网络不可用/任何异常 → { ok:false }（不抛异常，
// 调用方据此标 verified:false 并继续主流程）。

function log(msg) {
  console.log(`[dsh-science lit] ${msg}`)
}

const CROSSREF_API = 'https://api.crossref.org/works/'
const VERIFY_TIMEOUT_MS = 15000

// 归一化：去掉 https://doi.org/ 与 doi: 前缀，转小写（DOI 大小写不敏感）
export function normalizeDoi(raw) {
  let id = String(raw || '').trim()
  id = id.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').replace(/^doi:/i, '')
  return id.toLowerCase()
}

// 提取 Crossref message 里的第一标题/期刊/年份/作者（字段都是数组或缺失，逐项容错）
function metaOf(msg) {
  const first = (v) => (Array.isArray(v) ? v[0] : v)
  const dateParts = (msg.issued && msg.issued['date-parts']) || []
  const year = Array.isArray(dateParts[0]) || typeof dateParts[0] === 'number' ? dateParts[0] : undefined
  return {
    title: String(first(msg.title) || '').slice(0, 300) || undefined,
    containerTitle: String(first(msg['container-title']) || '').slice(0, 200) || undefined,
    year: typeof year === 'number' ? year : Array.isArray(year) ? year[0] : undefined,
    authors: Array.isArray(msg.author)
      ? msg.author
          .map((a) => [a && a.given, a && a.family].filter(Boolean).join(' '))
          .filter(Boolean)
          .slice(0, 8)
      : undefined,
    type: msg.type || undefined,
  }
}

// DOI 核对：ok=true 时返回 Crossref 元数据；ok=false 时返回 error（调用方标 verified:false）
export async function verifyDoi(doi, timeoutMs = VERIFY_TIMEOUT_MS) {
  const id = normalizeDoi(doi)
  if (!id) return { ok: false, error: 'DOI 为空' }
  try {
    const res = await fetch(`${CROSSREF_API}${encodeURIComponent(id)}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (res.status === 404) {
      return { ok: false, doi: id, error: `Crossref 无此 DOI（404）：${id}——请核对引用是否编造` }
    }
    if (!res.ok) {
      return { ok: false, doi: id, error: `Crossref HTTP ${res.status}（服务暂不可用，稍后可重试）` }
    }
    const body = await res.json()
    const msg = body && body.message
    if (!msg || typeof msg !== 'object') {
      return { ok: false, doi: id, error: 'Crossref 响应缺 message 字段' }
    }
    log(`verified doi: ${id}`)
    return { ok: true, doi: id, source: 'crossref', verifiedAt: Date.now(), ...metaOf(msg) }
  } catch (err) {
    const reason = err && err.name === 'TimeoutError' ? '超时' : (err && err.message) || String(err)
    return { ok: false, doi: id, error: `Crossref 核对失败（${reason}）——网络不可用时参考文献仍可登记，但 verified=false` }
  }
}

export function registerLitTools(ctx) {
  ctx.tools.register({
    name: 'sci_doi_verify',
    description:
      '核对 DOI 真实性（Crossref works API）：返回该 DOI 的真实元数据（标题/期刊/年份/作者）。用于引用卫生检查与参考文献登记前的核对；DOI 不存在（404）时明确报错——引用不得编造。网络不可用时返回核对失败说明。',
    parameters: {
      doi: { type: 'string' /*必填*/, description: 'DOI（必填，接受裸 DOI / doi: 前缀 / https://doi.org/ 链接）' },
    },
    output: {
      schema: { type: 'object' },
      render: (_a, v) => [{ type: 'text', text: JSON.stringify(v, null, 2) }],
    },
    async execute(args) {
      const r = await verifyDoi(args.doi)
      if (!r.ok) return { verified: false, doi: String(args.doi || ''), error: r.error }
      return {
        verified: true,
        doi: r.doi,
        title: r.title || '',
        container: r.containerTitle || '',
        year: r.year || null,
        authors: r.authors || [],
        type: r.type || '',
        source: r.source,
      }
    },
  })
  log('lit tools registered (sci_doi_verify)')
}
