# Adapted from user-supplied python_equivalent archive (SHA-256 c467c157d39a2f36b2951a2a073b01d536c459ea653de5b28785c1b3e1a56cab). The supplied README maps these equations to MATLAB source, but neither MATLAB originals nor the GPU measurement trace were supplied; no MATLAB/measurement validation is claimed.
"""Shared numerical helpers for the MATLAB-to-Python conversions."""
from __future__ import annotations

from types import SimpleNamespace
import numpy as np


def ns(**kwargs):
    return SimpleNamespace(**kwargs)


def safe_div(a, b, eps: float = 1e-9):
    """Scalar safe division matching the MATLAB guards used in the models."""
    b = float(b)
    if abs(b) < eps:
        b = eps if b >= 0 else -eps
    return a / b


def numeric_jacobian(fun, x0, rel_step: float = 1e-7):
    x0 = np.asarray(x0, dtype=float)
    f0 = np.asarray(fun(x0), dtype=float).reshape(-1)
    J = np.zeros((f0.size, x0.size), dtype=float)
    for i in range(x0.size):
        x1 = x0.copy()
        h = rel_step * (1.0 + abs(x0[i]))
        x1[i] += h
        J[:, i] = (np.asarray(fun(x1), dtype=float).reshape(-1) - f0) / h
    return J


def pi_bw_tuning(loop_type, fbw, zeta, param1, omega_b, param2=0.0):
    wn = 2.0 * np.pi * fbw
    lt = str(loop_type).lower()
    if lt in {"v", "voltage"}:
        kp = 2.0 * zeta * wn * (param1 / omega_b)
    elif lt in {"c", "current"}:
        kp = 2.0 * zeta * wn * (param1 / omega_b) - param2
    else:
        raise ValueError(f"Unknown loop_type: {loop_type}")
    ki = wn**2 * (param1 / omega_b)
    return kp, ki


def pll_bw_tuning(fbw, zeta, fb=60.0):
    wn = 2.0 * np.pi * fbw
    omega_b = 2.0 * np.pi * fb
    return 2.0 * zeta * wn / omega_b, wn**2 / omega_b


def matlab_hann(n: int):
    """Periodic/symmetric distinction is immaterial here; MATLAB hann(N) is symmetric."""
    if n <= 1:
        return np.ones(n)
    return np.hanning(n)


def set_ieee_axes(ax, fontsize=8):
    ax.grid(True, alpha=0.18)
    ax.tick_params(direction="out", width=0.8, labelsize=fontsize)
    for spine in ax.spines.values():
        spine.set_linewidth(0.8)
    return ax
