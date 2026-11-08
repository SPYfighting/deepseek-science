# 工具档案：GROMACS

> 使用前必读：本档案给结构与已知坑；**一切参数默认值以你远端实际版本的官方手册为准**（manual.gromacs.org，按远端 `gmx --version` 的版本号选文档）。首次使用按 sci-simulation 第 0 节完成核验并在会话笔记登记。

## 必查项（写输入前逐项确认）

- [ ] 远端 GROMACS 版本与 GPU 构建（`gmx --version`：版本、CUDA、GPU 支持）
- [ ] 力场来源与版本（amber14sb/charmm36m/oplsaa…）；水模型（TIP3P/TIP4P）
- [ ] 手册对应章节：mdp 参数表（manual.gromacs.org/current/gmx-mdp.html）

## 输入管线（稳定，版本间极少变化）

```
pdb2gmx(拓扑+坐标) → editconf(盒子) → solvate(加水) → grompp(预处理,需 .mdp)
→ genion(加离子,需 .tpr) → grompp → mdrun
```

- `.mdp` 文本参数文件每阶段一份：em(能量最小化) → nvt → npt → md(production)。**平衡-生产两段式不可跳过**。
- 位置约束常开在 nvt/npt（define = -DPOSRES，依赖 pdb2gmx 生成的 posre.itp）。

## 已知坑

- pdb2gmx 因缺失残基/非常规配体质子化失败 → 先处理结构（补残基/加 HIIL 参数），不要改力场。
- `grompp` 报电荷不中和 → genion 加离子时用 `-neutral`/`-conc`，检查水模型与力场匹配。
- 温度耦合组漏掉离子/溶剂 → tc-grps 必须覆盖体系全部原子（否则 grompp 警告耦合组不满）。
- GPU 构建 mdrun：`-nb gpu -pme gpu`（版本相关，查手册 benchmark 建议）。
- 周期性镜像距离警告（coulomb/rijvdw > box/2）→ 加大盒子或改 cut-off。

## 收敛/质量判据

- em：最大力 < 1000 kJ/mol/nm（常用阈值，体系相关）。
- nvt/npt：温度/密度/压力平稳后才能进 production；总模拟时长 = 平衡 + 采样，采样区才用于分析。
- production：检查 total energy 漂移、约束 RMSD（linacs 报告 < 容差）。

## 引用格式

GROMACS 版本 + DOI（manual.gromacs.org 首页的引用块）；力场原始文献必须单引。
