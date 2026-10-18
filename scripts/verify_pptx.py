"""Check generated OpenXML slide content, relationships, and bounds without Office."""

from pathlib import Path
import json
import sys
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parent.parent
NS = {
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "r": "http://schemas.openxmlformats.org/package/2006/relationships",
}
EMU = 914400


def normalized(value):
    return " ".join(value.split())


def review_label(feature):
    if feature.get("verifiedOn"):
        return f"Reviewed {feature['verifiedOn']}"
    assessed = (feature.get("provenance") or {}).get("assessedOn")
    return f"Not human verified (assessed {assessed})" if assessed else "Not human verified"


def verify(path, features):
    expected_count = len(features) * 2
    errors = []
    with zipfile.ZipFile(path) as package:
        names = package.namelist()
        slides = sorted(
            (name for name in names if name.startswith("ppt/slides/slide") and name.endswith(".xml") and "/_rels/" not in name),
            key=lambda name: int(Path(name).stem.removeprefix("slide")),
        )
        if len(slides) != expected_count:
            errors.append(f"Expected {expected_count} slides, got {len(slides)}")
        presentation = ET.fromstring(package.read("ppt/presentation.xml"))
        size = presentation.find("p:sldSz", NS)
        width, height = int(size.attrib["cx"]), int(size.attrib["cy"])
        for index, name in enumerate(slides):
            feature = features[index // 2]
            tree = ET.fromstring(package.read(name))
            content = normalized(" ".join(node.text or "" for node in tree.findall(".//a:t", NS)))
            required_text = ["COPILOT RUNWAY", "Primary sources:", "Independent initiative.", feature["name"], review_label(feature)]
            if index % 2:
                kit = feature["demo"]["status"].removeprefix("kit-").replace("-", " ").upper()
                live = feature["demo"]["liveStatus"].replace("-", " ").upper()
                required_text.extend([feature["cost"]["headline"], feature["cost"]["detail"], f"KIT: {kit}", f"LIVE: {live}"])
            for required in required_text:
                if normalized(required) not in content:
                    errors.append(f"{name}: missing {required}")
            if any(token in content.lower() for token in ("lorem ipsum", "placeholder text", "xxxx")):
                errors.append(f"{name}: leftover placeholder")
            notes_name = name.replace("ppt/slides/slide", "ppt/notesSlides/notesSlide")
            if notes_name not in names:
                errors.append(f"{name}: presenter/source notes missing")
            else:
                notes = ET.fromstring(package.read(notes_name))
                note_text = " ".join(node.text or "" for node in notes.findall(".//a:t", NS))
                if "https://docs.github.com/" not in note_text or "Live feature validation:" not in note_text:
                    errors.append(f"{name}: notes lack evidence or live-validation scope")
            for transform in tree.findall(".//p:spPr/a:xfrm", NS):
                offset = transform.find("a:off", NS)
                extent = transform.find("a:ext", NS)
                if offset is None or extent is None:
                    continue
                x, y = int(offset.attrib["x"]), int(offset.attrib["y"])
                w, h = int(extent.attrib["cx"]), int(extent.attrib["cy"])
                if min(x, y, w, h) < 0 or x + w > width + 100 or y + h > height + 100:
                    errors.append(f"{name}: element out of slide bounds")
                if x < .49 * EMU or y < .49 * EMU or x + w > width - .49 * EMU or y + h > height - .49 * EMU:
                    errors.append(f"{name}: element violates minimum content margin")
            rel_name = str(Path(name).parent / "_rels" / (Path(name).name + ".rels")).replace("\\", "/")
            relationships = ET.fromstring(package.read(rel_name))
            links = [node.attrib.get("Target", "") for node in relationships if node.attrib.get("TargetMode") == "External"]
            if not any(link.startswith("https://") for link in links):
                errors.append(f"{name}: clickable primary-source citation missing")
            if any(not link.startswith("https://") for link in links):
                errors.append(f"{name}: non-HTTPS external relationship")
    if errors:
        raise ValueError(f"{path.name}:\n" + "\n".join(errors))
    print(f"Verified {path.name}: {expected_count} slides, cited content, notes, and bounds.")


def main():
    manifest = json.loads((ROOT / "artifacts" / "manifest.json").read_text(encoding="utf-8"))
    catalog = json.loads((ROOT / "catalog" / "features.json").read_text(encoding="utf-8"))
    features = {feature["id"]: feature for feature in catalog["features"]}
    for entry in manifest["features"]:
        verify(ROOT / entry["deck"], [features[entry["id"]]])
    verify(ROOT / "artifacts" / "slides" / "copilot-runway.pptx", catalog["features"])


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, OSError, zipfile.BadZipFile, ET.ParseError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
