"""Independent DFT regression for the production one-sided spectrum."""

from __future__ import annotations

import unittest

try:
    import numpy as np
    from numpy.typing import NDArray

    _NUMPY_AVAILABLE = True
except ImportError:
    _NUMPY_AVAILABLE = False


@unittest.skipUnless(_NUMPY_AVAILABLE, "spectrum regressions require NumPy")
class SpectrumParityTests(unittest.TestCase):
    @staticmethod
    def spectrum(signal: NDArray[np.float64]) -> tuple[NDArray[np.float64], NDArray[np.float64]]:
        from datacenter_twin.spectrum import spectrum

        return spectrum(signal, duration=2.0)

    def assert_matches_full_dft(self, n: int) -> None:
        samples = np.arange(n)
        signal = 0.37 * np.cos(2 * np.pi * (n // 2) * samples / n)
        signal += 0.1 * np.sin(2 * np.pi * 10 * samples / n)
        window = np.hanning(n)
        weighted = (signal - signal.mean()) * window
        # Direct full complex DFT, deliberately independent of rfft/fft.
        full = np.exp(-2j * np.pi * np.outer(samples, samples) / n) @ weighted
        expected = np.abs(full[: n // 2 + 1]) / window.sum()
        for k in range(1, len(expected)):
            if n % 2 or k != n // 2:
                expected[k] += abs(full[n - k]) / window.sum()
        frequencies, actual = self.spectrum(signal)
        np.testing.assert_allclose(actual, expected, rtol=1e-10, atol=3e-14)
        np.testing.assert_allclose(frequencies, np.arange(n // 2 + 1) * (n - 1) / (2.0 * n))
        self.assertGreater(expected[-1], 0.1)

    def test_odd_801_doubles_the_last_positive_frequency(self) -> None:
        self.assert_matches_full_dft(801)

    def test_even_800_keeps_the_nyquist_amplitude_undoubled(self) -> None:
        self.assert_matches_full_dft(800)


if __name__ == "__main__":
    unittest.main()
