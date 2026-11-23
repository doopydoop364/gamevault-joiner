import unittest

from website.gallery import MEDIA, public_cards


class GalleryTests(unittest.TestCase):
    def test_proxy_response_is_reduced_to_public_card_fields(self):
        game = {
            "title": "Library filename",
            "file_path": "/private/games/library-file",
            "bookmarked_users": [{"email": "member@example.test"}],
            "metadata": {
                "title": " Example game ",
                "description": "Explore\nthis world.",
                "notes": "Private notes",
                "cover": {"id": "42", "file_path": "/private/media/42"},
            },
        }
        self.assertEqual(public_cards({"data": [game, game]}), [{
            "title": "Example game",
            "description": "Explore this world.",
            "coverUrl": MEDIA + "42",
        }])

    def test_only_proxy_covers_and_at_most_twelve_items(self):
        cards = public_cards([
            {"title": "Other site", "coverUrl": "https://example.test/cover"},
            {"title": "Unexpected path", "metadata": {"cover": {"id": "../games/1"}}},
            *({"title": f"Game {i}", "description": "a" * 200, "coverUrl": MEDIA + str(i)}
              for i in range(1, 15)),
        ])
        self.assertEqual(len(cards), 12)
        self.assertEqual(cards[0]["title"], "Game 1")
        self.assertEqual(cards[0]["description"], "a" * 179 + "…")
