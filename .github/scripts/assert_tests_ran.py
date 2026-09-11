#!/usr/bin/env python3
"""Fail unless a TRX file shows tests that really ran, with none skipped.

The Postgres tests skip themselves unless HH_POSTGRES_TESTS=1, so that
`dotnet test` on the solution works without Docker. That makes a green run of
the Postgres job meaningless on its own: a typo in the variable would skip all
of them and the job would still pass. This check turns that into a failure.

Usage: assert_tests_ran.py <results.trx> <minimum-number-of-tests>
"""

import sys
import xml.etree.ElementTree as ET
from collections import Counter

NS = {"t": "http://microsoft.com/schemas/VisualStudio/TeamTest/2010"}


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 2

    path, minimum = sys.argv[1], int(sys.argv[2])
    root = ET.parse(path).getroot()
    results = root.findall(".//t:Results/t:UnitTestResult", NS)
    outcomes = Counter(r.get("outcome") for r in results)

    print(f"{path}: {len(results)} test results: {dict(outcomes)}")

    problems = []
    if len(results) < minimum:
        problems.append(f"expected at least {minimum} tests, found {len(results)}")
    not_passed = {k: v for k, v in outcomes.items() if k != "Passed"}
    if not_passed:
        problems.append(f"every test must run and pass; also found {not_passed}")
        for r in results:
            if r.get("outcome") != "Passed":
                print(f"  {r.get('outcome')}: {r.get('testName')}")

    if problems:
        for p in problems:
            print(f"::error::{p}")
        return 1

    print("OK: every test ran against Postgres and passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
