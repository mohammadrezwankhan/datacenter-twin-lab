# Adapted from user-supplied python_equivalent archive (SHA-256 c467c157d39a2f36b2951a2a073b01d536c459ea653de5b28785c1b3e1a56cab). The supplied README maps these equations to MATLAB source, but neither MATLAB originals nor the GPU measurement trace were supplied; no MATLAB/measurement validation is claimed.
"""Python equivalent of gfm_init_from_pf_qss_newton.m."""
from __future__ import annotations
import warnings
import numpy as np
from scipy.optimize import least_squares
from .gfm_port_model import gfm_port_model


def gfm_init_from_pf_qss_newton(Vport_pf, Iport_pf, gfm):
    b, f, v = gfm.base, gfm.filt, gfm.virt
    Zg = f.rg + 1j * (b.ome_sys * f.lg)
    Vf = Vport_pf + Zg * Iport_pf
    Zv = v.rv + 1j * (b.ome_sys * v.lv)
    Vs = Vf + Zv * Iport_pf
    S_filt = Vf * np.conj(Iport_pf)
    pref0, qref0 = np.real(S_filt), np.imag(S_filt)
    Ic = 1j * b.ome_sys * f.cf * Vf
    Icv = Iport_pf + Ic
    Vcv = Vf + (f.rf + 1j * b.ome_sys * f.lf) * Icv
    refs = dict(pref0=pref0, qref0=qref0, ome_ref0=1.0, v_ref0=abs(Vs), Vf_qss=Vf, Vcv_qss=Vcv)

    xg = np.array(
        [
            np.real(Icv),
            np.imag(Icv),
            np.real(Vf),
            np.imag(Vf),
            np.real(Iport_pf),
            np.imag(Iport_pf),
            np.angle(Vcv),
            pref0,
            qref0,
            0.0,
            0.0,
            0.0,
            0.0,
        ]
    )
    typX = np.maximum(np.abs(xg), 1e-2)
    typX[6:9] = 1.0
    fun = lambda x: gfm_port_model(0.0, x, Vport_pf, gfm, pref0, qref0, 1.0, abs(Vs))[0]
    # x_scale='jac' gives robust scaling close in spirit to MATLAB TypicalX/LM.
    sol = least_squares(fun, xg, method="lm", xtol=1e-12, ftol=1e-12, gtol=1e-12, max_nfev=4000)
    if not sol.success:
        idx = int(np.argmax(np.abs(sol.fun)))
        warnings.warn(
            f"GFM Newton did not fully converge. max|F|={abs(sol.fun[idx]):.3e} at eqn #{idx+1}"
        )
    return sol.x, refs
