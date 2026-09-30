# Adapted from user-supplied python_equivalent archive (SHA-256 c467c157d39a2f36b2951a2a073b01d536c459ea653de5b28785c1b3e1a56cab). The supplied README maps these equations to MATLAB source, but neither MATLAB originals nor the GPU measurement trace were supplied; no MATLAB/measurement validation is claimed.
"""Python equivalent of gfm_port_model.m."""
from __future__ import annotations
import numpy as np


def gfm_port_model(t, x, Vport, gfm, pref_cmd, qref_cmd, ome_ref, v_ref, omega_sys=None):
    if omega_sys is None:
        omega_sys = gfm.base.ome_sys
    b, f, dr, vi, inner, dc = gfm.base, gfm.filt, gfm.droop, gfm.virt, gfm.inner, gfm.dc
    x = np.asarray(x, dtype=float).reshape(-1)
    ir_cv, ii_cv, vr_f, vi_f, ir_f, ii_f, the, pm, qm, xi_d, xi_q, gam_d, gam_q = x

    sn, cs = np.sin(the + np.pi / 2), np.cos(the + np.pi / 2)
    T = np.array([[sn, -cs], [cs, sn]])
    vd_f, vq_f = T @ np.array([vr_f, vi_f])
    id_f, iq_f = T @ np.array([ir_f, ii_f])
    id_cv, iq_cv = T @ np.array([ir_cv, ii_cv])

    ome_oc = ome_ref + dr.Kp * (pref_cmd - pm)
    v_oc = v_ref + dr.Kq * (qref_cmd - qm)
    vd_vi_ref = v_oc - vi.rv * id_f + ome_oc * vi.lv * iq_f
    vq_vi_ref = -vi.rv * iq_f - ome_oc * vi.lv * id_f
    id_cv_ref = inner.kpv * (vd_vi_ref - vd_f) + inner.kiv * xi_d - f.cf * ome_oc * vq_f
    iq_cv_ref = inner.kpv * (vq_vi_ref - vq_f) + inner.kiv * xi_q + f.cf * ome_oc * vd_f
    vd_cv_ref = inner.kpc * (id_cv_ref - id_cv) + inner.kic * gam_d - ome_oc * f.lf * iq_cv
    vq_cv_ref = inner.kpc * (iq_cv_ref - iq_cv) + inner.kic * gam_q + ome_oc * f.lf * id_cv

    md, mq = vd_cv_ref / dc.Vdc, vq_cv_ref / dc.Vdc
    vr_cv = (sn * md + cs * mq) * dc.Vdc
    vi_cv = (-cs * md + sn * mq) * dc.Vdc

    xdot = np.zeros(13)
    xdot[0:2] = (b.ome_b / f.lf) * np.array(
        [
            vr_cv - vr_f - f.rf * ir_cv + omega_sys * f.lf * ii_cv,
            vi_cv - vi_f - f.rf * ii_cv - omega_sys * f.lf * ir_cv,
        ]
    )
    xdot[2:4] = (b.ome_b / f.cf) * np.array(
        [
            ir_cv - ir_f + omega_sys * f.cf * vi_f,
            ii_cv - ii_f - omega_sys * f.cf * vr_f,
        ]
    )
    xdot[4:6] = (b.ome_b / f.lg) * np.array(
        [
            vr_f - np.real(Vport) - f.rg * ir_f + omega_sys * f.lg * ii_f,
            vi_f - np.imag(Vport) - f.rg * ii_f - omega_sys * f.lg * ir_f,
        ]
    )
    xdot[6] = b.ome_b * (ome_oc - omega_sys)
    xdot[7:9] = [
        dr.ome_z * ((vr_f * ir_f + vi_f * ii_f) - pm),
        dr.ome_f * ((-vr_f * ii_f + vi_f * ir_f) - qm),
    ]
    xdot[9:13] = [vd_vi_ref - vd_f, vq_vi_ref - vq_f, id_cv_ref - id_cv, iq_cv_ref - iq_cv]
    Iport = ir_f + 1j * ii_f
    aux = dict(ome_oc=ome_oc, v_oc=v_oc, p_inst=pm, q_inst=qm)
    return xdot, Iport, aux
