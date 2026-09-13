# Worksheet: calculate battery ride-through

**Lesson 3 | Prediction and exercise**

Name: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_  Date: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

Open [Calculate battery ride-through](https://mohammadrezwankhan.github.io/datacenter-twin-lab/?lesson=ride-through).
Make your prediction before reading the answer. In print preview, check that
**Worked answer** starts on a separate page; page-break support varies by renderer.

## The situation

This synthetic, uncalibrated lesson has a constant **1,000 kW IT demand**.
Utility supply fails at **300 s elapsed**, and the generator cannot start.
The battery supplies the load until its stored energy is depleted.

- Compare **100 kWh** and **50 kWh** of initial stored battery energy.
- **Charging is disabled**, including before the outage.
- Battery discharge efficiency is **0.90**; distribution efficiency is **0.95**.
- Keep the demand, efficiencies, and outage timing unchanged between cases.

**Ride-through duration** is time supported *after the outage*.
**Elapsed depletion time** is measured from the start of the lesson, at 0 s.

## Predict before calculating

If you halve the stored energy, what happens to the ride-through duration?
Will the elapsed depletion time also halve? Explain in your own words.

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

## Calculate, then try it

Use `delivered energy = stored energy × 0.90 × 0.95`, then
`duration (s) = delivered energy (kWh) / demand (kW) × 3,600 s/h`.
Add the outage start time to find elapsed depletion time.

| Initial stored energy | Delivered to IT (kWh) | Ride-through (s after outage) | Depletion (s elapsed) |
| --- | --- | --- | --- |
| 100 kWh | \_\_\_\_\_\_\_\_\_\_ | \_\_\_\_\_\_\_\_\_\_ | \_\_\_\_\_\_\_\_\_\_ |
| 50 kWh | \_\_\_\_\_\_\_\_\_\_ | \_\_\_\_\_\_\_\_\_\_ | \_\_\_\_\_\_\_\_\_\_ |

1. Leave **Initial battery (kWh)** at 100 and select **Run lesson**.
2. Select **Try the challenge value**, then **Run lesson** again for 50 kWh.
3. Record the browser's **s elapsed** results above. Subtract 300 s to compare
   them with your predicted ride-through durations.
4. Select **Show worked answer** only after recording your prediction.

What did your prediction get right, or what would you change?

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

<div style="break-before: page; page-break-before: always;"></div>

# Worked answer: battery ride-through

**Lesson 3 | Keep separate from the exercise when printing**

These answers use the same synthetic assumptions: constant 1,000 kW IT demand,
outage at 300 s elapsed, failed generator, **no charging**, and efficiencies of
0.90 for discharge and 0.95 for distribution.

## 100 kWh case

```text
Delivered IT energy = 100 kWh × 0.90 × 0.95 = 85.5 kWh
Ride-through        = 85.5 kWh / 1,000 kW × 3,600 s/h = 307.8 s
Elapsed depletion   = 300 s + 307.8 s = 607.8 s
```

## 50 kWh case

```text
Delivered IT energy = 50 kWh × 0.90 × 0.95 = 42.75 kWh
Ride-through        = 42.75 kWh / 1,000 kW × 3,600 s/h = 153.9 s
Elapsed depletion   = 300 s + 153.9 s = 453.9 s
```

Halving stored energy **halves ride-through duration** because demand and
efficiencies stay fixed: `153.9 / 307.8 = 0.5`.
It does **not** halve elapsed depletion time: both cases include the same
300 seconds before the outage. The browser displays **607.8 s elapsed** and
**453.9 s elapsed**, not the durations after the outage.

## Compare and explain

If your answer differs, check whether you multiplied both efficiencies,
converted hours to seconds, and added 300 s only for elapsed depletion time.
Do not substitute a charging-enabled scenario: adding energy before the outage
changes the 50 kWh result.

In your own words, why is the outage start time added only to one of the two
time quantities?

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

This is a teaching calculation, not equipment sizing or a facility safety,
reliability, or performance assessment. It does not model battery aging,
temperature effects, or electrical switching transients.

Return to the [course notes](power-systems-course.md) or
[run lesson 3 again](https://mohammadrezwankhan.github.io/datacenter-twin-lab/?lesson=ride-through).
