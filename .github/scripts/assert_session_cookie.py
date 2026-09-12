#!/usr/bin/env python3
"""Assert the attributes of the HH.Session Set-Cookie header in a curl dump.

Usage: assert_session_cookie.py <headers-file> secure|insecure

`secure`   -- the Secure attribute must be present (the default the app ships).
`insecure` -- it must be absent (Session__AllowInsecureCookieOverHttp is on and
              the request came in over plain http).

HttpOnly and SameSite=Strict are required either way: the LAN opt-in trades away
Secure and nothing else. The cookie's value is never printed or matched against,
so a chance substring in the ciphertext cannot decide the result.
"""
import sys


def main() -> int:
    if len(sys.argv) != 3 or sys.argv[2] not in ("secure", "insecure"):
        print(__doc__)
        return 2

    headers_path, mode = sys.argv[1], sys.argv[2]

    with open(headers_path, "r", encoding="utf-8", errors="replace") as handle:
        lines = [line.strip() for line in handle]

    cookie_lines = [
        line for line in lines
        if line.lower().startswith("set-cookie:") and "HH.Session=" in line
    ]

    if len(cookie_lines) != 1:
        print(f"expected exactly one HH.Session Set-Cookie header, found {len(cookie_lines)}")
        for line in lines:
            print(f"  {line}")
        return 1

    # Drop "Set-Cookie: " and the name=value pair; only attributes matter here.
    parts = [part.strip().lower() for part in cookie_lines[0].split(";")[1:]]
    print(f"HH.Session attributes: {parts}")

    failures = []

    has_secure = "secure" in parts
    if mode == "secure" and not has_secure:
        failures.append("expected the Secure attribute, it is absent")
    if mode == "insecure" and has_secure:
        failures.append("expected no Secure attribute, it is present")

    if "httponly" not in parts:
        failures.append("HttpOnly is missing")
    if "samesite=strict" not in parts:
        failures.append("SameSite=Strict is missing")

    for failure in failures:
        print(f"FAIL: {failure}")

    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
