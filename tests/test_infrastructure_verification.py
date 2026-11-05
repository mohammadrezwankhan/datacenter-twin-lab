"""Independent fixture verification rejects malformed numeric and state evidence."""

import json
import math
import unittest

from scripts import verify_infrastructure as verifier


class InfrastructureVerificationTests(unittest.TestCase):
    def test_boolean_actual_is_not_a_numeric_measurement(self) -> None:
        for actual, wanted in ((True, 1), (False, 0), (True, 1.0)):
            with self.subTest(actual=actual, wanted=wanted), self.assertRaises(AssertionError):
                verifier.assert_same("case", "power", actual, wanted)

    def test_numeric_actual_is_not_a_boolean_state(self) -> None:
        for actual, wanted in ((1, True), (0, False), (1.0, True)):
            with self.subTest(actual=actual, wanted=wanted), self.assertRaises(AssertionError):
                verifier.assert_same("case", "enabled", actual, wanted)
        verifier.assert_same("case", "enabled", True, True)
        verifier.assert_same("case", "enabled", False, False)

    def test_nonfinite_or_non_numeric_expectations_fail(self) -> None:
        wanted: object
        for wanted in (math.nan, math.inf, [], {}):
            with self.subTest(wanted=wanted), self.assertRaises(AssertionError):
                verifier.assert_same("case", "power", 1, wanted)

    def test_nonfinite_measurements_fail(self) -> None:
        for actual in (math.nan, math.inf, -math.inf, "1", None):
            with self.subTest(actual=actual), self.assertRaises(AssertionError):
                verifier.assert_same("case", "power", actual, 1)

    def test_all_frozen_cases_retain_independent_numeric_agreement(self) -> None:
        cases = verifier.golden_cases(json.loads(verifier.CASES_PATH.read_text(encoding="utf-8")))
        self.assertEqual(len(cases), 24)
        for case in cases:
            computed = verifier.expected(case["model"], case["inputs"])
            for key, wanted in case["expected"].items():
                with self.subTest(case=case["id"], key=key):
                    verifier.assert_same(case["id"], key, computed[key], wanted)

    def test_input_narrowing_preserves_native_integer_and_float_values(self) -> None:
        self.assertIs(type(verifier.numeric_input({"n": 3}, "n")), int)
        self.assertIs(type(verifier.numeric_input({"n": 3.5}, "n")), float)
        for value in (True, False, None, "3", math.inf, math.nan):
            with self.subTest(value=value), self.assertRaisesRegex(ValueError, "finite real"):
                verifier.numeric_input({"n": value}, "n")

    def test_summation_retains_input_order_and_rejects_malformed_sequences(self) -> None:
        values = [1e16, -1e16, 1.0]
        self.assertEqual(sum(verifier.numeric_sequence({"s": values}, "s")), 1.0)
        for value in (None, "12", [True], [math.inf]):
            with self.subTest(value=value), self.assertRaises(ValueError):
                verifier.numeric_sequence({"s": value}, "s")

    def test_golden_boundary_rejects_malformed_records(self) -> None:
        value: object
        for value in (None, {}, [1], [{1: "not a field"}], [{"id": 1, "model": "loadLedger"}]):
            with self.subTest(value=value), self.assertRaises(ValueError):
                verifier.golden_cases(value)

    def test_browser_boundary_rejects_malformed_results(self) -> None:
        value: object
        for value in (None, {}, [1], [{"id": 1, "result": {}}], [{"id": "a", "result": []}]):
            with self.subTest(value=value), self.assertRaises(ValueError):
                verifier.browser_results(value)
        self.assertEqual(verifier.browser_results([]), [])
        self.assertEqual(
            verifier.browser_results([{"id": "a", "result": {"power": 2}}]),
            [{"id": "a", "result": {"power": 2}}],
        )

    def test_unknown_model_still_fails(self) -> None:
        with self.assertRaisesRegex(ValueError, "No independent equation"):
            verifier.expected("unregistered", {})
