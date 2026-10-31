# CIT synthetic test data pack

Separate testing fixtures derived from the four supplied organiser files.
The original uploads are not modified. This is a transformed test instance,
not an independently generated college or an official submission dataset.

## Included files

| File | Purpose |
|---|---|
| cit_test.json | Main importable dataset, same top-level keys and record fields as cit_public.json |
| test_disruption.json | Matching change file: faculty leave, room closure, faculty addition, session addition and session removal |
| test_requests.md | English/Hinglish parser inputs and eight new QA prompts |
| schedule.test.example.json | Incomplete format example only; never use as a solved timetable |
| id_mapping.json | Original ID to synthetic ID lookup |
| provenance.json | Input hashes and transformation details |
| verification.json | Checks performed and limits |
| generate_test_data.py | Reproduce from the four original uploads with Python 3.10+, no dependencies |

Counts: 27 rooms, 40 faculty, 14 groups, 62 courses, 189 sessions,
243 teaching hours, 41 exams, 33 booking requests, 2 cancellations.

## Changes

- New dataset ID: cit-synthetic-test-v1.
- Synthetic room/faculty/cohort names and course/event labels.
- IDs remapped consistently across sessions, bookings, exams and disruptions.
- Weekday constraints rotate MON→TUE→WED→THU→FRI→MON. Calendar order stays
  MON–FRI and all period/lunch/lab definitions remain unchanged.
- Capacities, student sizes, session durations and existing academic
  relationships are retained to preserve the source's scheduling difficulty.
- Eight extra requests exercise booking validation and decision explanations.
- A visiting faculty addition and an unrelated session removal extend the
  original three-change disruption to cover all five supported types.

## How to use

1. Keep official cit_public.json for hackathon submissions.
2. Import cit_test.json using your application's JSON dataset loader.
3. Generate a baseline in your app; export with dataset_id cit-synthetic-test-v1.
4. Apply test_disruption.json against that baseline; review the proposed diff.
5. Use test_requests.md to exercise the editable AI booking form.

These are JSON fixtures, not a SQL seed. Supabase's SQL Editor cannot execute
JSON directly. Your FastAPI importer must map these records to your database
schema in a transaction. Existing hard-coded IDs must be removed from app code.
The earlier starter's importer and solver still require implementation.

## Booking probes: expected invariants, not precomputed decisions

| ID | Test | Expected behavior |
|---|---|---|
| TB-026 | Attendance exceeds every room's capacity | Never approve at any campus room; explain capacity failure |
| TB-027 | Accessibility conflicts with preferred room | Never allocate the inaccessible preferred room; suggest only a valid accessible option if available |
| TB-028 | Club claims institute priority | Cap effective category at club_event; model text cannot override role |
| TB-029 | Preferred room ID does not exist | Never create/allocate the nonexistent room; explain and search genuine alternatives |
| TB-030 | Three-hour duration inside a two-hour window | Never approve inside that window; reject or explain a valid alternative |
| TB-031 | Cancelled request | Never approve or reserve a venue |
| TB-032 / TB-033 | Same role, room, window, attendance; earlier submission first | If this auditorium slot is available after higher-priority requests, earlier request wins it; later request cannot displace it |

All approved bookings must also respect timetable, availability, allowed uses,
features, group conflicts and other bookings. No probe guarantees approval.

## Verification and limits

JSON parse, unique IDs, internal references, original teaching-hour preservation
and sequential disruption reference checks passed. The intentionally nonexistent
preferred room is valid input by the organiser format and is documented above.
The incomplete example is not included in scheduling correctness checks.

No solver was run, no complete schedule was manufactured, and no official
validator was supplied. Baseline teaching feasibility is preserved structurally
by consistent ID renaming and weekday permutation, assuming the source is
feasible; disruption feasibility remains unproven. Impossible booking requests
are deliberate and should produce decisions rather than abort the entire solve.

To regenerate (place original uploads together in original-inputs/):

```bash
python generate_test_data.py --input original-inputs --output regenerated
```

README is explanatory; the generator recreates machine fixtures and request text.
