"""Smoke de acessibilidade (40-UX): HTML servido pelo Next standalone.

Checa em cada rota: lang, botões/links com nome acessível, inputs com
label associado, imagens com alt, um h1 por página. Falha com exit != 0.
Uso: python scripts/a11y_smoke.py http://127.0.0.1:3101
"""
import re
import sys
import urllib.request

ROUTES = [
    "/login",
    "/?tenant=demo-tenant-a",
    "/ride/quote?tenant=demo-tenant-a",
    "/rides/history?tenant=demo-tenant-a",
    "/driver",
    "/ops?tenant=demo-tenant-a",
    "/notifications",
    "/admin/tenants",
    "/api/health",
]

failures: list[str] = []


def check(name: str, condition: bool, detail: str = "") -> None:
    if not condition:
        failures.append(f"{name}: {detail}")


def fetch(base: str, path: str) -> str:
    with urllib.request.urlopen(base + path, timeout=10) as response:
        return response.read().decode("utf-8")


def main() -> int:
    base = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:3101"
    for route in ROUTES:
        try:
            html = fetch(base, route)
        except Exception as error:  # noqa: BLE001 - smoke relata e segue
            failures.append(f"{route}: fetch failed ({error})")
            continue
        if route == "/api/health":
            check(route, '"status":"healthy"' in html, "health não saudável")
            continue
        check(route, re.search(r'<html[^>]*lang="', html) is not None, "sem lang")
        rendered = html.count("<h1")
        check(route, rendered == 1, f"h1 renderizado ausente ou multiplo ({rendered})")
        for tag in re.findall(r"<button[^>]*>(.*?)</button>", html, re.DOTALL):
            text = re.sub(r"<[^>]+>", "", tag).strip()
            check(route, text != "", "button sem nome acessível")
        for match in re.finditer(r'<a\s[^>]*href="([^"]*)"[^>]*>(.*?)</a>', html, re.DOTALL):
            text = re.sub(r"<[^>]+>", "", match.group(2)).strip()
            check(route, text != "", f"link sem texto ({match.group(1)})")
        for input_tag in re.findall(r"<input[^>]*>", html):
            if 'type="hidden"' in input_tag:
                continue
            name = re.search(r'name="([^"]*)"', input_tag)
            input_id = re.search(r'id="([^"]*)"', input_tag)
            labelled = input_id is not None and f'for="{input_id.group(1)}"' in html
            check(route, labelled or name is None, f"input sem label ({input_tag[:60]})")
        for img in re.findall(r"<img[^>]*>", html):
            check(route, 'alt=' in img, f"img sem alt ({img[:60]})")
        print(f"OK {route} ({len(html)} bytes)")
    if failures:
        print("FALHAS:")
        for failure in failures:
            print(f" - {failure}")
        return 1
    print("a11y smoke: tudo verde.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
