#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET="${1:-.}"

cp -f "$SCRIPT_DIR/overlay/.firebaserc" "$TARGET/.firebaserc"
cp -f "$SCRIPT_DIR/overlay/firebase.json" "$TARGET/firebase.json"
cp -f "$SCRIPT_DIR/overlay/firestore.rules" "$TARGET/firestore.rules"
mkdir -p "$TARGET/src/firebase"
cp -f "$SCRIPT_DIR/overlay/src/firebase/firebase.js" "$TARGET/src/firebase/firebase.js"

echo "적용 완료: $TARGET"
echo "다음: Firebase Console에서 Anonymous Auth 활성화 후 firebase deploy --only firestore:rules"
