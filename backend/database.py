"""
Database integration module for CIT Campus Scheduling & Venue Engine.
Connects with Supabase PostgreSQL if credentials are provided (SUPABASE_URL and SUPABASE_KEY or DATABASE_URL),
otherwise provides safe, reliable local-fallback operations using cit_public.json and exports.
"""

import os
import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

logger = logging.getLogger("cit_database")
logging.basicConfig(level=logging.INFO)

# Environment variables
SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "").strip()
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

_supabase_client = None
_client_init_error = None
_last_sync_time = None

def get_supabase_client():
    """
    Lazily initializes and returns the Supabase client if configured.
    """
    global _supabase_client, _client_init_error
    if _supabase_client is not None:
        return _supabase_client
    if _client_init_error is not None:
        return None

    if not SUPABASE_URL or not SUPABASE_KEY:
        _client_init_error = "SUPABASE_URL or SUPABASE_KEY not configured in environment"
        return None

    try:
        from supabase import create_client, Client
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        logger.info(f"Supabase client successfully initialized for {SUPABASE_URL}")
        return _supabase_client
    except Exception as e:
        _client_init_error = str(e)
        logger.warning(f"Failed to initialize Supabase client: {e}")
        return None

def get_database_status() -> Dict[str, Any]:
    """
    Returns connection status and statistics for Supabase or local fallback mode.
    """
    client = get_supabase_client()
    if client:
        try:
            # Quick ping to institutes table
            res = client.table("institutes").select("count", count="exact").execute()
            count = res.count if hasattr(res, "count") and res.count is not None else 1
            return {
                "configured": True,
                "connected": True,
                "mode": "supabase",
                "url": SUPABASE_URL.split(".supabase.co")[0] + ".supabase.co" if ".supabase.co" in SUPABASE_URL else "configured",
                "tables_count": {"institutes": count},
                "last_synced": _last_sync_time or "Ready to sync",
                "message": "Connected to Supabase PostgreSQL database."
            }
        except Exception as e:
            return {
                "configured": True,
                "connected": False,
                "mode": "local_fallback",
                "error": str(e),
                "last_synced": _last_sync_time,
                "message": f"Supabase configured but ping failed ({e}). Operating in local fallback mode."
            }
    else:
        return {
            "configured": bool(SUPABASE_URL and SUPABASE_KEY),
            "connected": False,
            "mode": "local_fallback",
            "last_synced": _last_sync_time,
            "message": "Running in local storage mode (add SUPABASE_URL & SUPABASE_KEY in .env to connect live DB)."
        }

def sync_dataset_to_supabase(dataset: Dict[str, Any], user_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Syncs the active in-memory dataset to Supabase relational tables.
    """
    client = get_supabase_client()
    if not client:
        return {
            "success": False,
            "mode": "local_fallback",
            "message": "Supabase not configured or unreachable. Local data preserved."
        }

    global _last_sync_time
    try:
        inst_name = dataset.get("institute", "Chilika Institute of Technology")
        dataset_id = dataset.get("dataset_id", "CIT_PUBLIC_V1")

        # 1. Upsert Institute
        inst_res = client.table("institutes").upsert({
            "name": inst_name
        }, on_conflict="name").execute()
        
        inst_records = client.table("institutes").select("id").eq("name", inst_name).execute()
        if not inst_records.data:
            raise RuntimeError("Failed to resolve institute ID from Supabase")
        inst_id = inst_records.data[0]["id"]

        # 2. Upsert Dataset record
        dataset_row = {
            "institute_id": inst_id,
            "source_dataset_id": dataset_id,
            "institute_name": inst_name,
            "is_active": True,
            "calendar": dataset.get("calendar", {}),
            "priority_order": dataset.get("priority_order", []),
            "role_category_cap": dataset.get("role_category_cap", {}),
            "source_payload": dataset
        }
        
        # Check if dataset exists
        existing_ds = client.table("datasets").select("id").eq("institute_id", inst_id).eq("source_dataset_id", dataset_id).execute()
        if existing_ds.data:
            db_dataset_id = existing_ds.data[0]["id"]
            client.table("datasets").update(dataset_row).eq("id", db_dataset_id).execute()
        else:
            new_ds = client.table("datasets").insert(dataset_row).execute()
            db_dataset_id = new_ds.data[0]["id"]

        # 3. Upsert Rooms
        rooms = dataset.get("rooms", [])
        if rooms:
            room_rows = [{
                "dataset_id": db_dataset_id,
                "id": r["id"],
                "name": r.get("name", r["id"]),
                "building": r.get("building", "Main"),
                "type": r.get("type", "classroom"),
                "capacity": r.get("capacity", 0),
                "features": r.get("features", []),
                "accessible": r.get("accessible", False),
                "allowed_uses": r.get("allowed_uses", [])
            } for r in rooms]
            client.table("rooms").upsert(room_rows, on_conflict="dataset_id,id").execute()

        # 4. Upsert Faculty
        faculty = dataset.get("faculty", [])
        if faculty:
            fac_rows = [{
                "dataset_id": db_dataset_id,
                "id": f["id"],
                "name": f.get("name", f["id"]),
                "department": f.get("department", "CSE"),
                "max_hours_per_day": f.get("max_hours_per_day", 6),
                "needs_accessible": f.get("needs_accessible", False),
                "preferences": f.get("preferences", [])
            } for f in faculty]
            client.table("faculty").upsert(fac_rows, on_conflict="dataset_id,id").execute()

        # 5. Upsert Student Groups
        groups = dataset.get("student_groups", [])
        if groups:
            grp_rows = [{
                "dataset_id": db_dataset_id,
                "id": g["id"],
                "name": g.get("name", g["id"]),
                "year": g.get("year", 1),
                "department": g.get("department", "CSE"),
                "size": g.get("size", 0),
                "needs_accessible": g.get("needs_accessible", False)
            } for g in groups]
            client.table("student_groups").upsert(grp_rows, on_conflict="dataset_id,id").execute()

        # 6. Upsert Courses
        courses = dataset.get("courses", [])
        if courses:
            course_rows = [{
                "dataset_id": db_dataset_id,
                "id": c["id"],
                "title": c.get("title", c["id"]),
                "department": c.get("department", "CSE"),
                "year": c.get("year", 1),
                "lecture_hours": c.get("lecture_hours", 0),
                "tutorial_hours": c.get("tutorial_hours", 0),
                "lab_blocks": c.get("lab_blocks", 0)
            } for c in courses]
            client.table("courses").upsert(course_rows, on_conflict="dataset_id,id").execute()

        # 7. Upsert Sessions
        sessions = dataset.get("sessions", [])
        if sessions:
            sess_rows = [{
                "dataset_id": db_dataset_id,
                "id": s["id"],
                "course_id": s["course_id"],
                "kind": s.get("kind", "lecture"),
                "faculty_id": s["faculty_id"],
                "size": s.get("size", 0),
                "duration": s.get("duration", 1),
                "room_types": s.get("room_types", []),
                "needs_accessible": s.get("needs_accessible", False),
                "basket_slot": s.get("basket_slot"),
                "fixed_day": s.get("fixed_day"),
                "fixed_start_period": s.get("fixed_start_period")
            } for s in sessions]
            client.table("sessions").upsert(sess_rows, on_conflict="dataset_id,id").execute()

        _last_sync_time = datetime.now().isoformat()
        return {
            "success": True,
            "mode": "supabase",
            "dataset_id": db_dataset_id,
            "rooms_synced": len(rooms),
            "faculty_synced": len(faculty),
            "sessions_synced": len(sessions),
            "timestamp": _last_sync_time
        }
    except Exception as e:
        logger.error(f"Error syncing dataset to Supabase: {e}")
        return {
            "success": False,
            "mode": "supabase_error",
            "error": str(e)
        }

def sync_schedule_to_supabase(
    schedule_data: Dict[str, Any],
    dataset_id_str: str = "CIT_PUBLIC_V1",
    status: str = "active",
    source_kind: str = "baseline",
    val_report: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Syncs generated schedule to Supabase schedules and scheduled_sessions tables.
    """
    client = get_supabase_client()
    if not client:
        return {"success": False, "mode": "local_fallback", "message": "Supabase client not active"}

    try:
        # Resolve dataset UUID
        ds_res = client.table("datasets").select("id").eq("source_dataset_id", dataset_id_str).execute()
        if not ds_res.data:
            return {"success": False, "message": f"Dataset {dataset_id_str} not found in Supabase"}
        ds_id = ds_res.data[0]["id"]

        # Insert schedule row
        sched_row = {
            "dataset_id": ds_id,
            "status": status,
            "source_kind": source_kind,
            "team": schedule_data.get("team", "CrunchWeek Solver"),
            "payload": schedule_data,
            "validator_report": val_report or {}
        }
        res = client.table("schedules").insert(sched_row).execute()
        sched_id = res.data[0]["id"]

        # Populate scheduled_sessions
        sessions = schedule_data.get("sessions", [])
        if sessions:
            sched_sess_rows = [{
                "schedule_id": sched_id,
                "session_id": s["session_id"],
                "day": s["day"],
                "start_period": s["start_period"],
                "room_id": s["room_id"]
            } for s in sessions]
            client.table("scheduled_sessions").insert(sched_sess_rows).execute()

        return {
            "success": True,
            "schedule_id": sched_id,
            "sessions_synced": len(sessions)
        }
    except Exception as e:
        logger.error(f"Error syncing schedule to Supabase: {e}")
        return {"success": False, "error": str(e)}

def record_audit_log(actor_name: str, action: str, details: Optional[Dict[str, Any]] = None):
    """
    Asynchronously records an audit event into Supabase audit_logs table if connected.
    """
    client = get_supabase_client()
    if not client:
        return
    try:
        inst_res = client.table("institutes").select("id").limit(1).execute()
        if not inst_res.data:
            return
        inst_id = inst_res.data[0]["id"]
        client.table("audit_logs").insert({
            "institute_id": inst_id,
            "actor_name": actor_name,
            "action": action,
            "details": details or {}
        }).execute()
    except Exception as e:
        logger.debug(f"Audit log push skipped: {e}")
