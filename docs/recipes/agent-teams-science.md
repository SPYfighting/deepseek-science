# 与 dsh-agent-teams 协作：科研团队配置模板

[dsh-agent-teams](https://github.com/NanmiCoder/dsh-agent-teams)（MIT）把会话变成队长，成员是可续跑的 DSH 子代理，通过 `toolPolicies` 按成员配置工具白名单。**dsh-science 的全部工具（`sci_*`）与命令（`sci-*`）采用独立命名空间，与 agent-teams 零冲突**，且天然可被团队成员使用。

## 兼容性结论

| 维度 | 状态 |
|---|---|
| 命名空间 | 无冲突（sci_ 前缀工具 / sci-* 命令 / sci-data 资源协议 / dsh-science slot id 均唯一）|
| 团队成员使用科研工具 | ✅ 在 agent-teams 配置的 `toolPolicies` 中放行对应 `sci_*` 工具即可 |
| 审查与团队 | review 保持插件内独立实现（不依赖 agent-teams 存在）；团队模式下可把审查分配给专职 reviewer 成员（见下） |

## 科研团队模板（追加到你的 cordis.patch.yml 的 agent-teams 配置）

```yaml
- id: agent-teams
  config:
    profiles:
      sci-research:
        members:
          - { name: scout,    role: "文献侦察：用 sci_lit_search / sci_doi_verify 检索并核对文献，输出缺口卡" }
          - { name: analyst,  role: "数据分析：用 sci_db_query / sci_db_tables 做只读分析，禁止 sci_db_execute" }
          - { name: compute,  role: "远程计算：用 sci_ssh_probe / sci_job_submit / sci_job_status / sci_job_harvest 管理作业" }
          - { name: writer,   role: "撰写：遵循 sci-writing / sci-polish skill 起草与润色" }
          - { name: reviewer, role: "审查：按只读原则核对数字溯源/图文一致/引用，输出 findings JSON" }
        tasks:
          - { id: t1, subject: "文献缺口分析", assignee: scout }
          - { id: t2, subject: "数据盘点", assignee: analyst, dependencies: [t1] }
```

对应的工具白名单建议（`toolPolicies`）：

```yaml
    toolPolicies:
      scout:    { allow: [read, glob, grep, sci_lit_search, sci_protein_get, sci_chem_lookup, sci_doi_verify] }
      analyst:  { allow: [read, glob, grep, sci_db_profiles, sci_db_tables, sci_db_query, sci_figure_list] }
      compute:  { allow: [sci_ssh_profiles, sci_ssh_probe, sci_job_submit, sci_job_status, sci_job_logs, sci_job_harvest, sci_file_push, sci_file_fetch] }
      writer:   { allow: [read, glob, grep, sci_figure_list, sci_lit_search, sci_doi_verify] }
      reviewer: { allow: [read, glob, grep, sci_doi_verify, sci_figure_list, session_event_read] }
```

要点：

- `analyst` 与 `reviewer` 刻意**不含写工具**——审查成员只读，符合"只追因不复算"原则。
- 队长（主会话）保留全部工具；成员白名单由队长声明策略时选择，不由成员自带。
- 本模板是普通配置片段，随 agent-teams 安装即可用；dsh-science 不需要感知 agent-teams 是否在场。
