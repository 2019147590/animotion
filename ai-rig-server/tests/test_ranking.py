import unittest

from ai_rig_server.ranking import select_character_instance


class CharacterRankingTest(unittest.TestCase):
    def test_prefers_high_confidence_large_centered_instance(self):
        image_size = {"width": 1000, "height": 1000}
        instances = [
            {"id": "edge", "bbox": {"x": 0, "y": 0, "w": 200, "h": 200}, "confidence": 0.95},
            {"id": "main", "bbox": {"x": 300, "y": 150, "w": 420, "h": 700}, "confidence": 0.88},
        ]
        self.assertEqual(select_character_instance(instances, image_size)["id"], "main")

    def test_returns_none_without_instances(self):
        self.assertIsNone(select_character_instance([], {"width": 1, "height": 1}))


if __name__ == "__main__":
    unittest.main()

