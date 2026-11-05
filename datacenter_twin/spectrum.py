"""Finite-domain Hann spectrum, importable with NumPy and without SciPy."""

from __future__ import annotations

import math

import numpy as np
from numpy.typing import NDArray


def spectrum(
    signal: NDArray[np.float64], duration: float
) -> tuple[NDArray[np.float64], NDArray[np.float64]]:
    """Return frequencies and amplitudes; reject undefined or overflowing inputs.

    A Hann window needs at least three samples for a nonzero normalization.
    The duration spans the first through last sample, including both endpoints.
    The valid-domain FFT and normalization order match the original helper.
    """
    if signal.ndim != 1 or len(signal) < 3:
        raise ValueError("signal must be a one-dimensional array with at least three samples")
    if signal.dtype.kind not in "fiu" or not bool(np.all(np.isfinite(signal))):
        raise ValueError("signal samples must be finite real numbers")
    if not math.isfinite(duration) or duration <= 0:
        raise ValueError("duration must be finite and positive")
    sample_interval = duration / (len(signal) - 1)
    if sample_interval <= 0:
        raise ValueError("sample interval is below the representable floating-point range")
    try:
        with np.errstate(over="raise", invalid="raise", divide="raise"):
            centered = signal - float(np.mean(signal))
            window = np.hanning(len(centered))
            coeff = np.fft.rfft(centered * window)
            amp = np.abs(coeff) / (len(centered) * float(np.mean(window)))
            if len(centered) % 2 == 0:
                amp[1:-1] *= 2.0
            else:
                amp[1:] *= 2.0
            frequencies = np.fft.rfftfreq(len(centered), d=sample_interval)
    except FloatingPointError as error:
        raise ValueError("spectrum exceeds the representable floating-point range") from error
    if not bool(np.all(np.isfinite(amp))) or not bool(np.all(np.isfinite(frequencies))):
        raise ValueError("spectrum exceeds the representable floating-point range")
    return np.asarray(frequencies, dtype=np.float64), amp
