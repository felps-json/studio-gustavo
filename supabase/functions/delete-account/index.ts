import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
      return new Response(JSON.stringify({ error: 'Não autenticado.' }), { status: 401, headers: { "Content-Type": "application/json" } })
    }

    // 2. A conta do barbeiro não pode ser apagada pelo app (perderia o acesso ao painel)
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role === 'admin') {
      return new Response(JSON.stringify({ error: 'Conta de administrador não pode ser excluída pelo app.' }), { status: 403, headers: { "Content-Type": "application/json" } })
    }

    // 3. Agendamentos futuros são apagados (libera os horários)
    const today = new Date().toISOString().split('T')[0]
    const { error: futureError } = await supabase
      .from('appointments')
      .delete()
      .eq('user_id', user.id)
      .gte('date', today)
    if (futureError) throw futureError

    // 4. Agendamentos antigos são anonimizados para manter o faturamento dos relatórios.
    //    Se a coluna user_id não aceitar NULL, eles são apagados.
    const { error: anonError } = await supabase
      .from('appointments')
      .update({ user_id: null, client_name: 'Cliente excluído' })
      .eq('user_id', user.id)
    if (anonError) {
      const { error: pastError } = await supabase.from('appointments').delete().eq('user_id', user.id)
      if (pastError) throw pastError
    }

    // 5. Remove o perfil e, por fim, o usuário de login
    const { error: profileError } = await supabase.from('profiles').delete().eq('id', user.id)
    if (profileError) throw profileError

    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id)
    if (deleteError) throw deleteError

    return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } })
  }
})
