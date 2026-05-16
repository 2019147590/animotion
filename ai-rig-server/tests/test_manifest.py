import unittest

from ai_rig_server.manifest import build_manifest


class ManifestTest(unittest.TestCase):
    def test_builds_version_three_character_manifest(self):
        manifest = build_manifest({
            "source_image": "panel.png",
            "canvas": {"width": 100, "height": 200},
            "character": {"id": "char_01", "bbox": {"x": 1, "y": 2, "w": 30, "h": 40}, "confidence": 0.9},
            "parts": [{
                "id": "part_head",
                "name": "head",
                "type": "head",
                "rect": {"x": 10, "y": 20, "w": 30, "h": 40},
                "pivot": {"x": 15, "y": 35},
                "joint": {"x": 15, "y": 10},
            }],
        })
        self.assertEqual(manifest["version"], 3)
        self.assertEqual(manifest["characters"][0]["parts"][0]["name"], "head")
        self.assertEqual(manifest["characters"][0]["parts"][0]["order"], 1)


if __name__ == "__main__":
    unittest.main()

