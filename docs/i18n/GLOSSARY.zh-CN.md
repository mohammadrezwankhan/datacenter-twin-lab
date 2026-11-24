# 工程术语表（English / 简体中文）

[English README](../../README.md) · [简体中文 README](../../README.zh-CN.md) · [原始术语表](../scenarios/glossary.md)

本表为本项目的术语约定，不是标准原文或合规证明。通用工程用语参考 [GB 50174-2017《数据中心设计规范》](https://www.cra-ccua.org.cn/site/content/8468.html)、[IEEE 3000 系列](https://standards.ieee.org/products-programs/ieee-3000/) 和 [ISO/IEC 30134-2:2026（PUE）](https://www.iso.org/standard/30134-2)。模型专用术语以仓库的原始术语表、[计算边界](../engineering/calculation-boundaries.md)及[供电连续性模型](../engineering/electrical-continuity.md)为准。未完成 IEEE、ASHRAE 或国标逐条符合性审查。

| English | 简体中文 | 项目语义 |
| --- | --- | --- |
| Electrical continuity | 供电连续性 | 模型边界内持续向 IT 负荷供电的能力；不是统计可靠性。 |
| Utility feed / utility loss | 市电电源／市电中断 | 外部电源及其不可用事件。 |
| Standby generator | 备用发电机 | 市电中断后按设定延时启动的抽象电源。 |
| Uninterruptible power system (UPS) | 不间断电源系统（UPS） | 工程通用术语；模型中的 UPS 蓄电池不是完整 UPS 动态模型。 |
| Stored battery energy | 蓄电池储能量 | 蓄电池内部的储能，单位 kWh；不等于 IT 侧可交付电量。 |
| Battery ride-through duration | 蓄电池支撑时长 | 从市电中断时刻起计的支撑时间，单位 s。 |
| Distribution efficiency | 配电效率 | 到达 IT 边界的电能与相应配电输入电能之比。 |
| Gross path capacity | 供电路径额定容量 | 模型声明的损耗前路径功率上限，单位 kW。 |
| Redundancy | 冗余 | 备用供电路径的工程概念；不能据此推定可用性等级。 |
| Shared failure domain | 共因故障域 | 由同一个显式故障事件影响的资产集合；不代表概率模型。 |
| Energy ledger | 能量收支台账 | 逐区间记录供电、储能变化、损耗和供电结果。 |
| Requested / served / unserved IT energy | IT 需求电量／已供电量／未供电量 | 同一边界和时间区间内的三个电量项，单位 kWh。 |
| Battery depletion elapsed time | 蓄电池耗尽时刻 | 自仿真开始起的累计时间，单位 s；不同于支撑时长。 |
| Power usage effectiveness (PUE) | 电能利用效率（PUE） | 设施总能耗与 IT 设备能耗之比；规划模型使用假设值，非实测 PUE。 |
| Electromagnetic transients (EMT) | 电磁暂态（EMT） | 本项目独立的理想直流链路 RLC 教学研究。 |

## 编辑约定

- 保留 SI 单位及工程缩写：kW、MW、kWh、MWh、kV、PUE、UPS、EMT。
- 功率和电量不得混用；百分比、正负号、未知值及时间基准保持源语义。
- 代码标识符、JSON 字段、场景 ID、版本、输入哈希和机器可读导出保持原样。
- 译文中的能量收支台账不等于财务台账；配电路径容量不是实物设备选型。
- 标准术语与教学模型约定发生冲突时，保留模型边界并注明差异。

[原始规范与模型证据](../canonical-case.md) · [多语言实施审计](AUDIT.md)
