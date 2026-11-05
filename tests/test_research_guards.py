"""Exercise solver rejection paths and independent small analytical cases."""

from __future__ import annotations

import io
import json
import math
import runpy
import tempfile
import unittest
from contextlib import redirect_stdout
from importlib.util import find_spec
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

_NUMERICS_AVAILABLE = find_spec("numpy") is not None and find_spec("scipy") is not None


@unittest.skipUnless(_NUMERICS_AVAILABLE, "research studies require the optional NumPy/SciPy stack")
class NumericalHelperTests(unittest.TestCase):
    def test_division_guard_preserves_denominator_sign(self) -> None:
        from datacenter_twin.research.common import safe_div

        self.assertEqual(safe_div(6.0, 3.0), 2.0)
        self.assertEqual(safe_div(2.0, 0.0, eps=0.01), 200.0)
        self.assertEqual(safe_div(2.0, -1e-6, eps=0.01), -200.0)

    def test_finite_difference_matches_independent_polynomial_jacobian(self) -> None:
        import numpy as np

        from datacenter_twin.research.common import numeric_jacobian

        jacobian = numeric_jacobian(
            lambda state: np.array([state[0] ** 2 + 3 * state[1], state[0] * state[1]]),
            np.array([2.0, 4.0]),
        )
        np.testing.assert_allclose(jacobian, [[4.0, 3.0], [4.0, 2.0]], rtol=1e-6, atol=1e-6)

    def test_tuning_rejects_unknown_control_loop(self) -> None:
        from datacenter_twin.research.common import ns, pi_bw_tuning

        self.assertEqual(ns(voltage=1.0).voltage, 1.0)
        with self.assertRaisesRegex(ValueError, "Unknown loop_type"):
            pi_bw_tuning("unsupported", 5.0, 1.0, 2.0, 60.0)

    def test_hann_window_handles_degenerate_and_symmetric_samples(self) -> None:
        import numpy as np

        from datacenter_twin.research.common import matlab_hann

        self.assertEqual(matlab_hann(0).size, 0)
        np.testing.assert_array_equal(matlab_hann(1), [1.0])
        np.testing.assert_allclose(matlab_hann(4), [0.0, 0.75, 0.75, 0.0], atol=1e-15)

    def test_plot_style_preserves_axes_identity_and_updates_each_spine(self) -> None:
        from collections.abc import Mapping
        from typing import assert_type

        from datacenter_twin.research.common import _Spine, set_ieee_axes

        class PlotSpine:
            def __init__(self) -> None:
                self.widths: list[float] = []

            def set_linewidth(self, width: float) -> None:
                self.widths.append(width)

        class PlotAxes:
            def __init__(self) -> None:
                self.spine_records = {"left": PlotSpine(), "bottom": PlotSpine()}
                self.spines: Mapping[str, _Spine] = self.spine_records
                self.grids: list[tuple[bool, float]] = []
                self.ticks: list[tuple[str, float, int]] = []

            def grid(self, visible: bool, *, alpha: float) -> None:
                self.grids.append((visible, alpha))

            def tick_params(self, *, direction: str, width: float, labelsize: int) -> None:
                self.ticks.append((direction, width, labelsize))

        axes = PlotAxes()
        styled = assert_type(set_ieee_axes(axes, fontsize=10), PlotAxes)
        self.assertIs(styled, axes)
        self.assertEqual(axes.grids, [(True, 0.18)])
        self.assertEqual(axes.ticks, [("out", 0.8, 10)])
        for spine in axes.spine_records.values():
            self.assertEqual(spine.widths, [0.8])

    def test_plot_style_type_parameter_keeps_its_bound_and_declaration_scope(self) -> None:
        from typing import TypeVar

        from datacenter_twin.research import common

        parameters: tuple[TypeVar, ...] = getattr(common.set_ieee_axes, "__type_params__", ())
        self.assertEqual(len(parameters), 1)
        parameter = parameters[0]
        self.assertIsInstance(parameter, TypeVar)
        self.assertEqual(parameter.__name__, "AxesType")
        self.assertIs(parameter.__bound__, common._Axes)
        self.assertTrue(parameter.__infer_variance__)
        self.assertNotIn("AxesType", vars(common))

    def test_load_command_alias_resolves_its_real_type_lazily(self) -> None:
        from collections.abc import Callable
        from importlib.util import module_from_spec
        from typing import TypeAliasType

        specification = find_spec("datacenter_twin.research.types")
        if specification is None or specification.loader is None:
            self.fail("The research type module must have an executable loader")
        isolated = module_from_spec(specification)
        specification.loader.exec_module(isolated)
        alias = vars(isolated)["LoadCommand"]
        self.assertIsInstance(alias, TypeAliasType)
        with patch.object(isolated, "Real", int):
            self.assertEqual(alias.__value__, int | Callable[[float], int])

    def test_research_type_aliases_keep_runtime_and_annotation_contracts(self) -> None:
        from collections.abc import Callable
        from typing import TypeAliasType, get_type_hints

        import numpy as np
        from numpy.typing import NDArray

        from datacenter_twin.research.datacenter_port_model import datacenter_core_equations
        from datacenter_twin.research.types import (
            Complex,
            ComplexArray,
            FloatArray,
            LoadCommand,
            Real,
        )

        for alias, name, value in (
            (FloatArray, "FloatArray", NDArray[np.float64]),
            (ComplexArray, "ComplexArray", NDArray[np.complex128]),
            (Real, "Real", float | np.float64),
            (Complex, "Complex", complex | np.complex128),
            (LoadCommand, "LoadCommand", Real | Callable[[float], Real]),
        ):
            with self.subTest(alias=name):
                self.assertIsInstance(alias, TypeAliasType)
                self.assertEqual(alias.__name__, name)
                self.assertEqual(alias.__module__, "datacenter_twin.research.types")
                self.assertEqual(alias.__type_params__, ())
                self.assertEqual(alias.__value__, value)

        hints = get_type_hints(datacenter_core_equations)
        self.assertIs(hints["x"], FloatArray)
        self.assertIs(hints["vport"], Complex)
        self.assertIs(hints["p_load"], Real)
        self.assertIs(hints["omega_sys"], Real)
        self.assertEqual(hints["return"], tuple[FloatArray, Complex, Real])

    def test_newton_solves_linear_equation_without_mutating_initial_state(self) -> None:
        import numpy as np

        from datacenter_twin.research.sdcib_core import run_newton_solver

        initial = np.array([0.0])
        output = io.StringIO()
        with redirect_stdout(output):
            state, norm = run_newton_solver(initial, lambda value, load: value - load, 2.0)
        np.testing.assert_allclose(state, [2.0], atol=1e-10)
        np.testing.assert_array_equal(initial, [0.0])
        self.assertLess(norm, 1e-10)
        self.assertIn("||F||=", output.getvalue())

    def test_newton_handles_a_singular_but_consistent_system(self) -> None:
        import numpy as np

        from datacenter_twin.research.sdcib_core import run_newton_solver

        state, norm = run_newton_solver(
            np.array([0.0, 3.0]),
            lambda value, load: np.array([value[0] - load, 0.0]),
            2.0,
            do_print=False,
        )
        np.testing.assert_allclose(state, [2.0, 3.0], atol=1e-10)
        self.assertLess(norm, 1e-10)

    def test_stalled_newton_step_is_reported_and_never_claims_convergence(self) -> None:
        import numpy as np

        from datacenter_twin.research.sdcib_core import run_newton_solver
        from datacenter_twin.research.types import FloatArray, Real

        def constant(_value: FloatArray, _load: Real) -> FloatArray:
            return np.array([1.0])

        with redirect_stdout(io.StringIO()), self.assertWarnsRegex(UserWarning, "stalled"):
            state, norm = run_newton_solver(np.array([4.0]), constant, 0.0, max_it=1, tol_x=0.0)
        np.testing.assert_array_equal(state, [4.0])
        self.assertEqual(norm, 1.0)
        # The unchanged residual is also returned when the small-step guard exits.
        _, norm = run_newton_solver(np.array([4.0]), constant, 0.0, do_print=False)
        self.assertEqual(norm, 1.0)

    def test_eigenvalue_tracking_keeps_distinct_modes_paired(self) -> None:
        import numpy as np

        from datacenter_twin.research.sdcib_core import (
            match_eigs_global,
            sort_eigs_for_tracking,
        )

        previous = np.array([-1 + 2j, -1 - 2j, -4 + 0j])
        current = np.array([-4.1 + 0j, -1.1 + 2.1j, -1.1 - 2.1j])
        np.testing.assert_array_equal(match_eigs_global(previous, current), [1, 2, 0])
        np.testing.assert_array_equal(sort_eigs_for_tracking(previous), [-1 + 2j, -4 + 0j, -1 - 2j])

    def test_piecewise_frequency_phase_is_the_continuous_integral(self) -> None:
        from datacenter_twin.research.sdcib_core import f_schedule, phase_stepfreq, smoothstep01

        for time, frequency, phase in (
            (0.0, 0.0, 0.0),
            (1.0, 2.0, 0.0),
            (1.5, 2.0, 1.0),
            (2.0, 3.0, 2.0),
            (2.5, 3.0, 3.5),
            (3.0, 4.0, 5.0),
            (4.0, 4.0, 9.0),
        ):
            with self.subTest(time=time):
                self.assertEqual(f_schedule(time, 1.0, 2.0, 2.0, 3.0, 3.0, 4.0), frequency)
                self.assertEqual(phase_stepfreq(time, 1.0, 2.0, 2.0, 3.0, 3.0, 4.0), phase)
        self.assertEqual(smoothstep01(-1.0), 0.0)
        self.assertEqual(smoothstep01(0.5), 0.5)
        self.assertEqual(smoothstep01(2.0), 1.0)

    def test_signal_collection_keeps_each_sample_command_and_state(self) -> None:
        import numpy as np

        from datacenter_twin.research import STUDY_DEFAULTS
        from datacenter_twin.research.sdcib import initial_guess, make_parameters
        from datacenter_twin.research.sdcib_core import collect_signals_reduced

        parameters, _ = make_parameters(STUDY_DEFAULTS["modal"])
        times = np.array([0.0, 0.1, 0.2])
        states = np.tile(initial_guess(parameters), (len(times), 1))
        signals = collect_signals_reduced(times, states, parameters, lambda time: 0.4 + time)
        np.testing.assert_allclose(signals["p_load_cmd"], [0.4, 0.5, 0.6], atol=1e-15)
        np.testing.assert_array_equal(signals["vdc_ups"], [1.0, 1.0, 1.0])
        np.testing.assert_array_equal(signals["v_eq"], [0.5, 0.5, 0.5])


@unittest.skipUnless(_NUMERICS_AVAILABLE, "research studies require the optional NumPy/SciPy stack")
class ScientificRejectionTests(unittest.TestCase):
    def test_bdf_uses_explicit_initial_state_and_matches_exponential_decay(self) -> None:
        import numpy as np

        from datacenter_twin.research.sdcib import _sample_solver

        times = np.array([0.0, 0.25, 0.5])
        initial = np.array([2.0])
        result = _sample_solver(lambda _time, value: -value, initial, 0.0, 0.5, times, 0.01)
        np.testing.assert_allclose(result.y[0], 2 * np.exp(-times), rtol=2e-6, atol=1e-8)
        np.testing.assert_array_equal(initial, [2.0])

    def test_bdf_rejects_failed_incomplete_and_nonfinite_results(self) -> None:
        import numpy as np

        from datacenter_twin.research.model_comparison import _integrate_segment
        from datacenter_twin.research.model_validation import build_params
        from datacenter_twin.research.sdcib import _sample_solver

        times = np.array([0.0, 0.5])
        for success, columns, value, message in (
            (False, 2, 0.0, "did not complete"),
            (True, 1, 0.0, "did not complete"),
            (True, 2, math.nan, "non-finite"),
        ):
            with self.subTest(success=success, columns=columns, value=value):
                result = SimpleNamespace(
                    success=success, y=np.full((62, columns), value), message="injected failure"
                )
                with (
                    patch("datacenter_twin.research.sdcib.solve_ivp", return_value=result),
                    self.assertRaisesRegex(ValueError, message),
                ):
                    _sample_solver(lambda _time, state: -state, np.zeros(62), 0.0, 0.5, times, 0.01)
                with (
                    patch(
                        "datacenter_twin.research.model_comparison.solve_ivp", return_value=result
                    ),
                    self.assertRaisesRegex(ValueError, message),
                ):
                    _integrate_segment(
                        np.zeros(62), 0.0, 0.5, times, 0.5, build_params(), rtol=1e-8, atol=1e-10
                    )

    def test_model_pair_rejects_runaway_states_without_clipping(self) -> None:
        import numpy as np

        from datacenter_twin.research.model_comparison import _integrate_segment
        from datacenter_twin.research.model_validation import build_params

        runaway = SimpleNamespace(success=True, y=np.full((62, 2), 1e6 + 1), message="success")
        with (
            patch("datacenter_twin.research.model_comparison.solve_ivp", return_value=runaway),
            self.assertRaisesRegex(ValueError, "without clipping"),
        ):
            _integrate_segment(
                np.zeros(62),
                0.0,
                0.5,
                np.array([0.0, 0.5]),
                0.5,
                build_params(),
                rtol=1e-8,
                atol=1e-10,
            )

    def test_model_pair_rejects_impossible_startup_and_invalid_tolerances(self) -> None:
        from datacenter_twin.research.model_comparison import _initial_state, run_model_comparison
        from datacenter_twin.research.model_validation import build_params

        parameters = build_params()
        parameters["r_psu"] = 100.0
        with self.assertRaisesRegex(ValueError, "no real initialized conductance"):
            _initial_state(parameters)
        for tolerance in (0.0, -1.0, math.inf, math.nan):
            with (
                self.subTest(tolerance=tolerance),
                self.assertRaisesRegex(ValueError, "tolerances"),
            ):
                run_model_comparison({"load_final_pu": 0.6}, rtol=tolerance)

    def test_equilibrium_fallback_is_independently_recomputed(self) -> None:
        import numpy as np

        from datacenter_twin.research import STUDY_DEFAULTS
        from datacenter_twin.research.sdcib import equilibrium, make_parameters

        parameters, _ = make_parameters(STUDY_DEFAULTS["modal"])
        expected_state, _, _ = equilibrium(parameters)
        fallback = SimpleNamespace(x=expected_state, nfev=7, success=True)
        with (
            patch(
                "datacenter_twin.research.sdcib.run_newton_solver",
                return_value=(np.full(21, math.nan), 0.0),
            ),
            patch("datacenter_twin.research.sdcib.root", return_value=fallback) as solver,
        ):
            state, residual, evaluations = equilibrium(parameters)
        solver.assert_called_once()
        np.testing.assert_array_equal(state, expected_state)
        self.assertLess(residual, 1e-6)
        self.assertEqual(evaluations, 7)
        fallback.x = np.full(21, math.nan)
        with (
            patch(
                "datacenter_twin.research.sdcib.run_newton_solver",
                return_value=(np.full(21, math.nan), 0.0),
            ),
            patch("datacenter_twin.research.sdcib.root", return_value=fallback),
            self.assertRaisesRegex(ValueError, "recomputed"),
        ):
            equilibrium(parameters)

    def test_power_flow_rejects_invalid_solution_and_singular_load_block(self) -> None:
        import numpy as np

        from datacenter_twin.research.grid_network import _power_flow

        with (
            patch(
                "datacenter_twin.research.grid_network.root",
                return_value=SimpleNamespace(x=np.full(15, math.nan), success=True),
            ),
            self.assertRaisesRegex(ValueError, "did not converge"),
        ):
            _power_flow(0.5)
        with (
            patch("datacenter_twin.research.grid_network.np.linalg.cond", return_value=1e13),
            self.assertRaisesRegex(ValueError, "load block is ill-conditioned"),
        ):
            _power_flow(0.5)

    def test_study_boundary_rejects_invalid_identity_shapes_and_nested_nonfinite_values(
        self,
    ) -> None:
        from datacenter_twin.research import _validate_result, run_study

        for payload in (
            '{"study_id":"other","model":"example"}',
            '{"model":1}',
            '{"model":"example","charts":{}}',
            '{"model":"example","metrics":{}}',
            '{"model":"example","diagnostics":{"invalid":[NaN]}}',
        ):
            with self.subTest(payload=payload), self.assertRaises(ValueError):
                _validate_result(json.loads(payload), "modal", {})
        with self.assertRaisesRegex(ValueError, "Unknown study_id"):
            run_study("unsupported")
        with self.assertRaisesRegex(ValueError, "JSON object"):
            run_study("modal", json.loads("[]"))


@unittest.skipUnless(_NUMERICS_AVAILABLE, "research studies require the optional NumPy/SciPy stack")
class SolverDiagnosticBoundaryTests(unittest.TestCase):
    def test_unsuccessful_device_solvers_keep_failure_diagnostics(self) -> None:
        import numpy as np

        from datacenter_twin.research.datacenter_init_from_pf_qss import datacenter_init_from_pf_qss
        from datacenter_twin.research.gfl_init_from_pf_qss_newton import gfl_init_from_pf_qss_newton
        from datacenter_twin.research.gfm_init_from_pf_qss_newton import gfm_init_from_pf_qss_newton
        from datacenter_twin.research.grid_network import (
            _dc_params,
            _gfl_params,
            _gfm_params,
            _power_flow,
        )

        net = _power_flow(0.5)
        dc = _dc_params(60.0)
        dc_state, dc_refs, _ = datacenter_init_from_pf_qss(net["Vp"][3], net["Ip"][3], dc)
        dc_solution = np.r_[dc_state, dc_refs["p_load"], dc_refs["B_shunt"]]
        with (
            patch(
                "datacenter_twin.research.datacenter_init_from_pf_qss.root",
                return_value=SimpleNamespace(x=dc_solution, success=False),
            ),
            self.assertWarnsRegex(UserWarning, "DataCenter init did not fully converge"),
        ):
            state, _, info = datacenter_init_from_pf_qss(net["Vp"][3], net["Ip"][3], dc)
        np.testing.assert_array_equal(state, dc_state)
        self.assertEqual(info["exitflag"], -1)
        self.assertLess(info["residual_inf"], 1e-5)

        gfl = _gfl_params(100.0, 60.0)
        gfl_state, gfl, _, _ = gfl_init_from_pf_qss_newton(net["Vp"][2], net["Ip"][2], gfl)
        with (
            patch(
                "datacenter_twin.research.gfl_init_from_pf_qss_newton.root",
                return_value=SimpleNamespace(x=gfl_state, success=False),
            ),
            self.assertWarnsRegex(UserWarning, "GFL init Newton did not fully converge"),
        ):
            state, _, _, info = gfl_init_from_pf_qss_newton(net["Vp"][2], net["Ip"][2], gfl)
        np.testing.assert_array_equal(state, gfl_state)
        self.assertEqual(info["exitflag"], -1)
        self.assertLess(info["fval_inf"], 1e-5)

        gfm = _gfm_params(60.0)
        gfm_state, _ = gfm_init_from_pf_qss_newton(net["Vp"][1], net["Ip"][1], gfm)
        with (
            patch(
                "datacenter_twin.research.gfm_init_from_pf_qss_newton.least_squares",
                return_value=SimpleNamespace(x=gfm_state, fun=np.array([0.1, -2.0]), success=False),
            ),
            self.assertWarnsRegex(UserWarning, "max\\|F\\|=2.000e\\+00 at eqn #2"),
        ):
            state, _ = gfm_init_from_pf_qss_newton(net["Vp"][1], net["Ip"][1], gfm)
        np.testing.assert_array_equal(state, gfm_state)

    def test_machine_angle_fallback_preserves_speed_default_and_explicit_solver_options(
        self,
    ) -> None:
        import numpy as np

        from datacenter_twin.research.grid_network import _power_flow, _sm_params
        from datacenter_twin.research.sm_init_from_pf_fsolve import sm_init_from_pf_fsolve
        from datacenter_twin.research.sm_port_model import sm_port_model

        net = _power_flow(0.5)
        voltage, current = net["Vp"][0], net["Ip"][0]
        baseline, _, _, _ = sm_init_from_pf_fsolve(voltage, current, _sm_params(60.0))
        angle_failures: tuple[object, ...] = (
            SimpleNamespace(success=False, x=np.array([math.nan])),
            RuntimeError("angle refinement failed"),
        )
        for angle_failure in angle_failures:
            machine = _sm_params(60.0)
            del machine.ws
            with (
                self.subTest(angle_failure=type(angle_failure)),
                patch(
                    "datacenter_twin.research.sm_init_from_pf_fsolve.root",
                    side_effect=[angle_failure, SimpleNamespace(x=baseline, success=True)],
                ) as solver,
            ):
                state, machine, refs, info = sm_init_from_pf_fsolve(
                    voltage, current, machine, {"maxfev": 123}
                )
            self.assertEqual(refs["ws"], 1.0)
            self.assertEqual(solver.call_args_list[1].kwargs["options"]["maxfev"], 123)
            np.testing.assert_array_equal(state, baseline)
            residual = np.linalg.norm(
                sm_port_model(0.0, state, voltage, machine, refs["pref"])[0], np.inf
            )
            self.assertEqual(info["residual_inf"], residual)

    def test_data_center_port_default_speed_and_callable_load_match_explicit_inputs(self) -> None:
        import numpy as np

        from datacenter_twin.research.datacenter_init_from_pf_qss import datacenter_init_from_pf_qss
        from datacenter_twin.research.datacenter_port_model import datacenter_port_model
        from datacenter_twin.research.grid_network import _dc_params, _power_flow

        net, dc = _power_flow(0.5), _dc_params(60.0)
        voltage = net["Vp"][3]
        state, refs, _ = datacenter_init_from_pf_qss(voltage, net["Ip"][3], dc)
        explicit = datacenter_port_model(0.0, state, voltage, dc, refs, 1.0)
        command = SimpleNamespace(p_load=lambda _time: refs["p_load"], B_shunt=refs["B_shunt"])
        default = datacenter_port_model(0.0, state, voltage, dc, command)
        np.testing.assert_array_equal(default[0], explicit[0])
        self.assertEqual(default[1:], explicit[1:])

    def test_modal_diagnostics_reject_bad_eigenvectors_and_nonfinite_transfer(self) -> None:
        import numpy as np
        from scipy.linalg import eig

        from datacenter_twin.research import STUDY_DEFAULTS
        from datacenter_twin.research.sdcib import (
            equilibrium,
            linearize,
            make_parameters,
            run_sdcib_study,
        )

        config = STUDY_DEFAULTS["modal"]
        parameters, _ = make_parameters(config)
        state, _, _ = equilibrium(parameters)
        matrix, inputs, outputs, direct, power = linearize(parameters, state)
        eigenvalues, left, right = eig(matrix, left=True, right=True, check_finite=True)
        with (
            patch("datacenter_twin.research.sdcib.np.linalg.cond", return_value=math.inf),
            self.assertRaisesRegex(ValueError, "eigenvectors are ill-conditioned"),
        ):
            run_sdcib_study("modal", config)
        for bad_left, bad_right, message in (
            (np.eye(len(state)), np.eye(len(state)), "eigenvector residual"),
            (left * 1e-20, right * 1e-20, "participation normalization"),
        ):
            with (
                self.subTest(message=message),
                patch(
                    "datacenter_twin.research.sdcib.eig",
                    return_value=(eigenvalues, bad_left, bad_right),
                ),
                self.assertRaisesRegex(ValueError, message),
            ):
                run_sdcib_study("modal", config)
        with (
            patch(
                "datacenter_twin.research.sdcib.linearize",
                return_value=(matrix, inputs, outputs, math.nan, power),
            ),
            self.assertRaisesRegex(ValueError, "Frequency response contains a non-finite"),
        ):
            run_sdcib_study("modal", config)
        self.assertTrue(math.isfinite(direct))
        with self.assertRaisesRegex(ValueError, "Unsupported SDCIB study"):
            run_sdcib_study("unregistered-study", config)

    def test_model_comparison_rejects_nonfinite_outputs_even_with_finite_states(self) -> None:
        import numpy as np

        from datacenter_twin.research.model_comparison import run_model_comparison
        from datacenter_twin.research.types import FloatArray

        def sampled(
            initial: FloatArray,
            _start: float,
            _end: float,
            times: FloatArray,
            _load: float,
            _parameters: dict[str, float],
            **_tolerances: float,
        ) -> SimpleNamespace:
            return SimpleNamespace(t=times, y=np.repeat(initial[:, None], len(times), axis=1))

        with (
            patch(
                "datacenter_twin.research.model_comparison._integrate_segment", side_effect=sampled
            ),
            patch(
                "datacenter_twin.research.model_comparison.get_sys_derivatives",
                return_value=(np.zeros(62), math.nan, 0.0, 0.0, 0.0),
            ),
            self.assertRaisesRegex(ValueError, "outputs are non-finite; result withheld"),
        ):
            run_model_comparison({"load_final_pu": 0.6})

    def test_spectrum_rejects_nonfinite_backend_coefficients_and_frequency_grid(self) -> None:
        import numpy as np

        from datacenter_twin.spectrum import spectrum

        samples = np.array([0.0, 1.0, 0.0, -1.0, 0.0])
        for name, returned in (
            ("rfft", np.array([complex(math.nan), 0j, 0j])),
            ("rfftfreq", np.array([0.0, math.inf, 1.0])),
        ):
            with (
                self.subTest(name=name),
                patch("datacenter_twin.spectrum.np.fft." + name, return_value=returned),
                self.assertRaisesRegex(ValueError, "representable floating-point range"),
            ):
                spectrum(samples, 1.0)


@unittest.skipUnless(_NUMERICS_AVAILABLE, "research studies require the optional NumPy/SciPy stack")
class ResearchCommandTests(unittest.TestCase):
    def test_module_command_writes_stdout_or_file_with_validated_config(self) -> None:
        result = {"study_id": "modal", "model": "test solver result"}
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            config = path / "config.json"
            config.write_text('{"load_pu":0.55}', encoding="utf-8")
            for to_file in (False, True):
                output = path / "result.json"
                argv = ["research", "--study", "modal", "--config", str(config)]
                if to_file:
                    argv += ["--output", str(output)]
                stdout = io.StringIO()
                with (
                    self.subTest(to_file=to_file),
                    patch("sys.argv", argv),
                    patch("datacenter_twin.research.run_study", return_value=result) as study,
                    redirect_stdout(stdout),
                ):
                    runpy.run_module("datacenter_twin.research", run_name="__main__")
                study.assert_called_once_with("modal", {"load_pu": 0.55})
                encoded = output.read_text(encoding="utf-8") if to_file else stdout.getvalue()
                self.assertEqual(json.loads(encoded), result)
                if to_file:
                    self.assertIn("Saved power-dynamics study:", stdout.getvalue())

    def test_force_requires_an_output_and_input_is_never_overwritten(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            config = Path(directory) / "config.json"
            original = '{"load_pu":0.55}'
            config.write_text(original, encoding="utf-8")
            for args in (
                ["--force"],
                ["--config", str(config), "--output", str(config), "--force"],
            ):
                with (
                    self.subTest(args=args),
                    patch("sys.argv", ["research", "--study", "modal", *args]),
                    patch("sys.stderr", io.StringIO()),
                    patch("datacenter_twin.research.run_study", return_value={"model": "example"}),
                    self.assertRaises(SystemExit) as error,
                ):
                    runpy.run_module("datacenter_twin.research", run_name="__main__")
                self.assertEqual(error.exception.code, 2)
                self.assertEqual(config.read_text(encoding="utf-8"), original)
