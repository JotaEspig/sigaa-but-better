#!/usr/bin/env python3
"""Anonymize a saved SIGAA HTML page so it can be committed as a parser fixture.

Usage: scripts/scrub_fixture.py IN.html OUT.html [--map private-map.json]

Automatically replaces e-mails, "Cadastrado por" names, forum usernames and
long digit runs that look like matrículas. A JSON map {"REAL": "FAKE"} can add
explicit replacements (keep that file out of git: *.private.json is ignored).
"""
import json, re, sys

def scrub(html: str, extra: dict) -> str:
    for real, fake in extra.items():
        # SIGAA mixes raw UTF-8 and numeric entities (JO&#195;O), so replace both.
        entity = "".join(c if ord(c) < 128 else f"&#{ord(c)};" for c in real)
        html = html.replace(real, fake).replace(entity, fake)
    html = re.sub(r"[\w.+-]+@[\w-]+\.[\w.]+(\.\.\.)?", "aluno@example.com", html)
    html = re.sub(r"(Cadastrado por:\s*(?:<[^>]+>\s*)*)[A-ZÀ-Ý][A-ZÀ-Ý ]{4,}", r"\1DOCENTE EXEMPLO", html)
    html = re.sub(r'<acronym title="[^"]*">\s*[a-z]{3,}\.[a-z]{3,}', '<acronym title="SERVIDOR EXEMPLO"> servidor.exemplo', html)
    html = re.sub(r"\b20\d{8}\b", "2020000001", html)
    html = re.sub(r"valid=[0-9A-Fa-f]+", "valid=0000000000", html)  # Pergamum token tied to the matrícula
    return html

if __name__ == "__main__":
    src, dst = sys.argv[1], sys.argv[2]
    extra = {}
    if "--map" in sys.argv:
        extra = json.load(open(sys.argv[sys.argv.index("--map") + 1], encoding="utf-8"))
    html = open(src, encoding="utf-8").read()
    open(dst, "w", encoding="utf-8").write(scrub(html, extra))
