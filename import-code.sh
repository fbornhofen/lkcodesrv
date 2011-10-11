#!/bin/sh

LK_PATH=$1
LK_CODEDB="livelydb.sqlite3"

cd $1
for f in `find . -type f | grep -v '.git/'`; do
  f=${f:2}
  curl -d @$f http://localhost:3000/$f
  echo $f;
done

