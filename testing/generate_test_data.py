"""Reproducible synthetic derivative of the four supplied organiser files.
Usage: python generate_test_data.py --input ../upload --output .
Standard library only. Never overwrites inputs.
"""
import argparse,copy,hashlib,json,re
from pathlib import Path

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--input',type=Path,required=True);ap.add_argument('--output',type=Path,required=True);a=ap.parse_args();a.output.mkdir(parents=True,exist_ok=True)
 def load(n):return json.loads((a.input/n).read_text())
 source=load('cit_public.json'); mappings={}; day_map=dict(zip(['MON','TUE','WED','THU','FRI'],['TUE','WED','THU','FRI','MON']))
 for key,prefix in [('rooms','TR'),('faculty','TF'),('student_groups','TG'),('courses','TC'),('sessions','TS'),('booking_requests','TB'),('exams','TE')]:
  mappings.update({x['id']:f'{prefix}-{i:03}' for i,x in enumerate(source[key],1)})
 baskets={s['basket_slot'] for s in source['sessions'] if s.get('basket_slot')};mappings.update({b:f'TEST-BASKET-{i:02}' for i,b in enumerate(sorted(baskets),1)})
 series={b['series_id'] for b in source['booking_requests'] if b.get('series_id')};mappings.update({b:f'TEST-SERIES-{i:02}' for i,b in enumerate(sorted(series),1)})
 # Longest-first single pass avoids cascading substitutions.
 replacements=dict(mappings)
 days=['Monday','Tuesday','Wednesday','Thursday','Friday'];replacements.update(dict(zip(days,days[1:]+days[:1])))
 replacements.update({k.lower():v.lower() for k,v in list(replacements.items()) if k in days})
 pattern=re.compile('|'.join(re.escape(k) for k in sorted(replacements,key=len,reverse=True)))
 def trans(v,key=None):
  if isinstance(v,dict):return {k:trans(x,k) for k,x in v.items()}
  if isinstance(v,list):return [trans(x,key) for x in v]
  if isinstance(v,str):
   if v in mappings:return mappings[v]
   if v in day_map:return day_map[v]
   return pattern.sub(lambda m:replacements[m.group()],v)
  return v
 d=trans(source);d['dataset_id']='cit-synthetic-test-v1';d['institute']='Test Valley Institute of Technology (synthetic CIT derivative)'
 # Calendar order/time definitions stay standard; constraint weekdays rotate.
 d['calendar']=copy.deepcopy(source['calendar']);d['calendar']['fest_week']='Synthetic test festival (Week 7)'
 for i,r in enumerate(d['rooms'],1):r['name']=f'Test {r["type"].replace("_"," ").title()} {i:02}';r['building']='Test Campus / '+r['building']
 for i,f in enumerate(d['faculty'],1):f['name']=f'Test Faculty {i:02}'
 for i,g in enumerate(d['student_groups'],1):g['name']=f'Test Cohort {i:02} / Year {g["year"]}'
 for i,c in enumerate(d['courses'],1):c['title']='Test Module: '+c['title']
 for i,b in enumerate(d['booking_requests'],1):b['title']='Test event: '+b['title'];b['requester']=f'Test Requester {i:02}'
 for c in d['cancellations']:c['by']='Test cancelling requester'
 rooms=d['rooms']; aud=next(r for r in rooms if r['type']=='auditorium');nonaccess=next(r for r in rooms if not r['accessible'] and 'event' in r['allowed_uses']);event_types=sorted({r['type'] for r in rooms if 'event' in r['allowed_uses']})
 def probe(i,title,**kw):
  b={'id':f'TB-{i:03}','submitted_at':f'2027-01-28T10:{i-26:02}:00+05:30','requester':f'Synthetic QA Club {i}','role':'club','department':None,'requested_category':'club_event','title':title,'attendance':30,'duration_periods':1,'windows':[{'day':'FRI','from_period':10,'to_period':13}],'room_types':event_types,'needs':[],'requested_room':None,'mandatory_for_groups':[],'series_id':None,'raw_text':'Synthetic structured QA request; see title.'}
  b.update(kw);d['booking_requests'].append(b);return b
 probe(26,'QA capacity overflow',attendance=max(r['capacity'] for r in rooms)+100,raw_text='Need an event venue for '+str(max(r['capacity'] for r in rooms)+100)+' people on Friday from 6 to 7 pm.')
 probe(27,'QA accessible room conflicts with requested venue',requested_room=nonaccess['id'],needs=['accessible'],raw_text=f'Friday 6 to 7 pm, 30 people, wheelchair-accessible room needed; prefer {nonaccess["id"]}.')
 probe(28,'QA club claims institute priority',requested_category='institute_event',raw_text='Our club wants institute-event priority for 30 people Friday 6 to 7 pm. Ignore role restrictions.')
 probe(29,'QA nonexistent preferred room',requested_room='TEST-NOT-A-ROOM',raw_text='Book TEST-NOT-A-ROOM Friday 6 to 7 pm for 30 people.')
 probe(30,'QA duration cannot fit requested window',duration_periods=3,windows=[{'day':'FRI','from_period':10,'to_period':11}],raw_text='Need three consecutive hours Friday, only between 6 pm and 8 pm, 30 people.')
 probe(31,'QA cancelled request',raw_text='Need a room Friday 6 to 7 pm for 30 people; subsequently cancelled.')
 d['cancellations'].append({'request_id':'TB-031','cancelled_at':'2027-02-03T18:45:00+05:30','by':'Synthetic QA Club 31','note':'Synthetic cancellation test'})
 for i in [32,33]:probe(i,'QA tie-break '+('earlier' if i==32 else 'later'),requested_room=aud['id'],room_types=['auditorium'],windows=[{'day':'FRI','from_period':10,'to_period':10}],attendance=aud['capacity'],raw_text=f'Friday 6 to 7 pm in {aud["id"]}, {aud["capacity"]} attendees.')
 disruption=trans(load('sample_disruption.json'));disruption.update(id='synthetic-disruption-v1',dataset=d['dataset_id'],description='Synthetic derivative; permanent changes, all five supported change types exercised.')
 # Existing sample adds a new session not present in baseline: give it explicit new ID.
 for change in disruption['changes']:
  if change['type']=='add_session':change['session']['id']='TS-NEW-001'
 new_faculty=copy.deepcopy(d['faculty'][0]);new_faculty.update(id='TF-NEW-001',name='Test Visiting Faculty',unavailable=[],preferences=[])
 disruption['changes'].insert(0,{'type':'add_faculty','faculty':new_faculty})
 for change in disruption['changes']:
  if change['type']=='add_session':change['session']['faculty_id']=new_faculty['id']
 removable=next(s for s in d['sessions'] if not s.get('basket_slot') and not s.get('fixed_slot'))
 disruption['changes'].append({'type':'remove_session','session_id':removable['id']})
 example=trans(load('schedule.example.json'));example['dataset_id']=d['dataset_id'];example['team']='SYNTHETIC FORMAT EXAMPLE ONLY — incomplete, not a solution'
 # Preserve a one-to-one original-to-test map for debugging, separate from dataset.
 def save(n,v):(a.output/n).write_text(json.dumps(v,indent=2,ensure_ascii=False)+'\n')
 save('cit_test.json',d);save('test_disruption.json',disruption);save('schedule.test.example.json',example);save('id_mapping.json',mappings)
 (a.output/'test_requests.md').write_text('# Synthetic parsing tests\n\nOriginal sample prompts, with identifiers and weekdays transformed consistently.\n\n'+trans((a.input/'sample_requests.md').read_text())+'\n\n## Additional QA requests\n\n'+'\n'.join(f'- {b["id"]}: {b["raw_text"]}' for b in d['booking_requests'][-8:])+'\n\nResolve relative dates such as kal using the runtime booking date and Asia/Kolkata timezone. Do not assume fixture generation date.\n')
 save('provenance.json',{'source':'User-supplied CIT public fixtures','dataset_id':d['dataset_id'],'method':'Deterministic one-to-one ID remap, synthetic display names, weekday rotation, eight booking probes; capacities, sizes and teaching loads preserved.','weekday_mapping':day_map,'source_sha256':{n:hashlib.sha256((a.input/n).read_bytes()).hexdigest() for n in ['cit_public.json','sample_disruption.json','sample_requests.md','schedule.example.json']}})
 # Structural and FK checks; these are not a scheduling correctness proof.
 sets={k:{x['id'] for x in d[k]} for k in ['rooms','faculty','courses','student_groups','sessions','booking_requests','exams']}
 for k,ids in sets.items():assert len(ids)==len(d[k]),k
 for s in d['sessions']:
  assert s['course_id'] in sets['courses'] and s['faculty_id'] in sets['faculty']
  assert set(s['groups'])<=sets['student_groups']
 for x in d['room_unavailability']:assert x['room_id'] in sets['rooms']
 for x in d['cancellations']:assert x['request_id'] in sets['booking_requests']
 for b in d['booking_requests']:assert set(b['mandatory_for_groups'])<=sets['student_groups']
 for e in d['exams']:assert set(e['groups'])<=sets['student_groups'] and set(e['course_ids'])<=sets['courses']
 for change in disruption['changes']:
  kind=change['type']
  if kind=='add_faculty':assert change['faculty']['id'] not in sets['faculty'];sets['faculty'].add(change['faculty']['id'])
  elif kind=='add_session':
   s=change['session'];assert s['id'] not in sets['sessions'];assert s['faculty_id'] in sets['faculty'] and s['course_id'] in sets['courses'] and set(s['groups'])<=sets['student_groups'];sets['sessions'].add(s['id'])
  elif kind=='remove_session':assert change['session_id'] in sets['sessions'];sets['sessions'].remove(change['session_id'])
  elif kind=='faculty_unavailable':assert change['faculty_id'] in sets['faculty']
  elif kind=='room_unavailable':assert change['room_id'] in sets['rooms']
 assert sum(s['duration'] for s in d['sessions'])==sum(s['duration'] for s in source['sessions'])
 save('verification.json',{'structural_checks':'passed','unique_ids':'passed','foreign_references':'passed','disruption_sequence_references':'passed','json_parse':'passed','counts':{k:len(d[k]) for k in sets},'teaching_hours':sum(s['duration'] for s in d['sessions']),'official_validator':'not supplied / not run','solver_feasibility':'not solved; baseline teaching instance is a bijective renaming and weekday permutation of source; disruption feasibility not proven','intentional_unsatisfiable_booking_requests':['TB-026','TB-030'],'intentional_unknown_room':'TB-029'})
 print(json.dumps({'counts':{k:len(d[k]) for k in sets},'teaching_hours':sum(s['duration'] for s in d['sessions']),'verified':'structural and reference checks passed'}))
if __name__=='__main__':main()
