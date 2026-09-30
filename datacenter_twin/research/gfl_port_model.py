# Adapted from user-supplied python_equivalent archive (SHA-256 c467c157d39a2f36b2951a2a073b01d536c459ea653de5b28785c1b3e1a56cab). The supplied README maps these equations to MATLAB source, but neither MATLAB originals nor the GPU measurement trace were supplied; no MATLAB/measurement validation is claimed.
"""Python equivalent of gfl_port_model.m."""
from __future__ import annotations
import numpy as np


def gfl_port_model(t, x, Vport, gfl, pref_cmd, qref_cmd, omega_sys=None):
    if omega_sys is None:
        omega_sys = gfl.base.ome_sys
    b, f, pll, out, inner, dc = gfl.base, gfl.filt, gfl.pll, gfl.outer, gfl.inner, gfl.dc
    x = np.asarray(x, dtype=float).reshape(-1)
    (
        ir_cv,
        ii_cv,
        vr_filt,
        vi_filt,
        ir_g,
        ii_g,
        vq_pll,
        eps_pll,
        the_pll,
        sig_p,
        pm,
        sig_q,
        qm,
        gam_d,
        gam_q,
    ) = x

    ome_est = 1.0 + pll.kp * vq_pll + pll.ki * eps_pll
    s, c = np.sin(the_pll + np.pi / 2), np.cos(the_pll + np.pi / 2)
    vd_f = s * vr_filt - c * vi_filt
    vq_f = c * vr_filt + s * vi_filt
    id_cv = s * ir_cv - c * ii_cv
    iq_cv = c * ir_cv + s * ii_cv

    p_inst = vr_filt * ir_g + vi_filt * ii_g
    q_inst = vi_filt * ir_g - vr_filt * ii_g
    Id_pi = out.Kp_p * (pref_cmd - pm) + out.Ki_p * sig_p
    Iq_pi = -(out.Kp_q * (qref_cmd - qm) + out.Ki_q * sig_q)
    Vd_pi = inner.kpc * (Id_pi - id_cv) + inner.kic * gam_d
    Vq_pi = inner.kpc * (Iq_pi - iq_cv) + inner.kic * gam_q
    Vd_cv_ref = Vd_pi - ome_est * inner.lf * iq_cv + inner.kffv * vd_f
    Vq_cv_ref = Vq_pi + ome_est * inner.lf * id_cv + inner.kffv * vq_f

    md, mq = Vd_cv_ref / dc.Vdc, Vq_cv_ref / dc.Vdc
    vr_cv = (s * md + c * mq) * dc.Vdc
    vi_cv = (-c * md + s * mq) * dc.Vdc
    Vr_g, Vi_g = np.real(Vport), np.imag(Vport)

    xdot = np.zeros(15)
    xdot[0:2] = (b.ome_b / f.lf) * np.array(
        [
            vr_cv - vr_filt - f.rf * ir_cv + omega_sys * f.lf * ii_cv,
            vi_cv - vi_filt - f.rf * ii_cv - omega_sys * f.lf * ir_cv,
        ]
    )
    xdot[2:4] = (b.ome_b / f.cf) * np.array(
        [
            ir_cv - ir_g + omega_sys * f.cf * vi_filt,
            ii_cv - ii_g - omega_sys * f.cf * vr_filt,
        ]
    )
    xdot[4:6] = (b.ome_b / f.lg) * np.array(
        [
            vr_filt - Vr_g - f.rg * ir_g + omega_sys * f.lg * ii_g,
            vi_filt - Vi_g - f.rg * ii_g - omega_sys * f.lg * ir_g,
        ]
    )
    xdot[6:9] = [pll.ome_lp * (vq_f - vq_pll), vq_pll, b.ome_b * (ome_est - omega_sys)]
    xdot[9:13] = [
        pref_cmd - pm,
        out.ome_z * (p_inst - pm),
        qref_cmd - qm,
        out.ome_f * (q_inst - qm),
    ]
    xdot[13:15] = [Id_pi - id_cv, Iq_pi - iq_cv]

    Iport = ir_g + 1j * ii_g
    aux = dict(ome_est=ome_est, p_inst=p_inst, q_inst=q_inst, Id_pi=Id_pi, Iq_pi=Iq_pi)
    return xdot, Iport, aux
