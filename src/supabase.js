import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://gxsxfrffaenvtcfqahtv.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_vGZFakpUzZYWJWrO1THbUQ_b9MXP-2q'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)