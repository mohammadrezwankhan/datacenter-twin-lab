# Explore power continuity across facility profiles

Choose a facility, stress its supply, and trace what reaches the IT load. The [energy workspace](https://mohammadrezwankhan.github.io/datacenter-twin-lab/) combines an interactive isometric campus, interval power flows, editable equipment limits, a complete event replay and reproducible reports.

## Four starting points

| Profile | Initial aggregate IT demand | Outage-case battery energy | Extended-reserve battery energy |
| --- | ---: | ---: | ---: |
| AI cluster | 50 MW | 5 MWh | 200 MWh |
| Hyperscale | 200 MW | 20 MWh | 800 MWh |
| Crypto mining | 30 MW | 3 MWh | 120 MWh |
| Traditional | 5 MW | 0.5 MWh | 20 MWh |

These are original illustrative scaling assumptions, not industry averages or equipment specifications. Each profile scales the same one-load electrical topology. The profile names do not add GPU scheduling, cloud demand or mining behavior to the model.

The exported source IDs resolve to the packaged source register. `SYN-ENERGY-WORKSPACE-001` records the new event schedules and reserve overrides; each added facility profile has a separate scaling record. The original seven presets retain their existing inputs and source IDs.

## Three experiments

**Grid outage.** Utility and generator fail at 300 s and recover at 900 s. The initial battery energy equals 0.1 hours of nominal IT demand. Discharge efficiency of 0.90 and distribution efficiency of 0.95 give `0.1 × 0.90 × 0.95 × 3600 = 307.8 s` of ride-through. Depletion occurs at 607.8 s. Pre-outage charging remains enabled in these reference-derived cases, so reducing initial energy can add a charging contribution before failure.

**Load step.** Starting at nominal demand, the input changes to 80% at 300 s, 110% at 600 s, then 100% at 900 s. For the 50 MW profile those levels are 40, 55 and 50 MW. The run requests `50 × (300 + 0.8×300 + 1.1×300 + 900) / 3600 = 24.583333… MWh`. All demand is served with these declared capacities. These are discrete aggregate power changes, not GPU transient traces or millisecond control simulations. Editing the initial IT demand does not rescale scheduled demand events.

**Extended reserve.** A four-hour simulation includes exactly three hours without utility or generator: 300–11,100 s. Charging is disabled. Four hours of gross stored energy provides `4 × 0.90 × 0.95 = 3.42 h` at nominal IT demand, enough for this outage. With half the initial energy, support lasts 1.71 h and the shortfall lasts 1.29 h. For the 50 MW case, change **Initial battery** from 200,000 to 100,000 kWh: depletion is at 6,456 s elapsed and unserved energy is 64.5 MWh. Battery power limits still apply independently of stored energy.

Run the same inputs from the current source checkout:

```sh
python -m datacenter_twin simulate --preset ai_cluster_50mw_ramp
python -m datacenter_twin simulate --preset hyperscale_200mw_reserve
python -m datacenter_twin simulate --preset traditional_5mw_outage
```

These added presets are in current source and the browser workspace. Historical alpha release assets retain their original scope.

## Read the dashboard

- Select a source or the server hall in the campus view to inspect the selected interval. Utility is cyan, generator amber, battery violet and unserved demand coral. Labels and numerical values accompany the colors.
- Use the milestone buttons or replay slider to move through the run. Animated dashes represent an active simulated flow; animation speed does not represent physical control latency.
- The coverage ring is the fraction of requested **energy** served over the run. It is not uptime, a reliability probability or certification.
- Expand **Configure storage, losses & asset limits** to change assumptions. Results stay attached to the last completed run until **Run scenario** is selected.
- Export JSON, Markdown or HTML, or save a session baseline. The browser's optional **Verify against Python** compares the complete result with the reference engine on your device.
- Pause animation or use your operating system's reduced-motion preference. Source selection and replay also support keyboard operation.

The campus is a schematic illustration. The detailed **Electrical supply paths** graph is the authoritative view of declared connections. No customer telemetry is sent to a server, and the public demo has no shared simulation backend.

## Energy-system questions and evidence

Grid access, variable demand, renewable supply, longer reserves and island operation are useful engineering questions. They require different evidence:

| Question | What can be explored here | What requires another model or evidence |
| --- | --- | --- |
| Speed to power | Supply outages, startup delays and finite reserve | A utility connection study, permits and actual firm capacity |
| AI power changes | Piecewise aggregate demand, feed constraints and energy shortfall | Converter response, voltage/frequency and workload traces |
| Renewable integration | Electrical continuity assumptions | Weather, generation and dispatch time series; renewable-share and emissions calculations |
| Longer battery support | Stored energy, charge/discharge limits and losses | Selected equipment, degradation, thermal limits and protection |
| Grid independence | Declared asset availability and recovery | Grid-forming controls, black start and island-transition tests |

The model remains synthetic and uncalibrated. It does not establish facility safety, certified uptime, controller response time, CapEx savings, MTBF, cybersecurity certification, grid-service revenue or zero-transfer backup. It controls no physical equipment. See the [electrical model](electrical-continuity.md) and [contracts](../contracts/electrical-v2.md).

## Primary-source context

Reviewed 23 September 2026. These sources motivate questions; none validates this simulator or its profile sizes.

- [LBNL, Queued Up](https://emp.lbl.gov/queues): U.S. generation and storage interconnection queues. Do not relabel these as data-center load-connection timelines.
- [IEA, Electricity 2026: Grids](https://www.iea.org/reports/electricity-2026/grids): grid constraints and infrastructure development timelines, including the growth of large loads.
- [IEA, Key Questions on Energy and AI](https://www.iea.org/reports/key-questions-on-energy-and-ai/executive-summary): demand and operational questions associated with AI; these do not define a universal training-run energy requirement.
- [DOE, UNIFI Consortium](https://www.energy.gov/cmei/systems/unifi-consortium): grid-forming inverter research and system integration. Real controls require equipment and system validation.
- [GHG Protocol, Scope 2 Guidance](https://ghgprotocol.org/scope-2-guidance): location-based and market-based electricity emissions accounting. No emissions result is calculated in this workspace.

All dashboard illustrations and explanation text are original. No vendor identity, product imagery, marketing copy or performance guarantee is adopted.
