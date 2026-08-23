"""Unicode-safe normalization used only inside the local search process."""

import unicodedata


def normalize(value: str) -> str:
    """Use NFC and collapsed whitespace, case-folding Latin text without transliteration."""
    collapsed = " ".join(unicodedata.normalize("NFC", value).split())
    return collapsed.casefold()
