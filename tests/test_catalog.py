from copy import deepcopy
from datetime import date
from decimal import localcontext
from importlib.resources import files
import json
import unittest
from urllib.parse import urlparse

from datacenter_twin.catalog import load_catalog, normalize_quote
from datacenter_twin.contracts import InputError
from datacenter_twin.demo import demo_scenario


class CatalogTests(unittest.TestCase):
    def quote(self, offer="aws-p5", **changes):
        return normalize_quote({"offer_id":offer, "node_count":2, "billed_hours":"3", "assumed_rate":"8", **changes})

    def test_node_and_gpu_units_have_independent_expected_costs(self):
        for offer in ("aws-p5","azure-nd-h100"):
            result = self.quote(offer)
            self.assertEqual(result["cost"],"48.00") # 2 nodes * 3 hours * $8/node-hour
            self.assertEqual(result["provisioned_gpu_hour_rate"],"1")
        result = self.quote("oci-h100")
        self.assertEqual(result["cost"],"384.00") # 2 nodes * 8 GPUs * 3 hours * $8/GPU-hour
        self.assertEqual(result["normalized_node_hour_rate"],"64")
        self.assertEqual(result["billed_units"],"48")

    def test_unknown_is_not_zero_and_assumptions_are_not_quotes(self):
        self.assertIsNone(self.quote(assumed_rate=None)["cost"])
        self.assertEqual(self.quote(assumed_rate=None)["price_status"],"unknown")
        self.assertEqual(self.quote(assumed_rate="0")["cost"],"0.00")
        self.assertEqual(self.quote()["price_status"],"user_assumption")
        self.assertIsNone(self.quote()["offer"]["rate"])

    def test_quote_validation(self):
        for changes in ({"node_count":True}, {"node_count":0}, {"node_count":1.5}, {"offer_id":"missing"},
                        {"billed_hours":-1}, {"assumed_rate":"NaN"}, {"billing_unit":"gpu_hour"}):
            with self.subTest(changes=changes), self.assertRaises(InputError): self.quote(**changes)

    def test_rounding_after_aggregation_and_context_independence(self):
        result = self.quote(node_count=1, billed_hours="3", assumed_rate="0.005")
        self.assertEqual(result["cost"],"0.02")
        with localcontext() as context:
            context.prec = 3
            self.assertEqual(self.quote(node_count=1,billed_hours="3",assumed_rate="0.005"),result)

    def test_source_integrity_and_vendor_unit_preservation(self):
        catalog = load_catalog()
        date.fromisoformat(catalog["reviewed_on"])
        sources = {s["id"]:s for s in catalog["sources"]}
        self.assertEqual(len(sources),len(catalog["sources"]))
        for source in sources.values():
            date.fromisoformat(source["retrieved_on"])
            if source["url"] is not None:
                self.assertEqual(urlparse(source["url"]).scheme,"https")
            self.assertTrue(source["locator"] and source["limitations"])
        for group in ("hardware","cloud_offers","models","jurisdictions"):
            records = catalog[group]
            self.assertEqual(len(records),len({r["id"] for r in records}))
            for record in records:
                self.assertTrue(record["source_ids"])
                self.assertFalse(set(record["source_ids"])-sources.keys())
        for asset in demo_scenario().assets:
            self.assertFalse(set(asset.source_ids)-sources.keys())
        self.assertEqual(catalog["cloud_offers"][0]["gpu_memory_unit"],"GiB")
        self.assertEqual(catalog["cloud_offers"][1]["gpu_memory_unit"],"GB")
        self.assertTrue(all(o["availability"] == "not_verified" for o in catalog["cloud_offers"]))
        self.assertEqual([o["price_status"] for o in catalog["cloud_offers"]],["unknown","public_retail_snapshot","unknown"])
        self.assertTrue(all(j["applicability"] == "requires_project_review" for j in catalog["jurisdictions"]))

    def test_catalog_loads_do_not_share_mutable_state(self):
        baseline = deepcopy(load_catalog())
        modified = load_catalog()
        modified["cloud_offers"][0]["rate"] = "0"
        self.assertEqual(load_catalog(),baseline)

    def test_azure_price_preserves_the_selected_meter_and_date(self):
        snapshot = json.loads(files("datacenter_twin").joinpath("resources/azure-retail-snapshot.json").read_text(encoding="utf-8-sig"))
        record = snapshot["record"]
        offer = next(o for o in load_catalog()["cloud_offers"] if o["provider"] == "Azure")
        self.assertEqual(record["armSkuName"],offer["sku"])
        self.assertEqual(record["armRegionName"],offer["region"])
        self.assertEqual(str(record["retailPrice"]),offer["rate"])
        self.assertEqual(record["currencyCode"],offer["currency"])
        self.assertEqual(record["effectiveStartDate"],offer["effective_from"])
        self.assertEqual(snapshot["retrieved_on"],offer["observed_on"])
        self.assertEqual(record["unitOfMeasure"],"1 Hour")
        self.assertEqual(record["type"],"Consumption")
        self.assertEqual(record["meterName"],"ND96isrH100v5")
        self.assertNotIn("Windows",record["productName"])
