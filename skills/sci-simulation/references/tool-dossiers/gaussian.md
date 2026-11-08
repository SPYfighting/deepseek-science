# 工具档案：Gaussian

> 使用前必读：Gaussian 版本（g16/g09）与修订号决定关键词集与默认值；**以远端实际版本的官方手册为准**（gaussian.com/gaussian16/ 对应页）。首次使用按 sci-simulation 第 0 节核验登记。

## 必查项

- [ ] 版本与修订（`g16 --version` 或 license 文件；PBS 集群常以 module 提供）
- [ ] 计算类型与关键词集：opt/freq/sp/td/scrf…（手册 Keywords 页）
- [ ] 基组与泛函的适用域（basis set exchange 可查定义；引文献）
- [ ] `GAUSS_SCRDIR` 已指向大容量 scratch（cube/wavefunction 文件会很大）

## 输入结构（稳定）

```
%chk=xxx.chk  %mem=…  %nprocshared=…
#P 方法/基组 关键词
标题行
电荷 自旋多重度
几何（z-matrix / xyz）
附加段（basis/coordinates for custom stuff）
```

- 电荷与自旋多重度配错是最常见硬错误（radical/金属体系先想清楚）。
- opt 需要初始结构合理；先 `opt=modredundant` 做预弛豫或用更低级别预优化是常规操作。

## 已知坑

- 收敛失败：SCF 用 `scf=xqc`，几何用 `opt=gdiis`/maxstep 调整；分步弛豫优于硬扛。
- freq 必须与 opt 同级别同方法（确认无虚频或虚频可解释）。
- 溶剂：`scrf=(solvent=water)`（默认 SMD）；显式溶剂是另一档工作量。
- 弱相互作用/激发态：普通泛函不适用，查文献选泛函（ωB97X-D、CAM-B3LYP 等），不要默认 B3LYP 万能。
- 大分子 freq 的内存/磁盘需求按 2 次导数估，常比 opt 高一个量级。

## 收敛/质量判据

- opt：四项收敛标准全过（手册 Convergence Criteria 页有精确定义与单位）。
- freq：无虚频（极小点）或恰为过渡态模式（TS）。
- 报告需含：方法/基组/版本、零点校正、热矫正后的能量表。

## 引用格式

官方引用块（gaussian.com/citations：程序+版本）；基组与泛函原始文献单引。
