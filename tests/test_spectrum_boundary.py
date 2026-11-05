"""Boundary regressions for the importable production spectrum helper."""

import unittest

try:
    import numpy as np

    _NUMPY_AVAILABLE = True
except ImportError:
    _NUMPY_AVAILABLE = False


@unittest.skipUnless(_NUMPY_AVAILABLE, "spectrum boundary tests require the studies extra")
class SpectrumBoundaryTests(unittest.TestCase):
    def test_rejects_nonfinite_samples(self) -> None:
        from datacenter_twin.spectrum import spectrum

        for value in [float("nan"), float("inf"), -float("inf")]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                spectrum(np.array([0.0, value, 1.0]), 2.0)

    def test_rejects_invalid_duration(self) -> None:
        from datacenter_twin.spectrum import spectrum

        for value in [0.0, -1.0, float("nan"), float("inf")]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                spectrum(np.array([0.0, 1.0, 0.0]), value)

    def test_rejects_undefined_hann_windows_and_shapes(self) -> None:
        from datacenter_twin.spectrum import spectrum

        for signal in [np.array([]), np.array([1.0]), np.array([1.0, 2.0]), np.ones((3, 2))]:
            with self.subTest(shape=signal.shape), self.assertRaises(ValueError):
                spectrum(signal, 2.0)

    def test_constant_signal_has_zero_spectrum(self) -> None:
        from datacenter_twin.spectrum import spectrum

        frequency, amplitude = spectrum(np.ones(9), 2.0)
        np.testing.assert_array_equal(amplitude, np.zeros(5))
        self.assertEqual(frequency[0], 0.0)

    def test_rejects_complex_samples(self) -> None:
        from datacenter_twin.spectrum import spectrum

        with self.assertRaises(ValueError):
            spectrum(np.array([1j, 2j, 3j]), 2.0)

    def test_rejects_unrepresentable_intermediates(self) -> None:
        from datacenter_twin.spectrum import spectrum

        with self.assertRaises(ValueError):
            spectrum(np.array([1.0, 2.0, 3.0]), float.fromhex("0x0.0000000000001p-1022"))
        with self.assertRaises(ValueError):
            spectrum(np.array([1.7e308, 1.7e308, 1.7e308]), 2.0)


if __name__ == "__main__":
    unittest.main()
