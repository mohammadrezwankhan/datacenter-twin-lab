"""Case-9 four-port grid power-flow, initialization, modal, and POA study.

The network and device parameterization follow the user-supplied ``case9.py``
Python equivalent of the IEEE 9-bus / MATPOWER case9 variant. The MATLAB
source and measured GPU trace were absent. This module only runs the supplied
power-flow, device-equilibrium, modal, and POA portions; it makes no measured
trace or external validation claim.
"""

from __future__ import annotations

from copy import deepcopy
from types import SimpleNamespace as NS

import numpy as np
from scipy.linalg import eig
from scipy.optimize import root

from .common import numeric_jacobian, pi_bw_tuning
from .datacenter_init_from_pf_qss import datacenter_init_from_pf_qss, qss_equations
from .datacenter_port_model import datacenter_port_model
from .gfl_init_from_pf_qss_newton import gfl_init_from_pf_qss_newton
from .gfl_port_model import gfl_port_model
from .gfm_init_from_pf_qss_newton import gfm_init_from_pf_qss_newton
from .gfm_port_model import gfm_port_model
from .sm_init_from_pf_fsolve import sm_init_from_pf_fsolve
from .sm_port_model import sm_port_model


def _sm_params(fb: float) -> NS:
    return NS(
        omega_b=2 * np.pi * fb,
        ws=1.0,
        xd=0.1460,
        xq=0.0969,
        xdp=0.0608,
        xqp=0.0969,
        Td0p=8.96,
        Tq0p=0.31,
        H=3.0,
        D=0.0,
        ka=5.0,
        Ta=0.2,
        Te=0.314,
        kf=0.063,
        Tf=0.35,
        ke=1.0,
        ae=0.0039,
        be=1.555,
        r=0.15,
        Tsv=0.1,
        Tch=0.5,
    )


def _gfm_params(fb: float) -> NS:
    ob, wc_v, wc_i, cf, lf = 2 * np.pi * fb, 2 * np.pi * 80, 2 * np.pi * 200, 0.074, 0.08
    return NS(
        base=NS(ome_sys=1.0, ome_b=ob),
        filt=NS(lf=lf, rf=0.003, cf=cf, lg=0.2, rg=0.01),
        droop=NS(Kp=0.02, ome_z=20.0, Kq=0.05, ome_f=50.0),
        virt=NS(rv=0.0, lv=0.2),
        inner=NS(
            kpv=4 * wc_v * cf / ob,
            kiv=wc_v**2 * cf / ob,
            kpc=1.414 * wc_i * lf / ob,
            kic=wc_i**2 * lf / ob,
        ),
        dc=NS(Vdc=1.0),
    )


def _gfl_params(base_mva: float, fb: float) -> NS:
    b = NS(baseMVA=base_mva, fb_hz=fb, ome_b=2 * np.pi * fb, ome_sys=1.0)
    return NS(
        base=b,
        filt=NS(lf=0.08, rf=0.003, cf=0.074, lg=0.1, rg=0.01),
        pll=NS(kp=0.05, ki=1.42, ome_lp=376.99),
        outer=NS(Kp_p=0.01, Ki_p=0.12, Kp_q=0.01, Ki_q=0.12, ome_z=41.47, ome_f=41.47),
        inner=NS(kpc=0.15, kic=0.267, kffv=0.0, lf=0.08),
        dc=NS(Vdc=1.0),
    )


def _dc_params(fb: float) -> NS:
    dc = NS(
        fb=fb,
        omega_b=2 * np.pi * fb,
        omega_s=1.0,
        omega_lp=2 * np.pi * 100,
        l_afe=0.05,
        r_afe=0.003,
        c_dc=2.0,
        vdc_ups_ref=1.0,
        l_vsi=0.05,
        r_vsi=0.003,
        c_vsi=0.2,
        vu_vsi_ref=1.0,
        omega_vsi=1.0,
        c_psu=2.0,
        r_psu=0.005,
        vpsu_ref=1.0,
        c_eq=0.2,
        veq_ref=0.5,
        kp_pll=0.471,
        ki_pll=41.89,
    )
    dc.kp_dc_afe, dc.ki_dc_afe = pi_bw_tuning("voltage", 5.0, 1.0, dc.c_dc, dc.omega_b)
    dc.kp_c_afe, dc.ki_c_afe = pi_bw_tuning("current", 200.0, 0.707, dc.l_afe, dc.omega_b, dc.r_afe)
    dc.kp_v_vsi, dc.ki_v_vsi = pi_bw_tuning("voltage", 100.0, 1.0, dc.c_vsi, dc.omega_b)
    dc.kp_c_vsi, dc.ki_c_vsi = pi_bw_tuning("current", 400.0, 1.0, dc.l_vsi, dc.omega_b, dc.r_vsi)
    dc.kp_v_psu, dc.ki_v_psu = pi_bw_tuning("voltage", 10.0, 1.0, dc.c_psu, dc.omega_b)
    dc.kp_v_eq, dc.ki_v_eq = pi_bw_tuning("voltage", 100.0, 1.0, dc.c_eq, dc.omega_b)
    return dc


def _power_flow(scale: float):
    base = 100.0
    bus = np.array(
        [
            [1, 3, 0, 0, 0, 0, 1, 1.040, 0, 345, 1, 1.1, 0.9],
            [2, 2, 0, 0, 0, 0, 1, 1.025, 0, 345, 1, 1.1, 0.9],
            [3, 1, 0, 0, 0, 0, 1, 1.025, 0, 345, 1, 1.1, 0.9],
            [4, 1, 0, 0, 0, 0, 1, 1, 0, 345, 1, 1.1, 0.9],
            [5, 1, 125, 50, 0, 0, 1, 1, 0, 345, 1, 1.1, 0.9],
            [6, 1, 90, 30, 0, 0, 1, 1, 0, 345, 1, 1.1, 0.9],
            [7, 1, 0, 0, 0, 0, 1, 1, 0, 345, 1, 1.1, 0.9],
            [8, 1, 100, 0, 0, 0, 1, 1, 0, 345, 1, 1.1, 0.9],
            [9, 1, 0, 0, 0, 0, 1, 1, 0, 345, 1, 1.1, 0.9],
        ],
        dtype=float,
    )
    bus[:, 2:4] *= scale
    gen = np.array(
        [
            [1, 0, 0, 300, -300, 1.04, base, 1, 250, 10],
            [2, 163, 0, 300, -300, 1.025, base, 1, 300, 10],
        ],
        dtype=float,
    )
    gen[:, 1:3] *= scale
    branches = np.array(
        [
            [1, 4, 0, 0.0576, 0, 250, 250, 250, 0, 0, 1, -360, 360],
            [4, 5, 0.017, 0.092, 0.158, 250, 250, 250, 0, 0, 1, -360, 360],
            [5, 6, 0.039, 0.170, 0.358, 150, 150, 150, 0, 0, 1, -360, 360],
            [3, 6, 0, 0.0586, 0, 300, 300, 300, 0, 0, 1, -360, 360],
            [6, 7, 0.0119, 0.1008, 0.209, 150, 150, 150, 0, 0, 1, -360, 360],
            [7, 8, 0.0085, 0.072, 0.149, 250, 250, 250, 0, 0, 1, -360, 360],
            [8, 2, 0, 0.0625, 0, 250, 250, 250, 0, 0, 1, -360, 360],
            [8, 9, 0.032, 0.161, 0.306, 250, 250, 250, 0, 0, 1, -360, 360],
            [9, 4, 0.01, 0.085, 0.176, 250, 250, 250, 0, 0, 1, -360, 360],
        ],
        dtype=float,
    )
    ybus = np.zeros((9, 9), dtype=complex)
    for row in branches:
        f, t = int(row[0]) - 1, int(row[1]) - 1
        y, ysh = 1 / complex(row[2], row[3]), 1j * row[4] / 2
        ybus[f, f] += y + ysh
        ybus[t, t] += y + ysh
        ybus[f, t] -= y
        ybus[t, f] -= y
    ybus += np.diag((bus[:, 4] + 1j * bus[:, 5]) / base)
    pd, qd = bus[:, 2] / base, bus[:, 3] / base
    pg, qg = np.zeros(9), np.zeros(9)
    pg[[0, 1]] = gen[:, 1] / base
    qg[[0, 1]] = gen[:, 2] / base
    s3 = (85.0 - 1j * 10.94) * scale / base
    pg[2], qg[2] = s3.real, s3.imag
    v = bus[:, 7] * np.exp(1j * bus[:, 8] * np.pi / 180.0)
    pvpq = np.flatnonzero(bus[:, 1] != 3)
    pq = np.flatnonzero(bus[:, 1] == 1)
    x0 = np.r_[np.angle(v[pvpq]), np.abs(v[pq])]

    def mismatch(x):
        va, vm = np.angle(v).copy(), np.abs(v).copy()
        va[pvpq] = x[: len(pvpq)]
        vm[pq] = x[len(pvpq) :]
        trial = vm * np.exp(1j * va)
        s = trial * np.conj(ybus @ trial)
        return np.r_[pg[pvpq] - pd[pvpq] - s[pvpq].real, qg[pq] - qd[pq] - s[pq].imag]

    pf = root(mismatch, x0, method="hybr", options={"xtol": 1e-12, "maxfev": 3000})
    mismatch_inf = float(np.linalg.norm(mismatch(pf.x), np.inf))
    if not np.all(np.isfinite(pf.x)) or not np.isfinite(mismatch_inf) or mismatch_inf > 1e-8:
        raise ValueError(
            f"9-bus power flow did not converge (recomputed mismatch ||F||inf={mismatch_inf:.3g})."
        )
    v[pvpq] = np.abs(v[pvpq]) * np.exp(1j * pf.x[: len(pvpq)])
    v[pq] = pf.x[len(pvpq) :] * np.exp(1j * np.angle(v[pq]))
    s_pf = v * np.conj(ybus @ v)
    port_index = np.array([0, 1, 2, 7])
    load_index = np.array([3, 4, 5, 6, 8])
    pd_net, qd_net = pd.copy(), qd.copy()
    pd_net[7] = qd_net[7] = 0.0
    ynet = ybus + np.diag(np.conj(pd_net + 1j * qd_net) / np.abs(v) ** 2)
    yll = ynet[np.ix_(load_index, load_index)]
    if np.linalg.cond(yll) > 1e12:
        raise ValueError("Reduced 9-bus network load block is ill-conditioned.")
    yeq = ynet[np.ix_(port_index, port_index)] - ynet[
        np.ix_(port_index, load_index)
    ] @ np.linalg.solve(yll, ynet[np.ix_(load_index, port_index)])
    vp = v[port_index]
    ip_gen = np.array(
        [
            np.conj((s_pf[0] + pd[0] + 1j * qd[0]) / vp[0]),
            np.conj((s_pf[1] + pd[1] + 1j * qd[1]) / vp[1]),
            np.conj(s3 / vp[2]),
        ]
    )
    ip_dc = np.conj((-pd[7] - 1j * qd[7]) / vp[3])
    ipf = np.r_[ip_gen, ip_dc]
    return {
        "V": v,
        "Yeq": yeq,
        "Vp": vp,
        "Ip": ipf,
        "S3": s3,
        "pf_mismatch_inf": mismatch_inf,
        "base_mva": base,
        "scale": scale,
    }


def _pack_v(v: np.ndarray) -> np.ndarray:
    out = np.empty(2 * len(v))
    out[0::2], out[1::2] = np.real(v), np.imag(v)
    return out


def _unpack_v(v: np.ndarray) -> np.ndarray:
    v = np.asarray(v, dtype=float)
    return v[0::2] + 1j * v[1::2]


def _dae_rhs(
    t, y, nx_sm, nx_gfm, nx_gfl, nx_dc, sm, gfm, gfl, dc, refs_sm, refs_gfm, refs_gfl, refs_dc, net
):
    nx = nx_sm + nx_gfm + nx_gfl + nx_dc
    x = np.asarray(y[:nx], dtype=float)
    vp = _unpack_v(y[nx:])
    omega_sm = x[1]
    rt = deepcopy(refs_dc)
    dx1, i1, _ = sm_port_model(t, x[:nx_sm], vp[0], sm, refs_sm["pref"])
    dx1 = dx1.copy()
    dx1[0] = 0.0
    i = nx_sm
    dx2, i2, _ = gfm_port_model(
        t,
        x[i : i + nx_gfm],
        vp[1],
        gfm,
        refs_gfm["pref0"],
        refs_gfm["qref0"],
        refs_gfm["ome_ref0"],
        refs_gfm["v_ref0"],
        omega_sm,
    )
    i += nx_gfm
    dx3, i3, _ = gfl_port_model(
        t, x[i : i + nx_gfl], vp[2], gfl, refs_gfl["pref0"], refs_gfl["qref0"], omega_sm
    )
    i += nx_gfl
    dx4, i4, _ = datacenter_port_model(t, x[i : i + nx_dc], vp[3], dc, rt, omega_sm)
    g = np.array([i1, i2, i3, i4]) - net["Yeq"] @ vp
    return np.r_[dx1, dx2, dx3, dx4, -np.real(g), -np.imag(g)]


def _port_powers(vp: np.ndarray, yeq: np.ndarray) -> np.ndarray:
    # Generator port injections are positive; the data-center port is shown as
    # consumed power to match the supplied case9 plotting convention.
    power = np.real(vp * np.conj(yeq @ vp))
    return power * np.array([1.0, 1.0, 1.0, -1.0])


def run_grid_network(config: dict[str, float]) -> dict[str, object]:
    scale = config["load_scale"]
    fb = 60.0
    net = _power_flow(scale)
    sm, gfm, gfl, dc = _sm_params(fb), _gfm_params(fb), _gfl_params(100.0, fb), _dc_params(fb)
    xsm, sm, refs_sm, _ = sm_init_from_pf_fsolve(net["Vp"][0], net["Ip"][0], sm)
    xgfm, refs_gfm = gfm_init_from_pf_qss_newton(net["Vp"][1], net["Ip"][1], gfm)
    xgfl, gfl, refs_gfl, info_gfl = gfl_init_from_pf_qss_newton(net["Vp"][2], net["Ip"][2], gfl)
    xdc, refs_dc, info_dc = datacenter_init_from_pf_qss(net["Vp"][3], net["Ip"][3], dc)
    residual_sm = float(
        np.linalg.norm(sm_port_model(0.0, xsm, net["Vp"][0], sm, refs_sm["pref"])[0], np.inf)
    )
    residual_gfm = float(
        np.linalg.norm(
            gfm_port_model(
                0.0,
                xgfm,
                net["Vp"][1],
                gfm,
                refs_gfm["pref0"],
                refs_gfm["qref0"],
                refs_gfm["ome_ref0"],
                refs_gfm["v_ref0"],
            )[0],
            np.inf,
        )
    )
    residual_gfl = float(
        np.linalg.norm(
            gfl_port_model(0.0, xgfl, net["Vp"][2], gfl, refs_gfl["pref0"], refs_gfl["qref0"])[0],
            np.inf,
        )
    )
    residual_dc = float(
        np.linalg.norm(
            qss_equations(
                np.r_[xdc, refs_dc["p_load"], refs_dc["B_shunt"]], net["Vp"][3], -net["Ip"][3], dc
            ),
            np.inf,
        )
    )
    init_residuals = {
        "synchronous_machine": residual_sm,
        "grid_forming_inverter": residual_gfm,
        "grid_following_inverter": residual_gfl,
        "data_center": residual_dc,
    }
    if any(not np.isfinite(value) or value >= 1e-5 for value in init_residuals.values()):
        raise ValueError(
            "Case-9 device initialization failed its recomputed residual checks: "
            + repr(init_residuals)
        )
    lengths = list(map(len, (xsm, xgfm, xgfl, xdc)))
    nx = sum(lengths)
    x0 = np.r_[xsm, xgfm, xgfl, xdc]
    y0 = np.r_[x0, _pack_v(net["Vp"])]
    refs = (refs_sm, refs_gfm, refs_gfl, refs_dc)
    models = (sm, gfm, gfl, dc)
    args = (*lengths, *models, *refs, {"Yeq": net["Yeq"]})
    residual_y0 = _dae_rhs(0.0, y0, *args)
    residual_alg = float(np.linalg.norm(residual_y0[nx:], np.inf))
    if not np.isfinite(residual_alg) or residual_alg >= 1e-5:
        raise ValueError(
            f"Case-9 network algebraic initialization failed (||g||inf={residual_alg:.3g})."
        )

    eps = 1e-7
    jac = np.empty((len(y0), len(y0)))
    f0 = residual_y0
    for k in range(len(y0)):
        shifted = y0.copy()
        shifted[k] += eps
        jac[:, k] = (_dae_rhs(0.0, shifted, *args) - f0) / eps
    am, bm = jac[:nx, :nx], jac[:nx, nx:]
    cm, dm = jac[nx:, :nx], jac[nx:, nx:]
    cond_dm = float(np.linalg.cond(dm))
    if not np.isfinite(cond_dm) or cond_dm > 1e12:
        raise ValueError(
            f"Case-9 algebraic Jacobian is ill-conditioned (condition number {cond_dm:.3g})."
        )
    asys = am - bm @ np.linalg.solve(dm, cm)
    asys_red = asys[1:, 1:]  # remove the synchronous-machine angle reference

    perturbed_refs = list(refs)
    dc_perturbed = dict(refs_dc)
    dc_perturbed["p_load"] += eps
    perturbed_refs[3] = dc_perturbed
    fu = _dae_rhs(0.0, y0, *(*lengths, *models, *perturbed_refs, {"Yeq": net["Yeq"]}))
    fu = (fu - f0) / eps
    em, ealg = fu[:nx], fu[nx:]
    bsys = em - bm @ np.linalg.solve(dm, ealg)

    h = np.empty((4, len(y0) - nx))
    v0 = _unpack_v(y0[nx:])
    p0 = _port_powers(v0, net["Yeq"])
    for j in range(2 * len(v0)):
        shifted = y0[nx:].copy()
        shifted[j] += eps
        h[:, j] = (_port_powers(_unpack_v(shifted), net["Yeq"]) - p0) / eps
    csys = -h @ np.linalg.solve(dm, cm)
    dsys = -h @ np.linalg.solve(dm, ealg)
    # The supplied workflow fixes the synchronous-machine angle as its frame
    # reference by selecting the lower-right state submatrix. Its perturbation
    # must be removed from the matching input/output matrices as well.
    bsys_red = bsys[1:]
    csys_red = csys[:, 1:]

    # Check the signs in the Schur-reduced algebraic input term against a
    # separately solved perturbed network voltage at fixed dynamic states.
    def algebraic_at_voltage(packed_voltage):
        trial_y = np.r_[x0, packed_voltage]
        return _dae_rhs(0.0, trial_y, *(*lengths, *models, *perturbed_refs, {"Yeq": net["Yeq"]}))[
            nx:
        ]

    vpert = root(
        algebraic_at_voltage,
        _pack_v(net["Vp"]),
        method="hybr",
        options={"xtol": 1e-11, "maxfev": 500},
    )
    alg_pert_resid = float(np.linalg.norm(algebraic_at_voltage(vpert.x), np.inf))
    if not np.all(np.isfinite(vpert.x)) or alg_pert_resid > 1e-8:
        raise ValueError(
            f"Perturbed Case-9 algebraic network solve failed (||g||inf={alg_pert_resid:.3g})."
        )
    direct_fd = (_port_powers(_unpack_v(vpert.x), net["Yeq"]) - p0) / eps
    direct_error = float(
        np.max(np.abs(direct_fd - dsys)) / max(1.0, float(np.max(np.abs(direct_fd))))
    )
    if not np.isfinite(direct_error) or direct_error > 1e-4:
        raise ValueError(
            f"Case-9 Schur-reduced feedthrough sign/derivative check failed (relative error {direct_error:.3g})."
        )
    eigenvalues, left, right = eig(asys_red, left=True, right=True, check_finite=True)
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
            f"Case-9 modal eigenvectors are ill-conditioned (condition number {eig_cond:.3g})."
        )
    right_residual = float(np.linalg.norm(asys_red @ right - right * eigenvalues[None, :], np.inf))
    left_residual = float(
        np.linalg.norm(asys_red.T @ left - left * np.conj(eigenvalues)[None, :], np.inf)
    )
    residual_limit = 1e-5 * max(1.0, float(np.linalg.norm(asys_red, np.inf)))
    if max(right_residual, left_residual) > residual_limit:
        raise ValueError("Case-9 left/right eigenvector residual check failed.")
    participation = np.abs(right * np.conj(left))
    for k in range(participation.shape[1]):
        norm = float(np.sum(participation[:, k]))
        if not np.isfinite(norm) or norm < 1e-14:
            raise ValueError("Case-9 modal participation normalization failed.")
        participation[:, k] /= norm
    state_groups = [
        ("Synchronous machine", range(0, lengths[0] - 1)),
        ("Grid-forming inverter", range(lengths[0] - 1, lengths[0] - 1 + lengths[1])),
        (
            "Grid-following inverter",
            range(lengths[0] - 1 + lengths[1], lengths[0] - 1 + lengths[1] + lengths[2]),
        ),
        ("Data center", range(lengths[0] - 1 + lengths[1] + lengths[2], asys_red.shape[0])),
    ]
    mode_list = []
    for k, lam in enumerate(eigenvalues):
        scores = [(name, float(np.sum(participation[list(idx), k]))) for name, idx in state_groups]
        real, imag = float(lam.real), float(lam.imag)
        magnitude = float(abs(lam))
        mode_list.append(
            {
                "real": real,
                "imag": imag,
                "frequency_hz": abs(imag) / (2 * np.pi),
                "damping": -real / magnitude if magnitude > 1e-12 else None,
                "dominant_state": max(scores, key=lambda item: item[1])[0],
                "stable": real <= 1e-8,
            }
        )

    freq = np.logspace(-1.0, 3.0, 160)
    identity = np.eye(asys_red.shape[0])
    poa = np.empty((4, len(freq)))
    for k, f in enumerate(freq):
        transfer = (
            csys_red @ np.linalg.solve(1j * 2 * np.pi * f * identity - asys_red, bsys_red) + dsys
        )
        poa[:, k] = np.abs(transfer)
    if not np.all(np.isfinite(poa)):
        raise ValueError("Case-9 POA response contains non-finite values.")
    labels = [
        "Synchronous machine",
        "Grid-forming inverter",
        "Grid-following inverter",
        "Data-center load",
    ]
    colors = ["#2563eb", "#059669", "#d97706", "#7c3aed"]
    peaks = [int(np.argmax(row)) for row in poa]
    bus_mag = np.abs(net["V"])
    bus_ang = np.angle(net["V"]) * 180.0 / np.pi
    return {
        "study_id": "grid-network",
        "model": "Supplied modified IEEE 9-bus network with synchronous machine, GFM, GFL, and 21-state data-center port",
        "config": dict(config),
        "solver": {
            "method": "SciPy hybrid power flow; supplied nonlinear device initializers; algebraic Schur reduction; SciPy left/right eig",
            "power_flow_mismatch_inf": net["pf_mismatch_inf"],
            "device_residual_tolerance_inf": 1e-5,
            "poa_frequency_points": len(freq),
        },
        "assumptions": [
            "The 9-bus load, generator, and branch data follow the supplied case9.py variant; scale multiplies its listed loads and generator setpoints.",
            "The supplied case9-specific data-center controller parameters are retained; they differ from the archive's standalone defaults.",
            "The dynamic reduction removes the synchronous-machine angle reference state, as in the supplied case9 workflow.",
            "Only power flow, device initialization, modal analysis, and POA are implemented here. GPU_data.csv was absent, so measured-profile time simulation is not included.",
            "Positive power for the data-center port is reported as consumption; the other three ports use positive network injection.",
        ],
        "metrics": [
            {
                "label": "Recomputed power-flow mismatch infinity norm",
                "value": net["pf_mismatch_inf"],
                "unit": "pu",
            },
            {
                "label": "Recomputed network algebraic current residual infinity norm",
                "value": residual_alg,
                "unit": "pu",
            },
            {
                "label": "Algebraic Jacobian condition number",
                "value": cond_dm,
                "unit": "condition ratio",
            },
            {
                "label": "Modal right-eigenvector condition number",
                "value": eig_cond,
                "unit": "condition ratio",
            },
            {
                "label": "Unstable linearized modes",
                "value": float(sum(not mode["stable"] for mode in mode_list)),
                "unit": "modes",
            },
            *[
                {
                    "label": f"{label}: largest sampled POA",
                    "value": float(poa[i, peaks[i]]),
                    "unit": "pu/pu",
                }
                for i, label in enumerate(labels)
            ],
            *[
                {
                    "label": f"{label}: peak sampled frequency",
                    "value": float(freq[peaks[i]]),
                    "unit": "Hz",
                }
                for i, label in enumerate(labels)
            ],
        ],
        "charts": [
            {
                "id": "grid-poa",
                "title": "Four-port small-signal load-to-port response",
                "x_label": "Frequency (Hz)",
                "y_label": "Magnitude (pu/pu)",
                "x": freq.tolist(),
                "lines": [
                    {"label": labels[i], "values": poa[i].tolist(), "color": colors[i]}
                    for i in range(4)
                ],
            }
        ],
        "modes": mode_list,
        "diagnostics": {
            "bus_voltage_magnitude_pu": bus_mag.tolist(),
            "bus_voltage_angle_deg": bus_ang.tolist(),
            "port_voltage": [{"real": float(v.real), "imag": float(v.imag)} for v in net["Vp"]],
            "device_initialization_residuals_inf": init_residuals,
            "network_algebraic_residual_inf": residual_alg,
            "algebraic_jacobian_condition_number": cond_dm,
            "schur_feedthrough_fd_relative_error": direct_error,
            "right_eigenvector_residual_inf": right_residual,
            "left_eigenvector_residual_inf": left_residual,
            "eigenvector_condition_number": eig_cond,
            "pcc_power_at_initialization_pu": p0.tolist(),
            "state_count_before_angle_reference_removal": nx,
            "state_count_after_angle_reference_removal": asys_red.shape[0],
            "eigenvalues": [
                {
                    "real": mode["real"],
                    "imag": mode["imag"],
                    "frequency_hz": mode["frequency_hz"],
                    "damping": mode["damping"],
                }
                for mode in mode_list
            ],
            "poa_peak_grid_indices": peaks,
        },
    }
