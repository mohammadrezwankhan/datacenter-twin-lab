# Adapted from user-supplied python_equivalent archive (SHA-256 c467c157d39a2f36b2951a2a073b01d536c459ea653de5b28785c1b3e1a56cab). The supplied README maps these equations to MATLAB source, but neither MATLAB originals nor the GPU measurement trace were supplied; no MATLAB/measurement validation is claimed.
"""Python equivalent of gfl_init_from_pf_qss_newton.m."""
from __future__ import annotations
import warnings
import numpy as np
from scipy.optimize import root
from .gfl_port_model import gfl_port_model


def gfl_init_from_pf_qss_newton(Vport_pf, Iport_pf, gfl):
    base, filt = gfl.base, gfl.filt
    Vr_grid, Vi_grid = np.real(Vport_pf), np.imag(Vport_pf)
    Ir_g, Ii_g = np.real(Iport_pf), np.imag(Iport_pf)
    Vr_filt = Vr_grid + filt.rg * Ir_g - base.ome_sys * filt.lg * Ii_g
    Vi_filt = Vi_grid + filt.rg * Ii_g + base.ome_sys * filt.lg * Ir_g
    Pref0 = Vr_filt * Ir_g + Vi_filt * Ii_g
    Qref0 = Vi_filt * Ir_g - Vr_filt * Ii_g

    gfl.wref0, gfl.pref0, gfl.qref0, gfl.vref0 = 1.0, Pref0, Qref0, np.hypot(Vr_filt, Vi_filt)
    refs = dict(wref0=1.0, vref0=gfl.vref0, pref0=Pref0, qref0=Qref0)
    x_guess = np.array(
        [
            Ir_g,
            Ii_g,
            Vr_filt,
            Vi_filt,
            Ir_g,
            Ii_g,
            0.0,
            0.0,
            np.arctan2(Vi_filt, Vr_filt),
            0.0,
            Pref0,
            0.0,
            Qref0,
            0.0,
            0.0,
        ]
    )

    fun = lambda x: gfl_port_model(0.0, x, Vport_pf, gfl, Pref0, Qref0)[0]
    sol = root(fun, x_guess, method="hybr", options={"xtol": 1e-12, "maxfev": 3000})
    fval = fun(sol.x)
    info = dict(
        exitflag=1 if sol.success else -1, output=sol, fval_inf=float(np.linalg.norm(fval, np.inf))
    )
    if not sol.success:
        warnings.warn(f"GFL init Newton did not fully converge. ||f||_inf={info['fval_inf']:.3e}")
    return sol.x, gfl, refs, info
