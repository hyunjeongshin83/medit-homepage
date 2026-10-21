#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MedIT PnP 설치 프로그램 v1.0.0

약국 PC에서 약국 프로그램의 "구조(표·열 이름)"만 확인해, 복약지도 안내에 쓸 항목의 연결 설정(매핑)을 만든다.

이 프로그램이 하지 않는 것
  - 약국 DB의 행(환자·처방 내용)을 읽거나 전송하지 않는다. 읽는 것은 표와 열의 이름·형식뿐이다.
  - 약사가 직접 승인하기 전에는 어떤 설정도 확정하지 않는다. (approve는 약사가 터미널에서 직접 입력해야 한다)
  - 협약·동의·개인정보 검토가 끝나기 전에는 실제 약국 프로그램을 건드리지 않는다. (샘플 구조로만 동작)
  - 환자 데이터를 MedIT으로 보내는 기능(sync)은 아직 없다.

필요한 것: Python 3.8 이상(표준 라이브러리만 사용). 실제 DB 확인에 ODBC를 쓸 때만 pyodbc 필요.
"""
import argparse
import hashlib
import json
import os
import pathlib
import platform
import re
import sqlite3
import sys
import tempfile
import urllib.error
import urllib.request
from datetime import datetime, timezone

VERSION = "1.0.0"
DEFAULT_ENDPOINT = "https://xaclqvveppvccdpebzsz.supabase.co/functions/v1/pnp-install"
ENDPOINT = os.environ.get("MEDIT_PNP_ENDPOINT", DEFAULT_ENDPOINT)
APPROVE_PHRASE = "승인합니다"

# 홈페이지 기술 자료에 이미 적힌 약국 프로그램 이름만 후보로 확인한다(설치 목록에서 이름 일치 여부만 본다).
KNOWN_PROGRAMS = ["PharmIT3000", "PM+20", "밝은매장", "Hu-Pos", "온누리H&C", "지킴"]

EXIT_OK, EXIT_USAGE, EXIT_BLOCKED, EXIT_NET = 0, 2, 3, 4


# ───────────────────────── 공통 ─────────────────────────
class Ctx:
    def __init__(self, args):
        self.json_mode = args.json
        self.home = os.path.abspath(
            args.home or os.environ.get("MEDIT_PNP_HOME") or os.path.join(os.path.expanduser("~"), ".medit-pnp")
        )

    def say(self, *a):
        if not self.json_mode:
            print(*a)

    def path(self, name):
        return os.path.join(self.home, name)


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def write_json(path, obj, private=False):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(obj, f, ensure_ascii=False, indent=2)
        if private:
            try:
                os.chmod(tmp, 0o600)
            except OSError:
                pass
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)


def read_json(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return None


def load_state(ctx):
    return read_json(ctx.path("state.json"))


def need_state(ctx):
    st = load_state(ctx)
    if not st or not st.get("serial"):
        raise Blocked("먼저 시리얼을 확인하세요:  python medit-pnp.py redeem MEDIT-XXXX-XXXX-XXXX")
    return st


class Blocked(Exception):
    pass


class Usage(Exception):
    pass


def api(action, serial, **extra):
    body = json.dumps({"action": action, "serial": serial, **extra}).encode("utf-8")
    req = urllib.request.Request(
        ENDPOINT, data=body, method="POST",
        headers={"Content-Type": "application/json", "User-Agent": "medit-pnp/" + VERSION},
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read().decode("utf-8"))
        except Exception:
            return {"ok": False, "error": "http_%d" % e.code}
    except Exception as e:  # 네트워크 오류
        return {"ok": False, "error": "network", "message": str(e)[:120]}


ERROR_TEXT = {
    "invalid": "시리얼이 맞지 않습니다. 형식은 MEDIT-XXXX-XXXX-XXXX 입니다.",
    "expired": "시리얼 사용 기간이 지났습니다. 새 시리얼을 요청하세요.",
    "revoked": "폐기된 시리얼입니다. 새 시리얼을 요청하세요.",
    "license_pending": "약사 면허 확인이 아직 끝나지 않았습니다. 확인이 끝나면 사용할 수 있습니다.",
    "limit": "이 시리얼의 확인 횟수를 모두 썼습니다. 새 시리얼을 요청하세요.",
    "rate_limited": "잘못된 입력이 많아 잠시 막혔습니다. 10분 뒤 다시 시도하세요.",
    "network": "MedIT 서버에 연결하지 못했습니다. 인터넷 연결을 확인하세요.",
    "not_redeemed": "먼저 redeem 으로 시리얼을 확인하세요.",
    "hash_mismatch": "서버에 기록된 매핑과 달라졌습니다. map --recheck 를 먼저 실행하세요.",
    "not_approved": "약사 승인(approve)이 먼저 필요합니다.",
}


def report(ctx, st, step, ok, detail):
    """서버에 단계 결과를 알린다. 실패해도 로컬 작업은 계속한다."""
    res = api("report", st["serial"], step=step, ok=ok, detail=detail)
    if not res.get("ok"):
        ctx.say("  (서버 기록 실패: %s)" % ERROR_TEXT.get(res.get("error"), res.get("error")))
    return res


def sha256_mapping(engine, fields):
    canon = {"version": 1, "engine": engine,
             "fields": {k: {"table": v["table"], "column": v["column"]} for k, v in sorted(fields.items())}}
    s = json.dumps(canon, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


# ───────────────────────── redeem ─────────────────────────
def cmd_redeem(ctx, a):
    serial = a.serial.strip()
    res = api("redeem", serial)
    if not res.get("ok"):
        err = res.get("error")
        ctx.say("실패:", ERROR_TEXT.get(err, err))
        return EXIT_NET if err == "network" else EXIT_BLOCKED, {"ok": False, "error": err}
    st = {
        "serial": serial.upper(), "pharmacy_label": res["pharmacy_label"], "serial_hint": res["serial_hint"],
        "mode": res["mode"], "fields": res["fields"], "expires_at": res["expires_at"],
        "installer_version": res.get("installer_version"), "redeemed_at": now_iso(),
    }
    write_json(ctx.path("state.json"), st, private=True)
    ctx.say("확인되었습니다.")
    ctx.say("  약국:", st["pharmacy_label"], " / 만료:", st["expires_at"][:10])
    if st["mode"] == "live-ready":
        ctx.say("  모드: 실연동 가능 (협약·동의·검토 완료). 그래도 환자 데이터 전송(sync)은 아직 구현되어 있지 않습니다.")
    else:
        ctx.say("  모드: 샘플 전용. 실제 약국 프로그램은 건드리지 않고, 샘플 구조로 설치 과정을 진행합니다.")
    ctx.say("다음:  python medit-pnp.py detect")
    return EXIT_OK, {"ok": True, "mode": st["mode"], "pharmacy_label": st["pharmacy_label"]}


# ───────────────────────── detect ─────────────────────────
def norm_name(s):
    return re.sub(r"[\s\-_]", "", s or "").lower()


def match_known(names):
    hits = []
    for known in KNOWN_PROGRAMS:
        k = norm_name(known)
        if any(k in norm_name(n) for n in names):
            hits.append(known)
    return hits


def installed_programs():
    """Windows 설치 목록의 프로그램 이름. 다른 OS면 빈 목록."""
    if platform.system() != "Windows":
        return []
    import winreg  # type: ignore
    names = []
    roots = [(winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
             (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"),
             (winreg.HKEY_CURRENT_USER, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall")]
    for hive, sub in roots:
        try:
            with winreg.OpenKey(hive, sub) as k:
                for i in range(winreg.QueryInfoKey(k)[0]):
                    try:
                        with winreg.OpenKey(k, winreg.EnumKey(k, i)) as sk:
                            names.append(winreg.QueryValueEx(sk, "DisplayName")[0])
                    except OSError:
                        continue
        except OSError:
            continue
    return names


def odbc_dsn_names():
    """등록된 ODBC 데이터 원본의 이름만(연결 정보는 읽지 않는다)."""
    if platform.system() != "Windows":
        return []
    import winreg  # type: ignore
    out = []
    for hive in (winreg.HKEY_LOCAL_MACHINE, winreg.HKEY_CURRENT_USER):
        try:
            with winreg.OpenKey(hive, r"SOFTWARE\ODBC\ODBC.INI\ODBC Data Sources") as k:
                for i in range(winreg.QueryInfoKey(k)[1]):
                    out.append(winreg.EnumValue(k, i)[0])
        except OSError:
            continue
    return out


def cmd_detect(ctx, a):
    st = need_state(ctx)
    if platform.system() == "Windows":
        hits = match_known(installed_programs())
        dsns = odbc_dsn_names()
    else:
        hits, dsns = [], []
        ctx.say("이 컴퓨터는 Windows가 아니어서 설치 목록을 자동 확인하지 못합니다.")
    if a.program:
        hits = [a.program[:40]]
    ctx.say("약국 프로그램 후보:", ", ".join(hits) if hits else "찾지 못함(--program 이름 으로 직접 알려 줄 수 있습니다)")
    ctx.say("등록된 ODBC 데이터 원본:", ", ".join(dsns) if dsns else "없음")
    ctx.say("※ 이름만 확인했습니다. 설치 목록 전체나 연결 정보는 읽거나 보내지 않습니다.")
    report(ctx, st, "detect", True, {"programs": hits[:5], "dsn_count": len(dsns), "os": platform.system()[:20]})
    ctx.say("다음:  python medit-pnp.py schema --sample")
    return EXIT_OK, {"ok": True, "programs": hits, "dsn_names": dsns}


# ───────────────────────── schema ─────────────────────────
def build_sample_schema():
    """가상 약국 구조(합성). 실제 약국 프로그램의 구조가 아니다."""
    con = sqlite3.connect(":memory:")
    con.executescript("""
      CREATE TABLE TB_RX (rx_no INTEGER, pt_nm TEXT, pt_tel TEXT, rx_dt TEXT);
      CREATE TABLE TB_RX_DRUG (rx_no INTEGER, drug_nm TEXT, dose_1t TEXT, freq_day INTEGER, days INTEGER, usage_txt TEXT);
      CREATE TABLE TB_STOCK (item_cd TEXT, item_nm TEXT, qty INTEGER);
    """)
    return con


def sqlite_schema(con):
    tables = []
    for (name,) in con.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"):
        cols = [{"name": r[1], "type": (r[2] or "")} for r in con.execute('PRAGMA table_info("%s")' % name.replace('"', '""'))]
        tables.append({"name": name, "columns": cols})
    return tables


def odbc_schema(conn_str):
    try:
        import pyodbc  # type: ignore
    except ImportError:
        raise Blocked("ODBC 확인에는 pyodbc 가 필요합니다:  pip install pyodbc  (약사 동의 후 설치)")
    con = pyodbc.connect(conn_str, readonly=True, autocommit=True, timeout=10)
    cur = con.cursor()
    tables = []
    for t in cur.tables(tableType="TABLE"):
        cols = [{"name": c.column_name, "type": str(c.type_name)} for c in con.cursor().columns(table=t.table_name)]
        tables.append({"name": t.table_name, "columns": cols})
    con.close()
    return tables


def cmd_schema(ctx, a):
    st = need_state(ctx)
    chosen = [bool(a.sample), bool(a.sqlite), bool(a.odbc)]
    if sum(chosen) != 1:
        raise Usage("--sample, --sqlite 파일, --odbc 연결문자열 중 하나만 고르세요.")
    if a.sample:
        engine, tables = "sample", sqlite_schema(build_sample_schema())
    else:
        if st["mode"] != "live-ready":
            raise Blocked("실제 약국 프로그램 구조 확인은 협약·동의·개인정보 검토가 끝난 뒤에만 가능합니다. 지금은 --sample 만 쓸 수 있습니다.")
        if not a.vendor_ok:
            raise Blocked("약국 프로그램 업체와 협의된 방식인지 약사가 확인한 뒤 --vendor-ok 를 붙여 다시 실행하세요.")
        if a.sqlite:
            if not os.path.isfile(a.sqlite):
                raise Usage("파일을 찾을 수 없습니다: " + a.sqlite)
            uri = pathlib.Path(a.sqlite).resolve().as_uri() + "?mode=ro"
            con = sqlite3.connect(uri, uri=True)
            con.execute("PRAGMA query_only = ON")
            engine, tables = "sqlite", sqlite_schema(con)
            con.close()
        else:
            conn = a.odbc
            if conn.startswith("env:"):  # 비밀번호가 명령줄·대화에 남지 않도록 환경변수에서 읽는다
                conn = os.environ.get(conn[4:], "")
                if not conn:
                    raise Usage("환경변수 %s 가 비어 있습니다. 약사가 직접 설정한 뒤 다시 실행하세요." % a.odbc[4:])
            engine, tables = "odbc", odbc_schema(conn)
    n_cols = sum(len(t["columns"]) for t in tables)
    write_json(ctx.path("schema.json"), {"engine": engine, "created_at": now_iso(), "tables": tables})
    ctx.say("구조를 읽었습니다(표 %d개, 열 %d개). 행(데이터)은 읽지 않았습니다." % (len(tables), n_cols))
    for t in tables[:12]:
        ctx.say("  -", t["name"], "(%s)" % ", ".join(c["name"] for c in t["columns"][:8]) + (" …" if len(t["columns"]) > 8 else ""))
    report(ctx, st, "schema", True, {"tables": len(tables), "columns": n_cols, "engine": engine, "sample": engine == "sample"})
    ctx.say("다음:  python medit-pnp.py map")
    return EXIT_OK, {"ok": True, "engine": engine, "tables": len(tables), "columns": n_cols}


# ───────────────────────── map ─────────────────────────
GROUPS = {
    "patient": {"pt", "patient", "ptnt", "환자"},
    "name": {"nm", "name", "성명", "이름", "명"},
    "phone": {"tel", "phone", "hp", "mobile", "cell", "전화", "휴대", "연락처"},
    "drug": {"drug", "med", "medi", "medicine", "prod", "item", "약품", "약명", "의약품"},
    "dose": {"dose", "dosage", "1t", "once", "1회", "용량", "투약량"},
    "freq": {"freq", "times", "횟수", "회수", "daily"},
    "days": {"days", "period", "일수", "투약일수"},
    "disp": {"disp", "dispense", "dispensed", "rx", "조제", "처방"},
    "date": {"dt", "date", "ymd", "일자"},
    "usage": {"usage", "direction", "sig", "instruction", "용법", "복용", "복약"},
}
RULES = {  # 항목 → 필요한 토큰 묶음(모두 충족해야 후보)
    "drug_name": [["drug", "name"]],
    "dose_per_time": [["dose"]],
    "times_per_day": [["freq"]],
    "days": [["days"]],
    "dispensed_on": [["disp", "date"]],
    "usage_note": [["usage"]],
    "patient_name": [["patient", "name"]],
    "patient_phone": [["patient", "phone"]],
}
TABLE_HINT = {"drug": "drug", "patient": "patient", "disp": "disp"}


def tokens(s):
    s = re.sub(r"([a-z])([A-Z])", r"\1 \2", s)
    return [t for t in re.split(r"[^0-9A-Za-z가-힣]+", s.lower()) if t]


def has(tok_list, group):
    syn = GROUPS[group]
    for t in tok_list:
        if t in syn:
            return True
        if re.search(r"[가-힣]", t) and any(re.search(r"[가-힣]", w) and w in t for w in syn):
            return True  # 한글 열 이름은 부분 일치(예: 약품명, 환자명, 조제일자)
    return False


def propose(schema, catalog, mode):
    fields, locked, missing = {}, [], []
    for f in catalog:
        key = f["key"]
        if f["pii"] and mode != "live-ready":
            locked.append(key)
            continue
        best = []
        for t in schema["tables"]:
            ttoks = tokens(t["name"])
            for c in t["columns"]:
                ctoks = tokens(c["name"])
                for need in RULES.get(key, []):
                    if all(has(ctoks, g) for g in need):
                        score = 2 * len(need) + sum(1 for g in need if g in TABLE_HINT and has(ttoks, TABLE_HINT[g]))
                        best.append((score, t["name"], c["name"]))
        best.sort(key=lambda x: (-x[0], x[1], x[2]))
        if best:
            sc, tb, col = best[0]
            fields[key] = {"table": tb, "column": col, "confidence": "high" if sc >= 3 else "medium",
                           "alternatives": ["%s.%s" % (b[1], b[2]) for b in best[1:4]]}
        elif f["required"]:
            missing.append(key)
    return fields, locked, missing


def validate_mapping(mapping, schema, catalog, mode):
    errs = []
    cat = {f["key"]: f for f in catalog}
    by_table = {t["name"]: {c["name"] for c in t["columns"]} for t in schema["tables"]}
    for key, v in (mapping.get("fields") or {}).items():
        if key not in cat:
            errs.append("알 수 없는 항목: %s" % key)
            continue
        if cat[key]["pii"] and mode != "live-ready":
            errs.append("%s: 협약·동의·검토 완료 전에는 매핑할 수 없습니다" % key)
        if v.get("table") not in by_table or v.get("column") not in by_table.get(v.get("table"), set()):
            errs.append("%s: %s.%s 가 구조에 없습니다" % (key, v.get("table"), v.get("column")))
    return errs


def coverage(fields, catalog):
    req = [f["key"] for f in catalog if f["required"]]
    return round(sum(1 for k in req if k in fields) / len(req), 2) if req else 1.0


def cmd_map(ctx, a):
    st = need_state(ctx)
    schema = read_json(ctx.path("schema.json"))
    if not schema:
        raise Blocked("먼저 구조를 확인하세요:  python medit-pnp.py schema --sample")
    catalog, mode = st["fields"], st["mode"]
    path = ctx.path("mapping.proposed.json")
    if a.recheck:
        mapping = read_json(path)
        if not mapping:
            raise Blocked("mapping.proposed.json 이 없습니다. 먼저 map 을 실행하세요.")
        errs = validate_mapping(mapping, schema, catalog, mode)
        if errs:
            ctx.say("매핑에 문제가 있습니다:")
            for e in errs:
                ctx.say("  -", e)
            return EXIT_USAGE, {"ok": False, "errors": errs}
        fields = mapping["fields"]
        locked, missing = mapping.get("locked_fields", []), [f["key"] for f in catalog if f["required"] and f["key"] not in fields]
    else:
        fields, locked, missing = propose(schema, catalog, mode)
        mapping = {"version": 1, "engine": schema["engine"], "serial_hint": st["serial_hint"], "created_at": now_iso(),
                   "fields": fields, "locked_fields": locked, "missing_required": missing,
                   "note": "약사가 화면에서 확인하고 승인해야 확정됩니다. 틀린 항목은 이 파일을 고친 뒤 map --recheck 를 실행하세요."}
    mapping["missing_required"] = missing
    mapping["mapping_hash"] = h = sha256_mapping(mapping["engine"], fields)
    write_json(path, mapping)
    ctx.say("매핑 초안을 만들었습니다 (필수 항목 %d%% 연결)." % int(coverage(fields, catalog) * 100))
    label = {f["key"]: f["label"] for f in catalog}
    for k, v in fields.items():
        ctx.say("  - %-10s ← %s.%s  [%s]" % (label.get(k, k), v["table"], v["column"], v.get("confidence", "수정됨")))
    if locked:
        ctx.say("  잠김(협약·동의·검토 완료 전):", ", ".join(label.get(k, k) for k in locked))
    if missing:
        ctx.say("  찾지 못한 필수 항목:", ", ".join(label.get(k, k) for k in missing), "→ 파일을 열어 직접 지정하세요.")
    report(ctx, st, "mapping", True, {"fields": list(fields), "coverage": coverage(fields, catalog), "mapping_hash": h})
    ctx.say("다음:  약사가 직접 터미널에서  python medit-pnp.py approve")
    return EXIT_OK, {"ok": True, "mapping_hash": h, "fields": list(fields), "missing_required": missing, "locked": locked}


# ───────────────────────── approve ─────────────────────────
def cmd_approve(ctx, a):
    st = need_state(ctx)
    if not (sys.stdin.isatty() and sys.stdout.isatty()):
        raise Blocked("승인은 약사가 터미널(명령 프롬프트)에서 직접 입력해야 합니다. LLM이나 스크립트가 대신 실행할 수 없습니다.")
    schema = read_json(ctx.path("schema.json"))
    mapping = read_json(ctx.path("mapping.proposed.json"))
    if not schema or not mapping:
        raise Blocked("먼저 schema 와 map 을 실행하세요.")
    catalog, mode = st["fields"], st["mode"]
    errs = validate_mapping(mapping, schema, catalog, mode)
    if errs:
        raise Blocked("매핑에 문제가 있어 승인할 수 없습니다: " + "; ".join(errs))
    if mapping.get("missing_required"):
        raise Blocked("필수 항목이 비어 있습니다: " + ", ".join(mapping["missing_required"]))
    fields = mapping["fields"]
    h = sha256_mapping(mapping["engine"], fields)
    label = {f["key"]: f["label"] for f in catalog}
    print("\n=== 약사 승인 ===")
    print("약국:", st["pharmacy_label"], "/ 모드:", "실연동 가능" if mode == "live-ready" else "샘플 전용")
    print("아래 항목만 안내에 쓰이며, 이 밖의 열은 읽지 않습니다.\n")
    for k, v in fields.items():
        print("  %-12s ← %s.%s" % (label.get(k, k), v["table"], v["column"]))
    print("\n지문(해시):", h[:16] + "…")
    print("이 프로그램은 환자 데이터를 읽거나 보내지 않으며, 안내문은 약사 확인 없이 발송되지 않습니다.")
    typed = input('\n위 내용을 확인했고 승인하려면 "%s" 를 입력하세요: ' % APPROVE_PHRASE).strip()
    if typed != APPROVE_PHRASE:
        print("승인하지 않았습니다.")
        return EXIT_BLOCKED, {"ok": False, "error": "not_approved"}
    approved = dict(mapping, mapping_hash=h, approved_at=now_iso())
    write_json(ctx.path("mapping.approved.json"), approved)
    st["approved_hash"] = h
    write_json(ctx.path("state.json"), st, private=True)
    report(ctx, st, "mapping", True, {"fields": list(fields), "coverage": coverage(fields, catalog), "mapping_hash": h})
    res = report(ctx, st, "approve", True, {"mapping_hash": h})
    print("승인되었습니다. 다음:  python medit-pnp.py verify")
    return EXIT_OK, {"ok": True, "mapping_hash": h, "server": res.get("status")}


# ───────────────────────── verify ─────────────────────────
SAMPLE_VALUES = {
    "drug_name": ["샘플정 10mg", "예시캡슐 250mg", "견본시럽 5ml"],
    "dose_per_time": ["1정", "1캡슐", "5ml"],
    "times_per_day": [3, 2, 1],
    "days": [7, 5, 14],
    "dispensed_on": ["2026-01-01", "2026-01-02", "2026-01-03"],
    "usage_note": ["식후 30분", "취침 전", "식전"],
    "patient_name": ["가상환자1", "가상환자2", "가상환자3"],
    "patient_phone": ["000-0000-0001", "000-0000-0002", "000-0000-0003"],
}


def cmd_verify(ctx, a):
    st = need_state(ctx)
    approved = read_json(ctx.path("mapping.approved.json"))
    if not approved or st.get("approved_hash") != approved.get("mapping_hash"):
        raise Blocked("약사 승인이 필요합니다:  python medit-pnp.py approve")
    if sha256_mapping(approved["engine"], approved["fields"]) != approved["mapping_hash"]:
        raise Blocked("승인된 매핑 파일이 승인 뒤에 바뀌었습니다. 다시 map 과 approve 를 진행하세요.")
    fields = approved["fields"]
    catalog = st["fields"]
    label = {f["key"]: f["label"] for f in catalog}
    ctx.say("가상 데이터 3건으로 전송 항목을 점검합니다. 실제 DB의 행은 읽지 않았습니다.\n")
    rows = []
    for i in range(3):
        rows.append({k: SAMPLE_VALUES[k][i] for k in fields if k in SAMPLE_VALUES})
    for i, r in enumerate(rows, 1):
        ctx.say("  [샘플 %d]" % i, ", ".join("%s=%s" % (label.get(k, k), v) for k, v in r.items()))
    config = {"version": 1, "installer_version": VERSION, "serial_hint": st["serial_hint"], "mode": st["mode"],
              "pharmacy_label": st["pharmacy_label"], "mapping_hash": approved["mapping_hash"],
              "engine": approved["engine"], "fields": {k: {"table": v["table"], "column": v["column"]} for k, v in fields.items()},
              "transfer": "locked", "created_at": now_iso()}
    write_json(ctx.path("config.json"), config)
    res = report(ctx, st, "verify", True, {"sample_rows": len(rows), "fields": list(fields)})
    ctx.say("\n설정이 저장되었습니다:", ctx.path("config.json"))
    ctx.say("현재 상태: 설정 완료(샘플 검증까지). 환자 데이터 전송은 잠겨 있습니다.")
    return EXIT_OK, {"ok": True, "server": res.get("status"), "config": ctx.path("config.json")}


# ───────────────────────── status / sync / reset ─────────────────────────
def cmd_status(ctx, a):
    st = load_state(ctx)
    if not st:
        ctx.say("아직 시작하지 않았습니다.  python medit-pnp.py redeem MEDIT-XXXX-XXXX-XXXX")
        return EXIT_OK, {"ok": True, "started": False}
    steps = {
        "시리얼 확인": True,
        "구조 확인": os.path.exists(ctx.path("schema.json")),
        "매핑 초안": os.path.exists(ctx.path("mapping.proposed.json")),
        "약사 승인": bool(st.get("approved_hash")),
        "샘플 검증·설정 저장": os.path.exists(ctx.path("config.json")),
    }
    ctx.say("약국:", st["pharmacy_label"], "/ 모드:", st["mode"], "/ 만료:", st["expires_at"][:10])
    for k, v in steps.items():
        ctx.say("  [%s] %s" % ("완료" if v else "대기", k))
    ctx.say("환자 데이터 전송: 잠김")
    return EXIT_OK, {"ok": True, "started": True, "mode": st["mode"], "steps": steps}


def cmd_sync(ctx, a):
    st = need_state(ctx)
    why = ("협약·동의·개인정보 검토가 끝나지 않아 잠겨 있습니다." if st["mode"] != "live-ready"
           else "아직 구현되지 않았습니다. 업체 협약과 개인정보 검토 결과에 따라 방식을 정한 뒤 구현합니다.")
    ctx.say("sync(환자 데이터 전송):", why)
    return EXIT_BLOCKED, {"ok": False, "error": "locked", "reason": why}


def cmd_reset(ctx, a):
    if not a.yes:
        raise Usage("저장된 설정과 시리얼을 지우려면 --yes 를 붙이세요.")
    removed = []
    for n in ("state.json", "schema.json", "mapping.proposed.json", "mapping.approved.json", "config.json"):
        p = ctx.path(n)
        if os.path.exists(p):
            os.remove(p)
            removed.append(n)
    ctx.say("지웠습니다:", ", ".join(removed) if removed else "지울 파일이 없습니다")
    return EXIT_OK, {"ok": True, "removed": removed}


# ───────────────────────── main ─────────────────────────
def build_parser():
    p = argparse.ArgumentParser(prog="medit-pnp", description="MedIT PnP 설치 프로그램 v" + VERSION)
    p.add_argument("--home", help="설정 저장 폴더 (기본: ~/.medit-pnp)")
    p.add_argument("--json", action="store_true", help="결과를 JSON 한 줄로만 출력")
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("redeem", help="시리얼 확인"); s.add_argument("serial"); s.set_defaults(fn=cmd_redeem)
    s = sub.add_parser("detect", help="약국 프로그램 이름 확인(이름만)"); s.add_argument("--program"); s.set_defaults(fn=cmd_detect)
    s = sub.add_parser("schema", help="표·열 이름 확인(행은 읽지 않음)")
    s.add_argument("--sample", action="store_true", help="가상 구조로 진행(샘플 전용 모드)")
    s.add_argument("--sqlite", help="SQLite 파일(읽기 전용)")
    s.add_argument("--odbc", help="ODBC 연결 문자열(저장하지 않음). 비밀번호가 있으면 env:환경변수이름 으로 지정")
    s.add_argument("--vendor-ok", action="store_true", help="약국 프로그램 업체와 협의된 방식임을 약사가 확인함")
    s.set_defaults(fn=cmd_schema)
    s = sub.add_parser("map", help="항목 연결 초안 만들기"); s.add_argument("--recheck", action="store_true", help="고친 초안을 다시 검사"); s.set_defaults(fn=cmd_map)
    s = sub.add_parser("approve", help="약사 승인(터미널에서 직접)"); s.set_defaults(fn=cmd_approve)
    s = sub.add_parser("verify", help="가상 데이터로 점검하고 설정 저장"); s.set_defaults(fn=cmd_verify)
    s = sub.add_parser("status", help="진행 상태"); s.set_defaults(fn=cmd_status)
    s = sub.add_parser("sync", help="환자 데이터 전송(잠김)"); s.set_defaults(fn=cmd_sync)
    s = sub.add_parser("reset", help="저장된 설정 지우기"); s.add_argument("--yes", action="store_true"); s.set_defaults(fn=cmd_reset)
    return p


def main(argv=None):
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
    args = build_parser().parse_args(argv)
    ctx = Ctx(args)
    try:
        code, result = args.fn(ctx, args)
    except Blocked as e:
        ctx.say("멈춤:", e)
        code, result = EXIT_BLOCKED, {"ok": False, "error": "blocked", "message": str(e)}
    except Usage as e:
        ctx.say("사용법:", e)
        code, result = EXIT_USAGE, {"ok": False, "error": "usage", "message": str(e)}
    except (sqlite3.Error, OSError) as e:
        ctx.say("오류:", e)
        code, result = EXIT_USAGE, {"ok": False, "error": "io", "message": str(e)[:200]}
    if ctx.json_mode:
        print(json.dumps(result, ensure_ascii=False))
    return code


if __name__ == "__main__":
    sys.exit(main())
