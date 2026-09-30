# Adapted from user-supplied python_equivalent archive (SHA-256 c467c157d39a2f36b2951a2a073b01d536c459ea653de5b28785c1b3e1a56cab). The supplied README maps these equations to MATLAB source, but neither MATLAB originals nor the GPU measurement trace were supplied; no MATLAB/measurement validation is claimed.
"""Supplied paired full-abc / reduced-uv model equations.

This module retains the parameter builder and 62-state derivative function
from the user's ``ModelValidation.py`` equivalent. Its original standalone
workflow uses explicit Heun with a 5 microsecond step. The interactive lesson
uses a separately documented, bounded BDF window; the archive did not include
the MATLAB original or measured GPU trace for independent comparison.
"""
from __future__ import annotations
import numpy as np
from .common import pi_bw_tuning, pll_bw_tuning, safe_div


def build_params():
    wb = 2 * np.pi * 60
    omega_s = 1.0
    omega_lp = 2 * np.pi * 100
    Vinf = 1.0
    Rinf = 0.02
    Xinf = 0.19
    l_afe = 0.05
    r_afe = 0.003
    c_dc = 2.0
    vdc_ups_ref = 1.0
    l_vsi = 0.05
    r_vsi = 0.003
    c_vsi = 0.2
    vu_vsi_ref = 1.0
    l_psu = 0.05
    c_psu = 2.0
    r_psu = 0.005
    v_psu_ref = 1.0
    l_eq = 0.05
    c_eq = 0.2
    v_eq_ref = 0.5
    kp_pll, ki_pll = pll_bw_tuning(20.0, 0.707)
    kp_dc_afe, ki_dc_afe = pi_bw_tuning("v", 5.0, 1.0, c_dc, wb, 0)
    kp_c_afe, ki_c_afe = pi_bw_tuning("c", 200.0, 0.707, l_afe, wb, r_afe)
    kp_v_vsi, ki_v_vsi = pi_bw_tuning("v", 100.0, 1.0, c_vsi, wb, 0)
    kp_c_vsi, ki_c_vsi = pi_bw_tuning("c", 400.0, 1.0, l_vsi, wb, r_vsi)
    kp_v_psu, ki_v_psu = pi_bw_tuning("v", 10.0, 1.0, c_psu, wb, 0)
    kp_c_psu, ki_c_psu = pi_bw_tuning("c", 1000.0, 1.0, l_psu, wb, r_psu)
    kp_v_eq, ki_v_eq = pi_bw_tuning("v", 100.0, 1.0, c_eq, wb, 0)
    kp_c_eq, ki_c_eq = pi_bw_tuning("c", 1000.0, 1.0, l_eq, wb, 0)
    return dict(locals())


def get_sys_derivatives(t, X, p_load, p):
    X = np.asarray(X, float).reshape(-1)
    dX = np.zeros(62)
    wb = p["wb"]
    omega_s = p["omega_s"]
    omega_lp = p["omega_lp"]
    Vinf = p["Vinf"]
    Rinf = p["Rinf"]
    Xinf = p["Xinf"]
    l_afe = p["l_afe"]
    r_afe = p["r_afe"]
    c_dc = p["c_dc"]
    vdc_ups_ref = p["vdc_ups_ref"]
    l_vsi = p["l_vsi"]
    r_vsi = p["r_vsi"]
    c_vsi = p["c_vsi"]
    vu_vsi_ref = p["vu_vsi_ref"]
    l_psu = p["l_psu"]
    c_psu = p["c_psu"]
    r_psu = p["r_psu"]
    v_psu_ref = p["v_psu_ref"]
    l_eq = p["l_eq"]
    c_eq = p["c_eq"]
    v_eq_ref = p["v_eq_ref"]
    kp_pll = p["kp_pll"]
    ki_pll = p["ki_pll"]
    kp_dc_afe = p["kp_dc_afe"]
    ki_dc_afe = p["ki_dc_afe"]
    kp_c_afe = p["kp_c_afe"]
    ki_c_afe = p["ki_c_afe"]
    kp_v_vsi = p["kp_v_vsi"]
    ki_v_vsi = p["ki_v_vsi"]
    kp_c_vsi = p["kp_c_vsi"]
    ki_c_vsi = p["ki_c_vsi"]
    kp_v_psu = p["kp_v_psu"]
    ki_v_psu = p["ki_v_psu"]
    kp_c_psu = p["kp_c_psu"]
    ki_c_psu = p["ki_c_psu"]
    kp_v_eq = p["kp_v_eq"]
    ki_v_eq = p["ki_v_eq"]
    kp_c_eq = p["kp_c_eq"]
    ki_c_eq = p["ki_c_eq"]

    theta_vsi = wb * omega_s * t
    g_load = p_load / (3 * v_eq_ref**2)
    sq = np.sqrt(2 / 3)
    ang = np.array([theta_vsi, theta_vsi - 2 * np.pi / 3, theta_vsi + 2 * np.pi / 3])
    T_inv = sq * np.column_stack((np.cos(ang), -np.sin(ang)))
    T_fwd = sq * np.vstack((np.cos(ang), -np.sin(ang)))

    xA = X[:41]
    dXA = np.zeros(41)
    i_rec = xA[17:20]
    v_psu = xA[20:23]
    xi_psu = xA[23:26]
    gam_psu = xA[26:29]
    i_eq = xA[29:32]
    v_eq = xA[32:35]
    xi_eq = xA[35:38]
    gam_eq = xA[38:41]
    v_abc = T_inv @ np.array([xA[11], xA[12]])
    v_rec = np.sqrt(v_abc**2 + 1e-6)
    i_eq_ref = kp_v_eq * (v_eq_ref - v_eq) + ki_v_eq * xi_eq
    d_eq_unl = kp_c_eq * (i_eq_ref - i_eq) + ki_c_eq * gam_eq
    d_eq = np.clip(d_eq_unl, 0, 1.0)
    dgam_eq = i_eq_ref - i_eq
    dgam_eq[((d_eq_unl >= 1) & (dgam_eq > 0)) | ((d_eq_unl <= 0) & (dgam_eq < 0))] = 0
    dXA[29:32] = (wb / l_eq) * (d_eq * v_psu - v_eq)
    dXA[32:35] = (wb / c_eq) * (i_eq - g_load * v_eq)
    dXA[35:38] = v_eq_ref - v_eq
    dXA[38:41] = dgam_eq
    i_psu_ld = d_eq * i_eq
    g_eq_abc = kp_v_psu * (v_psu_ref - v_psu) + ki_v_psu * xi_psu
    i_ref_psu = g_eq_abc * v_rec
    d_psu_unl = kp_c_psu * (i_ref_psu - i_rec) + ki_c_psu * gam_psu
    d_psu = np.clip(d_psu_unl, 0, 0.99)
    dgam_psu = i_ref_psu - i_rec
    dgam_psu[((d_psu_unl >= 0.99) & (dgam_psu > 0)) | ((d_psu_unl <= 0) & (dgam_psu < 0))] = 0
    di_rec = (wb / l_psu) * (v_rec - (1 - d_psu) * v_psu - r_psu * i_rec)
    di_rec[(i_rec <= 0) & (di_rec < 0)] = 0
    dXA[17:20] = di_rec
    dXA[20:23] = (wb / c_psu) * ((1 - d_psu) * i_rec - i_psu_ld)
    dXA[23:26] = v_psu_ref - v_psu
    dXA[26:29] = dgam_psu
    rect_ratio = (v_abc / v_rec) * i_rec
    iU_A = float(T_fwd[0] @ rect_ratio)
    iV_A = float(T_fwd[1] @ rect_ratio)
    P_A = xA[11] * iU_A + xA[12] * iV_A

    xB = X[41:62]
    dXB = np.zeros(21)
    v_psu_uv = xB[17]
    xi_psu_uv = xB[18]
    v_eq_uv = xB[19]
    xi_eq_uv = xB[20]
    i_eq_qss = kp_v_eq * (v_eq_ref - v_eq_uv) + ki_v_eq * xi_eq_uv
    dXB[19] = (wb / c_eq) * (i_eq_qss - g_load * v_eq_uv)
    dXB[20] = v_eq_ref - v_eq_uv
    i_psu_ld_uv = (v_eq_uv / max(0.1, v_psu_uv)) * i_eq_qss
    g_eq_uv = kp_v_psu * (v_psu_ref - v_psu_uv) + ki_v_psu * xi_psu_uv
    norm_v_sq = xB[11] ** 2 + xB[12] ** 2
    dXB[17] = (wb / c_psu) * (
        (g_eq_uv - r_psu * g_eq_uv**2) * norm_v_sq / (3 * max(v_psu_uv, 1e-9)) - i_psu_ld_uv
    )
    dXB[18] = v_psu_ref - v_psu_uv
    iU_B = g_eq_uv * xB[11]
    iV_B = g_eq_uv * xB[12]
    P_B = xB[11] * iU_B + xB[12] * iV_B

    p_pcc = []
    for xs, iU_ld, iV_ld, dsub in ((xA, iU_A, iV_A, dXA), (xB, iU_B, iV_B, dXB)):
        iU_ref = kp_v_vsi * (vu_vsi_ref - xs[11]) + ki_v_vsi * xs[13] - omega_s * c_vsi * xs[12]
        iV_ref = kp_v_vsi * (0 - xs[12]) + ki_v_vsi * xs[14] + omega_s * c_vsi * xs[11]
        vU_ref = kp_c_vsi * (iU_ref - xs[9]) + ki_c_vsi * xs[15] - omega_s * l_vsi * xs[10]
        vV_ref = kp_c_vsi * (iV_ref - xs[10]) + ki_c_vsi * xs[16] + omega_s * l_vsi * xs[9]
        mU = safe_div(vU_ref, xs[8])
        mV = safe_div(vV_ref, xs[8])
        omega_pll = omega_s + kp_pll * xs[2] + ki_pll * xs[1]
        s = np.sin(xs[0] + np.pi / 2)
        c = np.cos(xs[0] + np.pi / 2)
        ir = s * xs[3] + c * xs[4]
        ii = -c * xs[3] + s * xs[4]
        vr = Vinf - Rinf * ir + Xinf * ii
        vi = -Rinf * ii - Xinf * ir
        vd = s * vr - c * vi
        vq = c * vr + s * vi
        p_pcc.append(vd * xs[3] + vq * xs[4])
        id_ref = kp_dc_afe * (vdc_ups_ref - xs[8]) + ki_dc_afe * xs[5]
        vd_ref = kp_c_afe * (xs[3] - id_ref) + ki_c_afe * xs[6] + omega_pll * l_afe * xs[4]
        vq_ref = kp_c_afe * xs[4] + ki_c_afe * xs[7] - omega_pll * l_afe * xs[3]
        md = safe_div(vd_ref, xs[8])
        mq = safe_div(vq_ref, xs[8])
        dx = np.zeros(17)
        dx[0] = wb * (omega_pll - omega_s)
        dx[1] = xs[2]
        dx[2] = omega_lp * (vq - xs[2])
        dx[3] = (wb / l_afe) * (vd - md * xs[8] - r_afe * xs[3] + omega_pll * l_afe * xs[4])
        dx[4] = (wb / l_afe) * (vq - mq * xs[8] - r_afe * xs[4] - omega_pll * l_afe * xs[3])
        dx[5] = vdc_ups_ref - xs[8]
        dx[6] = xs[3] - id_ref
        dx[7] = xs[4]
        dx[8] = (wb / c_dc) * ((md * xs[3] + mq * xs[4]) - (mU * xs[9] + mV * xs[10]))
        dx[9] = (wb / l_vsi) * (mU * xs[8] - xs[11] - r_vsi * xs[9] + omega_s * l_vsi * xs[10])
        dx[10] = (wb / l_vsi) * (mV * xs[8] - xs[12] - r_vsi * xs[10] - omega_s * l_vsi * xs[9])
        dx[11] = (wb / c_vsi) * (xs[9] - iU_ld + omega_s * c_vsi * xs[12])
        dx[12] = (wb / c_vsi) * (xs[10] - iV_ld - omega_s * c_vsi * xs[11])
        dx[13] = vu_vsi_ref - xs[11]
        dx[14] = -xs[12]
        dx[15] = iU_ref - xs[9]
        dx[16] = iV_ref - xs[10]
        dsub[:17] = dx
    dX[:41] = dXA
    dX[41:] = dXB
    return dX, P_A, P_B, p_pcc[0], p_pcc[1]
