"""Independent hard-rule checks for this fixture format. Not the official validator.
Usage: python verify.py [directory]
"""
import json,sys
from pathlib import Path
from collections import defaultdict

def verify(root):
 root=Path(root);d=json.loads((root/'cit_fresh_v2.json').read_text());s=json.loads((root/'reference.schedule.json').read_text());changes=json.loads((root/'sample_disruption_v2.json').read_text());errors=[]
 def check(ok,msg):
  if not ok:errors.append(msg)
 maps={}
 for k in ['rooms','faculty','student_groups','courses','sessions','booking_requests','exams']:
  maps[k]={x['id']:x for x in d[k]};check(len(maps[k])==len(d[k]),k+' IDs unique')
 rm=maps['rooms'];fm=maps['faculty'];gm=maps['student_groups'];sm=maps['sessions'];bm=maps['booking_requests']
 check(s['dataset_id']==d['dataset_id'],'dataset matches')
 check(len(s['sessions'])==len(sm),'session count');check({p['session_id'] for p in s['sessions']}==set(sm),'session IDs exactly once')
 room_occ={};faculty_occ={};group_occ=defaultdict(list);daily=defaultdict(int);baskets={}
 for p in s['sessions']:
  x=sm[p['session_id']];r=rm[p['room_id']];f=fm[x['faculty_id']];day=p['day'];start=p['start_period'];end=start+x['duration']-1;periods=set(range(start,end+1))
  check(x['course_id'] in maps['courses'] and set(x['groups'])<=set(gm),'session references')
  check(day in d['calendar']['days'] and 1<=start<=end<=9 and not start<=5<end,'teaching bounds/lunch '+x['id'])
  check(x['kind']!='lab' or (start in [2,6] and x['duration']==3),'lab window '+x['id'])
  check(r['capacity']>=x['size'] and r['type'] in x['room_types'] and x['kind'] in r['allowed_uses'],'room fit '+x['id'])
  check(not(x['needs_accessible'] or f['needs_accessible'] or any(gm[g]['needs_accessible'] for g in x['groups'])) or r['accessible'],'accessibility '+x['id'])
  check(not any(u['day']==day and periods&set(u['periods']) for u in f['unavailable']),'faculty availability '+x['id'])
  check(not any(u['room_id']==r['id'] and u['day']==day and periods&set(u['periods']) for u in d['room_unavailability']),'room availability '+x['id'])
  if x['fixed_slot']:check(x['fixed_slot']=={'day':day,'start_period':start},'fixed slot '+x['id'])
  if x['basket_slot']:
   b=x['basket_slot'];check(b not in baskets or baskets[b]==(day,start),'basket sync '+b);baskets[b]=(day,start)
  daily[(f['id'],day)]+=x['duration']
  for t in periods:
   for occ,key,label in [(room_occ,(r['id'],day,t),'room'),(faculty_occ,(f['id'],day,t),'faculty')]:
    check(key not in occ,label+' collision '+x['id']);occ[key]=x['id']
   for g in x['groups']:
    key=(g,day,t)
    for previous in group_occ[key]:check(x['basket_slot'] is not None and previous['basket_slot']==x['basket_slot'],'group collision '+x['id'])
    group_occ[key].append(x)
 for (fid,day),n in daily.items():check(n<=fm[fid]['max_hours_per_day'],'daily faculty limit '+fid)
 check(len(s['exams'])==len(d['exams']) and {e['exam_id'] for e in s['exams']}==set(maps['exams']),'all exams exactly once')
 er=set();eg=set()
 for p in s['exams']:
  x=maps['exams'][p['exam_id']];day=p['day'];slot=p['session'];check(day in d['calendar']['exam_week']['days'] and slot in ['AM','PM'],'exam time');check(len(set(p['rooms']))==len(p['rooms']),'distinct exam rooms')
  check(sum(rm[r]['capacity']//2 for r in p['rooms'])>=x['size'],'exam half capacity')
  check(set(x['course_ids'])<=set(maps['courses']) and set(x['groups'])<=set(gm),'exam references')
  for rid in p['rooms']:
   r=rm[rid];check('exam' in r['allowed_uses'],'exam allowed');check(not any(gm[g]['needs_accessible'] for g in x['groups']) or r['accessible'],'exam accessible')
   check((rid,day,slot) not in er,'exam room collision');er.add((rid,day,slot))
   check(not any(u['room_id']==rid and u['day']==day and set(u['periods'])&set([2,3,4] if slot=='AM' else [6,7]) for u in d['room_unavailability']),'exam maintenance')
  for g in x['groups']:check((g,day,slot) not in eg,'exam group collision');eg.add((g,day,slot))
 cancelled={c['request_id'] for c in d['cancellations']};check(cancelled<=set(bm),'cancellation references');bo=set();bgo=set();decisions=s['fest_week']['bookings'];check(len(decisions)==len(bm) and {b['request_id'] for b in decisions}==set(bm),'one decision each')
 rank={c:i for i,c in enumerate(d['priority_order'])}
 effective=lambda b:max(rank[b['requested_category']],rank[d['role_category_cap'][b['role']]])
 ordered=sorted(bm,key=lambda id:(effective(bm[id]),bm[id]['submitted_at']))
 check([b['request_id'] for b in decisions]==ordered,'allocation priority/timestamp traversal')
 for p in decisions:
  b=bm[p['request_id']];check(bool(p['reason']),'decision reason');check(set(b['mandatory_for_groups'])<=set(gm),'mandatory groups references')
  if p['status']!='approved':continue
  check(b['id'] not in cancelled,'cancelled cannot approve');r=rm[p['room_id']];day=p['day'];start=p['start_period'];end=p['end_period'];periods=set(range(start,end+1))
  check(end-start+1==b['duration_periods'] and 1<=start<=end<=13,'booking duration/time')
  check(any(w['day']==day and w['from_period']<=start<=end<=w['to_period'] for w in b['windows']),'booking inside window')
  check(r['capacity']>=b['attendance'] and r['type'] in b['room_types'] and 'event' in r['allowed_uses'],'booking room fit')
  check(all((r['accessible'] if n=='accessible' else n in r['features']) for n in b['needs']),'booking needs')
  check(not any(u['room_id']==r['id'] and u['day']==day and periods&set(u['periods']) for u in d['room_unavailability']),'booking availability')
  for t in periods:
   key=(r['id'],day,t);check(key not in room_occ and key not in bo,'booking room collision');bo.add(key)
   for g in b['mandatory_for_groups']:
    key=(g,day,t);check(not group_occ[key] and key not in bgo,'booking mandatory group collision');bgo.add(key)
 # Apply the change sequence structurally; it is intentionally not yet repaired.
 updated= {k:dict(v) for k,v in maps.items()}
 for c in changes['changes']:
  kind=c['type']
  if kind=='add_faculty':check(c['faculty']['id'] not in updated['faculty'],'new faculty unique');updated['faculty'][c['faculty']['id']]=c['faculty']
  elif kind=='add_session':
   x=c['session'];check(x['id'] not in updated['sessions'] and x['faculty_id'] in updated['faculty'] and x['course_id'] in updated['courses'] and set(x['groups'])<=set(updated['student_groups']),'new session references');updated['sessions'][x['id']]=x
  elif kind=='remove_session':check(c['session_id'] in updated['sessions'],'remove session exists');updated['sessions'].pop(c['session_id'],None)
  elif kind=='faculty_unavailable':check(c['faculty_id'] in updated['faculty'],'disruption faculty exists')
  elif kind=='room_unavailable':check(c['room_id'] in updated['rooms'],'disruption room exists')
 # Confirm soft targets and payload sizes differ from the source, when supplied externally.
 check(len(s['fest_week']['session_overrides'])==0,'reference has no unexplained overrides')
 report={'dataset_id':d['dataset_id'],'errors':errors,'passed':not errors,'counts':{k:len(v) for k,v in maps.items()},'teaching_hours':sum(x['duration'] for x in d['sessions']),'approved_bookings':sum(p['status']=='approved' for p in decisions),'rejected_bookings':sum(p['status']=='rejected' for p in decisions),'checks':['unique IDs and foreign references','all teaching sessions exactly once','faculty, room and group overlaps','elective synchronization and group exemption','room capacity/type/allowed uses','faculty daily limits and unavailability','room maintenance','fixed slots, lab starts, lunch, accessibility','all exams exactly once, half-capacity, room/group collisions, maintenance','booking priority traversal, time, needs, collisions, cancellation','disruption sequence references'],'limits':['Not the organiser validator; no claim of soft-score optimality, booking optimality, minimal-move repair or production-app generation.','Repair after disruption has not been solved.','Reference is generated by fixture code only; never submit it as your app output.']}
 (root/'verification.json').write_text(json.dumps(report,indent=2)+'\n');return report
if __name__=='__main__':
 report=verify(sys.argv[1] if len(sys.argv)>1 else '.');print(json.dumps(report,indent=2));sys.exit(0 if report['passed'] else 1)
