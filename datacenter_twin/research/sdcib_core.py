# Adapted from user-supplied python_equivalent archive (SHA-256
# c467c157d39a2f36b2951a2a073b01d536c459ea653de5b28785c1b3e1a56cab). The supplied README maps
# these equations to MATLAB source, but neither MATLAB originals nor the GPU measurement trace
# were supplied; no MATLAB/measurement validation is claimed.
"""Shared reduced SDCIB equations and analysis helpers."""

from __future__ import annotations

import sys
import warnings
from collections.abc import Callable, Mapping
from types import SimpleNamespace

import numpy as np
from numpy.typing import NDArray

from .common import numeric_jacobian, safe_div
from .types import ComplexArray, FloatArray, Real

STATE_NAMES = [
    "theta_pll",
    "eps_pll",
    "vq_pll",
    "id_afe",
    "iq_afe",
    "xi_dc_afe",
    "gamd_afe",
    "gamq_afe",
    "vdc_ups",
    "iU_cv",
    "iV_cv",
    "vU_vsi",
    "vV_vsi",
    "xiU_vsi",
    "xiV_vsi",
    "gamU_vsi",
    "gamV_vsi",
    "v_psu",
    "xi_psu",
    "v_eq",
    "xi_eq",
]
IDX = {name: i for i, name in enumerate(STATE_NAMES)}


def run_newton_solver(
    x: FloatArray,
    rhs_u: Callable[[FloatArray, Real], FloatArray],
    p_load: Real,
    max_it: int = 80,
    tol_f: float = 1e-10,
    tol_x: float = 1e-10,
    do_print: bool = True,
) -> tuple[FloatArray, Real]:
    x = np.asarray(x, float).copy()
    n_f: Real = np.inf
    for it in range(1, max_it + 1):
        residual = np.asarray(rhs_u(x, p_load), float)
        n_f = np.linalg.norm(residual, 2)
        if do_print:
            sys.stdout.write(f"it={it:2d}  ||F||={n_f:.3e}\n")
        if n_f < tol_f:
            break
        jacobian = numeric_jacobian(lambda xx: rhs_u(xx, p_load), x)
        try:
            dx = np.linalg.solve(jacobian, -residual)
        except np.linalg.LinAlgError:
            dx = np.linalg.lstsq(jacobian, -residual, rcond=None)[0]
        if np.linalg.norm(dx, 2) < tol_x * (1 + np.linalg.norm(x, 2)):
            break
        alpha, c1 = 1.0, 1e-4
        accepted = False
        while alpha > 1e-6:
            xt = x + alpha * dx
            trial_residual = np.asarray(rhs_u(xt, p_load), float)
            if np.linalg.norm(trial_residual, 2) <= (1 - c1 * alpha) * n_f:
                x = xt
                accepted = True
                break
            alpha *= 0.5
        if not accepted:
            if do_print:
                warnings.warn("Newton line-search stalled; applying damped step.", stacklevel=2)
            x = x + 1e-3 * dx
    return x, n_f


def odefun_rhs_reduced(
    t: float,
    x: FloatArray,
    p: SimpleNamespace,
    pload_fun: Callable[[float], Real],
    idx: Mapping[str, int] = IDX,
) -> tuple[FloatArray, dict[str, Real]]:
    x = np.asarray(x, float).reshape(-1)
    theta_pll = x[idx["theta_pll"]]
    eps_pll = x[idx["eps_pll"]]
    vq_pll_f = x[idx["vq_pll"]]
    id_afe = x[idx["id_afe"]]
    iq_afe = x[idx["iq_afe"]]
    xi_dc_afe = x[idx["xi_dc_afe"]]
    gamd_afe = x[idx["gamd_afe"]]
    gamq_afe = x[idx["gamq_afe"]]
    vdc_ups = x[idx["vdc_ups"]]
    i_u_cv = x[idx["iU_cv"]]
    i_v_cv = x[idx["iV_cv"]]
    v_u_vsi = x[idx["vU_vsi"]]
    v_v_vsi = x[idx["vV_vsi"]]
    xi_u_vsi = x[idx["xiU_vsi"]]
    xi_v_vsi = x[idx["xiV_vsi"]]
    gam_u_vsi = x[idx["gamU_vsi"]]
    gam_v_vsi = x[idx["gamV_vsi"]]
    v_psu = x[idx["v_psu"]]
    xi_psu = x[idx["xi_psu"]]
    v_eq = x[idx["v_eq"]]
    xi_eq = x[idx["xi_eq"]]

    p_load = float(pload_fun(t))
    g_load = p_load / (3 * max(p.veq_ref, 1e-9) ** 2)
    i_eq = p.kp_v_eq * (p.veq_ref - v_eq) + p.ki_v_eq * xi_eq
    i_psu = safe_div(v_eq, v_psu) * i_eq
    g_eq = p.kp_v_psu * (p.vpsu_ref - v_psu) + p.ki_v_psu * xi_psu
    i_u_vsi = g_eq * v_u_vsi
    i_v_vsi = g_eq * v_v_vsi
    vuv_sq = v_u_vsi**2 + v_v_vsi**2
    psu_injection = ((g_eq - p.r_psu * g_eq**2) * vuv_sq) / (3 * max(v_psu, 1e-9))

    omega_vsi = p.omega_vsi
    v_u_ref_vsi = p.vu_vsi_ref
    v_v_ref_vsi = 0.0
    i_u_ref_cv = (
        p.kp_v_vsi * (v_u_ref_vsi - v_u_vsi) + p.ki_v_vsi * xi_u_vsi - omega_vsi * p.c_vsi * v_v_vsi
    )
    i_v_ref_cv = (
        p.kp_v_vsi * (v_v_ref_vsi - v_v_vsi) + p.ki_v_vsi * xi_v_vsi + omega_vsi * p.c_vsi * v_u_vsi
    )
    v_u_ref_cv = (
        p.kp_c_vsi * (i_u_ref_cv - i_u_cv) + p.ki_c_vsi * gam_u_vsi - omega_vsi * p.l_vsi * i_v_cv
    )
    v_v_ref_cv = (
        p.kp_c_vsi * (i_v_ref_cv - i_v_cv) + p.ki_c_vsi * gam_v_vsi + omega_vsi * p.l_vsi * i_u_cv
    )
    m_u = safe_div(v_u_ref_cv, vdc_ups)
    m_v = safe_div(v_v_ref_cv, vdc_ups)

    omega_pll = p.omega_s + p.kp_pll * vq_pll_f + p.ki_pll * eps_pll
    s = np.sin(theta_pll + np.pi / 2)
    c = np.cos(theta_pll + np.pi / 2)
    ir_pcc = s * id_afe + c * iq_afe
    ii_pcc = -c * id_afe + s * iq_afe
    vr_pcc = p.Vinf - p.Rinf * ir_pcc + p.Xinf * ii_pcc
    vi_pcc = -p.Rinf * ii_pcc - p.Xinf * ir_pcc
    vd_pcc = s * vr_pcc - c * vi_pcc
    vq_pcc = c * vr_pcc + s * vi_pcc

    id_ref_afe = p.kp_dc_afe * (p.vdc_ups_ref - vdc_ups) + p.ki_dc_afe * xi_dc_afe
    iq_ref_afe = 0.0
    vd_ref_afe = (
        p.kp_c_afe * (id_afe - id_ref_afe) + p.ki_c_afe * gamd_afe + omega_pll * p.l_afe * iq_afe
    )
    vq_ref_afe = (
        p.kp_c_afe * (iq_afe - iq_ref_afe) + p.ki_c_afe * gamq_afe - omega_pll * p.l_afe * id_afe
    )
    md = safe_div(vd_ref_afe, vdc_ups)
    mq = safe_div(vq_ref_afe, vdc_ups)
    i_dc_in = md * id_afe + mq * iq_afe
    i_dc_out = m_u * i_u_cv + m_v * i_v_cv

    xdot = np.zeros_like(x)
    xdot[idx["theta_pll"]] = p.omega_b * (omega_pll - p.omega_s)
    xdot[idx["eps_pll"]] = vq_pll_f
    xdot[idx["vq_pll"]] = p.omega_lp * (vq_pcc - vq_pll_f)
    xdot[idx["id_afe"]] = (p.omega_b / p.l_afe) * (
        vd_pcc - md * vdc_ups - p.r_afe * id_afe + omega_pll * p.l_afe * iq_afe
    )
    xdot[idx["iq_afe"]] = (p.omega_b / p.l_afe) * (
        vq_pcc - mq * vdc_ups - p.r_afe * iq_afe - omega_pll * p.l_afe * id_afe
    )
    xdot[idx["xi_dc_afe"]] = p.vdc_ups_ref - vdc_ups
    xdot[idx["gamd_afe"]] = id_afe - id_ref_afe
    xdot[idx["gamq_afe"]] = iq_afe - iq_ref_afe
    xdot[idx["vdc_ups"]] = (p.omega_b / p.c_dc) * (i_dc_in - i_dc_out)
    xdot[idx["iU_cv"]] = (p.omega_b / p.l_vsi) * (
        m_u * vdc_ups - v_u_vsi - p.r_vsi * i_u_cv + omega_vsi * p.l_vsi * i_v_cv
    )
    xdot[idx["iV_cv"]] = (p.omega_b / p.l_vsi) * (
        m_v * vdc_ups - v_v_vsi - p.r_vsi * i_v_cv - omega_vsi * p.l_vsi * i_u_cv
    )
    xdot[idx["vU_vsi"]] = (p.omega_b / p.c_vsi) * (i_u_cv - i_u_vsi + omega_vsi * p.c_vsi * v_v_vsi)
    xdot[idx["vV_vsi"]] = (p.omega_b / p.c_vsi) * (i_v_cv - i_v_vsi - omega_vsi * p.c_vsi * v_u_vsi)
    xdot[idx["xiU_vsi"]] = v_u_ref_vsi - v_u_vsi
    xdot[idx["xiV_vsi"]] = v_v_ref_vsi - v_v_vsi
    xdot[idx["gamU_vsi"]] = i_u_ref_cv - i_u_cv
    xdot[idx["gamV_vsi"]] = i_v_ref_cv - i_v_cv
    xdot[idx["v_psu"]] = (p.omega_b / p.c_psu) * (psu_injection - i_psu)
    xdot[idx["xi_psu"]] = p.vpsu_ref - v_psu
    xdot[idx["v_eq"]] = (p.omega_b / p.c_eq) * (i_eq - g_load * v_eq)
    xdot[idx["xi_eq"]] = p.veq_ref - v_eq

    alg = {
        "p_load": p_load,
        "g_load": g_load,
        "i_eq": i_eq,
        "i_psu": i_psu,
        "g_eq": g_eq,
        "vdc_ups": vdc_ups,
        "v_psu": v_psu,
        "v_eq": v_eq,
        "p_pcc": vr_pcc * ir_pcc + vi_pcc * ii_pcc,
        "p_dc_in": vdc_ups * i_dc_in,
        "p_dc_out": vdc_ups * i_dc_out,
    }
    return xdot, alg


def output_ppcc(
    x: FloatArray,
    p: SimpleNamespace,
    p_load_scalar: Real,
    idx: Mapping[str, int] = IDX,
) -> Real:
    return odefun_rhs_reduced(0, x, p, lambda _t: p_load_scalar, idx)[1]["p_pcc"]


def collect_signals_reduced(
    t: FloatArray,
    states: FloatArray,
    p: SimpleNamespace,
    u_fun: Callable[[float], Real],
    idx: Mapping[str, int] = IDX,
) -> dict[str, FloatArray]:
    t = np.asarray(t)
    states = np.asarray(states)
    fields = [
        "p_load_cmd",
        "p_pcc",
        "p_dc_in",
        "p_dc_out",
        "vdc_ups",
        "v_psu",
        "v_eq",
        "g_eq",
        "g_load",
        "i_eq",
        "i_psu",
    ]
    signals = {f: np.zeros(len(t)) for f in fields}
    for k, tt in enumerate(t):

        def sample_load(_time: float, sample_time: float = tt) -> Real:
            return u_fun(sample_time)

        _, a = odefun_rhs_reduced(0, states[k], p, sample_load, idx)
        signals["p_load_cmd"][k] = a["p_load"]
        signals["p_pcc"][k] = a["p_pcc"]
        signals["p_dc_in"][k] = a["p_dc_in"]
        signals["p_dc_out"][k] = a["p_dc_out"]
        signals["vdc_ups"][k] = a["vdc_ups"]
        signals["v_psu"][k] = a["v_psu"]
        signals["v_eq"][k] = a["v_eq"]
        signals["g_eq"][k] = a["g_eq"]
        signals["g_load"][k] = a["g_load"]
        signals["i_eq"][k] = a["i_eq"]
        signals["i_psu"][k] = a["i_psu"]
    return signals


def sort_eigs_for_tracking(lam: ComplexArray) -> ComplexArray:
    lam = np.asarray(lam)
    idx = np.lexsort((-np.real(lam), -np.imag(lam)))
    return lam[idx]


def match_eigs_global(lam_ref: ComplexArray, lam_now: ComplexArray) -> NDArray[np.int64]:
    lam_ref = np.asarray(lam_ref)
    lam_now = np.asarray(lam_now)
    n = len(lam_ref)
    distance = np.abs(lam_ref[:, None] - lam_now[None, :])
    perm = np.zeros(n, dtype=int)
    for _ in range(n):
        i, j = np.unravel_index(np.argmin(distance), distance.shape)
        perm[i] = j
        distance[i, :] = np.inf
        distance[:, j] = np.inf
    return perm


def smoothstep01(x: Real) -> Real:
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


def f_schedule(
    t: float,
    t_on: float,
    t_a: float,
    f0: float,
    f1: float,
    t_b: float,
    f2: float,
) -> float:
    return 0.0 if t < t_on else f0 if t < t_a else f1 if t < t_b else f2


def phase_stepfreq(
    t: float,
    t_on: float,
    t_a: float,
    f0: float,
    f1: float,
    t_b: float,
    f2: float,
) -> float:
    if t <= t_on:
        return 0.0
    if t < t_a:
        return f0 * (t - t_on)
    if t < t_b:
        return f0 * (t_a - t_on) + f1 * (t - t_a)
    return f0 * (t_a - t_on) + f1 * (t_b - t_a) + f2 * (t - t_b)
