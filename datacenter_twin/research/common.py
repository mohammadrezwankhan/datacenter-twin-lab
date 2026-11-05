# Adapted from user-supplied python_equivalent archive (SHA-256
# c467c157d39a2f36b2951a2a073b01d536c459ea653de5b28785c1b3e1a56cab). The supplied README maps
# these equations to MATLAB source, but neither MATLAB originals nor the GPU measurement trace
# were supplied; no MATLAB/measurement validation is claimed.
"""Shared numerical helpers for the MATLAB-to-Python conversions."""

from __future__ import annotations

from collections.abc import Callable, Mapping
from types import SimpleNamespace
from typing import Protocol, TypeVar

import numpy as np
from numpy.typing import ArrayLike, NDArray


def ns(**kwargs: object) -> SimpleNamespace:
    return SimpleNamespace(**kwargs)


def safe_div(a: float | np.float64, b: float | np.float64, eps: float = 1e-9) -> float | np.float64:
    """Scalar safe division matching the MATLAB guards used in the models."""
    b = float(b)
    if abs(b) < eps:
        b = eps if b >= 0 else -eps
    return a / b


def numeric_jacobian(
    fun: Callable[[NDArray[np.float64]], ArrayLike],
    x0: ArrayLike,
    rel_step: float = 1e-7,
) -> NDArray[np.float64]:
    x0 = np.asarray(x0, dtype=float)
    f0 = np.asarray(fun(x0), dtype=float).reshape(-1)
    jacobian = np.zeros((f0.size, x0.size), dtype=float)
    for i in range(x0.size):
        x1 = x0.copy()
        h = rel_step * (1.0 + abs(x0[i]))
        x1[i] += h
        jacobian[:, i] = (np.asarray(fun(x1), dtype=float).reshape(-1) - f0) / h
    return jacobian


def pi_bw_tuning(
    loop_type: str,
    fbw: float,
    zeta: float,
    param1: float,
    omega_b: float,
    param2: float = 0.0,
) -> tuple[float, float]:
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


def pll_bw_tuning(fbw: float, zeta: float, fb: float = 60.0) -> tuple[float, float]:
    wn = 2.0 * np.pi * fbw
    omega_b = 2.0 * np.pi * fb
    return 2.0 * zeta * wn / omega_b, wn**2 / omega_b


def matlab_hann(n: int) -> NDArray[np.float64]:
    """Periodic/symmetric distinction is immaterial here; MATLAB hann(N) is symmetric."""
    if n <= 1:
        return np.ones(n)
    return np.hanning(n)


class _Spine(Protocol):
    def set_linewidth(self, width: float) -> None: ...


class _Axes(Protocol):
    spines: Mapping[str, _Spine]

    def grid(self, visible: bool, *, alpha: float) -> None: ...

    def tick_params(self, *, direction: str, width: float, labelsize: int) -> None: ...


# OpenGrep 1.33 cannot parse PEP 695 parameters; retain the bound and concrete return type.
AxesType = TypeVar("AxesType", bound=_Axes)


def set_ieee_axes(ax: AxesType, fontsize: int = 8) -> AxesType:  # noqa: UP047
    ax.grid(True, alpha=0.18)
    ax.tick_params(direction="out", width=0.8, labelsize=fontsize)
    for spine in ax.spines.values():
        spine.set_linewidth(0.8)
    return ax
