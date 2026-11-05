"""Array and result contracts for the supplied numerical research models."""

from __future__ import annotations

from collections.abc import Callable
from typing import NotRequired, TypeAliasType, TypedDict

import numpy as np
from numpy.typing import NDArray
from scipy.optimize import OptimizeResult

# OpenGrep 1.33 cannot parse PEP 695 statements. Keep real alias objects and concrete values.
FloatArray = TypeAliasType("FloatArray", NDArray[np.float64])  # noqa: UP040
ComplexArray = TypeAliasType("ComplexArray", NDArray[np.complex128])  # noqa: UP040
Real = TypeAliasType("Real", float | np.float64)  # noqa: UP040
Complex = TypeAliasType("Complex", complex | np.complex128)  # noqa: UP040
LoadCommand = TypeAliasType("LoadCommand", Real | Callable[[float], Real])  # noqa: UP040


class DCReferences(TypedDict):
    p_load: Real
    B_shunt: Real


class GFMReferences(TypedDict):
    pref0: Real
    qref0: Real
    ome_ref0: Real
    v_ref0: Real
    Vf_qss: Complex
    Vcv_qss: Complex


class GFLReferences(TypedDict):
    wref0: Real
    vref0: Real
    pref0: Real
    qref0: Real


class SMReferences(TypedDict):
    vref: Real
    pref: Real
    ws: Real


class InitializationInfo(TypedDict):
    exitflag: int
    output: OptimizeResult[object]
    residual_inf: NotRequired[float]
    fval_inf: NotRequired[float]


class Metric(TypedDict):
    label: str
    value: float | None
    unit: str


class Mode(TypedDict):
    real: float
    imag: float
    frequency_hz: float
    damping: float | None
    dominant_state: str
    dominant_group: NotRequired[str]
    stable: bool


class StudyResult(TypedDict):
    study_id: str
    model: str
    config: dict[str, float]
    solver: dict[str, object]
    assumptions: list[str]
    metrics: list[Metric]
    charts: list[dict[str, object]]
    diagnostics: dict[str, object]
    modes: NotRequired[list[Mode]]
