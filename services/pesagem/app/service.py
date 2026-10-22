import csv
import io
import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from .domain import ValidationError, required, number, valid_date, gmd, metrics, matches

ANIMAL_FIELDS=('vid','eid','breed','sex','birth_date','status','pasture','supplier','buyer','mother_id','father_id','notes')
def uid(): return str(uuid.uuid4())
def now(): return datetime.now(timezone.utc).isoformat()

class Store:
    def __init__(self, path):
        self.db=sqlite3.connect(path, timeout=15)
        self.db.row_factory=sqlite3.Row
        self.actor_id='bonanca-service'
        self.db.execute('PRAGMA foreign_keys=ON')
        self.db.executescript(Path(__file__).with_name('schema.sql').read_text())
    def close(self): self.db.close()
    def rows(self, sql, args=()): return [dict(r) for r in self.db.execute(sql,args)]
    def one(self, table, id):
        if table not in ('animals','sessions','groups','lists','fields','filters'): raise ValidationError('Recurso inválido.')
        rows=self.rows(f'SELECT * FROM {table} WHERE id=?',(id,))
        if not rows: raise LookupError('Registro não encontrado.')
        return rows[0]
    def audit(self,action,id): self.db.execute('INSERT INTO audit(at,action,entity_id,actor_id) VALUES(?,?,?,?)',(now(),action,id,self.actor_id))
    def history(self, id):
        rows=self.rows('SELECT w.*,s.name session_name FROM weighings w JOIN sessions s ON s.id=w.session_id WHERE animal_id=? ORDER BY w.date,w.created_at,w.id',(id,))
        for row in rows:
            previous=next((r for r in reversed(rows) if r['date']<row['date']),None)
            row['gmd']=gmd(row,previous)
        return rows
    def animals(self):
        animals=self.rows('SELECT * FROM animals ORDER BY created_at DESC,id')
        all_weights=self.rows('SELECT * FROM weighings ORDER BY date,created_at,id')
        by_animal={}
        for w in all_weights: by_animal.setdefault(w['animal_id'],[]).append(w)
        memberships=self.rows('SELECT m.*,g.name,g.kind FROM memberships m JOIN groups g ON g.id=m.group_id')
        for a in animals:
            h=by_animal.get(a['id'],[]); last=h[-1] if h else None
            previous=next((r for r in reversed(h) if last and r['date']<last['date']),None)
            a.update(weight=last['weight'] if last else None,last_seen=last['date'] if last else None,
                     gmd=gmd(last,previous) if last else None,custom=json.loads(a['custom']),
                     groups=[m for m in memberships if m['animal_id']==a['id']])
        return animals
    def session_rows(self,id):
        result=[]
        for w in self.rows('SELECT * FROM weighings WHERE session_id=? ORDER BY created_at',(id,)):
            a=self.one('animals',w['animal_id'])
            previous=self.rows('SELECT * FROM weighings WHERE animal_id=? AND date<? ORDER BY date DESC,created_at DESC,id DESC LIMIT 1',(a['id'],w['date']))
            result.append({**a,**w,'id':a['id'],'weighing_id':w['id'],'gmd':gmd(w,previous[0] if previous else None)})
        return result
    def state(self):
        animals=self.animals()
        sessions=self.rows('SELECT * FROM sessions ORDER BY date DESC,created_at DESC')
        for s in sessions: s['metrics']=metrics(self.session_rows(s['id']))
        groups=self.rows('SELECT * FROM groups ORDER BY name')
        for g in groups:
            g['animal_ids']=[m['animal_id'] for m in self.rows('SELECT animal_id FROM memberships WHERE group_id=?',(g['id'],))]
            g['metrics']=metrics([a for a in animals if a['id'] in g['animal_ids']])
        lists=self.rows('SELECT * FROM lists ORDER BY created_at DESC')
        for l in lists:
            l['categories']=json.loads(l['categories']); l['assignments']=self.rows('SELECT animal_id,category FROM classifications WHERE list_id=?',(l['id'],))
        fields=self.rows('SELECT * FROM fields ORDER BY name')
        for f in fields: f['options']=json.loads(f['options'])
        filters=self.rows('SELECT * FROM filters')
        for f in filters: f['definition']=json.loads(f['definition'])
        return dict(animals=animals,sessions=sessions,groups=groups,lists=lists,fields=fields,filters=filters,
                    metrics=metrics(animals),audit=self.rows('SELECT * FROM audit ORDER BY id DESC LIMIT 100'))
    def save_animal(self,data,id=None):
        old=self.one('animals',id) if id else {}
        if id and data.get('version')!=old['version']: raise ValidationError('Este animal foi alterado. Atualize a página antes de salvar.')
        d={k:data.get(k,old.get(k,'')) for k in ANIMAL_FIELDS}
        for k in ANIMAL_FIELDS:
            if d[k] is not None and not isinstance(d[k],str): raise ValidationError(f'{k}: use texto.')
            if d[k] is not None and len(d[k])>2000: raise ValidationError(f'{k}: texto muito longo.')
        for k in ('vid','eid','birth_date','mother_id','father_id'): d[k]=d[k].strip() or None if d[k] else None
        if not d['vid'] and not d['eid']: raise ValidationError('Informe o brinco visual ou eletrônico.')
        if d['birth_date']: valid_date(d['birth_date'])
        d['status']=d['status'] or 'ativo'
        if d['status'] not in ('ativo','vendido','morto','transferido'): raise ValidationError('Situação inválida.')
        if d['sex'] not in ('','macho','femea'): raise ValidationError('Sexo inválido.')
        id=id or uid()
        # Traverse ancestors to prevent self-reference and indirect cycles.
        for parent in (d['mother_id'],d['father_id']):
            pending=[parent] if parent else []; seen=set()
            while pending:
                p=pending.pop()
                if p==id: raise ValidationError('A linhagem não pode conter ciclos.')
                if p in seen: continue
                seen.add(p); ancestor=self.one('animals',p)
                pending.extend(x for x in (ancestor['mother_id'],ancestor['father_id']) if x)
        custom=data.get('custom',json.loads(old.get('custom','{}')))
        if not isinstance(custom,dict): raise ValidationError('Campos adicionais inválidos.')
        definitions={f['id']:f for f in self.rows('SELECT * FROM fields')}
        for key,value in custom.items():
            if key not in definitions: raise ValidationError('Campo adicional não cadastrado.')
            f=definitions[key]
            if value in ('',None): continue
            if f['type']=='number': custom[key]=number(value,f['name'],-1e12,1e12)
            elif f['type']=='date': custom[key]=valid_date(value)
            elif f['type']=='select' and value not in json.loads(f['options']): raise ValidationError('Opção de campo inválida.')
            elif not isinstance(value,str) or len(value)>2000: raise ValidationError('Valor de campo inválido.')
        if d['mother_id'] and d['mother_id']==d['father_id']: raise ValidationError('Pai e mãe devem ser animais diferentes.')
        if old:
            self.db.execute('UPDATE animals SET '+','.join(f'{k}=?' for k in ANIMAL_FIELDS)+',custom=?,version=version+1 WHERE id=?',tuple(d.values())+(json.dumps(custom),id))
        else:
            self.db.execute('INSERT INTO animals(id,'+','.join(ANIMAL_FIELDS)+',custom,created_at) VALUES('+','.join('?' for _ in range(len(ANIMAL_FIELDS)+3))+')',(id,*d.values(),json.dumps(custom),now()))
        self.audit('animal.updated' if old else 'animal.created',id); return {'id':id}
    def command(self, action, d):
        try:
            with self.db:
                self.db.execute("BEGIN IMMEDIATE")
                return self._command(action,d)
        except sqlite3.IntegrityError as e:
            if 'animal_already_in_collective' in str(e): raise ValidationError('O animal já pertence a outro grupo coletivo.')
            raise ValidationError('Registro duplicado ou referência inválida. Confira os identificadores.')
    def _command(self,action,d):
        if action=='animal.save': return self.save_animal(d,d.get('id'))
        if action=='session.save':
            name=required(d.get('name'),'Nome'); date=valid_date(d.get('date')); kind=d.get('kind','pesagem')
            if kind not in ('pesagem','entrada','saida','manejo'): raise ValidationError('Tipo de sessão inválido.')
            id=uid(); self.db.execute('INSERT INTO sessions(id,name,date,kind,notes,created_at) VALUES(?,?,?,?,?,?)',(id,name,date,kind,str(d.get('notes',''))[:2000],now()))
        elif action=='session.close':
            id=d['id']; self.one('sessions',id); self.db.execute("UPDATE sessions SET status='concluida' WHERE id=?",(id,))
        elif action=='weighing.save':
            s=self.one('sessions',d['session_id']); a=self.one('animals',d['animal_id'])
            if s['status']!='aberta': raise ValidationError('Esta sessão está concluída e não aceita novas pesagens.')
            if a['birth_date'] and s['date']<a['birth_date']: raise ValidationError('A pesagem não pode ser anterior ao nascimento.')
            if a['status']!='ativo': raise ValidationError('Somente animais ativos podem receber novas pesagens.')
            weight=number(d.get('weight'),'Peso'); id=uid()
            self.db.execute('INSERT INTO weighings VALUES(?,?,?,?,?,?,?)',(id,s['id'],a['id'],s['date'],weight,str(d.get('notes',''))[:2000],now()))
        elif action=='group.save':
            kind=d.get('kind')
            if kind not in ('collective','group'): raise ValidationError('Tipo de grupo inválido.')
            id=uid(); self.db.execute('INSERT INTO groups VALUES(?,?,?,?,?)',(id,required(d.get('name'),'Nome'),kind,str(d.get('location',''))[:200],now()))
        elif action=='group.members':
            id=d['id']; group=self.one('groups',id); ids=list(dict.fromkeys(d.get('animal_ids',[])))
            for aid in ids: self.one('animals',aid)
            if group['kind']=='collective':
                conflicts=self.rows("SELECT m.animal_id FROM memberships m JOIN groups g ON g.id=m.group_id WHERE g.kind='collective' AND g.id<>?",(id,))
                if any(c['animal_id'] in ids for c in conflicts) and not d.get('transfer'):
                    raise ValidationError('Há animais em outro grupo coletivo. Confirme a transferência.')
                if d.get('transfer'):
                    for aid in ids:
                        self.db.execute("DELETE FROM memberships WHERE animal_id=? AND group_id IN(SELECT id FROM groups WHERE kind='collective')",(aid,))
            self.db.execute('DELETE FROM memberships WHERE group_id=?',(id,))
            self.db.executemany('INSERT INTO memberships VALUES(?,?)',[(id,aid) for aid in ids])
        elif action=='list.save':
            categories=[required(c,'Categoria',80) for c in d.get('categories',[])]
            if not 2<=len(categories)<=20 or len(set(categories))!=len(categories): raise ValidationError('Informe entre 2 e 20 categorias diferentes.')
            id=uid(); self.db.execute('INSERT INTO lists VALUES(?,?,?,?)',(id,required(d.get('name'),'Nome'),json.dumps(categories),now()))
        elif action=='list.assign':
            id=d['id']; l=self.one('lists',id)
            if d.get('category') not in json.loads(l['categories']): raise ValidationError('Categoria inválida.')
            for aid in list(dict.fromkeys(d.get('animal_ids',[]))):
                self.one('animals',aid); self.db.execute('INSERT INTO classifications VALUES(?,?,?) ON CONFLICT(list_id,animal_id) DO UPDATE SET category=excluded.category',(id,aid,d['category']))
        elif action=='field.save':
            type=d.get('type')
            if type not in ('text','number','date','select'): raise ValidationError('Tipo de campo inválido.')
            options=d.get('options',[])
            if type=='select' and (not options or not all(isinstance(v,str) and v.strip() for v in options)): raise ValidationError('Informe as opções do campo.')
            id=uid(); self.db.execute('INSERT INTO fields VALUES(?,?,?,?)',(id,required(d.get('name'),'Nome',80),type,json.dumps(options)))
        elif action=='filter.save':
            definition=d.get('definition',{})
            if not isinstance(definition,dict) or definition.get('mode','all') not in ('all','any'): raise ValidationError('Filtro inválido.')
            matches({},definition)
            id=uid(); self.db.execute('INSERT INTO filters VALUES(?,?,?)',(id,required(d.get('name'),'Nome'),json.dumps(definition)))
        elif action=='health.save':
            id=uid(); self.one('animals',d['animal_id'])
            self.db.execute('INSERT INTO health_events VALUES(?,?,?,?,?)',(id,d['animal_id'],required(d.get('name'),'Procedimento'),valid_date(d.get('date')),str(d.get('notes',''))[:2000]))
        elif action=='import.animals': return self.import_animals(d)
        else: raise ValidationError('Operação não reconhecida.')
        self.audit(action,id); return {'id':id}
    def import_animals(self,d):
        text=d.get('csv','')
        if not isinstance(text,str) or len(text)>1_000_000: raise ValidationError('O CSV deve ter até 1 MB.')
        reader=csv.DictReader(io.StringIO(text.lstrip('\ufeff')),delimiter=';')
        if not reader.fieldnames or not {'vid','eid'}&set(reader.fieldnames): raise ValidationError('Inclua a coluna vid ou eid. Use ponto e vírgula como separador.')
        if any(k not in ANIMAL_FIELDS for k in reader.fieldnames): raise ValidationError('O arquivo contém colunas desconhecidas. Use o modelo.')
        rows=list(reader)
        if not rows or len(rows)>5000: raise ValidationError('Importe de 1 a 5.000 linhas.')
        # SAVEPOINT preview runs exact domain validation then rolls back.
        self.db.execute('SAVEPOINT preview')
        errors=[]
        try:
            for i,row in enumerate(rows,2):
                try: self.save_animal(row)
                except (ValidationError,sqlite3.IntegrityError,LookupError) as e: errors.append({'line':i,'message':str(e)})
        finally:
            self.db.execute('ROLLBACK TO preview'); self.db.execute('RELEASE preview')
        if errors: return {'valid':False,'errors':errors,'count':len(rows)}
        if not d.get('confirm'): return {'valid':True,'errors':[],'count':len(rows)}
        for row in rows: self.save_animal(row)
        self.audit('import.completed',str(len(rows))); return {'valid':True,'imported':len(rows)}
