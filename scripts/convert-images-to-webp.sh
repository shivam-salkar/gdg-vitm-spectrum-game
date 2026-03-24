#!/usr/bin/env bash

set -euo pipefail

SOURCE_DIR="${1:-public/assets}"
LOSSLESS="${LOSSLESS:-1}"
QUALITY="${QUALITY:-90}"

if ! command -v magick >/dev/null 2>&1; then
  echo "ImageMagick (magick) is required but was not found on PATH." >&2
  exit 1
fi

if [ ! -d "$SOURCE_DIR" ]; then
  echo "Source directory not found: $SOURCE_DIR" >&2
  exit 1
fi

converted=0

while IFS= read -r -d '' file; do
  target="${file%.*}.webp"

  if [ "$LOSSLESS" = "1" ]; then
    magick "$file" -define webp:lossless=true "$target"
  else
    magick "$file" -quality "$QUALITY" "$target"
  fi

  converted=$((converted + 1))
  echo "Converted: $file -> $target"
done < <(find "$SOURCE_DIR" -type f \( -iname "*.png" -o -iname "*.jpg" -o -iname "*.jpeg" \) -print0)

echo "Done. Converted $converted image(s) in $SOURCE_DIR."
