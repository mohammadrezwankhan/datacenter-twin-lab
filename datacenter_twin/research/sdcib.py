"""Pure numerical wrappers for the supplied reduced 21-state SDCIB equations."""

from __future__ import annotations

from copy import deepcopy
from types import SimpleNamespace as NS

import numpy as np
from scipy.integrate import solve_ivp
from scipy.linalg import eig
from scipy.optimize import root

from .common import numeric_jacobian, pi_bw_tuning, pll_bw_tuning
from .sdcib_core import IDX, STATE_NAMES, odefun_rhs_reduced, output_ppcc, run_newton_solver


def make_parameters(config: dict[str, float]) -> tuple[NS, NS]:
    """Build the SDCIB.m baseline and retune only the exposed study inputs."""
    p = NS()
    p.fb = 60.0
    p.omega_b = 2.0 * np.pi * p.fb
    p.omega_s = 1.0
    p.Vinf = 1.0
    p.Rinf = config["grid_reactance_pu"] / 9.5
    p.Xinf = config["grid_reactance_pu"]
    p.omega_lp = 2.0 * np.pi * 100.0
    p.l_afe, p.r_afe, p.c_dc, p.vdc_ups_ref = 0.05, 0.003, config["dc_capacitance_pu"], 1.0
    p.l_vsi, p.r_vsi, p.c_vsi, p.vu_vsi_ref = 0.05, 0.003, 0.2, 1.0
    p.omega_vsi = p.omega_s
    p.c_psu, p.r_psu, p.vpsu_ref = 2.0, 0.005, 1.0
    p.c_eq, p.veq_ref = 0.2, 0.5
    p.p_load0 = config.get("load_initial_pu", config.get("load_pu", 0.5))
    tg = NS(
        pll=NS(fbw=20.0, zeta=0.707),
        dc_afe=NS(fbw=5.0, zeta=1.0),
        c_afe=NS(fbw=200.0, zeta=0.707),
        v_vsi=NS(fbw=config["vsi_bandwidth_hz"], zeta=1.0),
        c_vsi=NS(fbw=400.0, zeta=1.0),
        v_psu=NS(fbw=10.0, zeta=1.0),
        v_eq=NS(fbw=100.0, zeta=1.0),
    )
    p.kp_dc_afe, p.ki_dc_afe = pi_bw_tuning(
        "voltage", tg.dc_afe.fbw, tg.dc_afe.zeta, p.c_dc, p.omega_b
    )
    p.kp_c_afe, p.ki_c_afe = pi_bw_tuning(
        "current", tg.c_afe.fbw, tg.c_afe.zeta, p.l_afe, p.omega_b, p.r_afe
    )
    p.kp_v_vsi, p.ki_v_vsi = pi_bw_tuning(
        "voltage", tg.v_vsi.fbw, tg.v_vsi.zeta, p.c_vsi, p.omega_b
    )
    p.kp_c_vsi, p.ki_c_vsi = pi_bw_tuning(
        "current", tg.c_vsi.fbw, tg.c_vsi.zeta, p.l_vsi, p.omega_b, p.r_vsi
    )
    p.kp_v_psu, p.ki_v_psu = pi_bw_tuning(
        "voltage", tg.v_psu.fbw, tg.v_psu.zeta, p.c_psu, p.omega_b
    )
    p.kp_v_eq, p.ki_v_eq = pi_bw_tuning("voltage", tg.v_eq.fbw, tg.v_eq.zeta, p.c_eq, p.omega_b)
    p.kp_pll, p.ki_pll = pll_bw_tuning(tg.pll.fbw, tg.pll.zeta, p.fb)
    return p, tg


def initial_guess(p: NS) -> np.ndarray:
    x = np.zeros(len(STATE_NAMES))
    x[IDX["vdc_ups"]] = p.vdc_ups_ref
    x[IDX["vU_vsi"]] = p.vu_vsi_ref
    x[IDX["v_psu"]] = p.vpsu_ref
    x[IDX["v_eq"]] = p.veq_ref
    g_load = p.p_load0 / (3.0 * p.veq_ref**2)
    i_eq = g_load * p.veq_ref
    i_psu = (p.veq_ref / p.vpsu_ref) * i_eq
    g_eq = i_psu / p.vu_vsi_ref
    x[IDX["xi_psu"]] = g_eq / p.ki_v_psu
    x[IDX["xi_eq"]] = i_eq / p.ki_v_eq
    x[IDX["iU_cv"]] = g_eq * p.vu_vsi_ref
    x[IDX["id_afe"]] = p.p_load0
    return x


def equilibrium(p: NS, x0: np.ndarray | None = None) -> tuple[np.ndarray, float, int]:
    """Solve and independently verify the supplied model's equilibrium."""
    x0 = initial_guess(p) if x0 is None else np.asarray(x0, dtype=float).copy()
    rhs = lambda x: odefun_rhs_reduced(0.0, x, p, lambda _t: p.p_load0, IDX)[0]
    # This is the archive's damped Newton method. Its returned norm can be
    # stale when it exits on a small step, so always recompute it here.
    x, _stale_norm = run_newton_solver(
        x0,
        lambda state, _load: rhs(state),
        p.p_load0,
        max_it=80,
        tol_f=1e-10,
        tol_x=1e-10,
        do_print=False,
    )
    fallback_nfev = 0
    residual = rhs(x)
    if (
        not np.all(np.isfinite(x))
        or not np.all(np.isfinite(residual))
        or np.linalg.norm(residual, np.inf) >= 1e-6
    ):
        fallback = root(rhs, x, method="hybr", options={"xtol": 1e-11, "maxfev": 4000})
        fallback_nfev = int(fallback.nfev)
        x = np.asarray(fallback.x, dtype=float)
        residual = rhs(x)
    residual_inf = float(np.linalg.norm(residual, np.inf))
    if not np.all(np.isfinite(x)) or not np.isfinite(residual_inf) or residual_inf >= 1e-6:
        raise ValueError(
            f"21-state equilibrium did not converge (recomputed ||f||inf={residual_inf:.3g})."
        )
    return x, residual_inf, fallback_nfev


def linearize(p: NS, xeq: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray, float, float]:
    rhs = lambda x, load: odefun_rhs_reduced(0.0, x, p, lambda _t: load, IDX)[0]
    A = numeric_jacobian(lambda x: rhs(x, p.p_load0), xeq, rel_step=1e-7)
    du = 1e-6 * (1.0 + abs(p.p_load0))
    b = (rhs(xeq, p.p_load0 + du) - rhs(xeq, p.p_load0)) / du
    p0 = output_ppcc(xeq, p, p.p_load0, IDX)
    c = numeric_jacobian(
        lambda x: np.array([output_ppcc(x, p, p.p_load0, IDX)]), xeq, rel_step=1e-7
    ).reshape(-1)
    d = (output_ppcc(xeq, p, p.p_load0 + du, IDX) - p0) / du
    return A, b, c, float(d), float(p0)


def _metrics(items: list[tuple[str, float | None, str]]) -> list[dict[str, object]]:
    return [{"label": label, "value": value, "unit": unit} for label, value, unit in items]


def _base_result(
    study_id: str,
    config: dict[str, float],
    xeq: np.ndarray,
    residual: float,
    nfev: int,
    p: NS,
    pcc0: float,
) -> dict[str, object]:
    return {
        "study_id": study_id,
        "model": "Supplied 21-state reduced SDCIB (VSI + data-center equivalent load)",
        "config": dict(config),
        "solver": {
            "method": "damped Newton equilibrium; SciPy BDF time integration",
            "rtol": 1e-6,
            "atol": 1e-8,
        },
        "assumptions": [
            "Per-unit electrical quantities and seconds; the grid reactance control retains the supplied SDCIB X/R ratio of 9.5.",
            "The imported Python equations are used as supplied, with only the documented controls retuned.",
            "The provided archive has no MATLAB originals or GPU_data.csv, so no MATLAB-trace or measured-GPU comparison is represented.",
        ],
        "metrics": _metrics(
            [
                ("Equilibrium residual ||f||∞", residual, "pu/s"),
                ("Equilibrium PCC active power", pcc0, "pu"),
                ("Configured VSI voltage-loop bandwidth", float(config["vsi_bandwidth_hz"]), "Hz"),
            ]
        ),
        "charts": [],
        "diagnostics": {
            "state_names": list(STATE_NAMES),
            "equilibrium_state": [float(v) for v in xeq],
        },
    }


def _sample_solver(fun, t0: float, t1: float, sample_t: np.ndarray, max_step: float):
    sol = solve_ivp(
        fun,
        (t0, t1),
        fun.x0,
        method="BDF",
        t_eval=sample_t,
        rtol=1e-6,
        atol=1e-8,
        max_step=max_step,
        first_step=min(1e-5, max_step),
    )
    if not sol.success or sol.y.shape[1] != len(sample_t):
        raise ValueError(f"BDF integration did not complete: {sol.message}")
    if not np.all(np.isfinite(sol.y)):
        raise ValueError("BDF integration returned non-finite state values.")
    return sol


def run_sdcib_study(study_id: str, config: dict[str, float]) -> dict[str, object]:
    p, _tuning = make_parameters(config)
    xeq, residual, nfev = equilibrium(p)
    pcc_eq = float(output_ppcc(xeq, p, p.p_load0, IDX))
    result = _base_result(study_id, config, xeq, residual, nfev, p, pcc_eq)
    if study_id == "load-step":
        initial = config["load_initial_pu"]
        final = config["load_final_pu"]
        t_step, t_end = 0.2, 1.0
        times = np.linspace(0.0, t_end, 201)
        post_times = times[times >= t_step]
        p.p_load0 = initial
        # Rebuild exactly at the selected initial load; the initial helper above
        # already used it, but assigning here documents the held input.
        rhs = lambda t, x: odefun_rhs_reduced(t, x, p, lambda _tt: final, IDX)[0]
        rhs.x0 = xeq
        sol = _sample_solver(rhs, t_step, t_end, post_times, max_step=0.002)
        states = np.tile(xeq, (len(times), 1))
        states[np.searchsorted(times, t_step) :] = sol.y.T
        p_load = np.where(times < t_step, initial, final)
        pcc = np.array([output_ppcc(state, p, load, IDX) for state, load in zip(states, p_load)])
        _A, _b, _c, _d, pcc0 = linearize(p, xeq)
        result["solver"] = {
            "method": "damped Newton equilibrium; SciPy BDF (split at load step)",
            "rtol": 1e-6,
            "atol": 1e-8,
            "max_step_s": 0.002,
            "nfev": int(sol.nfev),
        }
        result["metrics"] = _metrics(
            [
                ("Recomputed equilibrium residual ||f||∞", residual, "pu/s"),
                ("PCC power before step", pcc0, "pu"),
                (
                    "Peak absolute PCC deviation after step",
                    float(np.max(np.abs(pcc[times >= t_step] - pcc0))),
                    "pu",
                ),
                ("Final PCC active power", float(pcc[-1]), "pu"),
            ]
        )
        result["charts"] = [
            {
                "id": "load-step",
                "title": "21-state response to a held load step",
                "x_label": "Time (s)",
                "y_label": "Active power (pu)",
                "x": times.tolist(),
                "lines": [
                    {"label": "Commanded load", "values": p_load.tolist(), "color": "#d97706"},
                    {"label": "PCC active power", "values": pcc.tolist(), "color": "#2563eb"},
                ],
            }
        ]
        result["diagnostics"].update(
            {
                "time_s": [float(t) for t in times],
                "equilibrium_state": xeq.tolist(),
                "final_state": states[-1].tolist(),
                "equilibrium_residual_inf": residual,
                "integration_nfev": int(sol.nfev),
                "step_time_s": t_step,
            }
        )
        result["assumptions"].append(
            "The pre-step response is held at the solved equilibrium; the 0.2 s step raises load to its configured final value."
        )
        return result

    if study_id == "modal":
        A, b, c, d, _pcc0 = linearize(p, xeq)
        eigenvalues, left, right = eig(A, left=True, right=True, check_finite=True)
        order = np.array(
            sorted(
                range(len(eigenvalues)),
                key=lambda k: (
                    round(float(np.real(eigenvalues[k])), 8),
                    round(float(np.imag(eigenvalues[k])), 8),
                ),
            )
        )
        eigenvalues, left, right = eigenvalues[order], left[:, order], right[:, order]
        eig_cond = float(np.linalg.cond(right))
        if not np.isfinite(eig_cond) or eig_cond > 1e12:
            raise ValueError(
                f"Modal eigenvectors are ill-conditioned (condition number {eig_cond:.3g})."
            )
        left_resid = float(
            np.linalg.norm(A.T @ left - left * np.conj(eigenvalues)[None, :], np.inf)
        )
        right_resid = float(np.linalg.norm(A @ right - right * eigenvalues[None, :], np.inf))
        if max(left_resid, right_resid) > 1e-5 * max(1.0, float(np.linalg.norm(A, np.inf))):
            raise ValueError("Modal left/right eigenvector residual check failed.")
        participation = np.abs(right * np.conj(left))
        for k in range(len(eigenvalues)):
            norm = float(np.sum(participation[:, k]))
            if not np.isfinite(norm) or norm < 1e-14:
                raise ValueError("Modal participation normalization failed.")
            participation[:, k] /= norm
        groups = [
            ("PLL / AFE", range(0, 9)),
            ("VSI", range(9, 17)),
            ("PSU", range(17, 19)),
            ("Equivalent load", range(19, 21)),
        ]
        modes = []
        for k, lam in enumerate(eigenvalues):
            dominant_idx = int(np.argmax(participation[:, k]))
            group_scores = [
                (name, float(np.sum(participation[list(indices), k]))) for name, indices in groups
            ]
            real, imag = float(np.real(lam)), float(np.imag(lam))
            denom = float(abs(lam))
            modes.append(
                {
                    "real": real,
                    "imag": imag,
                    "frequency_hz": abs(imag) / (2.0 * np.pi),
                    "damping": (-real / denom if denom > 1e-12 else None),
                    "dominant_state": STATE_NAMES[dominant_idx],
                    "dominant_group": max(group_scores, key=lambda pair: pair[1])[0],
                    "stable": real <= 1e-8,
                }
            )
        freq = np.logspace(-1.0, 3.0, 160)
        identity = np.eye(A.shape[0])
        gain = np.array(
            [
                abs((c @ np.linalg.solve(1j * 2.0 * np.pi * f * identity - A, b)).item() + d)
                for f in freq
            ]
        )
        if not np.all(np.isfinite(gain)):
            raise ValueError("Frequency response contains a non-finite value.")
        peak_i = int(np.argmax(gain))
        result["solver"] = {
            "method": "damped Newton equilibrium; forward finite-difference Jacobian; SciPy left/right eig",
            "jacobian_step_relative": 1e-7,
        }
        result["metrics"] = _metrics(
            [
                ("Recomputed equilibrium residual ||f||∞", residual, "pu/s"),
                ("Right eigenvector condition number", eig_cond, "condition ratio"),
                ("Worst eigenvalue real part", max(mode["real"] for mode in modes), "1/s"),
                ("Largest sampled POA gain", float(gain[peak_i]), "pu/pu"),
                ("Frequency at largest sampled gain", float(freq[peak_i]), "Hz"),
            ]
        )
        result["modes"] = modes
        result["charts"] = [
            {
                "id": "poa",
                "title": "Small-signal load-to-PCC frequency response",
                "x_label": "Frequency (Hz)",
                "y_label": "Magnitude (pu/pu)",
                "x": freq.tolist(),
                "lines": [
                    {
                        "label": "|ΔPCC active power / Δload|",
                        "values": gain.tolist(),
                        "color": "#7c3aed",
                    },
                ],
            }
        ]
        result["diagnostics"].update(
            {
                "equilibrium_state": xeq.tolist(),
                "equilibrium_residual_inf": residual,
                "jacobian_shape": list(A.shape),
                "left_eigenvector_residual_inf": left_resid,
                "right_eigenvector_residual_inf": right_resid,
                "eigenvector_condition_number": eig_cond,
                "sampled_poa_peak_index": peak_i,
                "sampled_poa_peak_is_a_grid_point_not_an_exact_optimum": True,
            }
        )
        result["assumptions"].append(
            "The POA peak is the largest point on a 160-point logarithmic frequency grid from 0.1 to 1000 Hz, not a continuous optimum."
        )
        return result

    if study_id == "forced-response":
        frequency = config["forcing_frequency_hz"]
        amplitude = config["forcing_amplitude_pu"]
        duration = 2.0
        times = np.linspace(0.0, duration, 801)

        def load_at(t: float) -> float:
            return p.p_load0 + amplitude * np.sin(2.0 * np.pi * frequency * t)

        rhs = lambda t, x: odefun_rhs_reduced(t, x, p, load_at, IDX)[0]
        rhs.x0 = xeq
        max_step = min(0.002, 1.0 / (20.0 * frequency))
        sol = _sample_solver(rhs, 0.0, duration, times, max_step=max_step)
        states = sol.y.T
        p_load = np.array([load_at(float(t)) for t in times])
        pcc = np.array([output_ppcc(state, p, load, IDX) for state, load in zip(states, p_load)])

        # Correctly normalized, one-sided Hann-window spectrum of the known
        # synthetic input and the simulated PCC output.
        def spectrum(signal: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
            centered = signal - float(np.mean(signal))
            window = np.hanning(len(centered))
            coeff = np.fft.rfft(centered * window)
            amp = np.abs(coeff) / (len(centered) * float(np.mean(window)))
            if len(amp) > 2:
                amp[1:-1] *= 2.0
            return np.fft.rfftfreq(len(centered), d=duration / (len(centered) - 1)), amp

        fs, input_amp = spectrum(p_load)
        _, output_amp = spectrum(pcc)
        peak_mask = fs > 0.0
        peak_idx = int(np.argmax(output_amp[peak_mask])) + 1
        result["solver"] = {
            "method": "damped Newton equilibrium; SciPy BDF",
            "rtol": 1e-6,
            "atol": 1e-8,
            "max_step_s": max_step,
            "nfev": int(sol.nfev),
        }
        result["metrics"] = _metrics(
            [
                ("Synthetic input frequency", frequency, "Hz"),
                ("Synthetic input amplitude", amplitude, "pu peak"),
                ("Sampled output-spectrum peak frequency", float(fs[peak_idx]), "Hz"),
                (
                    "Input FFT amplitude at nearest frequency bin",
                    float(input_amp[int(np.argmin(np.abs(fs - frequency)))]),
                    "pu peak",
                ),
                ("PCC peak-to-peak response", float(np.ptp(pcc)), "pu"),
            ]
        )
        result["charts"] = [
            {
                "id": "forced-time",
                "title": "Synthetic sinusoidal load and 21-state PCC response",
                "x_label": "Time (s)",
                "y_label": "Active power (pu)",
                "x": times.tolist(),
                "lines": [
                    {
                        "label": "Synthetic load command",
                        "values": p_load.tolist(),
                        "color": "#d97706",
                    },
                    {"label": "PCC active power", "values": pcc.tolist(), "color": "#2563eb"},
                ],
            },
            {
                "id": "forced-spectrum",
                "title": "One-sided Hann-window spectrum (synthetic input / simulated output)",
                "x_label": "Frequency (Hz)",
                "y_label": "Amplitude (pu peak)",
                "x": fs.tolist(),
                "lines": [
                    {
                        "label": "Synthetic load input",
                        "values": input_amp.tolist(),
                        "color": "#d97706",
                    },
                    {
                        "label": "Simulated PCC output",
                        "values": output_amp.tolist(),
                        "color": "#2563eb",
                    },
                ],
            },
        ]
        result["diagnostics"].update(
            {
                "equilibrium_residual_inf": residual,
                "equilibrium_state": xeq.tolist(),
                "final_state": states[-1].tolist(),
                "expected_synthetic_frequency_hz": frequency,
                "spectrum_sample_rate_hz": (len(times) - 1) / duration,
                "frequency_resolution_hz": float(fs[1] - fs[0]),
            }
        )
        result["assumptions"].append(
            "This is a generated sinusoidal input, not an uploaded, measured, or GPU workload trace."
        )
        result["assumptions"].append(
            "The FFT uses 801 uniform samples over 2 s, a Hann window, mean removal, and single-sided amplitude normalization."
        )
        return result

    raise ValueError(f"Unsupported SDCIB study {study_id!r}.")
