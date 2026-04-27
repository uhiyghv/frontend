-- 1. Fix group_members admin policy (self-join bug -> privilege escalation)
DROP POLICY IF EXISTS "Group admins can manage members" ON public.group_members;

CREATE POLICY "Group owners and admins can manage members"
ON public.group_members
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = group_members.group_id AND g.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = group_members.group_id
      AND gm.user_id = auth.uid()
      AND gm.role = 'admin'
      AND gm.accepted_at IS NOT NULL
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = group_members.group_id AND g.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = group_members.group_id
      AND gm.user_id = auth.uid()
      AND gm.role = 'admin'
      AND gm.accepted_at IS NOT NULL
  )
);

-- 2. Allow group members to view each other's membership rows
DROP POLICY IF EXISTS "Members can view group members" ON public.group_members;

CREATE POLICY "Members can view fellow group members"
ON public.group_members
FOR SELECT
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = group_members.group_id AND g.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = group_members.group_id
      AND gm.user_id = auth.uid()
      AND gm.accepted_at IS NOT NULL
  )
);

-- 3. Add Realtime authorization on realtime.messages
-- Restrict broadcast/presence channels: only allow channels named after the user's id
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read own user channel" ON realtime.messages;
CREATE POLICY "Authenticated can read own user channel"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (SELECT realtime.topic()) = 'notifications-' || auth.uid()::text
);

DROP POLICY IF EXISTS "Authenticated can write own user channel" ON realtime.messages;
CREATE POLICY "Authenticated can write own user channel"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT realtime.topic()) = 'notifications-' || auth.uid()::text
);