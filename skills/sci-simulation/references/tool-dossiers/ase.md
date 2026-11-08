# 工具档案：ASE（Atomic Simulation Environment）

> 使用前必读：ASE 是 Python 求解器统一接口（非求解器本身），版本影响 Calculator API。**以远端 `python -c "import ase; print(ase.__version__)"` 对应的官方文档为准**（wiki.fysik.dtu.dk/ase）。首次使用按 sci-simulation 第 0 节核验登记。

## 定位

最适合做：多求解器统一脚本、结构操作（build/变换）、工作流胶水、批量提交。计算本身仍由后端（VASP/QE/GPAW/EMT/LJ…）执行——**后端各自适用域与引用见其档案**。

## 必查项

- [ ] ASE 版本 + 后端求解器是否可用（Calculator 导入成功）
- [ ] 后端要求的环境变量（VASP 的 VASP_PP_PATH、QE 的 pseudo_dir）

## 常用模式（稳定）

```python
from ase.io import read, write
atoms = read('structure.xyz')
atoms.calc = <Calculator>
e = atoms.get_potential_energy()
```

- 结构操作：`ase.build`（bulk/molecule/fcc…）、`atoms *= (2,2,2)` 超胞、FixAtoms 约束。
- 优化：`from ase.optimize import BFGS/FIRE; opt = BFGS(atoms); opt.run(fmax=0.05)`。
- 振动/NEB：ase.vibrations / ase.neb（过渡态搜索的标准工具）。
- 批量：循环 + `write('...traj')` 轨迹文件保存，断点可续。

## 已知坑

- EMT/LJ 只用于测试管道，**不是**生产级物理。
- Calculator 缓存：同一 atoms 换参数必须 `atoms.calc = ...` 重建或清缓存，否则读旧能量。
- 单胞/周期性：pbc 设置错误会让 k 点/静电完全不同——结构操作后必查 pbc 与 cell。
- 文件格式转换时丢信息（电荷/自旋/magmoms 在 xyz 里不保——用 traj/json）。

## 收敛/质量判据

- 优化：fmax 达标（常用 0.01–0.05 eV/Å，视任务）。
- 批量任务：每条记录后端、参数、版本（配合 sci-simulation 报告要求）。

## 引用格式

ASE 论文（Larsen et al. 2017）+ 后端求解器各自引用。
