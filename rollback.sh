#!/usr/bin/env bash
# Return to the previously deployed image. Data in the volume is untouched.
set -euo pipefail
cd "$(dirname "$0")"

[ -f .deploy-image.prev ] || { echo "error: no previous deploy recorded"; exit 1; }
exec ./deploy.sh "$(cat .deploy-image.prev)"
