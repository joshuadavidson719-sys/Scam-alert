#!/bin/bash
git remote add github "https://x-access-token:${GITHUB_PUSH_TOKEN}@github.com/joshuadavidson719-sys/Scam-alert.git" 2>/dev/null || true
git push github main
