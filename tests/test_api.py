import importlib.util
import unittest
from pathlib import Path

from datacenter_twin.demo import demo_scenario
from datacenter_twin.continuity import simulate_continuity

HAS_API = importlib.util.find_spec("fastapi") is not None and importlib.util.find_spec("httpx") is not None


@unittest.skipUnless(HAS_API, "Install the api and test-api extras to exercise HTTP contracts")
class ApiTests(unittest.TestCase):
    def setUp(self):
        from fastapi.testclient import TestClient
        from datacenter_twin.api import create_app
        self.client = TestClient(create_app())

    def tearDown(self): self.client.close()

    def test_api_calculates_exactly_the_same_run_as_domain_engine(self):
        scenario = demo_scenario("generator_failure")
        response = self.client.post("/api/v1/simulations", json=scenario.to_dict())
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json(), simulate_continuity(scenario).to_dict())

    def test_invalid_topology_rejected(self):
        scenario = demo_scenario().to_dict()
        scenario["dependencies"][0]["target"] = "missing"
        response = self.client.post("/api/v1/simulations", json=scenario)
        self.assertEqual(response.status_code, 422)
        self.assertIn("missing asset", response.json()["error"])

    def test_host_and_cross_origin_boundaries(self):
        self.assertEqual(self.client.get("/api/v1/health", headers={"host":"untrusted.example"}).status_code,400)
        response = self.client.options("/api/v1/simulations", headers={"origin":"https://untrusted.example", "access-control-request-method":"POST"})
        self.assertEqual(response.status_code,400)

    def test_duplicate_keys_and_large_inputs(self):
        for content in (b'{"schema_version":2,"schema_version":1}', b" "*(4*1024*1024+1)):
            response = self.client.post("/api/v1/simulations", content=content, headers={"content-type":"application/json"})
            self.assertEqual(response.status_code,422)

    def test_no_physical_actuation_routes(self):
        for path in ("/api/v1/breakers/trip", "/api/v1/epos/activate", "/api/v1/generators/start"):
            self.assertIn(self.client.post(path,json={}).status_code,(404,405))

    def test_presets_and_security_headers(self):
        response = self.client.get("/api/v1/presets")
        self.assertEqual(len(response.json()),5)
        self.assertEqual(response.headers["x-content-type-options"],"nosniff")
        self.assertEqual(response.headers["cache-control"],"no-store")

    def test_catalogue_and_normalized_quote(self):
        from datacenter_twin.catalog import load_catalog, normalize_quote
        self.assertEqual(self.client.get("/api/v1/catalog").json(),load_catalog())
        data = {"offer_id":"oci-h100","node_count":1,"billed_hours":"1","assumed_rate":"8"}
        self.assertEqual(self.client.post("/api/v1/quotes/normalize",json=data).json(),normalize_quote(data))

    def test_existing_planning_contract_keeps_the_same_result(self):
        from datacenter_twin.contracts import load_scenario
        from datacenter_twin.engine import simulate
        path = Path(__file__).resolve().parents[1]/"data/scenarios/baseline-1mw.json"
        scenario = load_scenario(path)
        self.assertEqual(self.client.post("/api/v1/planning",json=scenario.to_dict()).json(),simulate(scenario))

    def test_malformed_payloads_are_contract_errors(self):
        for content in (b"[]", b"null", b"\xff", b"["*20000+b"]"*20000):
            response = self.client.post("/api/v1/simulations",content=content,headers={"content-type":"application/json"})
            self.assertEqual(response.status_code,422,response.text)
        self.assertEqual(self.client.post("/api/v1/simulations",content=b"{}").status_code,422)
