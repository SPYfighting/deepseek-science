# 工具档案：Quantum ESPRESSO

> 使用前必读：QE 版本决定 namelist/卡片语法细节（**以远端 `pw.x --version` 对应的官方文档为准**，www.quantum-espresso.org/documentation）。首次使用按 sci-simulation 第 0 节核验登记。

## 必查项

- [ ] 版本与并行构建（`pw.x --version`；MPI/OpenMP/GPU）
- [ ] 赝势来源与类型（PSlibrary/SSSP；**赝势要有测试与出处**）
- [ ] 伪单元（pseudo_dir）路径在远端的位置

## 输入结构（pw.x，稳定）

namelists 序列：`&CONTROL` → `&SYSTEM` → `&ELECTRONS` → `&IONS` → `&CELL`（按 calculation 取子集）+ `ATOMIC_SPECIES`/`ATOMIC_POSITIONS`/`K_POINTS`/`CELL_PARAMETERS` 卡片。

- 标准流程：scf（体材料）→ nscf（密集 k 网格，做 DOS/能带）→ bands / projwfc / pp.x 后处理。
- 几何优化用 `calculation='relax'`（'vc-relax' 含晶胞）。

## 已知坑

- **收敛测试必须先做**：ecutwfc（+ecutrho，通常 4×/8×~12×）与 k 网格收敛到 <1 meV/atom 再谈生产——这是该方法的铁律，跳过 = 结果不可信。
- 赝势类型（NC/US/PAW）决定 ecutrho 倍率与可用性质；混用要查兼容性。
- smearing：金属必须加（occupations='smearing'），绝缘体用 fixed；degauss 值要测试。
- 磁性体系：starting_magnetization 不能为 0（会收敛到非磁解）；nspin=2。
- 并行：-nk（plane-wave pools）通常显著加速；GPU 构建参数查手册。

## 收敛/质量判据

- scf：conv_thr 达标（生产常 1e-6~1e-8 Ry，性质相关）。
- relax：force/energy 阈值达标，连续两步结构变化可忽略。
- k 点/截断收敛曲线已做并存档（写进作业记录）。

## 引用格式

QE 官方引用列表（www.quantum-espresso.org 的引用页，按版本）；赝势库（PSlibrary 等）单引。
