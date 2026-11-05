# Adapted from user-supplied python_equivalent archive (SHA-256
# c467c157d39a2f36b2951a2a073b01d536c459ea653de5b28785c1b3e1a56cab). The supplied README maps
# these equations to MATLAB source, but neither MATLAB originals nor the GPU measurement trace
# were supplied; no MATLAB/measurement validation is claimed.
"""Python equivalent of gfm_init_from_pf_qss_newton.m."""

from __future__ import annotations

import warnings
from types import SimpleNamespace

import numpy as np
from scipy.optimize import least_squares

from .gfm_port_model import gfm_port_model
from .types import Complex, FloatArray, GFMReferences


def gfm_init_from_pf_qss_newton(
    vport_pf: Complex,
    iport_pf: Complex,
    gfm: SimpleNamespace,
) -> tuple[FloatArray, GFMReferences]:
    b, f, v = gfm.base, gfm.filt, gfm.virt
    zg = f.rg + 1j * (b.ome_sys * f.lg)
    vf = vport_pf + zg * iport_pf
    zv = v.rv + 1j * (b.ome_sys * v.lv)
    vs = vf + zv * iport_pf
    s_filt = vf * np.conj(iport_pf)
    pref0, qref0 = np.real(s_filt), np.imag(s_filt)
    ic = 1j * b.ome_sys * f.cf * vf
    icv = iport_pf + ic
    vcv = vf + (f.rf + 1j * b.ome_sys * f.lf) * icv
    refs: GFMReferences = {
        "pref0": pref0,
        "qref0": qref0,
        "ome_ref0": 1.0,
        "v_ref0": abs(vs),
        "Vf_qss": vf,
        "Vcv_qss": vcv,
    }

    xg = np.array(
        [
            np.real(icv),
            np.imag(icv),
            np.real(vf),
            np.imag(vf),
            np.real(iport_pf),
            np.imag(iport_pf),
            np.angle(vcv),
            pref0,
            qref0,
            0.0,
            0.0,
            0.0,
            0.0,
        ]
    )
    typ_x = np.maximum(np.abs(xg), 1e-2)
    typ_x[6:9] = 1.0

    def fun(x: FloatArray) -> FloatArray:
        return gfm_port_model(0.0, x, vport_pf, gfm, pref0, qref0, 1.0, abs(vs))[0]

    # x_scale='jac' gives robust scaling close in spirit to MATLAB TypicalX/LM.
    sol = least_squares(fun, xg, method="lm", xtol=1e-12, ftol=1e-12, gtol=1e-12, max_nfev=4000)
    if not sol.success:
        idx = int(np.argmax(np.abs(sol.fun)))
        warnings.warn(
            f"GFM Newton did not fully converge. max|F|={abs(sol.fun[idx]):.3e} at eqn #{idx + 1}",
            stacklevel=2,
        )
    return sol.x, refs
