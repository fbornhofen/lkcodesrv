#!/bin/sh

LK_PATH=$1
LK_SERVER_HOST=$2
LK_SERVER_PORT=$3
LK_CODEDB="livelydb.sqlite3"

if [ "$LK_SERVER_HOST" = "" ]; then
  LK_SERVER_HOST="localhost"
fi

if [ "$LK_SERVER_PORT" = "" ]; then
  LK_SERVER_PORT=8888
fi

cd $LK_PATH
for f in `find . -type f | grep -v '.git/'`; do
  f=${f:2}
  curl --data-binary @$f http://$LK_SERVER_HOST:$LK_SERVER_PORT/$f
  echo $f;
done

