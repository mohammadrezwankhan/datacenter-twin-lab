# Adapted from user-supplied python_equivalent archive (SHA-256 c467c157d39a2f36b2951a2a073b01d536c459ea653de5b28785c1b3e1a56cab). The supplied README maps these equations to MATLAB source, but neither MATLAB originals nor the GPU measurement trace were supplied; no MATLAB/measurement validation is claimed.
"""Python equivalent of datacenter_port_model.m."""
from __future__ import annotations
import numpy as np


def datacenter_core_equations(x, Vport, dc, p_load, omega_sys):
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
        iU_cv,
        iV_cv,
        vU_vsi,
        vV_vsi,
        xiU_vsi,
        xiV_vsi,
        gamU_vsi,
        gamV_vsi,
        v_psu,
        xi_psu,
        v_eq,
        xi_eq,
    ) = x

    vdc_ups_safe = max(vdc_ups, 1e-6)
    v_psu_safe = max(v_psu, 1e-6)
    veq_ref_safe = max(dc.veq_ref, 1e-6)
    vr_pcc, vi_pcc = np.real(Vport), np.imag(Vport)

    g_load = p_load / (3.0 * veq_ref_safe**2)
    i_eq = dc.kp_v_eq * (dc.veq_ref - v_eq) + dc.ki_v_eq * xi_eq
    i_psu = (v_eq / v_psu_safe) * i_eq

    g_eq = dc.kp_v_psu * (dc.vpsu_ref - v_psu) + dc.ki_v_psu * xi_psu
    iU_vsi = g_eq * vU_vsi
    iV_vsi = g_eq * vV_vsi
    vuv_sq = vU_vsi**2 + vV_vsi**2
    psu_injection_term = ((g_eq - dc.r_psu * g_eq**2) * vuv_sq) / (3.0 * v_psu_safe)

    vU_ref_vsi, vV_ref_vsi = dc.vu_vsi_ref, 0.0
    iU_ref_cv = (
        dc.kp_v_vsi * (vU_ref_vsi - vU_vsi)
        + dc.ki_v_vsi * xiU_vsi
        - dc.omega_vsi * dc.c_vsi * vV_vsi
    )
    iV_ref_cv = (
        dc.kp_v_vsi * (vV_ref_vsi - vV_vsi)
        + dc.ki_v_vsi * xiV_vsi
        + dc.omega_vsi * dc.c_vsi * vU_vsi
    )
    vU_ref_cv = (
        dc.kp_c_vsi * (iU_ref_cv - iU_cv) + dc.ki_c_vsi * gamU_vsi - dc.omega_vsi * dc.l_vsi * iV_cv
    )
    vV_ref_cv = (
        dc.kp_c_vsi * (iV_ref_cv - iV_cv) + dc.ki_c_vsi * gamV_vsi + dc.omega_vsi * dc.l_vsi * iU_cv
    )
    mU, mV = vU_ref_cv / vdc_ups_safe, vV_ref_cv / vdc_ups_safe

    omega_pll = dc.omega_s + dc.kp_pll * vq_pll_f + dc.ki_pll * eps_pll
    s, c = np.sin(theta_pll + np.pi / 2), np.cos(theta_pll + np.pi / 2)
    ir_pcc = s * id_afe + c * iq_afe
    ii_pcc = -c * id_afe + s * iq_afe
    I_afe_in = ir_pcc + 1j * ii_pcc
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
    i_dc_out = mU * iU_cv + mV * iV_cv

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
        mU * vdc_ups - vU_vsi - dc.r_vsi * iU_cv + dc.omega_vsi * dc.l_vsi * iV_cv
    )
    xdot[10] = (dc.omega_b / dc.l_vsi) * (
        mV * vdc_ups - vV_vsi - dc.r_vsi * iV_cv - dc.omega_vsi * dc.l_vsi * iU_cv
    )
    xdot[11] = (dc.omega_b / dc.c_vsi) * (iU_cv - iU_vsi + dc.omega_vsi * dc.c_vsi * vV_vsi)
    xdot[12] = (dc.omega_b / dc.c_vsi) * (iV_cv - iV_vsi - dc.omega_vsi * dc.c_vsi * vU_vsi)
    xdot[13] = vU_ref_vsi - vU_vsi
    xdot[14] = vV_ref_vsi - vV_vsi
    xdot[15] = iU_ref_cv - iU_cv
    xdot[16] = iV_ref_cv - iV_cv
    xdot[17] = (dc.omega_b / dc.c_psu) * (psu_injection_term - i_psu)
    xdot[18] = dc.vpsu_ref - v_psu
    xdot[19] = (dc.omega_b / dc.c_eq) * (i_eq - g_load * v_eq)
    xdot[20] = dc.veq_ref - v_eq

    p_pcc = vr_pcc * ir_pcc + vi_pcc * ii_pcc
    return xdot, I_afe_in, p_pcc


def datacenter_port_model(t, x, Vport, dc, refs, omega_sys=None):
    if omega_sys is None:
        omega_sys = 1.0
    p_load_ref = refs["p_load"] if isinstance(refs, dict) else refs.p_load
    B_shunt = refs["B_shunt"] if isinstance(refs, dict) else refs.B_shunt
    p_load_val = p_load_ref(t) if callable(p_load_ref) else p_load_ref
    xdot, I_afe_in, p_pcc = datacenter_core_equations(x, Vport, dc, p_load_val, omega_sys)
    I_shunt_in = 1j * B_shunt * Vport
    I_total_in = I_afe_in + I_shunt_in
    Iport = -I_total_in
    aux = dict(p_load=p_load_val, p_pcc=p_pcc, I_afe=I_afe_in)
    return xdot, Iport, aux
