# Adapted from user-supplied python_equivalent archive (SHA-256
# c467c157d39a2f36b2951a2a073b01d536c459ea653de5b28785c1b3e1a56cab). The supplied README maps
# these equations to MATLAB source, but neither MATLAB originals nor the GPU measurement trace
# were supplied; no MATLAB/measurement validation is claimed.
"""Python equivalent of gfl_init_from_pf_qss_newton.m."""

from __future__ import annotations

import warnings
from types import SimpleNamespace

import numpy as np
from scipy.optimize import root

from .gfl_port_model import gfl_port_model
from .types import Complex, FloatArray, GFLReferences, InitializationInfo


def gfl_init_from_pf_qss_newton(
    vport_pf: Complex,
    iport_pf: Complex,
    gfl: SimpleNamespace,
) -> tuple[FloatArray, SimpleNamespace, GFLReferences, InitializationInfo]:
    base, filt = gfl.base, gfl.filt
    vr_grid, vi_grid = np.real(vport_pf), np.imag(vport_pf)
    ir_g, ii_g = np.real(iport_pf), np.imag(iport_pf)
    vr_filt = vr_grid + filt.rg * ir_g - base.ome_sys * filt.lg * ii_g
    vi_filt = vi_grid + filt.rg * ii_g + base.ome_sys * filt.lg * ir_g
    pref0 = vr_filt * ir_g + vi_filt * ii_g
    qref0 = vi_filt * ir_g - vr_filt * ii_g

    gfl.wref0, gfl.pref0, gfl.qref0, gfl.vref0 = 1.0, pref0, qref0, np.hypot(vr_filt, vi_filt)
    refs: GFLReferences = {"wref0": 1.0, "vref0": gfl.vref0, "pref0": pref0, "qref0": qref0}
    x_guess = np.array(
        [
            ir_g,
            ii_g,
            vr_filt,
            vi_filt,
            ir_g,
            ii_g,
            0.0,
            0.0,
            np.arctan2(vi_filt, vr_filt),
            0.0,
            pref0,
            0.0,
            qref0,
            0.0,
            0.0,
        ]
    )

    def fun(x: FloatArray) -> FloatArray:
        return gfl_port_model(0.0, x, vport_pf, gfl, pref0, qref0)[0]

    sol = root(fun, x_guess, method="hybr", options={"xtol": 1e-12, "maxfev": 3000})
    fval = fun(sol.x)
    info: InitializationInfo = {
        "exitflag": 1 if sol.success else -1,
        "output": sol,
        "fval_inf": float(np.linalg.norm(fval, np.inf)),
    }
    if not sol.success:
        warnings.warn(
            f"GFL init Newton did not fully converge. ||f||_inf={info['fval_inf']:.3e}",
            stacklevel=2,
        )
    return sol.x, gfl, refs, info
