# Adapted from user-supplied python_equivalent archive (SHA-256
# c467c157d39a2f36b2951a2a073b01d536c459ea653de5b28785c1b3e1a56cab). The supplied README maps
# these equations to MATLAB source, but neither MATLAB originals nor the GPU measurement trace
# were supplied; no MATLAB/measurement validation is claimed.
"""Python equivalent of datacenter_init_from_pf_qss.m."""

from __future__ import annotations

import warnings
from types import SimpleNamespace

import numpy as np
from scipy.optimize import root

from .datacenter_port_model import datacenter_core_equations
from .types import Complex, DCReferences, FloatArray, InitializationInfo


def qss_equations(
    y: FloatArray,
    vport: Complex,
    i_abs_target: Complex,
    dc: SimpleNamespace,
) -> FloatArray:
    y = np.asarray(y, dtype=float).reshape(-1)
    x, p_load, b_shunt = y[:21], y[21], y[22]
    xdot, i_afe_in, _ = datacenter_core_equations(x, vport, dc, p_load, 1.0)
    i_total_in = i_afe_in + 1j * b_shunt * vport
    i_err = i_total_in - i_abs_target
    # The dynamic np.r_ subscription loses dtype information in NumPy's stubs.
    # Every operand here is a real float64 state derivative or scalar.
    residual: FloatArray = np.r_[xdot, np.real(i_err), np.imag(i_err)]
    return residual


def datacenter_init_from_pf_qss(
    vport_pf: Complex,
    iport_pf: Complex,
    dc: SimpleNamespace,
) -> tuple[FloatArray, DCReferences, InitializationInfo]:
    i_absorbed_target = -iport_pf
    p_absorbed_guess = float(np.real(vport_pf * np.conj(i_absorbed_target)))
    y_guess = np.zeros(23)
    y_guess[0] = np.angle(vport_pf)
    y_guess[3] = p_absorbed_guess
    y_guess[8] = dc.vdc_ups_ref
    y_guess[11] = dc.vu_vsi_ref
    y_guess[17] = dc.vpsu_ref
    y_guess[19] = dc.veq_ref
    y_guess[21] = p_absorbed_guess
    y_guess[22] = 0.0

    def fun(y: FloatArray) -> FloatArray:
        return qss_equations(y, vport_pf, i_absorbed_target, dc)

    sol = root(fun, y_guess, method="hybr", options={"xtol": 1e-12, "maxfev": 5000})
    fval = fun(sol.x)
    if not sol.success:
        warnings.warn("DataCenter init did not fully converge.", stacklevel=2)
    x0 = sol.x[:21]
    refs: DCReferences = {"p_load": float(sol.x[21]), "B_shunt": float(sol.x[22])}
    info: InitializationInfo = {
        "exitflag": 1 if sol.success else -1,
        "output": sol,
        "residual_inf": float(np.linalg.norm(fval, np.inf)),
    }
    return x0, refs, info
