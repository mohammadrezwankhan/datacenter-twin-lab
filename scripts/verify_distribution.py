"""Install a built wheel into a fresh environment and exercise it outside the checkout."""

import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
import venv
from zipfile import ZipFile


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("wheel_directory", type=Path)
    parser.add_argument("--require-web", action="store_true", help="Also require the built dashboard in the wheel")
    args = parser.parse_args()
    wheels = list(args.wheel_directory.resolve().glob("datacenter_twin_lab-*.whl"))
    if len(wheels) != 1:
        parser.error("Expected exactly one Datacenter Twin Lab wheel in the supplied directory")
    wheel = wheels[0]
    with ZipFile(wheel) as archive:
        if any(name.endswith(".docx") or any(part in {"docs", "planning", "campaign"} for part in Path(name).parts) for name in archive.namelist()):
            raise RuntimeError("Private source material must not be included in the wheel")
        web_files = [name for name in archive.namelist() if name.startswith("datacenter_twin/web/")]
        if args.require_web and ("datacenter_twin/web/index.html" not in web_files or
                not any(name.endswith(".js") for name in web_files) or not any(name.endswith(".css") for name in web_files)):
            raise RuntimeError("Build apps/web before building a dashboard distribution")
    root = Path(__file__).resolve().parents[1]
    with TemporaryDirectory(prefix="datacenter-twin-install-") as directory:
        workspace = Path(directory)
        environment = workspace / "venv"
        venv.EnvBuilder(with_pip=True).create(environment)
        binary = environment / ("Scripts" if os.name == "nt" else "bin")
        python = binary / ("python.exe" if os.name == "nt" else "python")
        console = binary / ("datacenter-twin.exe" if os.name == "nt" else "datacenter-twin")
        clean_env = {key: value for key, value in os.environ.items() if key.upper() != "PYTHONPATH"}

        def execute(*arguments):
            return subprocess.run(arguments, cwd=workspace, env=clean_env, check=True,
                                  capture_output=True, text=True, encoding="utf-8", timeout=120).stdout

        execute(str(python), "-I", "-m", "pip", "install", "--no-index", "--no-deps", str(wheel))
        identity = json.loads(execute(str(python), "-I", "-c",
            "import json,datacenter_twin; from importlib.metadata import version; "
            "print(json.dumps({'file':datacenter_twin.__file__,'runtime':datacenter_twin.__version__,"
            "'distribution':version('datacenter-twin-lab')}))"))
        if not Path(identity["file"]).resolve().is_relative_to(environment.resolve()):
            raise RuntimeError("Smoke test imported source checkout instead of the installed wheel")
        if identity["runtime"] != identity["distribution"]:
            raise RuntimeError("Package and runtime versions differ")
        baseline = workspace / "baseline.json"
        alternative = workspace / "alternative.json"
        baseline.write_bytes((root / "data/scenarios/baseline-1mw.json").read_bytes())
        alternative.write_bytes((root / "data/scenarios/alternative-pue-115.json").read_bytes())
        result = json.loads(execute(str(python), "-I", "-m", "datacenter_twin", "run", str(baseline)))
        if result["result"]["energy_only_cost"] != "1095000.00":
            raise RuntimeError("Installed module returned an incorrect baseline result")
        result = json.loads(execute(str(console), "compare", str(baseline), str(alternative)))
        if result["result"]["energy_only_cost_saving"] != "87600.00":
            raise RuntimeError("Installed console command returned an incorrect comparison")
        result = json.loads(execute(str(console), "simulate", "--preset", "generator_failure"))["result"]
        if result["summary"]["service_status"] != "unserved_load" or result["summary"]["energy_balance_residual_kwh"] != "0":
            raise RuntimeError("Installed continuity engine failed its outage fixture")
        if not any(event["action"] == "battery_depleted" for event in result["events"]):
            raise RuntimeError("Installed preset failed to replay battery depletion")
        catalog = json.loads(execute(str(python), "-I", "-c",
            "import json; from datacenter_twin.catalog import load_catalog; print(json.dumps(load_catalog()))"))
        if {offer["provider"] for offer in catalog["cloud_offers"]} != {"AWS", "Azure", "OCI"}:
            raise RuntimeError("Installed catalogue is incomplete")
        print(json.dumps({"wheel": wheel.name, "version": identity["runtime"],
                          "python": sys.version.split()[0], "installed_outside_checkout": True,
                          "network_free_install": True, "module_and_console": "passed",
                          "continuity_and_catalogue": "passed", "dashboard_bundled": bool(web_files)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
