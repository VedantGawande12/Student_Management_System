import json
import os
import sys

# Ensure current directory is at the front of sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

import validator
from backend import solver

def main():
    print("=== Generating Baseline Schedule (exports/schedule.json) ===")
    data = validator.load("data/cit_public.json")
    schedule = solver.solve_all(data, baseline=None, timeout_sec=25)
    
    os.makedirs("exports", exist_ok=True)
    with open("exports/schedule.json", "w", encoding="utf-8") as f:
        json.dump(schedule, f, indent=2)
    print("Saved exports/schedule.json")
    
    rep1 = validator.run(data, schedule)
    print("\n--- Baseline Validation Report ---")
    print("Hard Violations Count:", rep1["hard_violation_count"])
    print("Hard by Rule:", rep1["hard_by_rule"])
    print("Soft Total:", rep1["soft_total"])
    print("Soft Penalties:", rep1["soft_penalties"])
    if "bookings" in rep1:
        b = rep1["bookings"]
        print(f"Bookings Score: {b['booking_score']}/{b['booking_score_max_if_all_approved']}")
        print(f"Approved: {b['approved']}, Alternatives: {b['alternatives']}, Rejected: {b['rejected']}")
        print(f"Priority Inversions: {len(b['priority_inversions'])}")
    if "exam_soft_penalty" in rep1:
        print(f"Exam Soft Penalty: {rep1['exam_soft_penalty']}")
        
    print("\n=== Generating Disrupted Schedule (exports/schedule_after.json) ===")
    disruption = validator.load("examples/sample_disruption.json")
    data_disrupted = validator.apply_disruption(data, disruption)
    
    schedule_after = solver.solve_all(data, baseline=schedule, disruption=disruption, timeout_sec=25)
    with open("exports/schedule_after.json", "w", encoding="utf-8") as f:
        json.dump(schedule_after, f, indent=2)
    print("Saved exports/schedule_after.json")
    
    rep2 = validator.run(data_disrupted, schedule_after, baseline=schedule)
    print("\n--- Disruption Validation Report ---")
    print("Hard Violations Count:", rep2["hard_violation_count"])
    print("Hard by Rule:", rep2["hard_by_rule"])
    print("Soft Total:", rep2["soft_total"])
    print("Soft Penalties:", rep2["soft_penalties"])
    if "bookings" in rep2:
        b = rep2["bookings"]
        print(f"Bookings Score: {b['booking_score']}/{b['booking_score_max_if_all_approved']}")
        print(f"Approved: {b['approved']}, Alternatives: {b['alternatives']}, Rejected: {b['rejected']}")
        print(f"Priority Inversions: {len(b['priority_inversions'])}")
    if "exam_soft_penalty" in rep2:
        print(f"Exam Soft Penalty: {rep2['exam_soft_penalty']}")
    if "stability" in rep2:
        s = rep2["stability"]
        print(f"Stability: {s['sessions_moved']} moved ({s['time_changed']} time, {s['room_only_changed']} room only)")
        
    print("\nDone!")

if __name__ == "__main__":
    main()
