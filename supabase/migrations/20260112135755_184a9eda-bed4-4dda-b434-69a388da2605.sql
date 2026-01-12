-- Fix RLS policies for group_invites to resolve 403 errors
-- First, drop existing policies that may conflict
DROP POLICY IF EXISTS "Gli utenti possono vedere i propri inviti" ON public.group_invites;
DROP POLICY IF EXISTS "I creatori possono vedere gli inviti inviati" ON public.group_invites;
DROP POLICY IF EXISTS "Permetti inserimento inviti" ON public.group_invites;
DROP POLICY IF EXISTS "Invited users can view their invites" ON public.group_invites;
DROP POLICY IF EXISTS "Group admins can manage invites" ON public.group_invites;

-- Ensure RLS is enabled
ALTER TABLE public.group_invites ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can view invites sent TO their email
CREATE POLICY "Users can view invites for their email"
ON public.group_invites
FOR SELECT
TO authenticated
USING (
  invited_email = (auth.jwt() ->> 'email')
);

-- Policy 2: Group owners and admins can view all invites for their groups
CREATE POLICY "Group owners can view group invites"
ON public.group_invites
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = group_invites.group_id AND g.owner_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = group_invites.group_id
    AND gm.user_id = auth.uid()
    AND gm.role IN ('admin', 'editor')
    AND gm.accepted_at IS NOT NULL
  )
);

-- Policy 3: Group owners and admins can insert invites
CREATE POLICY "Group owners can create invites"
ON public.group_invites
FOR INSERT
TO authenticated
WITH CHECK (
  invited_by = auth.uid()
  AND (
    EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = group_invites.group_id AND g.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_invites.group_id
      AND gm.user_id = auth.uid()
      AND gm.role IN ('admin', 'editor')
      AND gm.accepted_at IS NOT NULL
    )
  )
);

-- Policy 4: Users can update invites (for accepting/declining)
CREATE POLICY "Users can update their own invites"
ON public.group_invites
FOR UPDATE
TO authenticated
USING (
  invited_email = (auth.jwt() ->> 'email')
  OR invited_by = auth.uid()
);

-- Policy 5: Group owners can delete invites
CREATE POLICY "Group owners can delete invites"
ON public.group_invites
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = group_invites.group_id AND g.owner_id = auth.uid()
  )
  OR invited_by = auth.uid()
);