"""
Direct integration tests for Authentication, Role-Based Access Control,
and Self-Approval prevention in CIT Campus Scheduling Engine.
"""

import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from fastapi import HTTPException
import backend.main as m
import backend.database as db

def run_tests():
    print("========================================")
    print("RUNNING CIT AUTH & RBAC VERIFICATION")
    print("========================================")

    # 1. Test credentials retrieval
    creds = m.get_test_credentials()
    assert len(creds) == 4, f"Expected 4 credentials, got {len(creds)}"
    roles = {c["role"] for c in creds}
    assert roles == {"admin", "department_coordinator", "faculty", "club"}
    print("[PASS] 4 test roles available (admin, department_coordinator, faculty, club)")

    # 2. Invalid password rejected
    try:
        m.login(m.LoginRequest(email="admin@cit.edu.in", password="WrongPassword123"))
        assert False, "Should have failed with 401"
    except HTTPException as e:
        assert e.status_code == 401
        print("[PASS] Bad credentials rejected with 401 Unauthorized")

    # 3. Successful admin login
    admin_login = m.login(m.LoginRequest(email="admin@cit.edu.in", password="Admin@123"))
    admin_token = admin_login["token"]
    assert admin_login["user"]["role"] == "admin"
    print(f"[PASS] Admin authenticated successfully (Token: {admin_token[:12]}...)")

    # 4. Successful club login
    club_login = m.login(m.LoginRequest(email="dramatics@cit.edu.in", password="Club@123"))
    club_token = club_login["token"]
    assert club_login["user"]["role"] == "club"
    print(f"[PASS] Club authenticated successfully (Token: {club_token[:12]}...)")

    # 5. Token validation via get_current_user
    user_resolved = m.get_current_user(authorization=f"Bearer {club_token}")
    assert user_resolved["email"] == "dramatics@cit.edu.in"
    print("[PASS] Bearer token validation correctly identifies current user")

    # 6. RBAC Guard: Club role forbidden from admin endpoints
    admin_guard = m.require_role("admin")
    try:
        admin_guard(user=user_resolved)
        assert False, "Club should not be permitted for admin tasks"
    except HTTPException as e:
        assert e.status_code == 403
        print(f"[PASS] RBAC protection: {e.detail}")

    # 7. Database status endpoint
    db_stat = db.get_database_status()
    assert "mode" in db_stat
    print(f"[PASS] Database status check works: mode='{db_stat['mode']}'")

    # 8. Self-Approval Guard (requester != approver)
    coord_user = m.TEST_ACCOUNTS["coord.cse@cit.edu.in"]
    self_booking = {
        "id": "BR-VERIFY-SELF",
        "requester": coord_user["name"],
        "requester_email": coord_user["email"],
        "role": "department_coordinator",
        "title": "CSE Faculty Review Meet"
    }
    m.state.active_data.setdefault("booking_requests", []).append(self_booking)

    try:
        m.decide_booking(
            m.BookingDecideRequest(request_id="BR-VERIFY-SELF", status="approved"),
            user=coord_user
        )
        assert False, "Self-approval should have thrown 403"
    except HTTPException as e:
        assert e.status_code == 403
        assert "Conflict of Interest" in e.detail
        print(f"[PASS] Self-approval blocked: {e.detail}")

    print("========================================")
    print("ALL TESTS PASSED SUCCESSFULLY! (8/8)")
    print("========================================")

if __name__ == "__main__":
    run_tests()
