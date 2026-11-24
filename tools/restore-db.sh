#!/usr/bin/env bash
# Restaura una copia hecha con tools/backup-db.sh.
#
#   RESTORE_URI=...  BACKUP_PASSPHRASE=...  tools/restore-db.sh rotta-AAAA-MM-DD-HHMM.archive.gz.enc [--drop]
#
# Sin --drop solo añade lo que falta: no toca los documentos que ya existen.
# Con --drop borra cada colección de la copia antes de restaurarla (vuelve todo a como estaba).
# Consejo: restaura primero en una base de pruebas para ver que la copia está bien.
set -euo pipefail

: "${RESTORE_URI:?Falta RESTORE_URI (la base donde restaurar)}"
: "${BACKUP_PASSPHRASE:?Falta BACKUP_PASSPHRASE}"
file="${1:?Indica el archivo de la copia}"
shift

openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in "$file" \
  | mongorestore --uri="$RESTORE_URI" --archive --gzip "$@"
