# Explore power continuity across facility profiles

Choose a facility, stress its supply, and trace what reaches the IT load. The [energy workspace](https://mohammadrezwankhan.github.io/datacenter-twin-lab/?mode=advanced) combines an interactive isometric campus, interval power flows, editable equipment limits, a complete event replay and reproducible reports.

## Four starting points

| Profile       | Initial aggregate IT demand | Outage-case battery energy | Extended-reserve battery energy |
| ------------- | --------------------------: | -------------------------: | ------------------------------: |
| AI cluster    |                       50 MW |                      5 MWh |                         200 MWh |
| Hyperscale    |                      200 MW |                     20 MWh |                         800 MWh |
| Crypto mining |                       30 MW |                      3 MWh |                         120 MWh |
| Traditional   |                        5 MW |                    0.5 MWh |                          20 MWh |

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

## Reopen a saved experiment

In the current source and live browser workspace, select **Import scenario**. Choose a schema-2 scenario JSON, a browser **Export run** file, or a JSON export from the Python `simulate` command. Files up to 10 MiB are read locally; the static demo sends no scenario data to a server.

The preview validates the existing electrical contract before showing differences from your current draft. Review unit-labelled values and expand changed assets, connections, source identifiers or events. **Run imported scenario** replaces the draft only after a successful calculation. **Discard import** retains your edits and completed result. Changing the draft or choosing another preset clears a pending import.

For a run file, only its scenario inputs are used. Saved result rows, claimed hashes and old engine versions are not treated as verified output: the active engine calculates a new complete result. Select **Verify against Python** to compare that result with Python on your device. Reproducing an older engine version requires that version's pinned release.

**Download current scenario** saves validated draft inputs, including edits not yet run. This is different from **Export run**, which saves the last completed calculation. Keep either file to reopen it after a page reload; no custom scenario is stored in the URL or a shared database. Source identifiers remain as supplied and require their own provenance review.

To reproduce downloaded inputs with the matching Python source:

```sh
python -m datacenter_twin simulate --scenario twin-scenario.json --output reopened-run.json
```

Schema-1 PUE planning, sensitivity/comparison collections, Markdown and HTML reports are not electrical scenario imports. Invalid JSON, unsupported fields, missing assets, cycles and contract bounds are rejected without replacing the current experiment. This import feature is a source/Pages addition after `0.4.0rc2`; that historical wheel and browser archive are unchanged.

## Compose a demand timeline

For a worked application, use [the equal-energy timing lesson](../tutorials/demand-timing.md). Its downloadable cases each request 375 kWh but put different amounts of that demand inside the same outage.

In the advanced workspace or the local dashboard, select **Edit demand timeline**. The chart shows requested IT power in kW against elapsed seconds. Numbered points select a step; the same selection is available through the **Point** list and labelled step buttons. The **Initial** point sets the demand before the first scheduled change.

1. Select **Add demand step**. The editor places it in the largest time gap; set its time and power with the fields or keyboard-accessible sliders.
2. Compare the requested-energy preview with a hand calculation. In the **Normal supply** preset, retain the initial 1,000 kW and add 500 kW at 900 s. Over 1,800 s, requested energy is `(1000 × 900 + 500 × 900) / 3600 = 375 kWh`.
3. Select **Run edited timeline**. Supply constraints, storage and losses are then calculated. Results and exports remain attached to the last completed run while the editor contains unsubmitted changes.
4. Export the completed run or its Markdown/HTML report. The optional **Verify against Python** compares the complete browser result, including the edited schedule and input hash.

The preview is requested energy, not delivered energy. Dashed amber markers show existing availability events; expanding **Schedule rules** lists their exact times and targets. Demand edits preserve asset/domain failures, recoveries, source identifiers, capacities and other assumptions. A custom topology uses its actual load identifier. Source identifiers describe the base inputs; edits and their hash travel in the exported scenario and require their own interpretation.

Times are whole seconds from zero through one second before the simulation ends. Demand is a nonnegative decimal kW quantity under the existing contract (at most nine decimal places and `10^12 kW`). Sliders use whole kW for convenience; typing a decimal preserves its exact value. A step holds until the next step. At coincident times, demand changes follow their listed event order and the last one wins. A step at zero takes effect immediately. Up to 128 total events are allowed, including failure and recovery events.

**Remove selected step** and **Reset timeline edits** affect the preview until the next run. Changing another scenario setting, choosing a preset, importing a scenario or closing the editor resets its local draft; run or export the desired completed configuration first. Invalid input leaves the previous result intact. Reloading the page does not retain a custom timeline: export JSON to keep it.

This feature uses the existing piecewise electrical model. It does not add measured workload traces, GPU-job predictions, voltage/frequency response or subsecond transients. The editor loads on demand; the canonical guide and twelve lessons retain their existing entry paths. Current source and Pages contain this addition; the historical `0.4.0rc2` wheel and browser archive are unchanged.

## Energy-system questions and evidence

Grid access, variable demand, renewable supply, longer reserves and island operation are useful engineering questions. They require different evidence:

| Question               | What can be explored here                                         | What requires another model or evidence                                                  |
| ---------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Speed to power         | Supply outages, startup delays and finite reserve                 | A utility connection study, permits and actual firm capacity                             |
| AI power changes       | Piecewise aggregate demand, feed constraints and energy shortfall | Converter response, voltage/frequency and workload traces                                |
| Renewable integration  | Electrical continuity assumptions                                 | Weather, generation and dispatch time series; renewable-share and emissions calculations |
| Longer battery support | Stored energy, charge/discharge limits and losses                 | Selected equipment, degradation, thermal limits and protection                           |
| Grid independence      | Declared asset availability and recovery                          | Grid-forming controls, black start and island-transition tests                           |

The model remains synthetic and uncalibrated. It does not establish facility safety, certified uptime, controller response time, CapEx savings, MTBF, cybersecurity certification, grid-service revenue or zero-transfer backup. It controls no physical equipment. See the [electrical model](electrical-continuity.md) and [contracts](../contracts/electrical-v2.md).

## Primary-source context

Reviewed 23 September 2026. These sources motivate questions; none validates this simulator or its profile sizes.

- [LBNL, Queued Up](https://emp.lbl.gov/queues): U.S. generation and storage interconnection queues. Do not relabel these as data-center load-connection timelines.
- [IEA, Electricity 2026: Grids](https://www.iea.org/reports/electricity-2026/grids): grid constraints and infrastructure development timelines, including the growth of large loads.
- [IEA, Key Questions on Energy and AI](https://www.iea.org/reports/key-questions-on-energy-and-ai/executive-summary): demand and operational questions associated with AI; these do not define a universal training-run energy requirement.
- [DOE, UNIFI Consortium](https://www.energy.gov/cmei/systems/unifi-consortium): grid-forming inverter research and system integration. Real controls require equipment and system validation.
- [GHG Protocol, Scope 2 Guidance](https://ghgprotocol.org/scope-2-guidance): location-based and market-based electricity emissions accounting. No emissions result is calculated in this workspace.

All dashboard illustrations and explanation text are original. No vendor identity, product imagery, marketing copy or performance guarantee is adopted.
