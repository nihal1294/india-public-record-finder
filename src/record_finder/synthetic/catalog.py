"""Locally authored fictional records; no external person data is read."""

from dataclasses import dataclass
from random import Random
from typing import Literal

from record_finder.domain.models import PublicRecord

SEED = 20260822


@dataclass(frozen=True)
class CatalogEntry:
    synthetic_id: str
    name_native: str
    name_latin: str
    relative_name_native: str
    relative_name_latin: str
    relationship: Literal["father", "mother", "spouse"]
    locality_native: str
    locality_latin: str
    house_reference: str
    age: int
    gender: Literal["female", "male", "other"]


_FIXED_CATALOG: tuple[CatalogEntry, ...] = (
    CatalogEntry(
        "SYN-KA-A",
        "ಅನನ್ಯಾ ಗೌಡ",
        "Ananya Gowda",
        "ರಮೇಶ್ ಗೌಡ",
        "Ramesh Gowda",
        "father",
        "ಚೆನ್ನಾಪುರ",
        "Chennapura",
        "11-A",
        28,
        "female",
    ),
    CatalogEntry(
        "SYN-KA-B",
        "ವಿವೇಕ್ ಶೆಟ್ಟಿ",
        "Vivek Shetty",
        "ಮಾಲತಿ ಶೆಟ್ಟಿ",
        "Malathi Shetty",
        "mother",
        "ಕುಂದಾಪುರ",
        "Kundapura",
        "12-B",
        35,
        "male",
    ),
    CatalogEntry(
        "SYN-KA-C",
        "ಕಾವ್ಯ ನಾಯಕ್",
        "Kavya Nayak",
        "ಸುನಿಲ್ ನಾಯಕ್",
        "Sunil Nayak",
        "father",
        "ಬೇಲೂರು",
        "Beluru",
        "14-C",
        31,
        "female",
    ),
    CatalogEntry(
        "SYN-KA-D",
        "ಪ್ರಣವ್ ಹೆಗ್ಡೆ",
        "Pranav Hegde",
        "ಶಾಂತಿ ಹೆಗ್ಡೆ",
        "Shanthi Hegde",
        "mother",
        "ಸೊರಬ",
        "Soraba",
        "18-A",
        42,
        "male",
    ),
    CatalogEntry(
        "SYN-KA-E",
        "ಮೀರಾ ಕುಲಕರ್ಣಿ",
        "Meera Kulkarni",
        "ಅರುಣ್ ಕುಲಕರ್ಣಿ",
        "Arun Kulkarni",
        "spouse",
        "ಧಾರವಾಡ",
        "Dharwad",
        "21-D",
        39,
        "female",
    ),
    CatalogEntry(
        "SYN-KA-F",
        "ನಿಖಿಲ್ ಭಟ್",
        "Nikhil Bhat",
        "ಗೋಪಾಲ್ ಭಟ್",
        "Gopal Bhat",
        "father",
        "ಶಿರಸಿ",
        "Sirsi",
        "27-A",
        24,
        "male",
    ),
    CatalogEntry(
        "SYN-KA-G",
        "ಐಶ್ವರ್ಯಾ ರಾವ್",
        "Aishwarya Rao",
        "ಕಿರಣ್ ರಾವ್",
        "Kiran Rao",
        "father",
        "ಮೂಡುಬಿದಿರೆ",
        "Moodubidire",
        "31-C",
        33,
        "female",
    ),
    CatalogEntry(
        "SYN-KA-H",
        "ದರ್ಶನ್ ಪೈ",
        "Darshan Pai",
        "ಲಲಿತಾ ಪೈ",
        "Lalitha Pai",
        "mother",
        "ಕಾರ್ಕಳ",
        "Karkala",
        "36-B",
        47,
        "male",
    ),
    CatalogEntry(
        "SYN-KA-I",
        "ಶ್ರೇಯಾ ಶೆಣೈ",
        "Shreya Shenoy",
        "ವಿನಯ ಶೆಣೈ",
        "Vinay Shenoy",
        "father",
        "ಉಡುಪಿ",
        "Udupi",
        "42-A",
        29,
        "female",
    ),
    CatalogEntry(
        "SYN-KA-J",
        "ಹರ್ಷಿತ್ ಕಾಮತ್",
        "Harshit Kamath",
        "ಮಂಜುನಾಥ ಕಾಮತ್",
        "Manjunath Kamath",
        "father",
        "ಪುತ್ತೂರು",
        "Puttur",
        "49-E",
        38,
        "male",
    ),
    CatalogEntry(
        "SYN-KA-K",
        "ಕಾವ್ಯ ನಾಯಕ್",
        "Kavya Nayak",
        "ಮೀನಾ ನಾಯಕ್",
        "Meena Nayak",
        "mother",
        "ಸಕಲೇಶಪುರ",
        "Sakaleshapura",
        "53-B",
        26,
        "female",
    ),
)

_NAMES: tuple[tuple[str, str], ...] = (
    ("ಅದಿತಿ", "Aditi"),
    ("ಅರ್ಜುನ್", "Arjun"),
    ("ಭವ್ಯ", "Bhavya"),
    ("ಚೇತನ್", "Chetan"),
    ("ದೀಪಾ", "Deepa"),
    ("ಗಣೇಶ್", "Ganesh"),
    ("ಹೇಮಾ", "Hema"),
    ("ಇಶಾನ್", "Ishan"),
    ("ಜಯಾ", "Jaya"),
    ("ಕಾರ್ತಿಕ್", "Karthik"),
    ("ಲಕ್ಷ್ಮಿ", "Lakshmi"),
    ("ಮನೋಜ್", "Manoj"),
)
_SURNAMES: tuple[tuple[str, str], ...] = (
    ("ಗೌಡ", "Gowda"),
    ("ಹೆಗ್ಡೆ", "Hegde"),
    ("ಕಾಮತ್", "Kamath"),
    ("ಕುಲಕರ್ಣಿ", "Kulkarni"),
    ("ನಾಯಕ್", "Nayak"),
    ("ಪೈ", "Pai"),
    ("ರಾವ್", "Rao"),
    ("ಶೆಟ್ಟಿ", "Shetty"),
    ("ಶೆಣೈ", "Shenoy"),
)
_LOCALITIES: tuple[tuple[str, str], ...] = (
    ("ಅರಸೀಕೆರೆ", "Arasikere"),
    ("ಬಾಗಲಕೋಟೆ", "Bagalkote"),
    ("ಚಿಕ್ಕಮಗಳೂರು", "Chikkamagaluru"),
    ("ದಾವಣಗೆರೆ", "Davanagere"),
    ("ಹೊನ್ನಾವರ", "Honavar"),
    ("ಮಡಿಕೇರಿ", "Madikeri"),
    ("ರಾಮನಗರ", "Ramanagara"),
    ("ಶಿವಮೊಗ್ಗ", "Shivamogga"),
)


def _generated_id(index: int) -> str:
    return f"SYN-KA-{index:03d}"


def _build_catalogue() -> tuple[CatalogEntry, ...]:
    """Return a fixed 20260822-selected fictional catalogue of exactly 120 rows."""
    selected = list(_FIXED_CATALOG)
    chooser = Random(SEED)
    for index in range(len(selected) + 1, 121):
        name_native, name_latin = chooser.choice(_NAMES)
        surname_native, surname_latin = chooser.choice(_SURNAMES)
        relative_native, relative_latin = chooser.choice(_NAMES)
        relative_surname_native, relative_surname_latin = chooser.choice(_SURNAMES)
        locality_native, locality_latin = chooser.choice(_LOCALITIES)
        gender: Literal["female", "male", "other"] = (
            "female" if name_latin[-1:] in {"a", "i"} else "male"
        )
        selected.append(
            CatalogEntry(
                _generated_id(index),
                f"{name_native} {surname_native}",
                f"{name_latin} {surname_latin}",
                f"{relative_native} {relative_surname_native}",
                f"{relative_latin} {relative_surname_latin}",
                chooser.choice(("father", "mother", "spouse")),
                locality_native,
                locality_latin,
                f"{chooser.randint(1, 99)}-{chooser.choice(('A', 'B', 'C', 'D', 'E'))}",
                chooser.randint(21, 68),
                gender,
            )
        )
    return tuple(selected)


CATALOG = _build_catalogue()
# The retained feasibility experiment remains deliberately bounded to its original ten cards.
SPIKE_CATALOG = _FIXED_CATALOG[:10]


class KarnatakaSyntheticAdapter:
    """The one fixed synthetic Karnataka card template."""

    template_id = "karnataka-synthetic-v1"
    field_geometry = {
        "synthetic_id": (30, 20, 240, 58),
        "name": (30, 64, 430, 112),
        "name_latin": (30, 116, 810, 158),
        "relative_name": (30, 164, 430, 212),
        "relative_name_latin": (30, 216, 810, 258),
        "locality": (30, 264, 430, 312),
        "locality_latin": (30, 316, 810, 358),
        "house_reference": (30, 364, 410, 406),
        "age": (430, 364, 600, 406),
        "gender": (620, 364, 810, 406),
    }

    def aliases(self, value: str) -> tuple[str, ...]:
        return (value,)

    def searchable_fields(self, record: PublicRecord) -> dict[str, tuple[str, ...]]:
        typed = record
        return {
            "name": (typed.name_native, typed.name_latin),
            "relative_name": (typed.relative_name_native, typed.relative_name_latin),
            "locality": (typed.locality_native, typed.locality_latin),
        }
