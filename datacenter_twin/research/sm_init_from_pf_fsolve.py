# Adapted from user-supplied python_equivalent archive (SHA-256 c467c157d39a2f36b2951a2a073b01d536c459ea653de5b28785c1b3e1a56cab). The supplied README maps these equations to MATLAB source, but neither MATLAB originals nor the GPU measurement trace were supplied; no MATLAB/measurement validation is claimed.
"""Python equivalent of sm_init_from_pf_fsolve.m."""
from __future__ import annotations
import numpy as np
from scipy.optimize import root
from .sm_port_model import sm_port_model


def sm_init_from_pf_fsolve(Vpf, Ipf, sm, opts=None):
    if not hasattr(sm, "ws"):
        sm.ws = 1.0
    pref0 = float(np.real(Vpf * np.conj(Ipf)))
    vt0 = abs(Vpf)

    vr, vi = np.real(Vpf), np.imag(Vpf)
    ir, ii = np.real(Ipf), np.imag(Ipf)
    delta_guess = np.angle(Vpf)

    def consist_eq(d):
        d = float(np.atleast_1d(d)[0])
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
    except Exception:
        pass

    vd = np.sin(delta_guess) * vr - np.cos(delta_guess) * vi
    vq = np.cos(delta_guess) * vr + np.sin(delta_guess) * vi
    id_ = np.sin(delta_guess) * ir - np.cos(delta_guess) * ii
    iq = np.cos(delta_guess) * ir + np.sin(delta_guess) * ii

    eqp0 = vq + sm.xdp * id_
    edp0 = 0.5 * ((vd - sm.xqp * iq) + (sm.xq - sm.xqp) * iq)
    efd0 = max(1e-6, eqp0 + (sm.xd - sm.xdp) * id_)
    vrA0 = (sm.ke + sm.ae * np.exp(sm.be * efd0)) * efd0
    vref0 = vt0 + vrA0 / sm.ka

    x_init = np.array([delta_guess, sm.ws, eqp0, edp0, efd0, 0.0, vrA0, pref0, pref0], dtype=float)
    sm.vref = vref0
    sm.pref = pref0
    refs = dict(vref=vref0, pref=pref0, ws=sm.ws)

    def fun(x):
        return sm_port_model(0.0, x, Vpf, sm, pref0)[0]

    options = {"xtol": 1e-12, "maxfev": 2000}
    if isinstance(opts, dict):
        options.update(opts)
    sol = root(fun, x_init, method="hybr", options=options)
    fval = fun(sol.x)
    info = dict(
        exitflag=1 if sol.success else -1,
        output=sol,
        residual_inf=float(np.linalg.norm(fval, np.inf)),
    )
    return sol.x, sm, refs, info
