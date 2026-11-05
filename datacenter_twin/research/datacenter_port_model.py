# Adapted from user-supplied python_equivalent archive (SHA-256
# c467c157d39a2f36b2951a2a073b01d536c459ea653de5b28785c1b3e1a56cab). The supplied README maps
# these equations to MATLAB source, but neither MATLAB originals nor the GPU measurement trace
# were supplied; no MATLAB/measurement validation is claimed.
"""Python equivalent of datacenter_port_model.m."""

from __future__ import annotations

from types import SimpleNamespace

import numpy as np

from .types import Complex, DCReferences, FloatArray, Real


def datacenter_core_equations(
    x: FloatArray,
    vport: Complex,
    dc: SimpleNamespace,
    p_load: Real,
    omega_sys: Real,
) -> tuple[FloatArray, Complex, Real]:
    x = np.asarray(x, dtype=float).reshape(-1)
    (
        theta_pll,
        eps_pll,
        vq_pll_f,
        id_afe,
        iq_afe,
        xi_dc_afe,
        gamd_afe,
        gamq_afe,
        vdc_ups,
        i_u_cv,
        i_v_cv,
        v_u_vsi,
        v_v_vsi,
        xi_u_vsi,
        xi_v_vsi,
        gam_u_vsi,
        gam_v_vsi,
        v_psu,
        xi_psu,
        v_eq,
        xi_eq,
    ) = x

    vdc_ups_safe = max(vdc_ups, 1e-6)
    v_psu_safe = max(v_psu, 1e-6)
    veq_ref_safe = max(dc.veq_ref, 1e-6)
    vr_pcc, vi_pcc = np.real(vport), np.imag(vport)

    g_load = p_load / (3.0 * veq_ref_safe**2)
    i_eq = dc.kp_v_eq * (dc.veq_ref - v_eq) + dc.ki_v_eq * xi_eq
    i_psu = (v_eq / v_psu_safe) * i_eq

    g_eq = dc.kp_v_psu * (dc.vpsu_ref - v_psu) + dc.ki_v_psu * xi_psu
    i_u_vsi = g_eq * v_u_vsi
    i_v_vsi = g_eq * v_v_vsi
    vuv_sq = v_u_vsi**2 + v_v_vsi**2
    psu_injection_term = ((g_eq - dc.r_psu * g_eq**2) * vuv_sq) / (3.0 * v_psu_safe)

    v_u_ref_vsi, v_v_ref_vsi = dc.vu_vsi_ref, 0.0
    i_u_ref_cv = (
        dc.kp_v_vsi * (v_u_ref_vsi - v_u_vsi)
        + dc.ki_v_vsi * xi_u_vsi
        - dc.omega_vsi * dc.c_vsi * v_v_vsi
    )
    i_v_ref_cv = (
        dc.kp_v_vsi * (v_v_ref_vsi - v_v_vsi)
        + dc.ki_v_vsi * xi_v_vsi
        + dc.omega_vsi * dc.c_vsi * v_u_vsi
    )
    v_u_ref_cv = (
        dc.kp_c_vsi * (i_u_ref_cv - i_u_cv)
        + dc.ki_c_vsi * gam_u_vsi
        - dc.omega_vsi * dc.l_vsi * i_v_cv
    )
    v_v_ref_cv = (
        dc.kp_c_vsi * (i_v_ref_cv - i_v_cv)
        + dc.ki_c_vsi * gam_v_vsi
        + dc.omega_vsi * dc.l_vsi * i_u_cv
    )
    m_u, m_v = v_u_ref_cv / vdc_ups_safe, v_v_ref_cv / vdc_ups_safe

    omega_pll = dc.omega_s + dc.kp_pll * vq_pll_f + dc.ki_pll * eps_pll
    s, c = np.sin(theta_pll + np.pi / 2), np.cos(theta_pll + np.pi / 2)
    ir_pcc = s * id_afe + c * iq_afe
    ii_pcc = -c * id_afe + s * iq_afe
    i_afe_in = ir_pcc + 1j * ii_pcc
    vd_pcc = s * vr_pcc - c * vi_pcc
    vq_pcc = c * vr_pcc + s * vi_pcc

    id_ref_afe = dc.kp_dc_afe * (dc.vdc_ups_ref - vdc_ups) + dc.ki_dc_afe * xi_dc_afe
    iq_ref_afe = 0.0
    vd_ref_afe = (
        dc.kp_c_afe * (id_afe - id_ref_afe) + dc.ki_c_afe * gamd_afe + omega_pll * dc.l_afe * iq_afe
    )
    vq_ref_afe = (
        dc.kp_c_afe * (iq_afe - iq_ref_afe) + dc.ki_c_afe * gamq_afe - omega_pll * dc.l_afe * id_afe
    )
    md, mq = vd_ref_afe / vdc_ups_safe, vq_ref_afe / vdc_ups_safe
    i_dc_in = md * id_afe + mq * iq_afe
    i_dc_out = m_u * i_u_cv + m_v * i_v_cv

    xdot = np.zeros(21)
    xdot[0] = dc.omega_b * (omega_pll - omega_sys)
    xdot[1] = vq_pll_f
    xdot[2] = dc.omega_lp * (vq_pcc - vq_pll_f)
    xdot[3] = (dc.omega_b / dc.l_afe) * (
        vd_pcc - md * vdc_ups - dc.r_afe * id_afe + omega_pll * dc.l_afe * iq_afe
    )
    xdot[4] = (dc.omega_b / dc.l_afe) * (
        vq_pcc - mq * vdc_ups - dc.r_afe * iq_afe - omega_pll * dc.l_afe * id_afe
    )
    xdot[5] = dc.vdc_ups_ref - vdc_ups
    xdot[6] = id_afe - id_ref_afe
    xdot[7] = iq_afe - iq_ref_afe
    xdot[8] = (dc.omega_b / dc.c_dc) * (i_dc_in - i_dc_out)
    xdot[9] = (dc.omega_b / dc.l_vsi) * (
        m_u * vdc_ups - v_u_vsi - dc.r_vsi * i_u_cv + dc.omega_vsi * dc.l_vsi * i_v_cv
    )
    xdot[10] = (dc.omega_b / dc.l_vsi) * (
        m_v * vdc_ups - v_v_vsi - dc.r_vsi * i_v_cv - dc.omega_vsi * dc.l_vsi * i_u_cv
    )
    xdot[11] = (dc.omega_b / dc.c_vsi) * (i_u_cv - i_u_vsi + dc.omega_vsi * dc.c_vsi * v_v_vsi)
    xdot[12] = (dc.omega_b / dc.c_vsi) * (i_v_cv - i_v_vsi - dc.omega_vsi * dc.c_vsi * v_u_vsi)
    xdot[13] = v_u_ref_vsi - v_u_vsi
    xdot[14] = v_v_ref_vsi - v_v_vsi
    xdot[15] = i_u_ref_cv - i_u_cv
    xdot[16] = i_v_ref_cv - i_v_cv
    xdot[17] = (dc.omega_b / dc.c_psu) * (psu_injection_term - i_psu)
    xdot[18] = dc.vpsu_ref - v_psu
    xdot[19] = (dc.omega_b / dc.c_eq) * (i_eq - g_load * v_eq)
    xdot[20] = dc.veq_ref - v_eq

    p_pcc = vr_pcc * ir_pcc + vi_pcc * ii_pcc
    return xdot, i_afe_in, p_pcc


def datacenter_port_model(
    t: float,
    x: FloatArray,
    vport: Complex,
    dc: SimpleNamespace,
    refs: DCReferences | SimpleNamespace,
    omega_sys: Real | None = None,
) -> tuple[FloatArray, Complex, dict[str, Real | Complex]]:
    if omega_sys is None:
        omega_sys = 1.0
    p_load_ref = refs["p_load"] if isinstance(refs, dict) else refs.p_load
    b_shunt = refs["B_shunt"] if isinstance(refs, dict) else refs.B_shunt
    p_load_val = p_load_ref(t) if callable(p_load_ref) else p_load_ref
    xdot, i_afe_in, p_pcc = datacenter_core_equations(x, vport, dc, p_load_val, omega_sys)
    i_shunt_in = 1j * b_shunt * vport
    i_total_in = i_afe_in + i_shunt_in
    iport = -i_total_in
    aux = {"p_load": p_load_val, "p_pcc": p_pcc, "I_afe": i_afe_in}
    return xdot, iport, aux
