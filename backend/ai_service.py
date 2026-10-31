import json
import os
import re
from datetime import datetime
from zoneinfo import ZoneInfo

# Day and period mappings for Chilika Institute of Technology
WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI"]
CALENDAR_WEEKDAYS = WEEKDAYS + ["SAT", "SUN"]
DAY_ALIASES = {
    "mon": "MON", "monday": "MON", "somwar": "MON", "somvaar": "MON",
    "tue": "TUE", "tuesday": "TUE", "mangal": "TUE", "mangalwar": "TUE", "mangalvaar": "TUE",
    "wed": "WED", "wednesday": "WED", "budh": "WED", "budhwar": "WED", "budhvaar": "WED",
    "thu": "THU", "thursday": "THU", "guru": "THU", "guruwar": "THU", "brihaspati": "THU", "veervaar": "THU",
    "fri": "FRI", "friday": "FRI", "shukra": "FRI", "shukrawar": "FRI", "shukravaar": "FRI",
    "sat": "SAT", "saturday": "SAT", "shani": "SAT", "shaniwar": "SAT"
}

# Period map: P1 = 08:00, P2 = 09:00, ..., P5 = 12:00, lunch 13:00-14:00, P6 = 14:00, ..., P9 = 17:00, P10 = 18:00, ..., P13 = 21:00
# Times:
# 8 am -> 1, 9 am -> 2, 10 am -> 3, 11 am -> 4, 12 pm -> 5
# 2 pm -> 6, 3 pm -> 7, 4 pm -> 8, 5 pm -> 9
# 6 pm -> 10, 7 pm -> 11, 8 pm -> 12, 9 pm -> 13, 10 pm -> 13

ROLE_CAPS = {
    "admin": "institute_event",
    "department_coordinator": "department_event",
    "faculty": "guest_lecture",
    "club": "club_event"
}

ORDER = ["institute_event", "guest_lecture", "department_event", "club_event"]

def enforce_role_cap(role: str, requested_category: str) -> str:
    cap = ROLE_CAPS.get(role, "club_event")
    req_idx = ORDER.index(requested_category) if requested_category in ORDER else len(ORDER) - 1
    cap_idx = ORDER.index(cap)
    effective_idx = max(req_idx, cap_idx)
    return ORDER[effective_idx]

def current_local_day() -> str:
    return datetime.now(ZoneInfo("Asia/Kolkata")).strftime("%a").upper()


def _next_schedulable_day(day: str, offset: int = 0) -> str:
    day_index = CALENDAR_WEEKDAYS.index(day) if day in CALENDAR_WEEKDAYS else 0
    day_index = (day_index + offset) % len(CALENDAR_WEEKDAYS)
    while day_index >= len(WEEKDAYS):
        day_index = (day_index + 1) % len(CALENDAR_WEEKDAYS)
    return CALENDAR_WEEKDAYS[day_index]


def resolve_relative_day(current_day: str | None, phrase: str) -> str:
    """
    Resolves relative days against the local booking date and available weekdays.
    """
    curr = (current_day or current_local_day()).upper()
    phrase_lower = phrase.lower()
    
    if re.search(r"\b(kal|tomorrow)\b", phrase_lower):
        return _next_schedulable_day(curr, 1)
    if re.search(r"\b(parson|day after tomorrow)\b", phrase_lower):
        return _next_schedulable_day(curr, 2)
    if re.search(r"\b(aaj|today)\b", phrase_lower):
        return _next_schedulable_day(curr)
        
    for alias, standard in DAY_ALIASES.items():
        if re.search(r'\b' + alias + r'\b', phrase_lower):
            return standard
            
    return _next_schedulable_day(curr)


def _recurring_days(phrase: str) -> list[str]:
    if not re.search(r"\b(every|each|weekly)\b", phrase, re.IGNORECASE):
        return []

    aliases = sorted(DAY_ALIASES, key=len, reverse=True)
    pattern = re.compile(r"\b(" + "|".join(map(re.escape, aliases)) + r")\b", re.IGNORECASE)
    days = []
    for match in pattern.finditer(phrase):
        day = DAY_ALIASES[match.group(1).lower()]
        if day in WEEKDAYS and day not in days:
            days.append(day)
    return days if len(days) > 1 else []


def _requested_room(text: str, rooms_data: list | None) -> dict | None:
    if not rooms_data:
        return None

    for room in sorted(rooms_data, key=lambda item: len(item["id"]), reverse=True):
        room_id = re.escape(room["id"])
        if re.search(r"(?<![A-Za-z0-9])" + room_id + r"(?![A-Za-z0-9])", text, re.IGNORECASE):
            return room
    return None


def _apply_room_constraints(parsed: dict, raw_text: str, rooms_data: list | None) -> dict:
    if not rooms_data:
        return parsed

    room = _requested_room(raw_text, rooms_data)
    if room is None:
        requested_id = parsed.get("requested_room")
        room = next(
            (candidate for candidate in rooms_data if candidate["id"].lower() == str(requested_id).lower()),
            None,
        )
    if room is None:
        return parsed

    parsed["requested_room"] = room["id"]
    room_types = parsed.get("room_types")
    if not isinstance(room_types, list):
        room_types = []
        parsed["room_types"] = room_types
    if room["type"] not in room_types:
        room_types.append(room["type"])

    needs = set(parsed.get("needs") or [])
    if room.get("accessible", False) or "accessible" not in needs:
        return parsed

    required_features = needs - {"accessible"}
    attendance = parsed.get("attendance") or 0
    alternative = next(
        (
            candidate
            for candidate in rooms_data
            if candidate["id"] != room["id"]
            and candidate["type"] == room["type"]
            and candidate.get("accessible", False)
            and candidate.get("capacity", 0) >= attendance
            and "event" in candidate.get("allowed_uses", [])
            and required_features <= set(candidate.get("features", []))
        ),
        None,
    )
    if alternative:
        parsed["requested_room"] = alternative["id"]
        parsed["room_warning"] = (
            f"Notice: {room['id']} is not wheelchair accessible. "
            f"Proposing {alternative['id']} instead, which meets the accessibility and capacity requirements."
        )
    else:
        parsed["room_warning"] = (
            f"Notice: {room['id']} is not wheelchair accessible, and no accessible "
            "room of the same type meets the request requirements."
        )
    return parsed


def rule_based_booking_parse(
    raw_text: str,
    role: str = "club",
    current_day: str | None = None,
    rooms_data: list | None = None,
) -> dict:
    """
    Deterministic rule-based NLP parser for plain-language and Hinglish booking requests.
    Supports English & Hinglish (e.g., 'seminar hall kal shaam 6 baje, 2 ghante, 100 log, mic chahiye').
    """
    text = raw_text.strip()
    text_lower = text.lower()
    
    # 1. Attendance extraction
    att_match = re.search(r'(\d+)\s*(people|students|participants|log|seats|pax|attendance)', text_lower)
    if not att_match:
        att_match = re.search(r'(around|maybe|approx|for)\s*(\d+)', text_lower)
        if att_match:
            attendance = int(att_match.group(2))
        else:
            numbers = [int(n) for n in re.findall(r'\b\d+\b', text) if int(n) >= 15]
            attendance = numbers[0] if numbers else None
    else:
        attendance = int(att_match.group(1))
        
    # 2. Duration extraction
    dur_match = re.search(r'(\d+)[-\s]*(hour|hours|hr|hrs|ghante|ghanta)', text_lower)
    if dur_match:
        duration_periods = int(dur_match.group(1))
    else:
        # Check time ranges like "6 to 8 pm" -> 2 hours
        range_match = re.search(r'(\d+)\s*(?:to|-)\s*(\d+)\s*(am|pm)?', text_lower)
        if range_match:
            t1 = int(range_match.group(1))
            t2 = int(range_match.group(2))
            if t2 > t1:
                duration_periods = t2 - t1
            else:
                duration_periods = (t2 + 12) - t1
        else:
            duration_periods = 1
            
    # 3. Day resolution
    recurring_days = _recurring_days(text_lower)
    day = recurring_days[0] if recurring_days else resolve_relative_day(current_day, text_lower)
    
    # 4. Period / Window resolution
    from_period = None
    to_period = None
    
    if "after lunch" in text_lower or "lunch ke baad" in text_lower or "dophar" in text_lower or "afternoon" in text_lower:
        from_period = 6
        to_period = min(13, from_period + duration_periods - 1)
    elif "evening" in text_lower or "shaam" in text_lower or "night" in text_lower or "raat" in text_lower:
        # Look for specific hour
        time_m = re.search(r'(\d+)\s*(pm|baje)?', text_lower)
        if time_m and int(time_m.group(1)) in (6, 7, 8, 9, 10):
            hour = int(time_m.group(1))
            # 6 pm -> 10, 7 pm -> 11, 8 pm -> 12, 9 pm -> 13
            from_period = 10 + (hour - 6)
            to_period = min(13, from_period + duration_periods - 1)
        else:
            from_period = 10
            to_period = min(13, 10 + duration_periods - 1)
    elif "morning" in text_lower or "subah" in text_lower:
        time_m = re.search(r'(\d+)\s*(am|baje)?', text_lower)
        if time_m:
            hour = int(time_m.group(1))
            # 8 am -> 1, 9 am -> 2, 10 am -> 3, 11 am -> 4
            if hour in (8, 9, 10, 11):
                from_period = hour - 7
                to_period = from_period + duration_periods - 1
        if not from_period:
            from_period = 2
            to_period = from_period + duration_periods - 1
    else:
        # Check for numeric hour with am/pm or baje
        time_m = re.search(r'(\d+)\s*(?:to|-)\s*(\d+)\s*(am|pm)?', text_lower)
        if time_m:
            t1, t2 = int(time_m.group(1)), int(time_m.group(2))
            is_pm = "pm" in text_lower or t1 >= 12 or t1 in (1, 2, 3, 4, 5, 6, 7, 8, 9)
            if is_pm and t1 in (6, 7, 8, 9):
                from_period = 10 + (t1 - 6)
                to_period = min(13, 10 + (t2 - 6) - 1)
            elif is_pm and t1 in (2, 3, 4, 5):
                from_period = 6 + (t1 - 2)
                to_period = from_period + (t2 - t1) - 1
            elif not is_pm and t1 in (8, 9, 10, 11):
                from_period = t1 - 7
                to_period = t2 - 8
        else:
            single_m = re.search(r'(\d+)\s*(am|pm|baje)', text_lower)
            if single_m:
                h = int(single_m.group(1))
                if ("pm" in single_m.group(2) or "baje" in single_m.group(2)) and h in (6, 7, 8, 9):
                    from_period = 10 + (h - 6)
                elif ("pm" in single_m.group(2) or "baje" in single_m.group(2)) and h in (2, 3, 4, 5):
                    from_period = 6 + (h - 2)
                elif h in (8, 9, 10, 11):
                    from_period = h - 7
                if from_period:
                    to_period = min(13, from_period + duration_periods - 1)
                    
    if not from_period:
        from_period = 10
        to_period = min(13, from_period + duration_periods - 1)

    # 5. Room types and features
    room_types = []
    if "seminar hall" in text_lower or "sh-" in text_lower or "sh1" in text_lower or "sh2" in text_lower:
        room_types.append("seminar_hall")
    if "auditorium" in text_lower or "audi" in text_lower:
        room_types.append("auditorium")
    if "lab" in text_lower or "computer" in text_lower or "coding" in text_lower:
        room_types.append("lab_cs")
    if "outdoor" in text_lower or "oat" in text_lower or "theatre" in text_lower:
        room_types.append("outdoor")
    if "classroom" in text_lower or "lecture" in text_lower:
        room_types.extend(["classroom", "lecture_hall"])
    if not room_types:
        room_types = ["classroom", "lecture_hall", "seminar_hall"]
        
    needs = []
    if re.search(r'\b(mic|microphone|pa|sound|audio|pa_system)\b', text_lower):
        needs.append("pa_system")
    if re.search(r'\b(projector|screen)\b', text_lower):
        needs.append("projector")
    if re.search(r'\b(stage|play|drama)\b', text_lower):
        needs.append("stage")
    if re.search(r'\b(wheelchair|accessible|handicap)\b', text_lower):
        needs.append("accessible")
    if re.search(r'\b(ac|air condition|air conditioning)\b', text_lower):
        needs.append("ac")

    # 6. Specific requested room detection & conflict warning (e.g. Request 7: SH-2 is not accessible!)
    requested_room = _requested_room(text, rooms_data)
        
    # 7. Category and Role capping
    req_category = "club_event"
    if "institute" in text_lower or "dean" in text_lower or "campus" in text_lower:
        req_category = "institute_event"
    elif "guest" in text_lower or "speaker" in text_lower or "industry" in text_lower:
        req_category = "guest_lecture"
    elif "department" in text_lower or "farewell" in text_lower or "branch" in text_lower:
        req_category = "department_event"
        
    eff_category = enforce_role_cap(role, req_category)
    
    # 8. Mandatory groups
    mandatory_for_groups = []
    if "mechanical" in text_lower and ("third" in text_lower or "3" in text_lower):
        mandatory_for_groups.append("ME-3")
    elif "cse" in text_lower and ("third" in text_lower or "3" in text_lower):
        mandatory_for_groups.append("CSE-3")
        
    # 9. Follow-up detection for missing or ambiguous fields
    follow_up = None
    if not attendance:
        follow_up = "How many participants are expected to attend?"
    elif "after lunch" in text_lower and duration_periods <= 1:
        follow_up = "Could you confirm the exact duration and start time after lunch (e.g., 2:00 PM - 4:00 PM)?"
        
    parsed = {
        "attendance": attendance or 50,
        "duration_periods": duration_periods,
        "windows": [
            {"day": recurring_day, "from_period": from_period, "to_period": to_period}
            for recurring_day in (recurring_days or [day])
        ],
        "room_types": room_types,
        "needs": needs,
        "requested_room": requested_room["id"] if requested_room else None,
        "mandatory_for_groups": mandatory_for_groups,
        "requested_category": req_category,
        "effective_category": eff_category,
        "room_warning": None,
        "follow_up": follow_up,
        "raw_text": raw_text
    }
    return _apply_room_constraints(parsed, raw_text, rooms_data)

async def parse_request_ai(
    raw_text: str,
    role: str = "club",
    current_day: str | None = None,
    rooms_data: list | None = None,
) -> dict:
    """
    Parses request using LLM if configured; otherwise seamlessly uses the deterministic rule-based parser.
    Always enforces role category caps and accessibility validation in Python code regardless of LLM output.
    """
    api_key = os.getenv("LLM_API_KEY")
    base_url = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1")
    model_name = os.getenv("LLM_MODEL", "gpt-4o-mini")
    
    # Fallback directly if no key
    if not api_key:
        return rule_based_booking_parse(raw_text, role=role, current_day=current_day, rooms_data=rooms_data)
        
    try:
        import httpx
        prompt = f"""You are Chilika Institute of Technology's room scheduling AI assistant.
Extract structured booking details from this text:
"{raw_text}"

Current local day in Asia/Kolkata: {current_day or current_local_day()}.
Available weekdays: MON, TUE, WED, THU, FRI.
Periods: P1 (08:00) to P9 (17:00) teaching, P10 (18:00) to P13 (22:00) events. Lunch is 13:00-14:00.
Relative days: 'kal' means tomorrow; when the target falls on a weekend, use the next available weekday.
Return ONLY valid JSON matching this schema:
{{
  "attendance": int or null,
  "duration_periods": int,
  "windows": [{{"day": "MON", "from_period": int, "to_period": int}}],
  "room_types": ["classroom"|"lecture_hall"|"auditorium"|"seminar_hall"|"outdoor"|"lab_cs"],
  "needs": ["projector"|"pa_system"|"stage"|"accessible"|"ac"],
  "requested_room": string or null,
  "mandatory_for_groups": list of group ids,
  "requested_category": "institute_event"|"guest_lecture"|"department_event"|"club_event",
  "follow_up": string or null
}}"""
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(
                f"{base_url.rstrip('/')}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "model": model_name,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.1,
                    "response_format": {"type": "json_object"}
                }
            )
            if resp.status_code == 200:
                result = resp.json()["choices"][0]["message"]["content"]
                parsed = json.loads(result)
                # Strict Python security verification on top of LLM
                parsed["effective_category"] = enforce_role_cap(role, parsed.get("requested_category", "club_event"))
                parsed["raw_text"] = raw_text
                return _apply_room_constraints(parsed, raw_text, rooms_data)
    except Exception as e:
        print(f"LLM API call failed ({e}); using rule-based parser fallback.")
        
    return rule_based_booking_parse(raw_text, role=role, current_day=current_day, rooms_data=rooms_data)

def explain_decision(decision: dict, request: dict, rooms_dict: dict) -> str:
    """
    Produces deterministic facts and human-readable explanation of why a booking was approved, rejected, or offered an alternative.
    """
    status = decision.get("status")
    rid = decision.get("request_id")
    eff_cat = decision.get("effective_category") or request.get("effective_category", "event")
    
    if status == "approved":
        return f"Approved: Your {eff_cat.replace('_', ' ')} request was allocated {decision.get('room_id')} on {decision.get('day')} from period P{decision.get('start_period')} to P{decision.get('end_period')}, matching your requested window with all equipment satisfied."
    elif status == "alternative_offered":
        return f"Alternative Offered: The requested time window was unavailable or occupied by higher-priority bookings. An alternative slot in {decision.get('room_id')} on {decision.get('day')} (P{decision.get('start_period')}–P{decision.get('end_period')}) has been reserved for you."
    elif status == "rejected":
        reason = decision.get("reason", "No suitable venue available")
        return f"Booking Request Rejected: {reason}. You may modify the expected attendance, adjust equipment needs, or propose alternative days."
    return "Status: " + str(status)
