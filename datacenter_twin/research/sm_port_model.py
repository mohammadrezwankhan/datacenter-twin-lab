# Adapted from user-supplied python_equivalent archive (SHA-256 c467c157d39a2f36b2951a2a073b01d536c459ea653de5b28785c1b3e1a56cab). The supplied README maps these equations to MATLAB source, but neither MATLAB originals nor the GPU measurement trace were supplied; no MATLAB/measurement validation is claimed.
"""Python equivalent of sm_port_model.m."""
from __future__ import annotations
import numpy as np


def sm_port_model(t, x, V, sm, pref):
    x = np.asarray(x, dtype=float).reshape(-1)
    delta, omega, eqp, edp, efd, vf, vrA, psv, tm = x
    p_ref = pref(t) if callable(pref) else pref

    vr, vi = np.real(V), np.imag(V)
    vt = np.hypot(vr, vi)
    vd = np.sin(delta) * vr - np.cos(delta) * vi
    vq = np.cos(delta) * vr + np.sin(delta) * vi

    id_ = (eqp - vq) / sm.xdp
    iq = (vd - edp) / sm.xqp
    ir = np.sin(delta) * id_ + np.cos(delta) * iq
    ii = -np.cos(delta) * id_ + np.sin(delta) * iq
    Iout = ir + 1j * ii

    pe = vd * id_ + vq * iq
    se = sm.ae * np.exp(sm.be * efd)

    xdot = np.zeros(9)
    xdot[0] = sm.omega_b * (omega - sm.ws)
    xdot[1] = (tm - pe - sm.D * (omega - sm.ws)) / (2.0 * sm.H)
    xdot[2] = (-eqp - (sm.xd - sm.xdp) * id_ + efd) / sm.Td0p
    xdot[3] = (-edp + (sm.xq - sm.xqp) * iq) / sm.Tq0p
    xdot[4] = (-(sm.ke + se) * efd + vrA) / sm.Te
    xdot[5] = (-vf + (sm.kf / sm.Te) * vrA - (sm.kf / sm.Te) * (sm.ke + se) * efd) / sm.Tf
    xdot[6] = (-vrA + sm.ka * (sm.vref - vf - vt)) / sm.Ta
    xdot[7] = (-psv + p_ref - (1.0 / sm.r) * (omega - sm.ws)) / sm.Tsv
    xdot[8] = (-tm + psv) / sm.Tch

    alg = dict(vt=vt, pe=pe, qe=vq * id_ - vd * iq, id=id_, iq=iq, tm=tm)
    return xdot, Iout, alg
