# Adapted from user-supplied python_equivalent archive (SHA-256 c467c157d39a2f36b2951a2a073b01d536c459ea653de5b28785c1b3e1a56cab). The supplied README maps these equations to MATLAB source, but neither MATLAB originals nor the GPU measurement trace were supplied; no MATLAB/measurement validation is claimed.
"""Python equivalent of datacenter_init_from_pf_qss.m."""
from __future__ import annotations
import warnings
import numpy as np
from scipy.optimize import root
from .datacenter_port_model import datacenter_core_equations


def qss_equations(y, Vport, I_abs_target, dc):
    y = np.asarray(y, dtype=float).reshape(-1)
    x, p_load, B_shunt = y[:21], y[21], y[22]
    xdot, I_afe_in, _ = datacenter_core_equations(x, Vport, dc, p_load, 1.0)
    I_total_in = I_afe_in + 1j * B_shunt * Vport
    I_err = I_total_in - I_abs_target
    return np.r_[xdot, np.real(I_err), np.imag(I_err)]


def datacenter_init_from_pf_qss(Vport_pf, Iport_pf, dc):
    I_absorbed_target = -Iport_pf
    P_absorbed_guess = float(np.real(Vport_pf * np.conj(I_absorbed_target)))
    y_guess = np.zeros(23)
    y_guess[0] = np.angle(Vport_pf)
    y_guess[3] = P_absorbed_guess
    y_guess[8] = dc.vdc_ups_ref
    y_guess[11] = dc.vu_vsi_ref
    y_guess[17] = dc.vpsu_ref
    y_guess[19] = dc.veq_ref
    y_guess[21] = P_absorbed_guess
    y_guess[22] = 0.0

    fun = lambda y: qss_equations(y, Vport_pf, I_absorbed_target, dc)
    sol = root(fun, y_guess, method="hybr", options={"xtol": 1e-12, "maxfev": 5000})
    fval = fun(sol.x)
    if not sol.success:
        warnings.warn("DataCenter init did not fully converge.")
    x0 = sol.x[:21]
    refs = dict(p_load=float(sol.x[21]), B_shunt=float(sol.x[22]))
    info = dict(
        exitflag=1 if sol.success else -1,
        output=sol,
        residual_inf=float(np.linalg.norm(fval, np.inf)),
    )
    return x0, refs, info
