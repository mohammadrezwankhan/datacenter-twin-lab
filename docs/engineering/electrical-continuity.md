# Electrical continuity model

`single_load_electrical_continuity_v1` is a reduced steady-state electrical flow model with discrete failures and a finite battery. It does not solve AC load flow, switching transients, protection coordination, harmonics, thermal behavior or workload queues. Its bounded topology is a synthetic experiment, not a certified redundant design.

For each interval the engine removes unavailable assets and propagates `requires` dependencies. `feeds` edges form a directed acyclic graph with node power capacities. A deterministic residual max-flow calculation dispatches utility first, then a running generator, then available battery energy. Residual rerouting avoids the false shortage that a greedy path choice can create. The path split is a feasible capacity allocation, not impedance-based load sharing; parallel paths need not split equally.

Generator startup begins only when the utility asset is unavailable. A downstream path failure or a capacity shortfall alone does not trigger startup. The configured start delay is deterministic; generator failure is an explicit asset/domain event. If it fails during startup, its timer resets, and recovery requests a fresh delay while the utility is unavailable. When the utility returns, the generator stops immediately in this simplified model. Fuel is assumed sufficient for the simulated horizon. There is no ramp, cooldown or transfer transient.

Battery energy is finite at the stored-energy boundary. It discharges only when additional load can be served. Charging uses the explicit charging bus and spare utility capacity, and occurs only when generator and battery discharge are zero. It cannot charge itself through the network. Charging and discharging are mutually exclusive. Charge power is bounded by its configured converter limit and the battery rating; source and upstream bus limits remain active.

For a constant interval of `h` hours:

```text
IT served kW = gross electrical kW reaching load × distribution efficiency
unserved IT kW = requested IT kW − served IT kW
stored energy change = charging kW × h × charge efficiency
                     − discharge kW × h / discharge efficiency
distribution loss = gross load kW × h − served IT kWh
charge loss = charging kWh − stored energy gained
discharge loss = stored energy withdrawn − discharge kWh
```

The exact rational ledger checks:

```text
grid kWh + generator kWh − battery stored-energy change
  = served IT kWh + distribution loss + charge loss + discharge loss
```

IT envelope margin is a warning screen. Physical network capacities limit delivered energy; they never clamp the requested demand or erase unserved load. A shared domain explicitly disables every asset belonging to that domain. This represents declared common dependencies, not a reliability probability or a Tier claim.

Intervals split at the next scheduled event, generator readiness, battery depletion, battery full state, regular step or simulation end. Exact `Fraction` arithmetic makes stored-energy boundaries independent of nominal step size. Power is piecewise constant between boundaries. Output decimal representation is rounded, while the internal energy balance is exact. The independent tests reconstruct exported energy terms within a 1e-80 kWh representation tolerance on the fixtures.

Grid cost integrates grid kWh at the supplied tariff; generator cost integrates generator kWh at its optional rate. Missing generator price makes the total unknown if generator energy is used. Initial battery energy is an opening balance: its historic acquisition cost is excluded. The reported total is incremental energy charges during the run, excluding capital, maintenance, demand charges, taxes and other non-energy costs. A lower bill during an outage is not an efficiency improvement.

The five demo cases prove normal supply, successful utility-loss ride-through, generator failure and battery depletion, one-path overload, and shared-domain loss followed by restoration. They use the same eight-asset graph. Separate evidence is required before mapping these assumptions to real equipment, a real site or a model workload.
