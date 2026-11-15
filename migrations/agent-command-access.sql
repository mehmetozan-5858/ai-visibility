-- Apply after agent-command-ledger.sql in an isolated migration environment first.
-- Group roles only: no login, password, customer grant or agent identity is issued.
BEGIN;
DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='agent_command_reader') THEN
  CREATE ROLE agent_command_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='agent_command_writer') THEN
  CREATE ROLE agent_command_writer NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('agent_command_reader','agent_command_writer')
  AND (rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)) THEN
  RAISE EXCEPTION 'Unexpected existing command role privileges';
 END IF;
END $$;
GRANT USAGE ON SCHEMA public TO agent_command_reader,agent_command_writer;
GRANT SELECT ON public.agent_command_ledger TO agent_command_reader;
GRANT SELECT,INSERT ON public.agent_command_ledger TO agent_command_writer;
COMMIT;
