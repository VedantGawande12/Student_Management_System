# ROLE & OBJECTIVE
Use the **Hallmark (`Nutlope/hallmark`)** design skill to completely redesign and polish the frontend UI layer of our **CIT Campus Scheduling & Venue Management ("Crunch Week")** platform.

Our goal is to score a full **20/20 on UI & Design (10 marks) and Usability & Dashboard (10 marks)**. A judge who has never seen our app must be able to find a room, read a timetable, and approve a change on both laptop and phone screens using only the demo accounts[cite: 5].

---

# 1. STRICT ARCHITECTURAL BOUNDARY (DO NOT BREAK LOGIC)
1. **Touch ONLY the Presentation Layer:** Only modify files inside `frontend/src/components/views/`, `frontend/src/components/ui/`, `frontend/src/app/`, and global stylesheets.
2. **Preserve Headless Logic:** DO NOT modify any files or business logic inside `frontend/src/core/` or `frontend/src/hooks/`. Keep all existing hook signatures, TypeScript types, prop interfaces, and API payload structures 100% intact.
3. **Resilient States:** Every view must implement proper loading skeletons, empty states, and clear error states (especially when the LLM API is disabled or returns a validation block)[cite: 4, 5].

---

# 2. HALLMARK DESIGN DIRECTION & AESTHETIC
Apply Hallmark's signature high-craft, editorial SaaS aesthetic (inspired by Linear, Vercel, and Cal.com):
- **Typography & Hierarchy:** Clean sans-serif UI text paired with crisp `tabular-nums` monospace fonts for all time slots (`08:00`–`22:00`), period badges (`P1`–`P13`), room codes (`LH-1`, `SH-1`, `AUD`), and validator metrics[cite: 7, 12].
- **Surface & Borders:** Subtle layered surfaces (`bg-zinc-50/50` / `bg-zinc-950`), hairline 1px borders (`border-zinc-200/80` / `border-zinc-800`), subtle glassmorphic sticky headers, and micro-interaction transitions.
- **Semantic Color System:**
  - **Lectures:** Crisp Indigo/Blue tint with left accent bar.
  - **Labs (3-hour blocks in P2–P4 or P6–P8):** Emerald/Teal tint with distinct badge[cite: 2, 7].
  - **Tutorials:** Amber/Orange tint.
  - **Elective Baskets (`OEB-1`, `OEB-2`, `OEB-3`):** Violet/Purple parallel-session badge[cite: 7, 12].
  - **Spectra Week Overrides & Events (P10–P13):** Rose/Crimson highlight with "Week 7 Override" pill[cite: 7].
  - **Midsem Exams (`AM` / `PM`):** Slate/Cyan structured cards showing split room allocations and halved capacities[cite: 2, 7].

---

# 3. COMPONENT-BY-COMPONENT REDESIGN SPECS

### A. Sticky Top Command Bar (`RoleSwitcherBar.tsx` & `ValidatorHudBar.tsx`)
- **Live Validator HUD:** Design a sleek, real-time status pill bar in the header showing:
  - `Hard Violations: 0` (Green pulse badge when 0, Red alert badge if > 0)[cite: 5, 11]
  - `Soft Penalty: S1–S6 breakdown popover`[cite: 7, 11]
  - `Booking Score & Priority Inversions: 0`[cite: 7, 11]
  - `Stability: X Sessions Moved`[cite: 11]
- **Instant Role Switcher (Demo Mode):** A segmented control allowing judges to switch in one click between **Admin (Dean's Office)**, **Department Coordinator**, **Faculty**, and **Club Representative** with a visual badge showing their `role_category_cap`[cite: 3, 5, 7].
- **Admin Quick Actions:** Prominent **"Reset Demo Data"** button (with confirmation toast), **"Upload Dataset / Disruption JSON"**, and **"Export `schedule.json` / `schedule_after.json`"** buttons[cite: 4, 5, 7].

### B. Master Timetable & Venue Utilization Grid (`TimetableGridView.tsx`)
- **Multi-Pivot Filter Bar:** Instant segmented tabs + searchable comboboxes to view timetables **By Student Group** (`Y1-A` to `CE-3`), **By Faculty** (`F01` to `F40`), or **By Room** (`27 venues`), plus a toggle between **Regular Week**, **Spectra Week (Week 7)**, and **Midsem Exam Week**[cite: 1, 3, 12].
- **Visual Time Grid:**
  - Render `MON` to `FRI` columns (or rows) across `P1` (`08:00`) to `P9` (`17:00`), with a visually distinct shaded divider between `P5` and `P6` for **Lunch (`13:00–14:00`)**, and a collapsible evening section for **Event-Only Periods `P10–P13` (`18:00–22:00`)**[cite: 2, 7, 12].
  - Show room utilization percentages (highlighting rooms under 40% capacity S5 penalty or near 100% capacity) and gray hatched patterns for `room_unavailability` and `faculty.unavailable` slots[cite: 1, 2, 7].
- **"Why This Slot?" Inspector Drawer:** Clicking any scheduled session or booking opens a sleek slide-over drawer displaying the deterministic explanation (constraints satisfied, why 8 AM was chosen, room features matched)[cite: 1, 4].
- **Mobile Responsiveness:** On phone screens (`< 768px`), automatically transform the wide 5-day grid into a swipeable Day-Tab Agenda view so judges testing on mobile never face broken horizontal scrollbars[cite: 5].

### C. Natural-Language / Hinglish Booking Copilot & Manual Form (`BookingCopilotView.tsx`)
- **Split-Pane Copilot Layout:**
  - **Left Pane (AI Input):** Chat/prompt box with quick-fill sample chips from `sample_requests.md` (including Hinglish like *"seminar hall kal shaam 6 baje..."* and tricky room-accessibility conflict requests like *"SH-2 for wheelchair-accessible session"*)[cite: 1, 9]. If the AI detects missing info or an accessibility mismatch, render an inline amber clarification callout[cite: 9].
  - **Right Pane (Always-Working Manual Form):** Live-synced structured booking form (`title`, `attendance`, `duration_periods`, `windows`, `room_types`, `needs` checkboxes, `requested_room`, `mandatory_for_groups`)[cite: 1, 4, 7].
- **Guaranteed Fallback UX:** Include a visible `"Manual Form Mode"` badge/toggle so if the LLM API key fails or is offline, the user can seamlessly fill and submit the form directly through deterministic validation[cite: 4].

### D. Spectra Week Priority Queue & Decision Center (`SpectraQueueView.tsx`)
- Display all 25 Spectra Week booking requests sorted by effective priority order (`institute_event` > `guest_lecture` > `department_event` > `club_event`) and submission timestamp[cite: 3, 7, 11].
- Show visual badges when a request's claimed category was capped by `role_category_cap` (e.g., `Club requested Institute Event -> Capped to Club Event`)[cite: 7, 12].
- Render status pills (`Approved`, `Alternative Offered`, `Rejected`, `Cancelled`) alongside the exact human-readable `reason` and any `session_overrides` (`Displaced Session -> New Slot`)[cite: 1, 7, 10].

### E. Disruption Rescheduler & Visual Diff Approval Modal (`DisruptionDiffModal.tsx`)
- Worth 4 dedicated marks in Rescheduling for a clear change view and approval step[cite: 5]:
  - When a disruption JSON or faculty change request is applied, display a side-by-side **Before vs. After Diff View** highlighting ONLY the moved sessions (`Session ID`, `Old Day/Period/Room` $\rightarrow$ `New Day/Period/Room`, and whether it was a time change or room-only change)[cite: 1, 5, 11].
  - Show a metric comparison card: `Sessions Moved`, `Hard Violations (0)`, and `Soft Penalty Delta`[cite: 11].
  - If a disruption is mathematically infeasible, render a high-visibility **Conflict Diagnostic Card** listing the exact conflicting hard constraints[cite: 1].
  - Enforce role lock on the **"Approve & Apply Schedule"** button (disabled with tooltip if `current_user == requester` or if role is not Admin)[cite: 1, 3].