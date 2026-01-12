-- 1. Assicuriamoci che la RLS sia attiva
ALTER TABLE public.group_invites ENABLE ROW LEVEL SECURITY;

-- 2. Pulizia policy precedenti (per evitare duplicati o errori)
DROP POLICY IF EXISTS "Gli utenti possono vedere i propri inviti" ON public.group_invites;
DROP POLICY IF EXISTS "I creatori possono vedere gli inviti inviati" ON public.group_invites;
DROP POLICY IF EXISTS "Permetti inserimento inviti" ON public.group_invites;

-- 3. Policy per chi riceve l'invito (Risolve il Forbidden 403)
-- Permette la lettura se l'email nel JWT corrisponde a invited_email
CREATE POLICY "Gli utenti possono vedere i propri inviti"
ON public.group_invites
FOR SELECT
TO authenticated
USING (
  invited_email = (auth.jwt() ->> 'email')
);

-- 4. Policy per chi ha inviato l'invito
-- Permette la lettura a chi ha creato l'invito (colonna invited_by)
CREATE POLICY "I creatori possono vedere gli inviti inviati"
ON public.group_invites
FOR SELECT
TO authenticated
USING (
  invited_by = auth.uid()
);

-- 5. Policy per permettere la creazione di nuovi inviti
CREATE POLICY "Permetti inserimento inviti"
ON public.group_invites
FOR INSERT
TO authenticated
WITH CHECK (
  invited_by = auth.uid()
);