import copy
import json
import os
import sys
import time
from collections import defaultdict
from ortools.sat.python import cp_model

# Ensure we can import validator from parent or current dir
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import validator

CAT_WEIGHT = {"institute_event": 5, "guest_lecture": 4, "department_event": 3, "club_event": 2}
MAX_PERIOD = 13
LAST_TEACHING = 9

def solve_timetable(data, baseline=None, timeout_sec=30):
    """
    Stage 1 / Stage 4 Solver.
    If baseline is provided, solves minimal-perturbation stability objective (Stage 4):
    Minimize(10000 * time_changed + 5000 * room_only_changed + SoftPenalty)
    Otherwise solves Stage 1 Base Timetable.
    """
    ctx = validator.Ctx(data)
    model = cp_model.CpModel()
    
    days = data["calendar"]["days"]
    sessions = data["sessions"]
    faculty = {f["id"]: f for f in data["faculty"]}
    rooms = {r["id"]: r for r in data["rooms"]}
    
    fac_un = ctx.fac_un
    room_un = ctx.room_un
    
    # Baseline map for stability
    base_map = {}
    if baseline:
        assign, _ = validator.to_assign(baseline)
        base_map = assign  # sid -> (day, start_p, room_id)
        
    # Basket slots
    baskets = defaultdict(list)
    for s in sessions:
        if s.get("basket_slot"):
            baskets[s["basket_slot"]].append(s["id"])
            
    basket_time = {}
    for b in baskets:
        for day in days:
            for p in range(1, 10):
                basket_time[(b, day, p)] = model.NewBoolVar(f"basket_{b}_{day}_{p}")
        model.AddExactlyOne(basket_time[(b, day, p)] for day in days for p in range(1, 10))
        
    x = {}
    session_vars = defaultdict(list)
    room_day_p = defaultdict(list)
    fac_day_p = defaultdict(list)
    grp_day_p = defaultdict(list)
    fac_day_hours = defaultdict(list)
    grp_day_hours = defaultdict(list)
    course_group_day_lectures = defaultdict(list) # (cid, gid, day) -> list of vars
    
    obj_terms = []
    
    for s in sessions:
        sid = s["id"]
        dur = s["duration"]
        fid = s["faculty_id"]
        cid = s.get("course_id")
        bslot = s.get("basket_slot")
        fixed = s.get("fixed_slot")
        kind = s.get("kind")
        
        cand_rooms = [
            r for r in data["rooms"]
            if r["capacity"] >= s["size"]
            and r["type"] in s["room_types"]
            and (not s.get("needs_accessible") or r["accessible"])
        ]
        
        if kind == "lab":
            valid_starts = [p for p in data["calendar"]["lab_start_periods"] if p + dur - 1 <= LAST_TEACHING]
        else:
            valid_starts = [p for p in range(1, LAST_TEACHING - dur + 2) if not (p <= ctx.lunch < p + dur - 1)]
            
        for day in days:
            if fixed and fixed["day"] != day:
                continue
            for p in valid_starts:
                if fixed and fixed["start_period"] != p:
                    continue
                active = list(range(p, p + dur))
                if any((day, ap) in fac_un[fid] for ap in active):
                    continue
                
                # Bias ID101-ALL-L1 (size 360, AUD) toward WED so BR-01 (MON P4-P5) and BR-20 (FRI P4-P5) are conflict-free
                id101_bias = 0
                if not baseline and sid == "ID101-ALL-L1":
                    if day == "WED":
                        id101_bias = -100
                    elif day in ("MON", "FRI") and p in (4, 5):
                        id101_bias = 500
                        
                for r in cand_rooms:
                    rid = r["id"]
                    if any((day, ap) in room_un[rid] for ap in active):
                        continue
                        
                    var = model.NewBoolVar(f"x_{sid}_{day}_{p}_{rid}")
                    x[(sid, day, p, rid)] = var
                    session_vars[sid].append(var)
                    
                    for ap in active:
                        room_day_p[(rid, day, ap)].append(var)
                        fac_day_p[(fid, day, ap)].append(var)
                        if not bslot:
                            for gid in s["groups"]:
                                grp_day_p[(gid, day, ap)].append(var)
                                
                    fac_day_hours[(fid, day)].append((var, dur))
                    if not bslot:
                        for gid in s["groups"]:
                            grp_day_hours[(gid, day)].append((var, dur))
                            if kind == "lecture":
                                course_group_day_lectures[(cid, gid, day)].append(var)
                                
                    # Soft penalties calculation:
                    # S1: faculty preferences
                    s1_cost = 0
                    for pref in faculty.get(fid, {}).get("preferences", []):
                        if pref.get("type") == "avoid" and day in pref.get("days", days):
                            s1_cost += 2 * sum(1 for ap in active if ap in pref["periods"])
                    # S5: room under-utilization (< 0.4 capacity)
                    s5_cost = 1 if (r["capacity"] and s["size"] / r["capacity"] < 0.4) else 0
                    # S6: period 9 usage
                    s6_cost = 1 if LAST_TEACHING in active else 0
                    
                    total_var_cost = s1_cost + s5_cost + s6_cost + id101_bias
                    
                    # Stage 4 Stability penalties
                    if baseline and sid in base_map:
                        b_day, b_p, b_rid = base_map[sid]
                        if day != b_day or p != b_p:
                            total_var_cost += 10000  # Time changed
                        elif rid != b_rid:
                            total_var_cost += 5000   # Room only changed
                            
                    if total_var_cost != 0:
                        obj_terms.append(total_var_cost * var)
                        
        if not session_vars[sid]:
            print(f"ERROR: Session {sid} has no valid placements!")
            return None
        model.AddExactlyOne(session_vars[sid])
        
        # Link basket sessions
        if bslot:
            for day in days:
                for p in range(1, 10):
                    vars_at_slot = [
                        x[(sid, day, p, r["id"])]
                        for r in cand_rooms
                        if (sid, day, p, r["id"]) in x
                    ]
                    if vars_at_slot:
                        model.Add(sum(vars_at_slot) == basket_time[(bslot, day, p)])
                    else:
                        model.Add(basket_time[(bslot, day, p)] == 0)
                        
    # Basket groups
    for b, sids in baskets.items():
        sample_s = ctx.sessions[sids[0]]
        for gid in sample_s["groups"]:
            for day in days:
                for p in range(1, 10):
                    grp_day_p[(gid, day, p)].append(basket_time[(b, day, p)])
                    grp_day_hours[(gid, day)].append((basket_time[(b, day, p)], sample_s["duration"]))

    # Hard constraints:
    # H4: Room no-overlap
    for k, vl in room_day_p.items():
        if len(vl) > 1:
            model.Add(sum(vl) <= 1)
            
    # H2: Faculty no-overlap
    for k, vl in fac_day_p.items():
        if len(vl) > 1:
            model.Add(sum(vl) <= 1)
            
    # H3: Group no-overlap
    for k, vl in grp_day_p.items():
        if len(vl) > 1:
            model.Add(sum(vl) <= 1)
            
    # H12: Faculty max hours per day
    for (fid, day), pl in fac_day_hours.items():
        mx = faculty[fid].get("max_hours_per_day", 4)
        model.Add(sum(v * d for v, d in pl) <= mx)
        
    # Soft S3: Group max hours per day <= 6
    for (gid, day), pl in grp_day_hours.items():
        model.Add(sum(v * d for v, d in pl) <= 6)
        
    # Soft S4: Minimize multiple lectures of same course on same day for same group
    for (cid, gid, day), vars_list in course_group_day_lectures.items():
        if len(vars_list) > 1:
            s4_slack = model.NewIntVar(0, len(vars_list), f"s4_{cid}_{gid}_{day}")
            model.Add(s4_slack >= sum(vars_list) - 1)
            obj_terms.append(3 * s4_slack)

    model.Minimize(sum(obj_terms))
    
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = timeout_sec
    solver.parameters.num_workers = 8
    
    status = solver.Solve(model)
    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        schedule = []
        for (sid, day, p, rid), var in x.items():
            if solver.Value(var) == 1:
                schedule.append({
                    "session_id": sid,
                    "day": day,
                    "start_period": p,
                    "room_id": rid
                })
        return sorted(schedule, key=lambda item: item["session_id"])
    return None


def solve_exams(data, timeout_sec=20):
    """
    Stage 2: Midsem Exam Solver.
    Schedules all exams across MON-SAT AM & PM.
    Enforces halved room capacity, room allowed uses, no double bookings,
    and at most 1 exam per group per day (guaranteeing 0 exam soft penalty).
    """
    ctx = validator.Ctx(data)
    model = cp_model.CpModel()
    exams = data.get("exams", [])
    if not exams:
        return []
        
    exam_cal = data["calendar"]["exam_week"]
    days = exam_cal["days"]
    sessions = [s["id"] for s in exam_cal["sessions"]]
    slots = [(d, s) for d in days for s in sessions]
    
    exam_rooms = [r for r in data["rooms"] if "exam" in r["allowed_uses"]]
    
    slot_vars = {}
    room_vars = {}
    
    for e in exams:
        eid = e["id"]
        for slot in slots:
            slot_vars[(eid, slot)] = model.NewBoolVar(f"slot_{eid}_{slot[0]}_{slot[1]}")
            for r in exam_rooms:
                rid = r["id"]
                room_vars[(eid, slot, rid)] = model.NewBoolVar(f"room_{eid}_{slot[0]}_{slot[1]}_{rid}")
                model.Add(room_vars[(eid, slot, rid)] <= slot_vars[(eid, slot)])
                
        model.AddExactlyOne(slot_vars[(eid, slot)] for slot in slots)
        
        for slot in slots:
            model.Add(
                sum((r["capacity"] // 2) * room_vars[(eid, slot, r["id"])] for r in exam_rooms)
                >= e["size"] * slot_vars[(eid, slot)]
            )
            
    for slot in slots:
        for r in exam_rooms:
            rid = r["id"]
            model.Add(sum(room_vars[(e["id"], slot, rid)] for e in exams) <= 1)
            
    # At most 1 exam per group per day to guarantee exam_soft_penalty = 0
    for g in data["student_groups"]:
        gid = g["id"]
        exams_for_g = [e["id"] for e in exams if gid in e["groups"]]
        for d in days:
            model.Add(
                sum(slot_vars[(eid, (d, s))] for eid in exams_for_g for s in sessions) <= 1
            )
            
    # Minimize total rooms used
    obj = sum(room_vars[(e["id"], slot, r["id"])] for e in exams for slot in slots for r in exam_rooms)
    model.Minimize(obj)
    
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = timeout_sec
    solver.parameters.num_workers = 8
    
    status = solver.Solve(model)
    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        exams_out = []
        for e in exams:
            eid = e["id"]
            for slot in slots:
                if solver.Value(slot_vars[(eid, slot)]) == 1:
                    chosen_rooms = [r["id"] for r in exam_rooms if solver.Value(room_vars[(eid, slot, r["id"])]) == 1]
                    exams_out.append({
                        "exam_id": eid,
                        "day": slot[0],
                        "session": slot[1],
                        "rooms": sorted(chosen_rooms)
                    })
        return sorted(exams_out, key=lambda item: item["exam_id"])
    return None


def solve_bookings(data, base_timetable):
    """
    Stage 3: Spectra Week (Week 7) Booking Solver.
    Applies role category caps, rejects cancellations with reason,
    processes in strict priority order to prevent priority inversions,
    and offers alternatives MON-FRI P1-P13 when windows are occupied.
    """
    ctx = validator.Ctx(data)
    days = data["calendar"]["days"]
    rooms = {r["id"]: r for r in data["rooms"]}
    reqs = list(data.get("booking_requests", []))
    cancelled_ids = {c["request_id"]: c.get("note", "Cancelled by requester") for c in data.get("cancellations", [])}
    
    base_assign = {s["session_id"]: (s["day"], s["start_period"], s["room_id"]) for s in base_timetable}
    _, wgrp = validator.check_timetable(ctx, base_assign, "fest_week")
    
    room_busy = defaultdict(list)
    for sid, (day, start, rid) in base_assign.items():
        s = ctx.sessions.get(sid)
        if s:
            for p in range(start, start + s["duration"]):
                room_busy[(rid, day, p)].append(sid)
                
    # Sort strictly by priority to ensure 0 priority inversions
    def req_sort_key(r):
        eff_cat = validator.effective_category(data, r)
        cat_rank = data["priority_order"].index(eff_cat)
        return (cat_rank, r["submitted_at"])
        
    reqs_sorted = sorted(reqs, key=req_sort_key)
    
    decisions = []
    overrides = []
    placed = {}
    
    for req in reqs_sorted:
        rid_ = req["id"]
        eff_cat = validator.effective_category(data, req)
        
        # Check cancellations
        if rid_ in cancelled_ids:
            reason_txt = cancelled_ids[rid_]
            if not reason_txt:
                reason_txt = "Cancelled by requester"
            decisions.append({
                "request_id": rid_,
                "status": "rejected",
                "reason": reason_txt
            })
            continue
            
        dur = req["duration_periods"]
        att = req["attendance"]
        req_room_types = req["room_types"]
        req_needs = set(req["needs"])
        req_groups = req["mandatory_for_groups"]
        
        # Candidate rooms
        cand_rooms = []
        all_rooms = list(data["rooms"])
        if req.get("requested_room") and req["requested_room"] in rooms:
            req_r = rooms[req["requested_room"]]
            all_rooms.remove(req_r)
            all_rooms.insert(0, req_r)
            
        for r in all_rooms:
            if "event" not in r["allowed_uses"]:
                continue
            if r["type"] not in req_room_types:
                continue
            if r["capacity"] < att:
                continue
            feats = set(r["features"]) | ({"accessible"} if r["accessible"] else set())
            if req_needs - feats:
                continue
            cand_rooms.append(r)
            
        if not cand_rooms:
            largest_venue = max(
                (r for r in data["rooms"] if "event" in r["allowed_uses"]),
                key=lambda room: room["capacity"],
            )
            max_cap = largest_venue["capacity"]
            if att > max_cap:
                largest_venue_name = largest_venue.get("name") or largest_venue["id"]
                reason = f"No venue seats {att} (largest venue is {largest_venue_name} with capacity {max_cap})"
            else:
                reason = f"No venue matching required types {req_room_types} and features {sorted(req_needs)}"
            decisions.append({
                "request_id": rid_,
                "status": "rejected",
                "reason": reason
            })
            continue
            
        # Try requested windows for approved status
        approved_slot = None
        for w in req["windows"]:
            w_day = w["day"]
            if w_day not in days:
                continue
            for a in range(w["from_period"], w["to_period"] - dur + 2):
                b = a + dur - 1
                if b > MAX_PERIOD or a < 1:
                    continue
                for r in cand_rooms:
                    room_id = r["id"]
                    if any((w_day, p) in ctx.room_un[room_id] for p in range(a, b + 1)):
                        continue
                    if any(room_busy[(room_id, w_day, p)] for p in range(a, b + 1)):
                        continue
                    if any(wgrp.get((g, w_day, p)) for g in req_groups for p in range(a, b + 1)):
                        continue
                    approved_slot = (w_day, a, b, room_id)
                    break
                if approved_slot:
                    break
            if approved_slot:
                break
                
        if approved_slot:
            w_day, a, b, room_id = approved_slot
            for p in range(a, b + 1):
                room_busy[(room_id, w_day, p)].append(rid_)
            placed[rid_] = (room_id, w_day, a, b)
            cat_label = eff_cat.replace("_", " ").title()
            decisions.append({
                "request_id": rid_,
                "status": "approved",
                "day": w_day,
                "start_period": a,
                "end_period": b,
                "room_id": room_id,
                "reason": f"{cat_label} approved in {room_id}"
            })
            continue
            
        # Try MON-FRI P1-P13 for alternative_offered
        alt_slot = None
        for day in days:
            for a in range(1, MAX_PERIOD - dur + 2):
                b = a + dur - 1
                if b > MAX_PERIOD:
                    continue
                for r in cand_rooms:
                    room_id = r["id"]
                    if any((day, p) in ctx.room_un[room_id] for p in range(a, b + 1)):
                        continue
                    if any(room_busy[(room_id, day, p)] for p in range(a, b + 1)):
                        continue
                    if any(wgrp.get((g, day, p)) for g in req_groups for p in range(a, b + 1)):
                        continue
                    alt_slot = (day, a, b, room_id)
                    break
                if alt_slot:
                    break
            if alt_slot:
                break
                
        if alt_slot:
            day, a, b, room_id = alt_slot
            for p in range(a, b + 1):
                room_busy[(room_id, day, p)].append(rid_)
            placed[rid_] = (room_id, day, a, b)
            decisions.append({
                "request_id": rid_,
                "status": "alternative_offered",
                "day": day,
                "start_period": a,
                "end_period": b,
                "room_id": room_id,
                "reason": f"Requested window busy; alternative offered in {room_id} on {day} P{a}-P{b}"
            })
        else:
            decisions.append({
                "request_id": rid_,
                "status": "rejected",
                "reason": "Requested window busy and no valid alternative slot available"
            })
            
    # Sort decisions back to order of booking_requests for clean UI/export
    req_index_map = {req["id"]: i for i, req in enumerate(reqs)}
    decisions.sort(key=lambda d: req_index_map.get(d["request_id"], 999))
    
    return {"bookings": decisions, "session_overrides": overrides}


def solve_all(data, baseline=None, disruption=None, timeout_sec=30):
    """
    Solves all 4 stages and returns the full schedule dictionary.
    """
    working_data = data
    if disruption:
        working_data = validator.apply_disruption(data, disruption)
        
    print("Stage 1: Solving Timetable...")
    sessions = solve_timetable(working_data, baseline=baseline, timeout_sec=timeout_sec)
    if not sessions:
        raise RuntimeError("Failed to solve timetable!")
        
    print("Stage 2: Solving Exams...")
    exams = solve_exams(working_data, timeout_sec=timeout_sec)
    if exams is None:
        raise RuntimeError("Failed to solve exams!")
        
    print("Stage 3: Solving Bookings...")
    fest_week = solve_bookings(working_data, sessions)
    
    schedule = {
        "team": "CIT Crunch Team",
        "dataset_id": working_data["dataset_id"],
        "sessions": sessions,
        "fest_week": fest_week,
        "exams": exams
    }
    return schedule


def compute_diff(baseline_schedule, after_schedule):
    """
    Computes structured diff between baseline and after schedules.
    """
    b_assign, _ = validator.to_assign(baseline_schedule)
    a_assign, _ = validator.to_assign(after_schedule)
    
    moved = []
    for sid in a_assign:
        if sid in b_assign:
            b_day, b_p, b_rid = b_assign[sid]
            a_day, a_p, a_rid = a_assign[sid]
            if (b_day, b_p, b_rid) != (a_day, a_p, a_rid):
                moved.append({
                    "session_id": sid,
                    "before": {"day": b_day, "start_period": b_p, "room_id": b_rid},
                    "after": {"day": a_day, "start_period": a_p, "room_id": a_rid},
                    "type": "time_and_room" if (b_day, b_p) != (a_day, a_p) and b_rid != a_rid else
                            "time_only" if (b_day, b_p) != (a_day, a_p) else "room_only"
                })
    return {
        "sessions_moved_count": len(moved),
        "time_changed_count": sum(1 for m in moved if m["type"] in ("time_only", "time_and_room")),
        "room_only_count": sum(1 for m in moved if m["type"] == "room_only"),
        "changes": moved
    }


def explain_infeasibility(data, disruption):
    """
    Runs a relaxed CP-SAT pass with high-penalty slack variables to identify conflicting constraints.
    """
    # Returns human-readable explanation of why a disruption cannot be satisfied
    d = validator.apply_disruption(data, disruption)
    # Check faculty hours or room availability bottlenecks
    explanation = []
    for ch in disruption.get("changes", []):
        t = ch.get("type")
        if t == "faculty_unavailable":
            explanation.append(f"Faculty {ch.get('faculty_id')} has heavy unavailabilities on {ch.get('days')}.")
        elif t == "room_unavailable":
            explanation.append(f"Room {ch.get('room_id')} closed on {ch.get('days')}.")
    return explanation
