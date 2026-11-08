# 工具档案：LAMMPS

> 使用前必读：LAMMPS 版本迭代快、命令语义偶有变动（**以远端 `lmp -help` 版本对应的官方手册为准**，docs.lammps.org 按版本选）。首次使用按 sci-simulation 第 0 节核验登记。

## 必查项

- [ ] 版本与编译特性包（`lmp -help` 顶部：MOLECULE/KSPACE/GPU-OPENMP 等包是否装了）
- [ ] 力场文件来源（OPLS/CHARMM/COMPASS 转换器；ReaxFF 的ffield）
- [ ] 手册对应命令页（run/minimize/fix/compute 各一条）

## 输入结构（稳定）

in.lammps 脚本 = 初始化(units/atom_style/boundary) → 体系构建(read_data/molecule) → 定义相互作用(pair_style/pair_coeff/bond/angle…) → 分组与计算(group/compute/fix) → 运行(minimize/run) + 输出(dump/thermo)。

- data 文件（read_data）由转换器生成（VMD topotools、moltemplate、pymatgen 等），不手写。
- 平衡-生产两段式：fix nvt/npt 先平衡，reset_timestep 0 后 production（保证时序统计干净）。

## 已知坑

- **单位制是第一行且决定一切数值含义**（units metal ≠ real ≠ lj）——换算错误是最常见灾难。
- pair_style 与原子类型/电荷匹配（reaxff 需要 `pair_style reaxff` + control 文件，且不用 pair_coeff 常规写法）。
- Kspace（长程静电）默认 ppm；大体系用 pppm 而非 ewald；`kspace_style off` 只在合理时用。
- 邻居列表 skins、thermo 输出频率影响性能与文件大小：dump 设定按分析需求，不要全量 dump 原始轨迹。
- GPU/多副本：-sf gpu/omp + -pk gpu 1（package 命令细节查手册 Benchmark 页）。

## 收敛/质量判据

- minimize：能量/力判据达标（etol/ftol）。
- MD：温度/压力平稳（平衡段）；production 的统计独立样本数足够（相关时间估计）。
- 能量守恒检查（NVE 短测）验证积分步长合理——步长过大会漂移。

## 引用格式

LAMMPS 官方引用（docs.lammps.org 首页 Citation）；力场文献单引。
