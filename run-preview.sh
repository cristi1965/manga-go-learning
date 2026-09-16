#!/bin/sh
set -eu
cd "$(dirname "$0")"
cd runner
exec go run .
