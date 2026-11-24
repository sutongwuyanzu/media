import argparse
import json
import sqlite3
from pathlib import Path

DB = Path(__file__).resolve().parent / 'sync-state.sqlite3'
PLATFORMS = ('xiaohongshu', 'douyin')


def connect():
    db = sqlite3.connect(DB, timeout=10, isolation_level=None)
    db.execute('CREATE TABLE IF NOT EXISTS jobs (source_id TEXT NOT NULL, platform TEXT NOT NULL, state TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, detail TEXT NOT NULL DEFAULT "", PRIMARY KEY(source_id, platform))')
    return db


def reserve(db, source_id, platform):
    if not isinstance(source_id, str) or not source_id.strip() or len(source_id) > 200 or platform not in PLATFORMS:
        raise ValueError('无效的任务标识或平台')
    db.execute('BEGIN IMMEDIATE')
    try:
        row = db.execute('SELECT state FROM jobs WHERE source_id=? AND platform=?', (source_id, platform)).fetchone()
        if row:
            db.execute('ROLLBACK')
            return {'reserved': False, 'state': row[0]}
        db.execute('INSERT INTO jobs(source_id,platform,state) VALUES(?,?,?)', (source_id,platform,'reserved'))
        db.execute('COMMIT')
        return {'reserved': True, 'state': 'reserved'}
    except BaseException:
        if db.in_transaction:
            db.execute('ROLLBACK')
        raise


def main():
    ap=argparse.ArgumentParser(description='逐平台同步状态；已有记录不会自动重试')
    sub=ap.add_subparsers(dest='command',required=True)
    for name in ('reserve','status'):
        cmd=sub.add_parser(name)
        cmd.add_argument('source_id')
        cmd.add_argument('platform',choices=PLATFORMS)
    args=ap.parse_args()
    with connect() as db:
        if args.command == 'reserve':
            result=reserve(db,args.source_id,args.platform)
        else:
            row=db.execute('SELECT state,updated_at,detail FROM jobs WHERE source_id=? AND platform=?',(args.source_id,args.platform)).fetchone()
            result={'state':row[0], 'updated_at':row[1], 'detail':row[2]} if row else {'state':'not_found'}
    print(json.dumps(result,ensure_ascii=False))


if __name__ == '__main__':
    main()
