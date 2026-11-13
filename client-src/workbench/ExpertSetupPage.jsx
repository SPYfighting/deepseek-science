import React, { useMemo, useState } from 'react'
import { Badge, Button, Panel, StatusMessage } from './components/ui.jsx'

const tool = (name, category) => ({
  name,
  category,
  environment: '本机运行依赖未探测；需按工具官方文档核对。',
  status: '本机安装状态与版本未检测。',
})

const ROLE_INFO = {
  simulator: { title: '计算模拟专家', purpose: '分子动力学、分子对接与蛋白复合物建模。', tools: [tool('GROMACS', '分子动力学软件'), tool('OpenMM', '分子动力学框架'), tool('NAMD', '分子动力学软件'), tool('Boltz', '蛋白质结构/复合物预测'), tool('AutoDock Vina', '分子对接软件'), tool('ORCA', '量子化学软件'), tool('Quantum ESPRESSO', '第一性原理计算软件')] },
  trainer: { title: '模型训练专家', purpose: '蛋白质语言模型、可复现训练与参数高效微调。', tools: [tool('ESM / ESMC', '蛋白质语言模型'), tool('ProtT5', '蛋白质语言模型'), tool('PyTorch Lightning', '深度学习训练框架'), tool('Hugging Face / PEFT', '模型与参数高效微调工具')] },
  'figure-expert': { title: '科研绘图专家', purpose: '组学统计图、结构与互作图、机制示意图和投稿前检查。', tools: [tool('Matplotlib / Seaborn / Plotly', '数据可视化库'), tool('结构视图与互作图', '结构分析与绘图工具'), tool('可编辑 SVG / PDF', '矢量图格式')] },
  analyst: { title: '数据分析师', purpose: 'NGS、单细胞、空间组学、蛋白质组和常规生物统计。', tools: [tool('FastQC / MultiQC', '测序质控工具'), tool('DESeq2 / edgeR', '差异表达分析包'), tool('Scanpy / Seurat', '单细胞分析工具'), tool('R / Python', '统计与脚本语言')] },
  'literature-scout': { title: '文献调研专员', purpose: '系统检索、筛选和核对研究证据。', tools: [tool('PubMed / Europe PMC', '文献数据库'), tool('Crossref / DOI 校验', '书目与标识符服务'), tool('系统综述记录', '证据整理方法')] },
  'topic-designer': { title: '课题设计专家', purpose: '研究问题、实验设计、关键对照和可检验假设。', tools: [tool('研究设计与功效分析', '统计设计方法'), tool('因果图与反证条件', '因果推理方法'), tool('实验可行性评估', '方案评估方法')] },
  writer: { title: '文章撰写专家', purpose: '围绕已确认结果组织稿件，不补造证据。', tools: [tool('论文结构与期刊格式', '写作规范'), tool('引文和图表定位', '稿件组织方法'), tool('中英文稿件', '学术写作')] },
  reviewer: { title: '科研审查专家', purpose: '检查主张、证据、统计和报告规范之间的一致性。', tools: [tool('证据链审查', '证据核查方法'), tool('偏倚与局限性核查', '研究质量评估'), tool('投稿前清单', '报告规范检查')] },
  presentation: { title: '汇报 PPT 专家', purpose: '将已确认结果整理成可讲述的学术汇报。', tools: [tool('会议汇报结构', '汇报设计'), tool('结果图表编排', '科学传播'), tool('答辩叙事', '汇报设计')] },
}

const ROLE_BY_KEY = {
  simulator: 'simulator', trainer: 'trainer', analyst: 'analyst', 'figure-expert': 'figure-expert',
  'literature-scout': 'literature-scout', 'topic-designer': 'topic-designer', writer: 'writer', reviewer: 'reviewer', presentation: 'presentation',
}

function installedFor(installed, role, catalogId) {
  return (installed?.[role] || []).find((item) => item.catalogId === catalogId || item.name === catalogId)
}

export function ExpertSetupPage({ view, refresh }) {
  const [busy, setBusy] = useState(null)
  const [notice, setNotice] = useState(null)
  const skillMenu = view.experts.skillMenu || {}
  const catalog = skillMenu.catalog || {}
  const installed = skillMenu.installed || {}
  const roles = Object.keys(ROLE_INFO)
  const candidateCards = useMemo(() => roles.flatMap((role) => (catalog[role] || []).map((entry) => ({ ...entry, role }))), [catalog])
  const catalogEntryKeys = new Set(candidateCards.map((entry) => `${entry.role}:${entry.id}`))
  const customInstalled = roles.flatMap((role) => (installed[role] || []).map((entry) => ({ ...entry, role, id: entry.name })))
    .filter((entry) => !catalogEntryKeys.has(`${entry.role}:${entry.catalogId || entry.name}`))
  const manageSkill = async (entry, action) => {
    const key = `${entry.role}:${entry.id}`
    setBusy(key); setNotice(null)
    try {
      const payloadBody = action === 'remove'
        ? { action, role: entry.role, name: entry.id }
        : { action, role: entry.role, repoId: entry.id }
      const response = await fetch('/plugins/dsh-science/skill-manage', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payloadBody) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || payload.ok === false) throw new Error(payload.error || `HTTP ${response.status}`)
      setNotice({ tone: 'success', text: action === 'install' ? `${entry.name} 已安装。` : `${entry.name} 已移除。` })
      await refresh()
    } catch (error) { setNotice({ tone: 'error', text: `操作失败：${error.message}` }) }
    finally { setBusy(null) }
  }
  return <div className="sci-stack">
    <Panel title="专家能力" subtitle="内置能力可直接使用；工具候选需要先在当前环境安装并验证，不代表已集成。">
      <div className="sci-expert-grid">{roles.map((role) => {
        const info = ROLE_INFO[role]
        const member = view.experts.roles?.[role]
        const installedCount = (installed[role] || []).length
        return <article className="sci-expert-card" key={role}><div className="sci-result-top"><div><h3>{member?.label || info.title}</h3><p>{info.purpose}</p></div><Badge>{installedCount} 项扩展已安装</Badge></div><div className="sci-tool-list" aria-label={`${info.title}环境工具候选`}>{info.tools.map((item) => <div className="sci-tool-row" key={item.name}><b>{item.name}</b><span>类别：{item.category}</span><span>环境/依赖：{item.environment}</span><span>状态/版本：{item.status}</span></div>)}</div></article>
      })}</div>
    </Panel>
    <Panel title="可选技能增强" subtitle="技能只提供操作说明。运行依赖、模型权重、外部 API 和数据许可仍需单独核对。">
      {notice && <StatusMessage tone={notice.tone === 'error' ? 'error' : 'success'}>{notice.text}</StatusMessage>}
      {candidateCards.length ? <div className="sci-expert-grid">{candidateCards.map((entry) => {
        const installedEntry = installedFor(installed, entry.role, entry.id)
        const canInstall = entry.installable === true && Boolean(entry.gitRef)
        return <article className="sci-expert-card" key={`${entry.role}:${entry.id}`}>
          <div className="sci-result-top"><div><h3>{entry.name}</h3><p>{entry.description}</p></div><Badge tone={installedEntry ? 'good' : canInstall ? 'default' : 'warn'}>{installedEntry ? '已安装' : canInstall ? '可安装技能' : '环境工具 / 待核验'}</Badge></div>
          <div className="sci-small"><b>角色：</b>{ROLE_INFO[entry.role]?.title || entry.role}</div>
          <div className="sci-small"><b>运行环境与依赖：</b>{entry.environment || '未记录，需核对仓库说明。'}</div>
          <div className="sci-small"><b>来源仓库：</b>{entry.repo ? <a href={entry.repo} target="_blank" rel="noreferrer">{entry.repo}</a> : '未记录'}</div>
          <div className="sci-small"><b>许可证：</b>{entry.license || '未核验'}</div>
          <div className="sci-small"><b>SKILL.md：</b>{entry.hasSkillMd ? `已核验 · ${entry.subdir ? `${entry.subdir}/SKILL.md` : 'SKILL.md'}` : '未核验或未发现'}</div>
          <div className="sci-small"><b>安装状态：</b>{installedEntry ? `已安装${installedEntry.dir ? ` · ${installedEntry.dir}` : ''}` : '尚未安装'}</div>
          {entry.gitRef && <div className="sci-small"><b>固定版本：</b><code>{entry.gitRef}</code></div>}
          {!entry.gitRef && <div className="sci-risk">当前没有已核实的固定提交，安装入口暂不可用。</div>}
          <div className="sci-risk"><b>使用风险：</b>{entry.risk || '风险信息未记录；安装前需自行核对依赖、数据外传和许可边界。'}</div>
          <div className="sci-result-actions">{installedEntry ? <Button small onClick={() => manageSkill(entry, 'remove')} disabled={busy === `${entry.role}:${entry.id}`}>移除扩展</Button> : <Button small primary onClick={() => manageSkill(entry, 'install')} disabled={!canInstall || busy === `${entry.role}:${entry.id}`}>{busy === `${entry.role}:${entry.id}` ? '处理中…' : canInstall ? '安装到该专家' : '暂不可安装'}</Button>}</div>
        </article>
      })}</div> : <div className="sci-small">目前没有固定版本且可直接安装的技能条目。环境工具候选仍可由计算专家按官方文档配置。</div>}
    </Panel>
    {customInstalled.length > 0 && <Panel title="已安装的自定义技能" subtitle="自定义仓库不会自动获得依赖或风险背书；请按仓库来源逐项核对。"><div className="sci-expert-grid">{customInstalled.map((entry) => <article className="sci-expert-card" key={`${entry.role}:${entry.id}`}>
      <div className="sci-result-top"><div><h3>{entry.name}</h3><p>{ROLE_INFO[entry.role]?.title || entry.role}</p></div><Badge tone="good">已安装</Badge></div>
      <div className="sci-small"><b>运行环境与依赖：</b>{entry.environment || '未记录'}</div>
      <div className="sci-small"><b>来源仓库：</b>{entry.repo ? <a href={entry.repo} target="_blank" rel="noreferrer">{entry.repo}</a> : '未记录'}</div>
      <div className="sci-small"><b>许可证：</b>{entry.license || '未核验'}</div>
      <div className="sci-small"><b>SKILL.md：</b>{entry.hasSkillMd ? `已发现 · ${(entry.skillMdPaths || []).join('；') || entry.dir}` : '未发现；目录只登记了路径'}</div>
      <div className="sci-small"><b>安装位置：</b>{entry.dir || '未记录'}</div>
      <div className="sci-risk"><b>使用风险：</b>{entry.risk || '尚未核验；使用前需检查仓库说明、执行命令、依赖许可和数据外传边界。'}</div>
      {entry.warn && <div className="sci-risk">安装记录标记：未发现标准 SKILL.md。</div>}
      <div className="sci-result-actions"><Button small onClick={() => manageSkill(entry, 'remove')} disabled={busy === `${entry.role}:${entry.id}`}>{busy === `${entry.role}:${entry.id}` ? '处理中…' : '移除扩展'}</Button></div>
    </article>)}</div></Panel>}
    <Panel title="独立集成与数据边界" subtitle="以下能力需要单独安装或外部服务，不会作为本地技能伪装成一键功能。">
      <div className="sci-expert-grid">{(skillMenu.integrations || []).map((integration) => <article className="sci-expert-card" key={integration.id}>
        <h3>{integration.name}</h3><p>{integration.description}</p><Badge tone={integration.tone || 'default'}>{integration.status}</Badge>
        {integration.environment && <div className="sci-small"><b>环境/依赖：</b>{integration.environment}</div>}
        {integration.license && <div className="sci-small"><b>许可：</b>{integration.license}</div>}
        <div className="sci-small"><b>来源：</b>{integration.repo || integration.sourceUrl ? <a href={integration.repo || integration.sourceUrl} target="_blank" rel="noreferrer">{integration.repo || integration.sourceUrl}</a> : integration.sourcePath ? <code>{integration.sourcePath}</code> : '未记录'}</div>
        {integration.installCommand && <div className="sci-small"><b>安装命令：</b><code>{integration.installCommand}</code></div>}
        <div className="sci-result-actions">{integration.actionUrl ? <a className="sci-button sci-button-small" href={integration.actionUrl} target="_blank" rel="noreferrer">{integration.actionLabel || '打开来源'}</a> : <span className="sci-small">{integration.actionLabel || '当前未配置可执行连接'}</span>}</div>
      </article>)}</div>
    </Panel>
  </div>
}
