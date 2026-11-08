// dsh-science — 科研团队角色注册表
// 角色专业知识在 agents/*.md（spawnTeammate 的成员提示词），本表只做映射与默认值。

import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { PKG_ROOT_OF } from './store.js'

// mascot：assets/mascots/ 下的科研鲸鱼娘 SVG（原创矢量图，科学风格致敬 agent-teams
// 的鲸鱼娘模式，MIT）。经 GET /plugins/dsh-science/assets/<file> 服务给客户端。
export const LEAD_MASCOT = 'lead.svg'

export const ROLES = {
  'literature-scout': { file: 'literature-scout.md', member: 'scout', label: '文献调研专员', icon: '📚', mascot: 'scout.svg' },
  'topic-designer': { file: 'topic-designer.md', member: 'designer', label: '课题设计专家', icon: '💡', mascot: 'designer.svg' },
  simulator: { file: 'simulator.md', member: 'simulator', label: '计算模拟专家', icon: '🖥', mascot: 'simulator.svg' },
  trainer: { file: 'trainer.md', member: 'trainer', label: '模型训练专家', icon: '🧠', mascot: 'trainer.svg' },
  'figure-expert': { file: 'figure-expert.md', member: 'figure', label: '科研绘图专家', icon: '📊', mascot: 'figure.svg' },
  writer: { file: 'writer.md', member: 'writer', label: '文章撰写专家', icon: '📝', mascot: 'writer.svg' },
  reviewer: { file: 'reviewer.md', member: 'reviewer', label: '科研审查专家', icon: '🔍', mascot: 'reviewer.svg' },
  analyst: { file: 'analyst.md', member: 'analyst', label: '数据分析师', icon: '📈', mascot: 'analyst.svg' },
  // v0.8.0：汇报 PPT 专家（按需 spawn，不进 DEFAULT_TEAM——默认编制 7 人见下）。
  // 角色方法轮出处见 agents/presentation.md 头注（PPTAgent/academic-ppt/open-kimi-ppt）。
  presentation: { file: 'presentation.md', member: 'presenter', label: '汇报PPT专家', icon: '📽', mascot: 'presentation.svg' },
}

export const DEFAULT_TEAM = ['literature-scout', 'topic-designer', 'analyst', 'simulator', 'figure-expert', 'writer', 'reviewer']

export function rolePrompt(roleId) {
  const def = ROLES[roleId]
  if (!def) return undefined
  try {
    return readFileSync(join(PKG_ROOT_OF(), 'agents', def.file), 'utf8')
  } catch {
    return undefined
  }
}

export function roleLabel(roleId) {
  const def = ROLES[roleId]
  return def ? `${def.icon} ${def.label}` : roleId
}
