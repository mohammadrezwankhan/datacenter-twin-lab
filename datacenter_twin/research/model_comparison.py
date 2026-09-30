"""Bounded simulation of the supplied 62-state full-abc and reduced-uv pair."""

from __future__ import annotations

import numpy as np
from scipy.integrate import solve_ivp
from scipy.sparse import block_diag, csc_matrix

from .model_validation import build_params, get_sys_derivatives


_ORIGINAL_STEP_TIME = 1.025
_STEP_TIME = 0.04
_END_TIME = 0.08
_RTOL = 1e-8
_ATOL = 1e-10


def _initial_state(p: dict[str, float]) -> np.ndarray:
    """Preserve the hand-set startup state from the imported ModelValidation script."""
    load0 = 0.5
    g_load = load0 / (3.0 * p["v_eq_ref"] ** 2)
    x = np.zeros(62)
    for offset in (0, 41):
        x[offset + 3] = load0
        x[offset + 5] = load0 / p["ki_dc_afe"]
        x[offset + 8] = p["vdc_ups_ref"]
        x[offset + 9] = load0 / p["vu_vsi_ref"]
        x[offset + 11] = p["vu_vsi_ref"]
        x[offset + 13] = load0 / p["vu_vsi_ref"] / p["ki_v_vsi"]
    i_eq0 = g_load * p["v_eq_ref"]
    i_psu0 = (p["v_eq_ref"] / p["v_psu_ref"]) * i_eq0
    discriminant = 1.0 - 4.0 * p["r_psu"] * (i_psu0 * 3.0)
    if discriminant < 0.0:
        raise ValueError("Supplied PSU startup equation has no real initialized conductance.")
    g_eq0 = (1.0 - np.sqrt(discriminant)) / (2.0 * p["r_psu"])
    sq = np.sqrt(2.0 / 3.0)
    v_abc = sq * p["vu_vsi_ref"] * np.array([1.0, -0.5, -0.5])
    x[17:20] = g_eq0 * np.sqrt(v_abc**2 + 1e-6)
    x[20:23] = p["v_psu_ref"]
    x[23:26] = g_eq0 / p["ki_v_psu"]
    x[29:32] = i_eq0
    x[32:35] = p["v_eq_ref"]
    x[35:38] = i_eq0 / p["ki_v_eq"]
    x[58] = p["v_psu_ref"]
    x[59] = g_eq0 / p["ki_v_psu"]
    x[60] = p["v_eq_ref"]
    x[61] = i_eq0 / p["ki_v_eq"]
    return x


def _integrate_segment(
    x0: np.ndarray,
    t0: float,
    t1: float,
    values: np.ndarray,
    load: float,
    p: dict[str, float],
    *,
    rtol: float,
    atol: float,
):
    def rhs(_t: float, x: np.ndarray) -> np.ndarray:
        return get_sys_derivatives(_t, x, load, p)[0]

    # The imported full-abc (41 states) and reduced-uv (21 states) equations
    # have no cross-model state coupling. This exact block structure lets
    # SciPy color finite-difference Jacobian columns without changing RHSs.
    sparsity = block_diag(
        (csc_matrix(np.ones((41, 41))), csc_matrix(np.ones((21, 21)))), format="csc"
    )
    sol = solve_ivp(
        rhs,
        (t0, t1),
        x0,
        method="BDF",
        t_eval=values,
        rtol=rtol,
        atol=atol,
        jac_sparsity=sparsity,
        max_step=np.inf,
    )
    if not sol.success or sol.y.shape[1] != len(values):
        raise ValueError(
            f"62-state BDF integration did not complete on {t0:g}–{t1:g} s: {sol.message}"
        )
    if not np.all(np.isfinite(sol.y)):
        raise ValueError("62-state BDF integration returned non-finite values; result withheld.")
    if float(np.max(np.abs(sol.y))) > 1e6:
        raise ValueError(
            "62-state response exceeded the 1e6 pu numerical runaway guard; result withheld without clipping."
        )
    return sol


def run_model_comparison(
    config: dict[str, float], *, rtol: float = _RTOL, atol: float = _ATOL
) -> dict[str, object]:
    if not np.isfinite(rtol) or not np.isfinite(atol) or rtol <= 0.0 or atol <= 0.0:
        raise ValueError("BDF tolerances must be finite, positive values.")
    p = build_params()
    initial = _initial_state(p)
    final_load = config["load_final_pu"]
    n_before = 121
    n_after = 100
    t_before = np.linspace(0.0, _STEP_TIME, n_before)
    t_after = np.linspace(_STEP_TIME, _END_TIME, n_after + 1)[1:]
    first = _integrate_segment(initial, 0.0, _STEP_TIME, t_before, 0.5, p, rtol=rtol, atol=atol)
    second = _integrate_segment(
        first.y[:, -1], _STEP_TIME, _END_TIME, t_after, final_load, p, rtol=rtol, atol=atol
    )
    t = np.r_[first.t, second.t]
    states = np.vstack((first.y.T, second.y.T))
    load = np.where(t < _STEP_TIME, 0.5, final_load)
    output = np.array(
        [
            get_sys_derivatives(float(tt), xx, float(uu), p)[1:]
            for tt, xx, uu in zip(t, states, load)
        ]
    )
    if not np.all(np.isfinite(output)):
        raise ValueError("Model-comparison outputs are non-finite; result withheld.")
    p_vsi_abc, p_vsi_uv, p_pcc_abc, p_pcc_uv = output.T
    post = t >= _STEP_TIME
    vsi_difference = p_vsi_abc[post] - p_vsi_uv[post]
    pcc_difference = p_pcc_abc[post] - p_pcc_uv[post]
    initial_derivative = get_sys_derivatives(0.0, initial, 0.5, p)[0]
    result = {
        "study_id": "model-comparison",
        "model": "Supplied 41-state full-abc and 21-state reduced-uv equations (62-state ModelValidation pair)",
        "config": dict(config),
        "solver": {
            "method": "SciPy BDF with exact 41+21 state-block Jacobian sparsity; two segments at the lesson load step",
            "rtol": float(rtol),
            "atol": float(atol),
            "nfev": int(first.nfev + second.nfev),
            "njev": int(first.njev + second.njev),
            "nlu": int(first.nlu + second.nlu),
        },
        "assumptions": [
            "The imported ModelValidation startup values are preserved; this is a hand-set initial condition, not a solved joint equilibrium.",
            "The full-abc and reduced-uv model outputs are compared under the same per-unit load command; they are not assumed identical.",
            "To keep the lesson responsive, the supplied hand-set startup is simulated for 0.08 s and its 1.025 s load step is retimed to 0.04 s; no equilibrium or pre-settled state is substituted.",
            "This model-pair comparison is not external validation and does not use measured GPU data.",
        ],
        "metrics": [
            {
                "label": "Full-abc VSI power vs reduced-uv VSI power RMS difference after step",
                "value": float(np.sqrt(np.mean(vsi_difference**2))),
                "unit": "pu",
            },
            {
                "label": "Full-abc PCC power vs reduced-uv PCC power RMS difference after step",
                "value": float(np.sqrt(np.mean(pcc_difference**2))),
                "unit": "pu",
            },
            {
                "label": "Maximum absolute post-step PCC power difference",
                "value": float(np.max(np.abs(pcc_difference))),
                "unit": "pu",
            },
            {
                "label": "Supplied startup derivative infinity norm",
                "value": float(np.linalg.norm(initial_derivative, np.inf)),
                "unit": "state-unit/s",
            },
            {
                "label": "Post-step observation interval",
                "value": _END_TIME - _STEP_TIME,
                "unit": "s",
            },
        ],
        "charts": [
            {
                "id": "model-vsi",
                "title": "VSI active power: full-abc and reduced-uv",
                "x_label": "Time (s)",
                "y_label": "VSI active power (pu)",
                "x": t.tolist(),
                "lines": [
                    {"label": "Full-abc", "values": p_vsi_abc.tolist(), "color": "#2563eb"},
                    {"label": "Reduced-uv", "values": p_vsi_uv.tolist(), "color": "#d97706"},
                ],
            },
            {
                "id": "model-pcc",
                "title": "PCC active power: full-abc and reduced-uv",
                "x_label": "Time (s)",
                "y_label": "PCC active power (pu)",
                "x": t.tolist(),
                "lines": [
                    {"label": "Full-abc", "values": p_pcc_abc.tolist(), "color": "#2563eb"},
                    {"label": "Reduced-uv", "values": p_pcc_uv.tolist(), "color": "#d97706"},
                ],
            },
        ],
        "diagnostics": {
            "state_count": 62,
            "initial_state": initial.tolist(),
            "final_state": states[-1].tolist(),
            "initial_derivative_inf": float(np.linalg.norm(initial_derivative, np.inf)),
            "step_time_s": _STEP_TIME,
            "source_step_time_s": _ORIGINAL_STEP_TIME,
            "end_time_s": _END_TIME,
            "sample_count": len(t),
            "time_s": t.tolist(),
            "integration_segments_successful": [bool(first.success), bool(second.success)],
            "post_step_sample_count": int(np.count_nonzero(post)),
        },
    }
    return result
