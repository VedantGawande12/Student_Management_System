import copy
import json
import os
import sys
from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends
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
# Demo Accounts (Section 3 of Plan.md)
# -------------------------------------------------------------
DEMO_ACCOUNTS = {
    "admin@cit.edu.in": {
        "email": "admin@cit.edu.in",
        "name": "Prof. Shreya Kapoor (Dean's Office)",
        "role": "admin",
        "department": "ADMIN",
        "faculty_id": "F37",
        "badge": "Dean / Admin"
    },
    "coord.cse@cit.edu.in": {
        "email": "coord.cse@cit.edu.in",
        "name": "Dr. Rajesh Verma (Coordinator CSE)",
        "role": "department_coordinator",
        "department": "CSE",
        "faculty_id": "F01",
        "badge": "Dept Coordinator (CSE)"
    },
    "f12@cit.edu.in": {
        "email": "f12@cit.edu.in",
        "name": "Dr. Amit Behera",
        "role": "faculty",
        "department": "CSE",
        "faculty_id": "F12",
        "badge": "Faculty (F12)"
    },
    "dramatics@cit.edu.in": {
        "email": "dramatics@cit.edu.in",
        "name": "Dramatics Society",
        "role": "club",
        "department": None,
        "faculty_id": None,
        "badge": "Club Rep (Dramatics)"
    }
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
        self.current_user = DEMO_ACCOUNTS["admin@cit.edu.in"]
        self.audit_logs = []
        self.log_event("SYSTEM", "Initialized server state")

    def log_event(self, actor: str, action: str, details: Optional[Dict[str, Any]] = None):
        self.audit_logs.insert(0, {
            "timestamp": datetime.now().isoformat(),
            "actor": actor,
            "action": action,
            "details": details or {}
        })

state = State()

# -------------------------------------------------------------
# Pydantic Request Models
# -------------------------------------------------------------
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

# -------------------------------------------------------------
# Endpoints
# -------------------------------------------------------------

@app.get("/api/health")
def health():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}

@app.get("/api/auth/me")
def get_current_user():
    return state.current_user

@app.get("/api/auth/accounts")
def get_demo_accounts():
    return list(DEMO_ACCOUNTS.values())

@app.post("/api/auth/switch")
def switch_user(req: SwitchUserRequest):
    if req.email not in DEMO_ACCOUNTS:
        raise HTTPException(status_code=404, detail="Demo account not found")
    state.current_user = DEMO_ACCOUNTS[req.email]
    state.log_event(state.current_user["name"], f"Switched role to {state.current_user['role']}")
    return state.current_user

@app.get("/api/state")
def get_state():
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
        "booking_requests": state.active_data.get("booking_requests", []),
        "cancellations": state.active_data.get("cancellations", []),
        "active_schedule": state.active_schedule,
        "disrupted_schedule": state.disrupted_schedule,
        "disruption_diff": state.disruption_diff,
        "pending_disruption": state.pending_disruption,
        "validator_report": val_report,
        "disruption_validator_report": disruption_val_report,
        "current_user": state.current_user,
        "audit_logs": state.audit_logs[:50]
    }

@app.post("/api/schedule/generate")
def generate_schedule():
    if state.current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only Admin can trigger schedule generation")
    try:
        t0 = datetime.now()
        sched = solver.solve_all(state.active_data, baseline=None, timeout_sec=25)
        state.active_schedule = sched
        
        # Save to exports/schedule.json
        os.makedirs(os.path.dirname(state.export_sched_path), exist_ok=True)
        with open(state.export_sched_path, "w", encoding="utf-8") as f:
            json.dump(sched, f, indent=2)
            
        elapsed = (datetime.now() - t0).total_seconds()
        state.log_event(state.current_user["name"], f"Generated baseline timetable in {elapsed:.1f}s")
        return {"status": "success", "schedule": sched}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/disruption/apply")
def apply_disruption(disruption: Optional[Dict[str, Any]] = None):
    if state.current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only Admin can apply disruption files")
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
        state.log_event(state.current_user["name"], f"Computed disruption schedule ({diff['sessions_moved_count']} sessions moved) in {elapsed:.1f}s")
        return {
            "status": "success",
            "diff": diff,
            "disrupted_schedule": sched_after
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/disruption/approve")
def approve_disruption():
    if state.current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only Admin can approve disruption diff")
    if not state.disrupted_schedule or not state.pending_disruption:
        raise HTTPException(status_code=400, detail="No pending disruption to approve")
        
    state.active_data = validator.apply_disruption(state.active_data, state.pending_disruption)
    state.active_schedule = state.disrupted_schedule
    state.disrupted_schedule = None
    state.disruption_diff = None
    state.pending_disruption = None
    state.log_event(state.current_user["name"], "Approved disruption changes to active timetable")
    return {"status": "success", "message": "Disruption approved and committed to active schedule"}

@app.post("/api/disruption/reject")
def reject_disruption():
    if state.current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only Admin can reject disruption diff")
    state.disrupted_schedule = None
    state.disruption_diff = None
    state.pending_disruption = None
    state.log_event(state.current_user["name"], "Rejected pending disruption changes")
    return {"status": "success", "message": "Disruption rejected and discarded"}

@app.post("/api/admin/reset")
def reset_demo_data():
    if state.current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only Admin can reset demo data")
    state.raw_data = validator.load(state.data_path)
    state.active_data = copy.deepcopy(state.raw_data)
    if os.path.exists(state.export_sched_path):
        state.active_schedule = validator.load(state.export_sched_path)
    else:
        state.active_schedule = None
    state.disrupted_schedule = None
    state.disruption_diff = None
    state.pending_disruption = None
    state.log_event(state.current_user["name"], "Reset demo data to initial state")
    return {"status": "success", "message": "Demo data reset successfully"}

@app.post("/api/admin/upload-dataset")
async def upload_dataset(file: UploadFile = File(...)):
    if state.current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only Admin can upload new dataset")
    content = await file.read()
    try:
        data = json.loads(content.decode("utf-8"))
        # Basic validation
        for key in ["rooms", "faculty", "student_groups", "sessions", "calendar"]:
            if key not in data:
                raise ValueError(f"Missing required dataset section '{key}'")
        state.raw_data = data
        state.active_data = copy.deepcopy(data)
        state.active_schedule = None
        state.disrupted_schedule = None
        state.disruption_diff = None
        state.pending_disruption = None
        state.log_event(state.current_user["name"], f"Uploaded new dataset: {data.get('dataset_id', file.filename)}")
        return {"status": "success", "dataset_id": data.get("dataset_id")}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid dataset JSON: {e}")

@app.post("/api/admin/upload-disruption")
async def upload_disruption(file: UploadFile = File(...)):
    if state.current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only Admin can upload disruption")
    content = await file.read()
    try:
        disruption = json.loads(content.decode("utf-8"))
        if "changes" not in disruption:
            raise ValueError("Disruption JSON must contain 'changes' list")
        return apply_disruption(disruption)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid disruption JSON: {e}")

# -------------------------------------------------------------
# Booking Management with No Self-Approval Guard
# -------------------------------------------------------------
@app.post("/api/bookings/submit")
def submit_booking(req: BookingSubmitRequest):
    user = state.current_user
    eff_cat = ai_service.enforce_role_cap(user["role"], req.requested_category or "club_event")
    
    new_id = f"BR-{len(state.active_data.get('booking_requests', [])) + 1:02d}"
    booking = {
        "id": new_id,
        "submitted_at": datetime.now().isoformat() + "+05:30",
        "requester": user["name"],
        "role": user["role"],
        "department": user.get("department"),
        "requested_category": req.requested_category or "club_event",
        "title": req.title,
        "attendance": req.attendance,
        "duration_periods": req.duration_periods,
        "windows": req.windows,
        "room_types": req.room_types,
        "needs": req.needs,
        "requested_room": req.requested_room,
        "mandatory_for_groups": req.mandatory_for_groups or [],
        "series_id": None,
        "raw_text": req.raw_text or req.title
    }
    
    state.active_data.setdefault("booking_requests", []).append(booking)
    state.log_event(user["name"], f"Submitted booking request {new_id} ({req.title})")
    
    # Auto re-solve fest_week bookings if active schedule exists
    if state.active_schedule:
        fest_res = solver.solve_bookings(state.active_data, state.active_schedule["sessions"])
        state.active_schedule["fest_week"] = fest_res
        
    return {"status": "success", "booking": booking}

@app.post("/api/bookings/decide")
def decide_booking(req: BookingDecideRequest):
    user = state.current_user
    req_obj = next((b for b in state.active_data.get("booking_requests", []) if b["id"] == req.request_id), None)
    if not req_obj:
        raise HTTPException(status_code=404, detail="Booking request not found")
        
    # Enforce NO SELF-APPROVAL rule (requester != approver)
    if req_obj.get("requester") == user["name"] or req_obj.get("requester") == user["email"]:
        raise HTTPException(
            status_code=403,
            detail="Conflict of Interest: Self-approval is strictly forbidden (requester != approver)."
        )
        
    # Permission check
    if user["role"] not in ("admin", "department_coordinator"):
        raise HTTPException(status_code=403, detail="Only Admins or Department Coordinators can decide bookings")
        
    if not state.active_schedule:
        raise HTTPException(status_code=400, detail="No active schedule available")
        
    # Update or insert decision
    fest_bookings = state.active_schedule.setdefault("fest_week", {}).setdefault("bookings", [])
    existing = next((d for d in fest_bookings if d.get("request_id") == req.request_id), None)
    
    new_dec = {
        "request_id": req.request_id,
        "status": req.status,
        "reason": req.reason or f"Manually updated by {user['name']}"
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
    return {"status": "success", "decision": new_dec}

@app.post("/api/bookings/cancel")
def cancel_booking(request_id: str):
    user = state.current_user
    req_obj = next((b for b in state.active_data.get("booking_requests", []) if b["id"] == request_id), None)
    if not req_obj:
        raise HTTPException(status_code=404, detail="Booking request not found")
        
    if user["role"] != "admin" and req_obj.get("requester") != user["name"]:
        raise HTTPException(status_code=403, detail="You can only cancel your own booking requests")
        
    state.active_data.setdefault("cancellations", []).append({
        "request_id": request_id,
        "cancelled_at": datetime.now().isoformat() + "+05:30",
        "by": user["name"],
        "note": f"Cancelled by requester ({user['name']})"
    })
    
    # Update fest_week decision to rejected
    if state.active_schedule and "fest_week" in state.active_schedule:
        for d in state.active_schedule["fest_week"].get("bookings", []):
            if d.get("request_id") == request_id:
                d["status"] = "rejected"
                d["reason"] = "Cancelled by requester"
                break
                
    state.log_event(user["name"], f"Cancelled booking request {request_id}")
    return {"status": "success", "message": f"Booking {request_id} cancelled"}

# -------------------------------------------------------------
# AI & Copilot Endpoints
# -------------------------------------------------------------
@app.post("/api/ai/parse-request")
async def parse_request(req: ParseAIRequest):
    user = state.current_user
    parsed = await ai_service.parse_request_ai(
        raw_text=req.text,
        role=user["role"],
        current_day=req.current_day or ai_service.current_local_day(),
        rooms_data=state.active_data.get("rooms", [])
    )
    return parsed

@app.post("/api/ai/faculty-change")
def faculty_change(req: FacultyChangeRequest):
    """
    Evaluates faculty schedule change request deterministically using CP-SAT.
    Finds clash-free alternative slots or explains exact constraint conflicts.
    """
    user = state.current_user
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
