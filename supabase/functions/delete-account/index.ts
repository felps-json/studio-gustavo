import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

// Exclusão de conta exigida pela Apple (5.1.1(v)) e pelo Google Play.
// O próprio usuário logado chama esta função pelo app.
serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 1. Descobre quem está pedindo a exclusão pelo token de login
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      return json({ error: 'Não autenticado.' }, 401)
    }

    // 2. Apaga/anonimiza os dados numa única transação (migration 20261020000000_exclusao_conta)
    const { error: dataError } = await supabase.rpc('delete_account_data', { p_user_id: user.id })
    if (dataError) {
      const status = dataError.code === 'GS003' ? 403 : 500
      return json({ error: dataError.message, code: dataError.code }, status)
    }

    // 3. Remove o login. Se falhar, os dados já foram apagados e a chamada pode ser repetida com segurança.
    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id)
    if (deleteError) throw deleteError

    return json({ success: true })
  } catch (error) {
    console.error('delete-account:', error)
    return json({ error: error.message }, 500)
  }
})
