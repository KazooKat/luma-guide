"""Run with: python -m unittest discover -s scripts"""
import tempfile
import unittest
from pathlib import Path

import extract_log as ex

PREFIX = "[06:48:{:02d}] [Render thread/INFO]: [System] [CHAT] "

LOG = [
    " Break:",
    "   Oak Log ->  5.33$ 5.65xp",
    " ----<< Prev 1/2 Next >>----",
    "   Birch Log ->  5.33$ 5.65xp",          # continues Break on page 2
    " ꕌ Local | Someone: chat noise:",       # player chat must be ignored
    " Strip logs:",                          # multi-word header
    "   Stripped Oak Log ->  1.82$ 1.61xp",
    " ----<< Prev 2/2 Next >>----",
]


class ExtractTest(unittest.TestCase):
    def dumps(self, lines):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "latest.log"
            p.write_text("\n".join(PREFIX.format(i) + l for i, l in enumerate(lines)) + "\n", encoding="utf-8")
            return ex.parse_dumps([p])

    def test_sections_carry_across_pages_and_allow_spaces(self):
        (d,) = self.dumps(LOG)
        self.assertTrue(d.complete)
        self.assertEqual(
            [(s, n) for s, n, *_ in d.entries()],
            [("Break", "Oak Log"), ("Break", "Birch Log"), ("Strip logs", "Stripped Oak Log")],
        )

    def test_values(self):
        (d,) = self.dumps(LOG)
        self.assertEqual(d.entries()[0][2:], (5.33, 5.65))

    def test_single_page_without_footer_is_kept(self):
        dumps = self.dumps([" Kill:", "   Zombie ->  8.54$ 11.12xp"])
        self.assertEqual(len(dumps), 1)
        self.assertEqual(dumps[0].entries()[0][1], "Zombie")


if __name__ == "__main__":
    unittest.main()
