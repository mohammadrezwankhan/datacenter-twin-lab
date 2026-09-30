# Adapted from user-supplied python_equivalent archive (SHA-256 c467c157d39a2f36b2951a2a073b01d536c459ea653de5b28785c1b3e1a56cab). The supplied README maps these equations to MATLAB source, but neither MATLAB originals nor the GPU measurement trace were supplied; no MATLAB/measurement validation is claimed.
"""Shared reduced SDCIB equations and analysis helpers."""
from __future__ import annotations
import warnings
from copy import deepcopy
import numpy as np

from .common import numeric_jacobian, safe_div, pi_bw_tuning, pll_bw_tuning

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


def run_newton_solver(x, rhs_u, p_load, max_it=80, tol_f=1e-10, tol_x=1e-10, do_print=True):
    x = np.asarray(x, float).copy()
    nF = np.inf
    for it in range(1, max_it + 1):
        F = np.asarray(rhs_u(x, p_load), float)
        nF = np.linalg.norm(F, 2)
        if do_print:
            print(f"it={it:2d}  ||F||={nF:.3e}")
        if nF < tol_f:
            break
        J = numeric_jacobian(lambda xx: rhs_u(xx, p_load), x)
        try:
            dx = np.linalg.solve(J, -F)
        except np.linalg.LinAlgError:
            dx = np.linalg.lstsq(J, -F, rcond=None)[0]
        if np.linalg.norm(dx, 2) < tol_x * (1 + np.linalg.norm(x, 2)):
            break
        alpha, c1 = 1.0, 1e-4
        accepted = False
        while alpha > 1e-6:
            xt = x + alpha * dx
            Ft = np.asarray(rhs_u(xt, p_load), float)
            if np.linalg.norm(Ft, 2) <= (1 - c1 * alpha) * nF:
                x = xt
                accepted = True
                break
            alpha *= 0.5
        if not accepted:
            if do_print:
                warnings.warn("Newton line-search stalled; applying damped step.")
            x = x + 1e-3 * dx
    return x, nF


def odefun_rhs_reduced(t, x, p, pload_fun, idx=IDX):
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
    iU_cv = x[idx["iU_cv"]]
    iV_cv = x[idx["iV_cv"]]
    vU_vsi = x[idx["vU_vsi"]]
    vV_vsi = x[idx["vV_vsi"]]
    xiU_vsi = x[idx["xiU_vsi"]]
    xiV_vsi = x[idx["xiV_vsi"]]
    gamU_vsi = x[idx["gamU_vsi"]]
    gamV_vsi = x[idx["gamV_vsi"]]
    v_psu = x[idx["v_psu"]]
    xi_psu = x[idx["xi_psu"]]
    v_eq = x[idx["v_eq"]]
    xi_eq = x[idx["xi_eq"]]

    p_load = float(pload_fun(t))
    g_load = p_load / (3 * max(p.veq_ref, 1e-9) ** 2)
    i_eq = p.kp_v_eq * (p.veq_ref - v_eq) + p.ki_v_eq * xi_eq
    i_psu = safe_div(v_eq, v_psu) * i_eq
    g_eq = p.kp_v_psu * (p.vpsu_ref - v_psu) + p.ki_v_psu * xi_psu
    iU_vsi = g_eq * vU_vsi
    iV_vsi = g_eq * vV_vsi
    vuv_sq = vU_vsi**2 + vV_vsi**2
    psu_injection = ((g_eq - p.r_psu * g_eq**2) * vuv_sq) / (3 * max(v_psu, 1e-9))

    omega_vsi = p.omega_vsi
    vU_ref_vsi = p.vu_vsi_ref
    vV_ref_vsi = 0.0
    iU_ref_cv = (
        p.kp_v_vsi * (vU_ref_vsi - vU_vsi) + p.ki_v_vsi * xiU_vsi - omega_vsi * p.c_vsi * vV_vsi
    )
    iV_ref_cv = (
        p.kp_v_vsi * (vV_ref_vsi - vV_vsi) + p.ki_v_vsi * xiV_vsi + omega_vsi * p.c_vsi * vU_vsi
    )
    vU_ref_cv = (
        p.kp_c_vsi * (iU_ref_cv - iU_cv) + p.ki_c_vsi * gamU_vsi - omega_vsi * p.l_vsi * iV_cv
    )
    vV_ref_cv = (
        p.kp_c_vsi * (iV_ref_cv - iV_cv) + p.ki_c_vsi * gamV_vsi + omega_vsi * p.l_vsi * iU_cv
    )
    mU = safe_div(vU_ref_cv, vdc_ups)
    mV = safe_div(vV_ref_cv, vdc_ups)

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
    i_dc_out = mU * iU_cv + mV * iV_cv

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
        mU * vdc_ups - vU_vsi - p.r_vsi * iU_cv + omega_vsi * p.l_vsi * iV_cv
    )
    xdot[idx["iV_cv"]] = (p.omega_b / p.l_vsi) * (
        mV * vdc_ups - vV_vsi - p.r_vsi * iV_cv - omega_vsi * p.l_vsi * iU_cv
    )
    xdot[idx["vU_vsi"]] = (p.omega_b / p.c_vsi) * (iU_cv - iU_vsi + omega_vsi * p.c_vsi * vV_vsi)
    xdot[idx["vV_vsi"]] = (p.omega_b / p.c_vsi) * (iV_cv - iV_vsi - omega_vsi * p.c_vsi * vU_vsi)
    xdot[idx["xiU_vsi"]] = vU_ref_vsi - vU_vsi
    xdot[idx["xiV_vsi"]] = vV_ref_vsi - vV_vsi
    xdot[idx["gamU_vsi"]] = iU_ref_cv - iU_cv
    xdot[idx["gamV_vsi"]] = iV_ref_cv - iV_cv
    xdot[idx["v_psu"]] = (p.omega_b / p.c_psu) * (psu_injection - i_psu)
    xdot[idx["xi_psu"]] = p.vpsu_ref - v_psu
    xdot[idx["v_eq"]] = (p.omega_b / p.c_eq) * (i_eq - g_load * v_eq)
    xdot[idx["xi_eq"]] = p.veq_ref - v_eq

    alg = dict(
        p_load=p_load,
        g_load=g_load,
        i_eq=i_eq,
        i_psu=i_psu,
        g_eq=g_eq,
        vdc_ups=vdc_ups,
        v_psu=v_psu,
        v_eq=v_eq,
        p_pcc=vr_pcc * ir_pcc + vi_pcc * ii_pcc,
        p_dc_in=vdc_ups * i_dc_in,
        p_dc_out=vdc_ups * i_dc_out,
    )
    return xdot, alg


def output_ppcc(x, p, p_load_scalar, idx=IDX):
    return odefun_rhs_reduced(0, x, p, lambda t: p_load_scalar, idx)[1]["p_pcc"]


def collect_signals_reduced(t, X, p, u_fun, idx=IDX):
    t = np.asarray(t)
    X = np.asarray(X)
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
    S = {f: np.zeros(len(t)) for f in fields}
    for k, tt in enumerate(t):
        _, a = odefun_rhs_reduced(0, X[k], p, lambda _t: u_fun(tt), idx)
        S["p_load_cmd"][k] = a["p_load"]
        S["p_pcc"][k] = a["p_pcc"]
        S["p_dc_in"][k] = a["p_dc_in"]
        S["p_dc_out"][k] = a["p_dc_out"]
        S["vdc_ups"][k] = a["vdc_ups"]
        S["v_psu"][k] = a["v_psu"]
        S["v_eq"][k] = a["v_eq"]
        S["g_eq"][k] = a["g_eq"]
        S["g_load"][k] = a["g_load"]
        S["i_eq"][k] = a["i_eq"]
        S["i_psu"][k] = a["i_psu"]
    return S


def sort_eigs_for_tracking(lam):
    lam = np.asarray(lam)
    idx = np.lexsort((-np.real(lam), -np.imag(lam)))
    return lam[idx]


def match_eigs_global(lam_ref, lam_now):
    lam_ref = np.asarray(lam_ref)
    lam_now = np.asarray(lam_now)
    n = len(lam_ref)
    D = np.abs(lam_ref[:, None] - lam_now[None, :])
    perm = np.zeros(n, dtype=int)
    for _ in range(n):
        i, j = np.unravel_index(np.argmin(D), D.shape)
        perm[i] = j
        D[i, :] = np.inf
        D[:, j] = np.inf
    return perm


def smoothstep01(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


def f_schedule(t, t_on, tA, f0, f1, tB, f2):
    return 0.0 if t < t_on else f0 if t < tA else f1 if t < tB else f2


def phase_stepfreq(t, t_on, tA, f0, f1, tB, f2):
    if t <= t_on:
        return 0.0
    if t < tA:
        return f0 * (t - t_on)
    if t < tB:
        return f0 * (tA - t_on) + f1 * (t - tA)
    return f0 * (tA - t_on) + f1 * (tB - tA) + f2 * (t - tB)
