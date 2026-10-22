"""Regras de domínio independentes da interface e do transporte HTTP."""
from datetime import datetime, date
import math

class ValidationError(ValueError):
    pass

def required(value, label, limit=200):
    value = str(value or '').strip()
    if not value or len(value) > limit:
        raise ValidationError(f'{label}: informe de 1 a {limit} caracteres.')
    return value

def number(value, label, minimum=0, maximum=5000):
    try:
        n = float(str(value).replace(',', '.'))
    except (ValueError, TypeError):
        raise ValidationError(f'{label}: informe um número válido.')
    if not math.isfinite(n) or not minimum < n <= maximum:
        raise ValidationError(f'{label}: o valor deve ser maior que {minimum} e até {maximum}.')
    return round(n, 3)

def valid_date(value):
    try:
        d = date.fromisoformat(value)
    except (ValueError, TypeError):
        raise ValidationError('Informe uma data válida no formato AAAA-MM-DD.')
    if d > date.today():
        raise ValidationError('A data não pode estar no futuro.')
    return d.isoformat()

def gmd(current, previous):
    if not previous: return None
    days = (date.fromisoformat(current['date']) - date.fromisoformat(previous['date'])).days
    return (current['weight'] - previous['weight']) / days if days > 0 else None

def metrics(rows):
    weights = [r['weight'] for r in rows if r.get('weight') is not None]
    gains = [r['gmd'] for r in rows if r.get('gmd') is not None]
    return dict(count=len(rows), weighed=len(weights), total=sum(weights),
                average=sum(weights)/len(weights) if weights else None,
                minimum=min(weights) if weights else None, maximum=max(weights) if weights else None,
                gmd=sum(gains)/len(gains) if gains else None, gmd_count=len(gains))

def matches(animal, filters):
    checks=[]
    for f in filters.get('conditions', []):
        field, op, value = f.get('field'), f.get('op'), f.get('value')
        if field not in ('weight','gmd','breed','sex','status','vid','eid','pasture','supplier'):
            raise ValidationError('Campo de filtro inválido.')
        if op not in ('eq','contains','gte','lte'): raise ValidationError('Operador inválido.')
        actual=animal.get(field)
        if actual is None: checks.append(False); continue
        if op in ('gte','lte'):
            try:
                a, v=float(actual),float(value)
                checks.append(a >= v if op=='gte' else a <= v)
            except (ValueError,TypeError): raise ValidationError('O filtro exige um número.')
        else:
            a,v=str(actual).casefold(),str(value).casefold()
            checks.append(a==v if op=='eq' else v in a)
    return (any(checks) if filters.get('mode')=='any' else all(checks)) if checks else True
