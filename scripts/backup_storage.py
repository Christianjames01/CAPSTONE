#!/usr/bin/env python3
"""Copies every file in the live Supabase Storage (all buckets) to
~/backups/files/<bucket>/<path>.

Incremental: a file already copied with the same size is skipped, so daily
runs only download what's new or changed. Files deleted in Supabase are kept
here, so an accidental delete can still be recovered.

Needs ~/backups/.cloud_service_key (chmod 600) holding the project's
service_role / secret key -- it can read every bucket, including private ones.
"""
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

SUPABASE_URL = 'https://itirvcydvaujbrwbuctc.supabase.co'
BACKUP_DIR = os.path.expanduser('~/backups')
FILES_DIR = os.path.join(BACKUP_DIR, 'files')

with open(os.path.join(BACKUP_DIR, '.cloud_service_key')) as f:
    KEY = f.read().strip()

# Works for both new secret keys (sb_secret_...) and legacy service_role JWTs.
HEADERS = {'apikey': KEY, 'Authorization': f'Bearer {KEY}'}


def request(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    headers = dict(HEADERS)
    if data is not None:
        headers['Content-Type'] = 'application/json'
    req = urllib.request.Request(SUPABASE_URL + path, data=data, headers=headers, method=method)
    return urllib.request.urlopen(req, timeout=120)


def list_folder(bucket, prefix):
    """Yields (path, size) for every file under prefix, recursing into folders."""
    offset = 0
    while True:
        with request('POST', f'/storage/v1/object/list/{urllib.parse.quote(bucket)}', {
            'prefix': prefix,
            'limit': 1000,
            'offset': offset,
            'sortBy': {'column': 'name', 'order': 'asc'},
        }) as res:
            items = json.load(res)

        for item in items:
            name = item['name']
            path = f'{prefix}/{name}' if prefix else name
            if item.get('id') is None:  # a folder
                yield from list_folder(bucket, path)
            elif name != '.emptyFolderPlaceholder':
                yield path, (item.get('metadata') or {}).get('size')

        if len(items) < 1000:
            return
        offset += 1000


def main():
    with request('GET', '/storage/v1/bucket') as res:
        buckets = [b['id'] for b in json.load(res)]

    total = copied = failed = 0

    for bucket in buckets:
        for path, size in list_folder(bucket, ''):
            total += 1
            target = os.path.join(FILES_DIR, bucket, *path.split('/'))

            if size is not None and os.path.exists(target) and os.path.getsize(target) == size:
                continue

            os.makedirs(os.path.dirname(target), exist_ok=True)
            quoted = '/'.join(urllib.parse.quote(part) for part in path.split('/'))
            try:
                with request('GET', f'/storage/v1/object/{urllib.parse.quote(bucket)}/{quoted}') as res:
                    content = res.read()
                with open(target + '.part', 'wb') as out:
                    out.write(content)
                os.replace(target + '.part', target)
                copied += 1
            except Exception as err:  # keep going; report at the end
                failed += 1
                print(f'FAILED {bucket}/{path}: {err}', file=sys.stderr)

    print(f'{len(buckets)} buckets, {total} files, {copied} new/changed copied, {failed} failed')
    return 1 if failed else 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except urllib.error.HTTPError as err:
        detail = err.read().decode(errors='replace')[:300]
        print(f'Storage request failed: HTTP {err.code} {detail}', file=sys.stderr)
        if err.code in (400, 401, 403):
            print("The key in ~/backups/.cloud_service_key was not accepted. Save the project's "
                  'secret (sb_secret_...) or service_role key again.', file=sys.stderr)
        sys.exit(1)
