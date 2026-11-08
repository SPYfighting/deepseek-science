---
name: sci-remote-jobs
description: 通过 SSH 把计算作业提交到实验室服务器/集群并取回结果。需要远程算力、长时间运行任务、HPC 集群时使用。
license: MIT
metadata:
  version: "2.0"
  design-reference: "主机知识持久化/首次接触协议/审批成本意识，借鉴 Claude Science remote-compute-ssh 的编排层思想（Apache-2.0，经 AcademicForge 移植版研读）"
---

# 远程计算作业工作流

本 skill 只管**编排**（主机探测、作业提交、监控、收割、恢复）；跑什么科学、为什么跑，来自任务与相关领域 skill。每一次失败提交都消耗用户的注意力、算力和信任——所以好的节奏是：先读已知信息，缺的一次问全，第一次提交就落地，并把学到的新知识记录下来让下次直达作业。

## 原则

- 「提交 → 等待 → 收割」模式，**没有交互式远程 shell**；不要尝试交互命令（vim/top/conda activate 保持会话）。
- 作业必须在断连后存活：脚本自包含、后台化、状态落远端文件。
- 危险操作（删数据、覆盖文件）提交前向用户确认。

## 首次接触一台主机（first-contact 协议）

1. `sci_ssh_probe` 探测：调度器（sbatch→Slurm）、CPU/内存/GPU、conda/micromamba、scratch 目录、磁盘余量。
2. **首次运行前批量问全**：分区名、账号限制（walltime 上限/并发作业数）、项目目录约定。主机上已有可用的软件环境时直接用（probe 的 details 会列出 conda/micromamba），不要重复安装。
3. **知识写回**：把学到的东西记录到工作区 `research/hosts/<profile名>.md`（分区、激活命令、scratch 路径、已知坑）。下次会话先读这个文件，避免重复探测与重复踩坑。

## 提交流程

1. **试跑先行**：正式作业前用极小规模走通 提交→运行→收割 全链路（见 sci-simulation 验证阶梯）。
2. **脚本自包含**：输入输出路径明确，结果统一写 `out/`（只有 out/、stdout.log、stderr.log 被收割）。中间产物/检查点也写 out/，崩溃不从头来。
3. `sci_job_submit`（mode: auto；脚本内容展示给用户）。环境变量放 `.job_env`（提交时的 env 参数），参数不藏在脚本里。
4. `sci_job_status` 低频轮询（长作业 10-30 分钟级）；stderr 尾部早识别失败征兆（sci-simulation 诊断表）。
5. `sci_job_harvest` 收割到本地 `sci-jobs/<job>/out/`；>100MB 文件留在远端（记录路径），用 `sci_file_fetch` 单独取或把分析脚本送过去跑。
6. **完成即记录**：作业结论、耗时、踩坑写进主机笔记，下次直达。

## 失败诊断表

| 症状 | 层 | 处置 |
|---|---|---|
| `job_timeout` 标记 | walltime | 3× 重估时长；或优化脚本；禁止盲目加倍重试 |
| 排队不动（Slurm） | 调度 | 查 squeue 原因码（QOS/依赖/资源）；换分区需用户确认 |
| 立即失败且 stdout 空 | 环境 | module/conda 激活缺失——先 `sci_ssh_exec` 单测激活命令再进脚本 |
| out/ 为空警告 | 脚本 | 结果没写 out/；修脚本重跑，不要去远端手工捞 |
| OOM | 资源 | 估内存申请；减并发/分块 |
| 断连后作业消失 | 提交方式 | 确认走的是本插件作业引擎（setsid 后台 + 远端 .phase），不要手工 nohup |

## 与 agent-teams 协作（可选）

多人团队模式下，compute 成员的 toolPolicies 放行 `sci_ssh_*`/`sci_job_*`/`sci_file_*` 即可（见插件 docs/recipes/agent-teams-science.md）。
