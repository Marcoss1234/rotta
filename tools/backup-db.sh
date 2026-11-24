#!/usr/bin/env bash
# Copia de seguridad cifrada de todas las bases de datos de Rotta (todos los clubs).
#
#   MONGO_URI=...  BACKUP_PASSPHRASE=...  tools/backup-db.sh [carpeta]
#
# Deja en la carpeta (por defecto, backups/) un archivo rotta-AAAA-MM-DD-HHMM.archive.gz.enc.
# Sin la frase de BACKUP_PASSPHRASE no se puede abrir: guárdala fuera de GitHub.
# Para restaurarla: tools/restore-db.sh.
set -euo pipefail

: "${MONGO_URI:?Falta MONGO_URI}"
: "${BACKUP_PASSPHRASE:?Falta BACKUP_PASSPHRASE}"

out_dir="${1:-backups}"
mkdir -p "$out_dir"
file="$out_dir/rotta-$(date -u +%Y-%m-%d-%H%M).archive.gz.enc"

# Todo va por tubería: la copia sin cifrar nunca se escribe en disco.
mongodump --uri="$MONGO_URI" --archive --gzip --quiet \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_PASSPHRASE -out "$file"

# Una copia vacía o rota no cuenta como copia.
size=$(wc -c < "$file")
if [ "$size" -lt 200 ]; then
  echo "La copia ha salido vacía ($size bytes)" >&2
  exit 1
fi
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in "$file" | gzip -t

echo "Copia hecha: $file ($size bytes)"
