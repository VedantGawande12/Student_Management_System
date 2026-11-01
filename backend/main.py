import copy
import hashlib
import json
import os
import secrets
import sys
from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

# Ensure root workspace dir is in sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

import validator
from backend import solver
from backend import ai_service
from backend import database

app = FastAPI(title="CIT Campus Scheduling & Venue Management API", version="1.0.0")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------------------
# Test Credentials & Role-Based Access Control (RBAC)
# -------------------------------------------------------------
PASSWORD_SALT = "cit_campus_scheduling_2026_salt"

def hash_password(pwd: str) -> str:
    return hashlib.sha256((pwd + PASSWORD_SALT).encode("utf-8")).hexdigest()

TEST_ACCOUNTS = {
    "admin@cit.edu.in": {
        "email": "admin@cit.edu.in",
        "name": "Prof. Shreya Kapoor (Dean's Office)",
        "role": "admin",
        "department": "ADMIN",
        "faculty_id": "F37",
        "badge": "Dean / Admin",
        "password_hash": hash_password("Admin@123"),
        "raw_password": "Admin@123",
        "description": "Full administrative authority: CP-SAT solver execution, disruptions, DB sync, configuration."
    },
    "coord.cse@cit.edu.in": {
        "email": "coord.cse@cit.edu.in",
        "name": "Dr. Rajesh Verma (Coordinator CSE)",
        "role": "department_coordinator",
        "department": "CSE",
        "faculty_id": "F01",
        "badge": "Dept Coordinator (CSE)",
        "password_hash": hash_password("Coord@123"),
        "raw_password": "Coord@123",
        "description": "Department coordination & venue approval powers (with strict NO self-approval enforcement)."
    },
    "f12@cit.edu.in": {
        "email": "f12@cit.edu.in",
        "name": "Dr. Amit Behera",
        "role": "faculty",
        "department": "CSE",
        "faculty_id": "F12",
        "badge": "Faculty (F12)",
        "password_hash": hash_password("Faculty@123"),
        "raw_password": "Faculty@123",
        "description": "Academic instructor: view faculty schedule, evaluate rescheduling for F12 sessions, submit academic bookings."
    },
    "dramatics@cit.edu.in": {
        "email": "dramatics@cit.edu.in",
        "name": "Dramatics Society",
        "role": "club",
        "department": None,
        "faculty_id": None,
        "badge": "Club Rep (Dramatics)",
        "password_hash": hash_password("Club@123"),
        "raw_password": "Club@123",
        "description": "Student club representative: submit club festival & venue requests via AI copilot, view Fest Week slots."
    }
}

# Token Store: token -> { "user": user_dict, "created_at": iso_str }
ACTIVE_TOKENS: Dict[str, Dict[str, Any]] = {}

# Pre-seed persistent tokens for test accounts
STATIC_TOKENS = {
    "tok_admin_cit": "admin@cit.edu.in",
    "tok_coord_cit": "coord.cse@cit.edu.in",
    "tok_faculty_cit": "f12@cit.edu.in",
    "tok_club_cit": "dramatics@cit.edu.in"
}
for tok, email in STATIC_TOKENS.items():
    acc = copy.deepcopy(TEST_ACCOUNTS[email])
    acc.pop("password_hash", None)
    acc.pop("raw_password", None)
    ACTIVE_TOKENS[tok] = {
        "user": acc,
        "created_at": datetime.now().isoformat()
    }

# -------------------------------------------------------------
# In-Memory App State
# -------------------------------------------------------------
class State:
    def __init__(self):
        self.data_path = os.path.join(BASE_DIR, "data", "cit_public.json")
        self.export_sched_path = os.path.join(BASE_DIR, "exports", "schedule.json")
        self.export_after_path = os.path.join(BASE_DIR, "exports", "schedule_after.json")
        
        self.raw_data = validator.load(self.data_path)
        self.active_data = copy.deepcopy(self.raw_data)
        
        # Load baseline schedule if exists, else None
        if os.path.exists(self.export_sched_path):
            self.active_schedule = validator.load(self.export_sched_path)
        else:
            self.active_schedule = None
            
        self.disrupted_schedule = None
        self.disruption_diff = None
        self.pending_disruption = None
        self.last_approved_diff = None
        
        # Hydrate state from Supabase if connected and tables exist
        try:
            remote_state = database.load_data_from_supabase(self.active_data.get("dataset_id", "CIT_PUBLIC_V1"))
            if remote_state:
                if remote_state.get("bookings"):
                    self.active_data["booking_requests"] = remote_state["bookings"]
                if remote_state.get("cancellations"):
                    self.active_data["cancellations"] = remote_state["cancellations"]
                if remote_state.get("schedule"):
                    self.active_schedule = remote_state["schedule"]
        except Exception as e:
            logger.debug(f"Supabase state hydration skipped: {e}")

        for r in self.active_data.get("booking_requests", []):
            if "week_scope" not in r:
                r["week_scope"] = "spectra"
                r["target_week"] = 7
                r["recurrence"] = "once"

        # Default user (Dean/Admin)
        default_acc = copy.deepcopy(TEST_ACCOUNTS["admin@cit.edu.in"])
        default_acc.pop("password_hash", None)
        default_acc.pop("raw_password", None)
        self.current_user = default_acc
        self.audit_logs = []
        self.log_event("SYSTEM", "Initialized server state")

    def log_event(self, actor: str, action: str, details: Optional[Dict[str, Any]] = None):
        entry = {
            "timestamp": datetime.now().isoformat(),
            "actor": actor,
            "action": action,
            "details": details or {}
        }
        self.audit_logs.insert(0, entry)
        database.record_audit_log(actor, action, details)

state = State()

@app.on_event("startup")
def startup_event():
    """
    On backend startup, automatically synchronizes the active dataset and baseline
    schedule to Supabase if connected and writable, ensuring database persistence
    is 100% automatic without requiring manual user intervention.
    """
    try:
        db_stat = database.get_database_status()
        if db_stat.get("connected") and db_stat.get("writable"):
            dataset_id = state.active_data.get("dataset_id", "cit-public-v1")
            database.sync_dataset_to_supabase(state.active_data)
            if state.active_schedule:
                val_report = None
                try:
                    val_report = validator.run(state.active_data, state.active_schedule)
                except Exception:
                    pass
                database.sync_schedule_to_supabase(
                    state.active_schedule,
                    dataset_id_str=dataset_id,
                    status="active",
                    val_report=val_report
                )
            state.log_event("SYSTEM", "Automatic startup database synchronization to Supabase completed")
    except Exception as e:
        print(f"Startup auto-sync warning: {e}")

# -------------------------------------------------------------
# Authentication & Role Dependency
# -------------------------------------------------------------
def get_current_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    if authorization:
        token = authorization
        if token.lower().startswith("bearer "):
            token = token[7:].strip()
        if token in ACTIVE_TOKENS:
            return ACTIVE_TOKENS[token]["user"]
    # Fallback to state.current_user if token not provided
    return state.current_user

def require_role(*roles: str):
    def role_dependency(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
        if user.get("role") not in roles:
            raise HTTPException(
                status_code=403,
                detail=f"Forbidden: Action restricted to roles {roles}. Your role is '{user.get('role')}'."
            )
        return user
    return role_dependency

# -------------------------------------------------------------
# Pydantic Request Models
# -------------------------------------------------------------
class LoginRequest(BaseModel):
    email: str
    password: str

class SwitchUserRequest(BaseModel):
    email: str

class ParseAIRequest(BaseModel):
    text: str
    current_day: Optional[str] = None

class BookingSubmitRequest(BaseModel):
    title: str
    attendance: int
    duration_periods: int
    windows: List[Dict[str, Any]]
    room_types: List[str]
    needs: List[str]
    requested_room: Optional[str] = None
    mandatory_for_groups: Optional[List[str]] = []
    requested_category: Optional[str] = "club_event"
    raw_text: Optional[str] = ""
    recurrence: Optional[str] = "once"
    target_week: Optional[int] = None
    week_scope: Optional[str] = None

class BookingDecideRequest(BaseModel):
    request_id: str
    status: str  # approved, rejected, alternative_offered
    day: Optional[str] = None
    start_period: Optional[int] = None
    end_period: Optional[int] = None
    room_id: Optional[str] = None
    reason: Optional[str] = ""

class FacultyChangeRequest(BaseModel):
    session_id: str
    preferred_day: str
    preferred_start_period: int
    note: Optional[str] = ""

class SessionMoveRequest(BaseModel):
    session_id: str
    day: str
    start_period: int
    room_id: str

# -------------------------------------------------------------
# Auth Endpoints
# -------------------------------------------------------------

@app.get("/api/health")
def health():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}

@app.post("/api/auth/login")
def login(req: LoginRequest):
    email = req.email.strip().lower()
    acc = TEST_ACCOUNTS.get(email)
    if not acc:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if hash_password(req.password) != acc["password_hash"]:
        raise HTTPException(status_code=401, detail="Invalid email or password")
        
    token = f"tok_{secrets.token_hex(24)}"
    user_data = {
        "email": acc["email"],
        "name": acc["name"],
        "role": acc["role"],
        "department": acc.get("department"),
        "faculty_id": acc.get("faculty_id"),
        "badge": acc.get("badge")
    }
    ACTIVE_TOKENS[token] = {
        "user": user_data,
        "created_at": datetime.now().isoformat()
    }
    state.current_user = user_data
    state.log_event(user_data["name"], f"User logged in ({user_data['role']})")
    return {"token": token, "user": user_data}

@app.post("/api/auth/logout")
def logout(authorization: Optional[str] = Header(None)):
    if authorization:
        token = authorization
        if token.lower().startswith("bearer "):
            token = token[7:].strip()
        ACTIVE_TOKENS.pop(token, None)
    state.log_event("USER", "User logged out")
    return {"status": "success", "message": "Logged out successfully"}

@app.get("/api/auth/me")
def get_user_me(user: Dict[str, Any] = Depends(get_current_user)):
    return user

@app.get("/api/auth/test-credentials")
def get_test_credentials():
    return [
        {
            "email": acc["email"],
            "password": acc["raw_password"],
            "role": acc["role"],
            "name": acc["name"],
            "badge": acc["badge"],
            "description": acc["description"]
        }
        for acc in TEST_ACCOUNTS.values()
    ]

@app.get("/api/auth/accounts")
def get_demo_accounts():
    accounts = []
    for acc in TEST_ACCOUNTS.values():
        c = copy.deepcopy(acc)
        c.pop("password_hash", None)
        c.pop("raw_password", None)
        accounts.append(c)
    return accounts

@app.post("/api/auth/switch")
def switch_user(req: SwitchUserRequest):
    email = req.email.strip().lower()
    if email not in TEST_ACCOUNTS:
        raise HTTPException(status_code=404, detail="Test account not found")
    
    acc = copy.deepcopy(TEST_ACCOUNTS[email])
    acc.pop("password_hash", None)
    acc.pop("raw_password", None)
    
    # Generate token for seamless switch
    token = f"tok_{secrets.token_hex(24)}"
    ACTIVE_TOKENS[token] = {
        "user": acc,
        "created_at": datetime.now().isoformat()
    }
    state.current_user = acc
    state.log_event(state.current_user["name"], f"Switched role to {state.current_user['role']}")
    return {"token": token, "user": acc}

# -------------------------------------------------------------
# Database Integration Endpoints (Supabase)
# -------------------------------------------------------------

@app.get("/api/database/status")
def database_status():
    return database.get_database_status()

@app.post("/api/database/sync")
def sync_database(user: Dict[str, Any] = Depends(require_role("admin"))):
    ds_res = database.sync_dataset_to_supabase(state.active_data)
    sched_res = None
    if state.active_schedule:
        val_report = None
        try:
            val_report = validator.run(state.active_data, state.active_schedule)
        except Exception:
            pass
        sched_res = database.sync_schedule_to_supabase(
            state.active_schedule,
            dataset_id_str=state.active_data.get("dataset_id", "CIT_PUBLIC_V1"),
            val_report=val_report
        )
    state.log_event(user["name"], "Triggered Supabase database synchronization")
    return {
        "status": "success",
        "dataset_sync": ds_res,
        "schedule_sync": sched_res,
        "database_status": database.get_database_status()
    }

# -------------------------------------------------------------
# System State & Solvers
# -------------------------------------------------------------

@app.get("/api/state")
def get_state(user: Dict[str, Any] = Depends(get_current_user)):
    # Compute validator reports
    val_report = None
    if state.active_schedule:
        try:
            val_report = validator.run(state.active_data, state.active_schedule)
        except Exception as e:
            val_report = {"error": str(e)}
            
    disruption_val_report = None
    if state.disrupted_schedule and state.pending_disruption:
        try:
            disrupted_data = validator.apply_disruption(state.active_data, state.pending_disruption)
            disruption_val_report = validator.run(
                disrupted_data,
                state.disrupted_schedule,
                baseline=state.active_schedule
            )
        except Exception as e:
            disruption_val_report = {"error": str(e)}
            
    return {
        "dataset_summary": {
            "dataset_id": state.active_data.get("dataset_id"),
            "institute": state.active_data.get("institute"),
            "rooms_count": len(state.active_data.get("rooms", [])),
            "faculty_count": len(state.active_data.get("faculty", [])),
            "sessions_count": len(state.active_data.get("sessions", [])),
            "groups_count": len(state.active_data.get("student_groups", [])),
            "booking_requests_count": len(state.active_data.get("booking_requests", [])),
            "exams_count": len(state.active_data.get("exams", [])),
        },
        "rooms": state.active_data.get("rooms", []),
        "faculty": state.active_data.get("faculty", []),
        "student_groups": state.active_data.get("student_groups", []),
        "sessions": state.active_data.get("sessions", []),
        "exams_meta": state.active_data.get("exams", []),
        "booking_requests": state.active_data.get("booking_requests", []),
        "cancellations": state.active_data.get("cancellations", []),
        "active_schedule": state.active_schedule,
        "disrupted_schedule": state.disrupted_schedule,
        "disruption_diff": state.disruption_diff,
        "pending_disruption": state.pending_disruption,
        "last_approved_diff": state.last_approved_diff,
        "validator_report": val_report,
        "disruption_validator_report": disruption_val_report,
        "current_user": user,
        "audit_logs": state.audit_logs[:50],
        "database_status": database.get_database_status()
    }

@app.post("/api/schedule/generate")
def generate_schedule(user: Dict[str, Any] = Depends(require_role("admin"))):
    try:
        t0 = datetime.now()
        sched = solver.solve_all(state.active_data, baseline=None, timeout_sec=25)
        state.active_schedule = sched
        
        # Save to exports/schedule.json
        os.makedirs(os.path.dirname(state.export_sched_path), exist_ok=True)
        with open(state.export_sched_path, "w", encoding="utf-8") as f:
            json.dump(sched, f, indent=2)
            
        elapsed = (datetime.now() - t0).total_seconds()
        state.log_event(user["name"], f"Generated baseline timetable in {elapsed:.1f}s")
        
        # If Supabase connected, auto sync
        val_report = validator.run(state.active_data, sched)
        database.sync_dataset_to_supabase(state.active_data)
        database.sync_schedule_to_supabase(
            sched,
            dataset_id_str=state.active_data.get("dataset_id", "CIT_PUBLIC_V1"),
            val_report=val_report
        )
        
        return {"status": "success", "schedule": sched}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/disruption/apply")
def apply_disruption(disruption: Optional[Dict[str, Any]] = None, user: Dict[str, Any] = Depends(require_role("admin"))):
    try:
        if not disruption:
            sample_path = os.path.join(BASE_DIR, "examples", "sample_disruption.json")
            disruption = validator.load(sample_path)
            
        if not state.active_schedule:
            raise HTTPException(status_code=400, detail="Generate baseline schedule before applying disruptions")
            
        t0 = datetime.now()
        sched_after = solver.solve_all(
            state.active_data,
            baseline=state.active_schedule,
            disruption=disruption,
            timeout_sec=25
        )
        diff = solver.compute_diff(state.active_schedule, sched_after)
        
        state.pending_disruption = disruption
        state.disrupted_schedule = sched_after
        state.disruption_diff = diff
        
        # Save to exports/schedule_after.json
        os.makedirs(os.path.dirname(state.export_after_path), exist_ok=True)
        with open(state.export_after_path, "w", encoding="utf-8") as f:
            json.dump(sched_after, f, indent=2)
            
        elapsed = (datetime.now() - t0).total_seconds()
        state.log_event(user["name"], f"Computed disruption schedule ({diff['sessions_moved_count']} sessions moved) in {elapsed:.1f}s")
        
        # Save disruption proposal to Supabase
        database.save_disruption_to_supabase(
            disruption,
            diff=diff,
            dataset_id_str=state.active_data.get("dataset_id", "CIT_PUBLIC_V1"),
            status="pending"
        )

        return {
            "status": "success",
            "diff": diff,
            "disrupted_schedule": sched_after
        }
    except solver.InfeasibleScheduleError as e:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "Infeasible Disruption",
                "message": str(e),
                "conflicts": e.conflicts
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/disruption/approve")
def approve_disruption(user: Dict[str, Any] = Depends(require_role("admin"))):
    if not state.disrupted_schedule or not state.pending_disruption:
        raise HTTPException(status_code=400, detail="No pending disruption to approve")
        
    diff_approved = state.disruption_diff
    state.last_approved_diff = diff_approved
    state.active_data = validator.apply_disruption(state.active_data, state.pending_disruption)
    state.active_schedule = state.disrupted_schedule
    
    # Save approved disruption record to Supabase
    database.save_disruption_to_supabase(
        state.pending_disruption,
        diff=diff_approved,
        dataset_id_str=state.active_data.get("dataset_id", "CIT_PUBLIC_V1"),
        status="approved"
    )

    # Persist updated schedule to exports/schedule.json so exports reflect changes!
    os.makedirs(os.path.dirname(state.export_sched_path), exist_ok=True)
    with open(state.export_sched_path, "w", encoding="utf-8") as f:
        json.dump(state.active_schedule, f, indent=2)

    state.disrupted_schedule = None
    state.disruption_diff = None
    state.pending_disruption = None
    state.log_event(user["name"], f"Approved disruption changes ({diff_approved.get('sessions_moved_count', 0)} sessions moved) to active timetable")
    
    # Sync approved schedule to DB if connected
    database.sync_dataset_to_supabase(state.active_data)
    database.sync_schedule_to_supabase(
        state.active_schedule,
        dataset_id_str=state.active_data.get("dataset_id", "CIT_PUBLIC_V1"),
        status="active",
        source_kind="disruption"
    )
    
    return {"status": "success", "message": "Disruption approved and committed to active schedule"}

@app.post("/api/disruption/reject")
def reject_disruption(user: Dict[str, Any] = Depends(require_role("admin"))):
    if state.pending_disruption:
        database.save_disruption_to_supabase(
            state.pending_disruption,
            diff=state.disruption_diff,
            dataset_id_str=state.active_data.get("dataset_id", "CIT_PUBLIC_V1"),
            status="rejected"
        )
    state.disrupted_schedule = None
    state.disruption_diff = None
    state.pending_disruption = None
    state.log_event(user["name"], "Rejected pending disruption changes")
    return {"status": "success", "message": "Disruption rejected and discarded"}

@app.post("/api/admin/reset")
def reset_demo_data(user: Dict[str, Any] = Depends(require_role("admin"))):
    state.raw_data = validator.load(state.data_path)
    state.active_data = copy.deepcopy(state.raw_data)
    if os.path.exists(state.export_sched_path):
        state.active_schedule = validator.load(state.export_sched_path)
    else:
        state.active_schedule = None
    state.disrupted_schedule = None
    state.disruption_diff = None
    state.pending_disruption = None
    state.log_event(user["name"], "Reset demo data to initial state")

    # Sync reset state to Supabase
    database.sync_dataset_to_supabase(state.active_data)
    if state.active_schedule:
        database.sync_schedule_to_supabase(
            state.active_schedule,
            dataset_id_str=state.active_data.get("dataset_id", "CIT_PUBLIC_V1"),
            status="active"
        )

    return {"status": "success", "message": "Demo data reset successfully"}

@app.post("/api/admin/upload-dataset")
async def upload_dataset(file: UploadFile = File(...), user: Dict[str, Any] = Depends(require_role("admin"))):
    content = await file.read()
    try:
        data = json.loads(content.decode("utf-8"))
        for key in ["rooms", "faculty", "student_groups", "sessions", "calendar"]:
            if key not in data:
                raise ValueError(f"Missing required dataset section '{key}'")
        state.raw_data = data
        state.active_data = copy.deepcopy(data)
        state.active_schedule = None
        state.disrupted_schedule = None
        state.disruption_diff = None
        state.pending_disruption = None
        state.log_event(user["name"], f"Uploaded new dataset: {data.get('dataset_id', file.filename)}")
        return {"status": "success", "dataset_id": data.get("dataset_id")}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid dataset JSON: {e}")

@app.post("/api/admin/upload-disruption")
async def upload_disruption(file: UploadFile = File(...), user: Dict[str, Any] = Depends(require_role("admin"))):
    content = await file.read()
    try:
        disruption = json.loads(content.decode("utf-8"))
        if "changes" not in disruption:
            raise ValueError("Disruption JSON must contain 'changes' list")
        return apply_disruption(disruption, user=user)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid disruption JSON: {e}")

# -------------------------------------------------------------
# Booking Management with Strict No Self-Approval Guard
# -------------------------------------------------------------
@app.post("/api/bookings/submit")
def submit_booking(req: BookingSubmitRequest, user: Dict[str, Any] = Depends(get_current_user)):
    eff_cat = ai_service.enforce_role_cap(user["role"], req.requested_category or "club_event")
    
    recurrence = req.recurrence or ("recurring" if len(req.windows) > 1 else "once")
    if recurrence == "recurring":
        target_week = None
        week_scope = "normal"
    elif req.target_week == 7 or req.week_scope == "spectra":
        target_week = 7
        week_scope = "spectra"
    elif req.target_week is not None:
        target_week = req.target_week
        week_scope = "normal"
    else:
        target_week = 7 if (req.week_scope == "spectra" or req.week_scope is None) else None
        week_scope = req.week_scope or "spectra"

    new_id = f"BR-{len(state.active_data.get('booking_requests', [])) + 1:02d}"
    booking = {
        "id": new_id,
        "submitted_at": datetime.now().isoformat() + "+05:30",
        "requester": user["name"],
        "requester_email": user["email"],
        "role": user["role"],
        "department": user.get("department"),
        "requested_category": eff_cat,
        "title": req.title,
        "attendance": req.attendance,
        "duration_periods": req.duration_periods,
        "windows": req.windows,
        "room_types": req.room_types,
        "needs": req.needs,
        "requested_room": req.requested_room,
        "mandatory_for_groups": req.mandatory_for_groups or [],
        "series_id": None,
        "raw_text": req.raw_text or req.title,
        "recurrence": recurrence,
        "target_week": target_week,
        "week_scope": week_scope
    }
    
    state.active_data.setdefault("booking_requests", []).append(booking)
    state.log_event(user["name"], f"Submitted booking request {new_id} ({req.title})")
    
    # Auto re-solve fest_week bookings if active schedule exists
    if state.active_schedule:
        fest_res = solver.solve_bookings(state.active_data, state.active_schedule["sessions"])
        state.active_schedule["fest_week"] = fest_res
        
    # Store change in Supabase database
    database.save_booking_request_to_supabase(
        booking,
        state.active_data.get("dataset_id", "CIT_PUBLIC_V1")
    )
    
    return {"status": "success", "booking": booking}

@app.post("/api/bookings/decide")
def decide_booking(
    req: BookingDecideRequest,
    user: Dict[str, Any] = Depends(require_role("admin", "department_coordinator"))
):
    req_obj = next((b for b in state.active_data.get("booking_requests", []) if b["id"] == req.request_id), None)
    if not req_obj:
        raise HTTPException(status_code=404, detail="Booking request not found")
        
    # Enforce NO SELF-APPROVAL rule (requester != approver)
    if (
        req_obj.get("requester") == user["name"] or
        req_obj.get("requester_email") == user["email"] or
        req_obj.get("requester") == user["email"]
    ):
        raise HTTPException(
            status_code=403,
            detail="Conflict of Interest: Self-approval is strictly forbidden (requester != approver). Another coordinator or dean must review."
        )
        
    if not state.active_schedule:
        raise HTTPException(status_code=400, detail="No active schedule available")
        
    # Update or insert decision
    fest_bookings = state.active_schedule.setdefault("fest_week", {}).setdefault("bookings", [])
    existing = next((d for d in fest_bookings if d.get("request_id") == req.request_id), None)
    
    new_dec = {
        "request_id": req.request_id,
        "status": req.status,
        "reason": req.reason or f"Decided by {user['name']}"
    }
    if req.status in ("approved", "alternative_offered"):
        new_dec.update({
            "day": req.day,
            "start_period": req.start_period,
            "end_period": req.end_period,
            "room_id": req.room_id
        })
        
    if existing:
        existing.update(new_dec)
    else:
        fest_bookings.append(new_dec)
        
    state.log_event(user["name"], f"Decided booking {req.request_id}: {req.status}")

    # Store change in Supabase database
    database.save_booking_decision_to_supabase(
        new_dec,
        state.active_data.get("dataset_id", "CIT_PUBLIC_V1")
    )

    return {"status": "success", "decision": new_dec}

@app.post("/api/bookings/cancel")
def cancel_booking(request_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    req_obj = next((b for b in state.active_data.get("booking_requests", []) if b["id"] == request_id), None)
    if not req_obj:
        raise HTTPException(status_code=404, detail="Booking request not found")
        
    if (
        user["role"] != "admin" and
        req_obj.get("requester") != user["name"] and
        req_obj.get("requester_email") != user["email"]
    ):
        raise HTTPException(status_code=403, detail="You can only cancel your own booking requests")
        
    canc_record = {
        "request_id": request_id,
        "cancelled_at": datetime.now().isoformat() + "+05:30",
        "by": user["name"],
        "note": f"Cancelled by requester ({user['name']})"
    }
    state.active_data.setdefault("cancellations", []).append(canc_record)
    
    # Update fest_week decision to rejected
    if state.active_schedule and "fest_week" in state.active_schedule:
        for d in state.active_schedule["fest_week"].get("bookings", []):
            if d.get("request_id") == request_id:
                d["status"] = "rejected"
                d["reason"] = "Cancelled by requester"
                break
                
    state.log_event(user["name"], f"Cancelled booking request {request_id}")

    # Store change in Supabase database
    database.save_cancellation_to_supabase(
        canc_record,
        state.active_data.get("dataset_id", "CIT_PUBLIC_V1")
    )

    return {"status": "success", "message": f"Booking {request_id} cancelled"}
                
    state.log_event(user["name"], f"Cancelled booking request {request_id}")
    return {"status": "success", "message": f"Booking {request_id} cancelled"}

# -------------------------------------------------------------
# AI & Copilot Endpoints
# -------------------------------------------------------------
@app.post("/api/ai/parse-request")
async def parse_request(req: ParseAIRequest, user: Dict[str, Any] = Depends(get_current_user)):
    parsed = await ai_service.parse_request_ai(
        raw_text=req.text,
        role=user["role"],
        current_day=req.current_day or ai_service.current_local_day(),
        rooms_data=state.active_data.get("rooms", [])
    )
    return parsed

@app.post("/api/ai/faculty-change")
def faculty_change(req: FacultyChangeRequest, user: Dict[str, Any] = Depends(get_current_user)):
    session = next((s for s in state.active_data.get("sessions", []) if s["id"] == req.session_id), None)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    if user["role"] == "faculty" and user.get("faculty_id") != session["faculty_id"]:
        raise HTTPException(status_code=403, detail="You can only request changes for your own sessions")
        
    # Check if target slot has clashes
    ctx = validator.Ctx(state.active_data)
    assign, _ = validator.to_assign(state.active_schedule or {"sessions": []})
    
    day = req.preferred_day
    start = req.preferred_start_period
    dur = session["duration"]
    fid = session["faculty_id"]
    active_periods = list(range(start, start + dur))
    
    conflicts = []
    # 1. Faculty unavailability
    if any((day, ap) in ctx.fac_un[fid] for ap in active_periods):
        conflicts.append(f"Faculty {fid} is marked unavailable on {day} in periods {active_periods}")
        
    # 2. Lunch constraint
    if active_periods[0] <= ctx.lunch < active_periods[-1]:
        conflicts.append(f"Session with duration {dur} cannot cross lunch (P{ctx.lunch}-P{ctx.lunch+1})")
        
    # 3. Double-booking with faculty's other sessions
    for sid, (d, s, r) in assign.items():
        if sid != req.session_id:
            s_obj = ctx.sessions.get(sid)
            if s_obj and s_obj["faculty_id"] == fid and d == day:
                s_pers = list(range(s, s + s_obj["duration"]))
                overlap = set(active_periods) & set(s_pers)
                if overlap:
                    conflicts.append(f"Faculty clash with {sid} ({s_obj['course_id']}) in period(s) {sorted(overlap)}")
                    
    # 4. Double-booking with student groups
    for gid in session["groups"]:
        for sid, (d, s, r) in assign.items():
            if sid != req.session_id:
                s_obj = ctx.sessions.get(sid)
                if s_obj and gid in s_obj["groups"] and d == day:
                    s_pers = list(range(s, s + s_obj["duration"]))
                    overlap = set(active_periods) & set(s_pers)
                    if overlap:
                        conflicts.append(f"Group {gid} clash with {sid} in period(s) {sorted(overlap)}")
                        
    # Find valid available rooms at target slot
    available_rooms = []
    cand_rooms = [
        r for r in state.active_data["rooms"]
        if r["capacity"] >= session["size"]
        and r["type"] in session["room_types"]
        and (not session.get("needs_accessible") or r["accessible"])
    ]
    for r in cand_rooms:
        rid = r["id"]
        if not any((day, ap) in ctx.room_un[rid] for ap in active_periods):
            # Check room busy
            busy = False
            for sid, (d, s, r_cur) in assign.items():
                if sid != req.session_id and r_cur == rid and d == day:
                    s_obj = ctx.sessions.get(sid)
                    if s_obj and (set(active_periods) & set(range(s, s + s_obj["duration"]))):
                        busy = True
                        break
            if not busy:
                available_rooms.append(rid)
                
    if conflicts:
        feasible = False
        message = f"Requested slot ({day} P{start}) is not feasible: " + "; ".join(conflicts)
    elif not available_rooms:
        feasible = False
        message = f"No eligible rooms ({session['room_types']}, capacity >= {session['size']}) free at {day} P{start}."
    else:
        feasible = True
        message = f"Slot feasible! Available rooms: {', '.join(available_rooms[:4])}."
        
    return {
        "feasible": feasible,
        "conflicts": conflicts,
        "available_rooms": available_rooms,
        "message": message,
        "proposed_slot": {"day": day, "start_period": start, "room_id": available_rooms[0] if available_rooms else None}
    }

@app.post("/api/schedule/move-session")
def move_session(req: SessionMoveRequest, user: Dict[str, Any] = Depends(get_current_user)):
    if not state.active_schedule:
        raise HTTPException(status_code=400, detail="No active schedule available")
        
    session_item = next((s for s in state.active_schedule.get("sessions", []) if s["session_id"] == req.session_id), None)
    if not session_item:
        raise HTTPException(status_code=404, detail="Session not found in active schedule")
        
    meta = next((s for s in state.active_data.get("sessions", []) if s["id"] == req.session_id), None)
    if not meta:
        raise HTTPException(status_code=404, detail="Session metadata not found")
        
    if user["role"] == "faculty" and user.get("faculty_id") != meta.get("faculty_id"):
        raise HTTPException(status_code=403, detail="You can only reschedule your own sessions")
        
    old_day = session_item["day"]
    old_start = session_item["start_period"]
    old_room = session_item["room_id"]
    
    # Enforce all hard constraints (H1-H14) before committing manual move
    test_assign = {s["session_id"]: (s["day"], s["start_period"], s["room_id"]) for s in state.active_schedule.get("sessions", [])}
    test_assign[req.session_id] = (req.day, req.start_period, req.room_id)
    ctx = validator.Ctx(state.active_data)
    violations, _ = validator.check_timetable(ctx, test_assign, "regular")
    if violations:
        violation_messages = [f"[{v.get('rule', 'HARD')}] {v.get('detail', 'Constraint violation')}" for v in violations]
        raise HTTPException(
            status_code=400,
            detail=f"Cannot move session: Violates hard constraint(s): {'; '.join(violation_messages[:3])}"
        )

    session_item["day"] = req.day
    session_item["start_period"] = req.start_period
    session_item["room_id"] = req.room_id
    
    # Track as an approved change in last_approved_diff
    diff_item = {
        "session_id": req.session_id,
        "before": {"day": old_day, "start_period": old_start, "room_id": old_room},
        "after": {"day": req.day, "start_period": req.start_period, "room_id": req.room_id},
        "type": "time_and_room" if old_room != req.room_id and (old_day != req.day or old_start != req.start_period) else ("room_only" if old_room != req.room_id else "time_only")
    }
    if not state.last_approved_diff:
        state.last_approved_diff = {
            "sessions_moved_count": 1,
            "time_changed_count": 1 if old_day != req.day or old_start != req.start_period else 0,
            "room_only_count": 1 if old_room != req.room_id and old_day == req.day and old_start == req.start_period else 0,
            "changes": [diff_item]
        }
    else:
        existing = next((c for c in state.last_approved_diff.get("changes", []) if c["session_id"] == req.session_id), None)
        if existing:
            existing.update(diff_item)
        else:
            state.last_approved_diff.setdefault("changes", []).append(diff_item)
            state.last_approved_diff["sessions_moved_count"] = len(state.last_approved_diff["changes"])

    # Persist updated schedule to exports/schedule.json
    os.makedirs(os.path.dirname(state.export_sched_path), exist_ok=True)
    with open(state.export_sched_path, "w", encoding="utf-8") as f:
        json.dump(state.active_schedule, f, indent=2)
        
    state.log_event(user["name"], f"Approved rescheduling of session {req.session_id} from {old_day} P{old_start} ({old_room}) to {req.day} P{req.start_period} ({req.room_id})")
    
    database.sync_schedule_to_supabase(
        state.active_schedule,
        dataset_id_str=state.active_data.get("dataset_id", "CIT_PUBLIC_V1"),
        status="active"
    )
    return {"status": "success", "session": session_item, "change": diff_item}

@app.post("/api/ai/explain")
def explain_decision_endpoint(decision: Dict[str, Any], request: Dict[str, Any]):
    rooms_dict = {r["id"]: r for r in state.active_data.get("rooms", [])}
    explanation = ai_service.explain_decision(decision, request, rooms_dict)
    return {"explanation": explanation}

# -------------------------------------------------------------
# Export Downloads
# -------------------------------------------------------------
@app.get("/api/export/schedule")
def download_schedule():
    if not os.path.exists(state.export_sched_path):
        raise HTTPException(status_code=404, detail="schedule.json not generated yet")
    return FileResponse(state.export_sched_path, media_type="application/json", filename="schedule.json")

@app.get("/api/export/schedule-after")
def download_schedule_after():
    if not os.path.exists(state.export_after_path):
        raise HTTPException(status_code=404, detail="schedule_after.json not generated yet")
    return FileResponse(state.export_after_path, media_type="application/json", filename="schedule_after.json")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
