#!/usr/bin/env bash
set -euo pipefail

CERT_DIR="${RUNNER_TEMP:-/tmp}/ata-pg-tls"
IMAGE="postgres:18.6"
DB_USER="ata_tls_test"
DB_PASSWORD="ata_local_tls_test_only"
DB_NAME="ata_tls_test"

rm -rf "$CERT_DIR"
mkdir -p "$CERT_DIR/newcerts" "$CERT_DIR/valid" "$CERT_DIR/expired" "$CERT_DIR/tls12"
: > "$CERT_DIR/index.txt"
printf '1000\n' > "$CERT_DIR/serial"

openssl req -x509 -newkey rsa:3072 -sha256 -days 2 -nodes \
  -keyout "$CERT_DIR/ca.key" -out "$CERT_DIR/ca.crt" \
  -subj "/CN=ATA Disposable CI PostgreSQL Root CA" \
  -addext "basicConstraints=critical,CA:TRUE" \
  -addext "keyUsage=critical,keyCertSign,cRLSign"

openssl req -x509 -newkey rsa:3072 -sha256 -days 2 -nodes \
  -keyout "$CERT_DIR/rogue-ca.key" -out "$CERT_DIR/rogue-ca.crt" \
  -subj "/CN=ATA Untrusted Disposable CI Root CA" \
  -addext "basicConstraints=critical,CA:TRUE" \
  -addext "keyUsage=critical,keyCertSign,cRLSign"

openssl req -new -newkey rsa:2048 -nodes \
  -keyout "$CERT_DIR/server.key" -out "$CERT_DIR/server.csr" \
  -subj "/CN=pg-tls.test"

cat > "$CERT_DIR/ca.cnf" <<EOF
[ ca ]
default_ca = CA_default
[ CA_default ]
dir = ${RUNNER_TEMP:-/tmp}/ata-pg-tls
database = \$dir/index.txt
new_certs_dir = \$dir/newcerts
certificate = \$dir/ca.crt
private_key = \$dir/ca.key
serial = \$dir/serial
default_md = sha256
policy = policy_any
unique_subject = no
copy_extensions = copy
[ policy_any ]
countryName = optional
stateOrProvinceName = optional
organizationName = optional
organizationalUnitName = optional
commonName = supplied
emailAddress = optional
[ server_cert ]
basicConstraints = critical,CA:FALSE
keyUsage = critical,digitalSignature,keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = DNS:pg-tls.test
EOF

openssl ca -batch -notext -config "$CERT_DIR/ca.cnf" \
  -in "$CERT_DIR/server.csr" -out "$CERT_DIR/valid/server.crt" \
  -days 2 -extensions server_cert

openssl ca -batch -notext -config "$CERT_DIR/ca.cnf" \
  -in "$CERT_DIR/server.csr" -out "$CERT_DIR/expired/server.crt" \
  -startdate 20200101000000Z -enddate 20200102000000Z \
  -extensions server_cert

cp "$CERT_DIR/server.key" "$CERT_DIR/valid/server.key"
cp "$CERT_DIR/server.key" "$CERT_DIR/expired/server.key"
cp "$CERT_DIR/valid/server.crt" "$CERT_DIR/tls12/server.crt"
cp "$CERT_DIR/server.key" "$CERT_DIR/tls12/server.key"
for fixture in valid expired tls12; do
  chmod 755 "$CERT_DIR/$fixture"
  chmod 644 "$CERT_DIR/$fixture/server.crt"
  chmod 600 "$CERT_DIR/$fixture/server.key"
done
sudo chown -R 999:999 "$CERT_DIR/valid" "$CERT_DIR/expired" "$CERT_DIR/tls12"

printf '127.0.0.1 pg-tls.test wrong.pg-tls.test\n' | sudo tee -a /etc/hosts >/dev/null

docker run --detach --name ata-pg-tls-valid --publish 127.0.0.1:55432:5432 \
  --mount "type=bind,src=$CERT_DIR/valid,dst=/tls,readonly" \
  --env "POSTGRES_USER=$DB_USER" --env "POSTGRES_PASSWORD=$DB_PASSWORD" \
  --env "POSTGRES_DB=$DB_NAME" "$IMAGE" \
  -c ssl=on -c ssl_cert_file=/tls/server.crt -c ssl_key_file=/tls/server.key \
  -c ssl_min_protocol_version=TLSv1.2

docker run --detach --name ata-pg-tls-expired --publish 127.0.0.1:55433:5432 \
  --mount "type=bind,src=$CERT_DIR/expired,dst=/tls,readonly" \
  --env "POSTGRES_USER=$DB_USER" --env "POSTGRES_PASSWORD=$DB_PASSWORD" \
  --env "POSTGRES_DB=$DB_NAME" "$IMAGE" \
  -c ssl=on -c ssl_cert_file=/tls/server.crt -c ssl_key_file=/tls/server.key \
  -c ssl_min_protocol_version=TLSv1.2

docker run --detach --name ata-pg-tls12-only --publish 127.0.0.1:55434:5432 \
  --mount "type=bind,src=$CERT_DIR/tls12,dst=/tls,readonly" \
  --env "POSTGRES_USER=$DB_USER" --env "POSTGRES_PASSWORD=$DB_PASSWORD" \
  --env "POSTGRES_DB=$DB_NAME" "$IMAGE" \
  -c ssl=on -c ssl_cert_file=/tls/server.crt -c ssl_key_file=/tls/server.key \
  -c ssl_min_protocol_version=TLSv1.2 -c ssl_max_protocol_version=TLSv1.2

docker run --detach --name ata-pg-plaintext --publish 127.0.0.1:55435:5432 \
  --env "POSTGRES_USER=$DB_USER" --env "POSTGRES_PASSWORD=$DB_PASSWORD" \
  --env "POSTGRES_DB=$DB_NAME" "$IMAGE"

for container in ata-pg-tls-valid ata-pg-tls-expired ata-pg-tls12-only ata-pg-plaintext; do
  ready=0
  for attempt in $(seq 1 60); do
    if docker exec "$container" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
      ready=1; break
    fi
    sleep 1
  done
  if [ "$ready" -ne 1 ]; then
    docker logs "$container"
    echo "Disposable PostgreSQL fixture did not become ready: $container" >&2
    exit 1
  fi
done

openssl verify -CAfile "$CERT_DIR/ca.crt" "$CERT_DIR/valid/server.crt"
if openssl verify -CAfile "$CERT_DIR/ca.crt" "$CERT_DIR/expired/server.crt" >/dev/null 2>&1; then
  echo "Expired certificate unexpectedly validated" >&2
  exit 1
fi
