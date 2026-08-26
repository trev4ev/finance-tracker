update public.transactions as t
set
  type = 'transfer',
  category_id = c.id
from public.categories as c
where c.user_id = t.user_id
  and c.name = 'Transfers'
  and c.kind = 'expense'
  and lower(coalesce(t.description, ''))
    ~ 'automatic payment|autopay payment|autopay pymt|payment - thank';
