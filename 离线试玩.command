#!/bin/zsh
cd -- "${0:A:h}" || exit 1
if [[ -f dist/index.html ]]; then
  open dist/index.html
else
  print "请先在此目录运行 npm install 和 npm run build。"
  exit 1
fi
