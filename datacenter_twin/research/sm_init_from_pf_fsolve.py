# Adapted from user-supplied python_equivalent archive (SHA-256
# c467c157d39a2f36b2951a2a073b01d536c459ea653de5b28785c1b3e1a56cab). The supplied README maps
# these equations to MATLAB source, but neither MATLAB originals nor the GPU measurement trace
# were supplied; no MATLAB/measurement validation is claimed.
"""Python equivalent of sm_init_from_pf_fsolve.m."""

from __future__ import annotations

import logging
from types import SimpleNamespace
from typing import TYPE_CHECKING

import numpy as np
from scipy.optimize import root

from .sm_port_model import sm_port_model
from .types import Complex, FloatArray, InitializationInfo, Real, SMReferences

if TYPE_CHECKING:
    # SciPy's stubs expose the exact hybr option schema as a type-only name.
    from scipy.optimize._root import _RootOptionsHybr as HybrOptions


def sm_init_from_pf_fsolve(
    vpf: Complex,
    ipf: Complex,
    sm: SimpleNamespace,
    opts: HybrOptions | None = None,
) -> tuple[FloatArray, SimpleNamespace, SMReferences, InitializationInfo]:
    if not hasattr(sm, "ws"):
        sm.ws = 1.0
    pref0 = float(np.real(vpf * np.conj(ipf)))
    vt0 = abs(vpf)

    vr, vi = np.real(vpf), np.imag(vpf)
    ir, ii = np.real(ipf), np.imag(ipf)
    delta_guess: Real = np.angle(vpf)

    def consist_eq(values: FloatArray) -> FloatArray:
        d = float(np.atleast_1d(values)[0])
        return np.array(
            [
                (np.sin(d) * vr - np.cos(d) * vi)
                - sm.xqp * (np.cos(d) * ir + np.sin(d) * ii)
                - (sm.xq - sm.xqp) * (np.cos(d) * ir + np.sin(d) * ii)
            ]
        )

    try:
        sol_delta = root(consist_eq, np.array([delta_guess]), options={"maxfev": 50})
        if sol_delta.success:
            delta_guess = float(sol_delta.x[0])
    except Exception as exc:
        logging.getLogger(__name__).debug(
            "Initial angle refinement failed; retaining initial guess: %s", exc
        )

    vd = np.sin(delta_guess) * vr - np.cos(delta_guess) * vi
    vq = np.cos(delta_guess) * vr + np.sin(delta_guess) * vi
    id_ = np.sin(delta_guess) * ir - np.cos(delta_guess) * ii
    iq = np.cos(delta_guess) * ir + np.sin(delta_guess) * ii

    eqp0 = vq + sm.xdp * id_
    edp0 = 0.5 * ((vd - sm.xqp * iq) + (sm.xq - sm.xqp) * iq)
    efd0 = max(1e-6, eqp0 + (sm.xd - sm.xdp) * id_)
    vr_a0 = (sm.ke + sm.ae * np.exp(sm.be * efd0)) * efd0
    vref0 = vt0 + vr_a0 / sm.ka

    x_init = np.array([delta_guess, sm.ws, eqp0, edp0, efd0, 0.0, vr_a0, pref0, pref0], dtype=float)
    sm.vref = vref0
    sm.pref = pref0
    refs: SMReferences = {"vref": vref0, "pref": pref0, "ws": sm.ws}

    def fun(x: FloatArray) -> FloatArray:
        return sm_port_model(0.0, x, vpf, sm, pref0)[0]

    options: HybrOptions = {"xtol": 1e-12, "maxfev": 2000}
    if isinstance(opts, dict):
        options.update(opts)
    sol = root(fun, x_init, method="hybr", options=options)
    fval = fun(sol.x)
    info: InitializationInfo = {
        "exitflag": 1 if sol.success else -1,
        "output": sol,
        "residual_inf": float(np.linalg.norm(fval, np.inf)),
    }
    return sol.x, sm, refs, info
