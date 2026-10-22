PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS animals (
 id TEXT PRIMARY KEY, vid TEXT, eid TEXT, breed TEXT NOT NULL DEFAULT '', sex TEXT NOT NULL DEFAULT '',
 birth_date TEXT, status TEXT NOT NULL DEFAULT 'ativo', pasture TEXT NOT NULL DEFAULT '',
 supplier TEXT NOT NULL DEFAULT '', buyer TEXT NOT NULL DEFAULT '', mother_id TEXT REFERENCES animals(id),
 father_id TEXT REFERENCES animals(id), notes TEXT NOT NULL DEFAULT '', custom TEXT NOT NULL DEFAULT '{}',
 created_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
 CHECK (vid IS NOT NULL OR eid IS NOT NULL));
CREATE UNIQUE INDEX IF NOT EXISTS animal_vid ON animals(vid) WHERE vid IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS animal_eid ON animals(eid) WHERE eid IS NOT NULL;
CREATE TABLE IF NOT EXISTS sessions (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, date TEXT NOT NULL, kind TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'aberta', notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS weighings (
 id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id), animal_id TEXT NOT NULL REFERENCES animals(id),
 date TEXT NOT NULL, weight REAL NOT NULL CHECK(weight>0 AND weight<=5000), notes TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL, UNIQUE(session_id,animal_id));
CREATE INDEX IF NOT EXISTS weighing_history ON weighings(animal_id,date);
CREATE TABLE IF NOT EXISTS groups (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('collective','group')),
 location TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS memberships (
 group_id TEXT REFERENCES groups(id), animal_id TEXT REFERENCES animals(id), PRIMARY KEY(group_id,animal_id));
CREATE TRIGGER IF NOT EXISTS collective_unique BEFORE INSERT ON memberships
WHEN (SELECT kind FROM groups WHERE id=NEW.group_id)='collective'
AND EXISTS (SELECT 1 FROM memberships m JOIN groups g ON g.id=m.group_id WHERE m.animal_id=NEW.animal_id AND g.kind='collective')
BEGIN SELECT RAISE(ABORT,'animal_already_in_collective'); END;
CREATE TABLE IF NOT EXISTS lists (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, categories TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS classifications (
 list_id TEXT REFERENCES lists(id), animal_id TEXT REFERENCES animals(id), category TEXT NOT NULL,
 PRIMARY KEY(list_id,animal_id));
CREATE TABLE IF NOT EXISTS fields (
 id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, type TEXT NOT NULL, options TEXT NOT NULL DEFAULT '[]');
CREATE TABLE IF NOT EXISTS filters (id TEXT PRIMARY KEY,name TEXT NOT NULL,definition TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS health_events (
 id TEXT PRIMARY KEY, animal_id TEXT NOT NULL REFERENCES animals(id), name TEXT NOT NULL,date TEXT NOT NULL,notes TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT,at TEXT NOT NULL,action TEXT NOT NULL,entity_id TEXT NOT NULL,actor_id TEXT NOT NULL DEFAULT 'bonanca-service');
