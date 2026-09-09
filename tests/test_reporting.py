from dataclasses import replace
import unittest

from datacenter_twin.continuity import simulate_continuity
from datacenter_twin.demo import demo_scenario
from datacenter_twin.reporting import render_html, render_markdown
from datacenter_twin.sensitivity import sweep_continuity


class ReportingTests(unittest.TestCase):
    def test_single_run_reports_are_deterministic_and_complete(self):
        scenario = replace(demo_scenario("generator_failure"), name="<script>alert('x')</script> | outage")
        result = simulate_continuity(scenario).to_dict()
        markdown = render_markdown(result)
        html = render_html(result)
        self.assertEqual(markdown, render_markdown(result))
        self.assertEqual(html, render_html(result))
        self.assertIn("Input SHA-256", markdown)
        self.assertIn("Unserved IT energy", markdown)
        self.assertIn("Energy balance residual", html)
        self.assertIn("Event timeline", markdown)
        self.assertIn("asset_down", html)
        self.assertIn("&lt;script&gt;", html)
        self.assertNotIn("<script>", html)
        self.assertNotIn("<script>", markdown)
        self.assertNotIn("generated_at", markdown)
        self.assertNotIn("<img", html)

    def test_unknown_generator_cost_is_visible_in_single_report(self):
        result = simulate_continuity(demo_scenario("utility_loss")).to_dict()
        markdown = render_markdown(result)
        html = render_html(result)
        self.assertIn("generator\\_energy\\_charge", markdown)
        self.assertIn("total_incremental_energy_charge", html)

    def test_sweep_report_has_ordered_values_warnings_and_caveats(self):
        result = sweep_continuity(demo_scenario("generator_failure"), "battery_initial_kwh", ["0", "100"])
        markdown = render_markdown(result)
        html = render_html(result)
        self.assertLess(markdown.index("0 kWh"), markdown.index("100 kWh"))
        self.assertIn("Sensitivity outcomes", markdown)
        self.assertIn("Unserved (kWh)", markdown)
        self.assertIn("Input SHA-256", markdown)
        self.assertIn("Run ID", markdown)
        self.assertIn("Assumptions", markdown)
        self.assertIn("Limitations", markdown)
        self.assertIn("<table>", html)
        self.assertIn("Base input SHA-256", html)
        self.assertIn("Full per-run results included", html)
        self.assertNotIn("<script", html.lower())
