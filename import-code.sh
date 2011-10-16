#!/bin/sh

LK_PATH=$1
LK_PORT=$2
LK_CODEDB="livelydb.sqlite3"

if [ "$LK_PORT" = "" ]; then
  LK_PORT=80
fi

cd $LK_PATH
for f in `find . -type f | grep -v '.git/'`; do
  f=${f:2}
  curl --data-binary @$f http://localhost:$LK_PORT/$f
  echo $f;
done

