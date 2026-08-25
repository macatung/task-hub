#!/bin/sh
set -eu

# Cloud Run considers the container ready as soon as Nginx accepts TCP traffic.
# Do not expose that port until the FastCGI upstream is actually accepting
# connections, otherwise cold starts briefly return 502 to Desktop and Hub.
until nc -z 127.0.0.1 9000; do
    sleep 0.1
done

exec nginx -g 'daemon off;'
